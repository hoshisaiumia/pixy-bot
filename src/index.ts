import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import registerMessageHandler from "./handlers/message/index.js";
import { config } from "dotenv";

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

registerMessageHandler(app);

app.once(Events.ClientReady, async () => {
  console.log(`[BOT] I'm online on Discord!`);
});

app.login(process.env.DISCORD_BOT_TOKEN);
