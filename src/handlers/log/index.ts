import { EmbedBuilder, type Client, type Message } from "discord.js";

const cut = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

/**
 * Sends a record of one conversation turn (user message + bot reply)
 * to a private log channel, or to the owner's DMs if no channel is set.
 * Never throws: a logging failure must not break the bot.
 */
export async function logConversation(
  client: Client,
  message: Message,
  text: string,
  reply: string,
): Promise<void> {
  const logChannelId = process.env.LOG_CHANNEL_ID;
  const ownerId = process.env.OWNER_ID;
  const logDMs = process.env.LOG_DMS !== "off";

  if (!logChannelId && !ownerId) return;
  if (!message.inGuild() && !logDMs) return;

  try {
    const where = message.inGuild()
      ? `${message.guild.name} › #${message.channel.name}`
      : "DM";

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.displayName} (${message.author.id})`,
        iconURL: message.author.displayAvatarURL(),
      })
      .addFields(
        { name: "User", value: cut(text, 1024) || "—" },
        { name: "Pixy", value: cut(reply, 1024) },
      )
      .setFooter({ text: where })
      .setTimestamp(message.createdAt);

    if (logChannelId) {
      const channel = await client.channels.fetch(logChannelId);
      if (channel?.isTextBased() && "send" in channel) {
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      }
    } else if (ownerId) {
      const owner = await client.users.fetch(ownerId);
      await owner.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("Log error:", err);
  }
}
