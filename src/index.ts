import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";

config();

const app = new Client({
  intents: [
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
});

const main = async () => {
  await app.login(process.env.DISCORD_BOT_TOKEN);
  console.log("[BOT] I am online!");
};

main();
