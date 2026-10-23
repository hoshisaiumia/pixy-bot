import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { config } from "dotenv";
import registerAiHandler from "./handlers/ai/index.js";
import registerPresenceHandler from "./handlers/presence/index.js";

config();

const app = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

registerPresenceHandler(app);
registerAiHandler(app);

app.once(Events.ClientReady, async () => {
  console.log(`[BOT] I'm online on Discord!`);
});

app.login(process.env.DISCORD_BOT_TOKEN);
