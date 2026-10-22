import { Events, Message, type Client } from "discord.js";

export default function registerMessageHandler(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (message.channel.partial) {
        await message.channel.fetch();
      }

      if (message.inGuild()) {
        console.log("The message was sent in a guild: ", {
          message: message.content,
          where: message.channel.name,
          at: message.guild.name,
          from: message.author.displayName,
          when: message.createdAt.toLocaleString("pt-br"),
        });
      } else {
        console.log("The message was sent in a DM: ", {
          message: message.content,
          from: message.author.displayName,
          when: message.createdAt.toLocaleString("pt-br"),
        });
      }
    } catch (error: any) {
      console.log("Ocorreu um erro: ", error);
    }
  });
}
