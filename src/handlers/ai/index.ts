import { Events, type Client, type Message } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import { logConversation } from "../log/index.js";
import { extractGifTag, searchGif } from "../gifs/index.js";
import { readFileSync } from "node:fs";
import "dotenv/config";

// imports the prompt from a separate file
const SYSTEM_PROMPT = readFileSync("prompt.txt", "utf-8");

// creates Google Model
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_TOKEN! });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

// model settings
type Turn = { role: "user" | "assistant"; content: string };
const history = new Map<string, Turn[]>();
const cooldown = new Map<string, number>();
const queues = new Map<string, Promise<void>>();
const MAX_TURNS = 10;
const COOLDOWN_MS = 3000;

// set REPLY_DELAYS=off in the .env to test without delays
const DELAYS_ENABLED = process.env.REPLY_DELAYS !== "off";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// how long before "starting to type" (as if reading / doing something else)
function readDelayMs(): number {
  if (!DELAYS_ENABLED) return 0;
  const r = Math.random();
  if (r < 0.08) return rand(15_000, 45_000); // distracted, away for a bit
  if (r < 0.3) return rand(4_000, 12_000); // busy with something
  return rand(800, 3_500); // normal
}

// how long the "typing..." indicator stays, based on reply length
function typingMs(reply: string): number {
  if (!DELAYS_ENABLED) return 0;
  const perChar = rand(40, 80);
  return Math.min(Math.max(reply.length * perChar, 1_200), 9_000);
}

// keeps the typing indicator alive (it expires after ~10s on its own)
function startTyping(channel: Message["channel"]): () => void {
  if (!("sendTyping" in channel)) return () => {};
  const ch = channel;
  ch.sendTyping().catch(() => {});
  const timer = setInterval(() => ch.sendTyping().catch(() => {}), 8_000);
  return () => clearInterval(timer);
}

// processes one message at a time per channel so the history never gets mixed up
function enqueue(channelId: string, task: () => Promise<void>) {
  const previous = queues.get(channelId) ?? Promise.resolve();
  const next: Promise<void> = previous.then(task, task).finally(() => {
    if (queues.get(channelId) === next) queues.delete(channelId);
  });
  queues.set(channelId, next);
}

async function generateReply(turns: Turn[]): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: turns.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    })),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 300,
      temperature: 1,
    },
  });
  return (res.text ?? "").trim();
}

export default function registerAiHandler(client: Client) {
  client.on(Events.MessageCreate, (message: Message) => {
    if (message.author.bot) return;

    const isDM = !message.inGuild();
    const mentioned =
      !!client.user &&
      message.mentions.has(client.user, {
        ignoreEveryone: true,
        ignoreRoles: true,
      });

    if (!isDM && !mentioned) return;

    const text = message.content.replace(/<@!?\d+>/g, "").trim();
    if (!text) return;

    const now = Date.now();
    if (now - (cooldown.get(message.author.id) ?? 0) < COOLDOWN_MS) return;
    cooldown.set(message.author.id, now);

    enqueue(message.channelId, async () => {
      let stopTyping = () => {};
      try {
        const name = message.author.displayName;
        const userTurn: Turn = {
          role: "user",
          content: isDM ? text : `${name}: ${text}`,
        };

        const turns = [
          ...(history.get(message.channelId) ?? []),
          userTurn,
        ].slice(-MAX_TURNS);
        while (turns[0]?.role === "assistant") turns.shift();

        // start the API call right away; it runs while the bot "reads" and "types"
        const result = generateReply(turns).then(
          (reply) => ({ reply }),
          (error) => ({ error }),
        );

        // 1) "reading" phase: no typing indicator yet
        await sleep(readDelayMs());

        // 2) "typing" phase
        stopTyping = startTyping(message.channel);
        const typingStart = Date.now();

        const out = await result;
        if ("error" in out) throw out.error;

        const reply = out.reply; // raw model output, may contain a [gif: ...] tag
        const { text: replyText, query: gifQuery } = extractGifTag(reply);

        // the gif search runs while the bot is "typing"
        const gifUrl = gifQuery ? await searchGif(gifQuery) : null;

        if (!replyText && !gifUrl) {
          await message
            .reply(
              "uhm, not sure what to say about that, let's talk about smth else pls",
            )
            .catch(() => {});
          return;
        }

        // keep "typing..." until a believable time has passed for this reply length
        const remaining =
          typingMs(replyText || "ok") - (Date.now() - typingStart);
        if (remaining > 0) await sleep(remaining);

        // history keeps the raw reply (with the tag) so the model sees how often it used gifs
        history.set(message.channelId, [
          ...turns,
          { role: "assistant", content: reply },
        ]);

        if (replyText) {
          await message.reply({
            content: replyText.slice(0, 2000),
            allowedMentions: { parse: [], repliedUser: false },
          });

          if (gifUrl && "send" in message.channel) {
            if (DELAYS_ENABLED) await sleep(rand(600, 1500)); // small pause, like picking a gif
            await message.channel.send({ content: gifUrl });
          }
        } else if (gifUrl) {
          // gif-only reply
          await message.reply({
            content: gifUrl,
            allowedMentions: { parse: [], repliedUser: false },
          });
        }

        void logConversation(
          client,
          message,
          text,
          gifUrl ? `${replyText}\n${gifUrl}`.trim() : replyText,
        );
      } catch (err: any) {
        console.error("AI error:", err);
        const msg =
          err?.status === 429
            ? "This is an automated response because I'm currently at sleep, please try messaging me later."
            : "I'm having a bad time rn, please talk to me again in a few minutes..";
        await message.reply(msg).catch(() => {});
      } finally {
        stopTyping();
      }
    });
  });
}
