import { Events, type Client, type Message } from "discord.js";

const IDLE_AFTER_MS = Number(process.env.IDLE_AFTER_MIN ?? 10) * 60_000;
const MODE = process.env.PRESENCE_MODE ?? "all"; // "all" | "mentions"

export default function registerPresenceHandler(client: Client) {
  let current: "online" | "idle" | null = null;
  let timer: NodeJS.Timeout | undefined;

  // only talks to Discord when the status actually changes (presence updates are rate limited)
  const setStatus = (status: "online" | "idle") => {
    if (!client.user || current === status) return;
    current = status;
    client.user.setPresence({ status, activities: [] });
  };

  const scheduleIdle = () => {
    clearTimeout(timer);
    const jitter = 0.8 + Math.random() * 0.4; // goes idle a bit earlier or later each time
    timer = setTimeout(() => setStatus("idle"), IDLE_AFTER_MS * jitter);
  };

  // activity detected: go online and restart the countdown
  const touch = () => {
    setStatus("online");
    scheduleIdle();
  };

  // is this message addressed to the bot? (DM or @mention)
  const isAddressed = (message: Message) =>
    !message.inGuild() ||
    (!!client.user &&
      message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true }));

  client.on(Events.MessageCreate, (message: Message) => {
    const fromSelf = message.author.id === client.user?.id;
    if (message.author.bot && !fromSelf) return; // ignore other bots

    if (!fromSelf && MODE === "mentions" && !isAddressed(message)) return;

    touch();
  });

  // starts online with the idle countdown running
  if (client.isReady()) touch();
  else client.once(Events.ClientReady, touch);
}