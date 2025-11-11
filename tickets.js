import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionsBitField, 
  ChannelType 
} from 'discord.js';
import { sendLog } from './logs.js';
import { TICKET_CATEGORY_ID, SUPPORT_ROLE_ID, TICKET_MESSAGE_CHANNEL_ID } from './config.js';

export const ticketCategory = new Map();
export const openTickets = new Map();

// Crée ou ouvre un ticket via commande
export async function handleTicket(interaction) {
  const guild = interaction.guild;
  const userId = interaction.user.id;
  const categoryId = ticketCategory.get(guild.id) || TICKET_CATEGORY_ID;

  if (!categoryId) return interaction.reply({ content: 'Catégorie ticket non définie.', ephemeral: true });
  if (openTickets.has(userId)) return interaction.reply({ content: 'Vous avez déjà un ticket ouvert !', ephemeral: true });

  const channel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  openTickets.set(userId, channel.id);
  await interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
  sendLog(interaction.client, guild.id, { action: 'Ticket créé', user: interaction.user });
}

// Enregistrement des tickets (commande + bouton)
export function registerTickets(client) {

  // Gestion des commandes
  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
      await handleTicket(interaction);
    }

    // Gestion des boutons
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
      const guild = interaction.guild;
      if (!guild) return;

      // Vérifie si l'utilisateur a déjà un ticket ouvert
      const existingChannel = guild.channels.cache.find(
        c => c.name === `ticket-${interaction.user.id}`
      );
      if (existingChannel) return interaction.reply({ content: 'Vous avez déjà un ticket ouvert !', ephemeral: true });

      // Crée le salon dans la catégorie ticket
      const channel = await guild.channels.create({
        name: `ticket-${interaction.user.id}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
      });

      openTickets.set(interaction.user.id, channel.id);
      await interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
      sendLog(client, guild.id, { action: 'Ticket créé via bouton', user: interaction.user });

      await channel.send({ content: `Bonjour ${interaction.user}, un membre du support va vous aider bientôt !` });
    }
  });

  // Message avec bouton au démarrage
  client.on('ready', async () => {
    const channel = client.channels.cache.get(TICKET_MESSAGE_CHANNEL_ID);
    if (!channel) return console.log('Salon pour le message ticket introuvable');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('Ouvrir un ticket')
        .setStyle(ButtonStyle.Primary)
    );

    const fetchedMessages = await channel.messages.fetch({ limit: 10 });
    const botMessage = fetchedMessages.find(m => m.author.id === client.user.id && m.components.length > 0);
    if (!botMessage) {
      await channel.send({ content: 'Cliquez sur le bouton pour ouvrir un ticket', components: [row] });
    }
  });
}
