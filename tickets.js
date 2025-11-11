import { PermissionsBitField, ChannelType } from 'discord.js';
import { sendLog } from './logs.js';

export const ticketCategory = new Map();
export const openTickets = new Map();

export async function handleTicket(interaction) {
  const guild = interaction.guild;
  const userId = interaction.user.id;
  const categoryId = ticketCategory.get(guild.id);
  if (!categoryId) return interaction.reply({ content: 'Catégorie ticket non définie.', ephemeral: true });

  if (openTickets.has(userId)) return interaction.reply({ content: 'Vous avez déjà un ticket ouvert !', ephemeral: true });

  const channel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  openTickets.set(userId, channel.id);
  interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
  sendLog(interaction.client, guild.id, { action: 'Ticket créé', user: interaction.user });
}

export function registerTickets(client) {
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ticket') {
      await handleTicket(interaction);
    }
  });
}
