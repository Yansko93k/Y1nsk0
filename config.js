import { SlashCommandBuilder } from 'discord.js';
import { logChannels } from '../logs.js';
import { welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from '../captcha.js';
import { ticketCategory } from '../tickets.js';
import { saveGuildConfig } from '../storage.js';

// Constantes fixes pour les tickets
export const TICKET_CATEGORY_ID = 'ID_DE_LA_CATEGORIE_TICKETS'; // catégorie où les tickets seront créés
export const SUPPORT_ROLE_ID = 'ID_DU_ROLE_SUPPORT'; // rôle qui pourra voir tous les tickets
export const TICKET_MESSAGE_CHANNEL_ID = 'ID_DU_SALON_MESSAGES_TICKETS'; // salon où le message bouton sera envoyé

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configurer le bot')
  .addChannelOption(opt => opt.setName('log').setDescription('Salon des logs'))
  .addChannelOption(opt => opt.setName('welcome').setDescription('Salon de bienvenue'))
  .addChannelOption(opt => opt.setName('captcha').setDescription('Salon du captcha'))
  .addRoleOption(opt => opt.setName('nonverif').setDescription('Rôle Non vérifié'))
  .addRoleOption(opt => opt.setName('verif').setDescription('Rôle Vérifié'))
  .addChannelOption(opt => opt.setName('ticketcat').setDescription('Catégorie tickets'));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const log = interaction.options.getChannel('log')?.id;
  const welcome = interaction.options.getChannel('welcome')?.id;
  const captcha = interaction.options.getChannel('captcha')?.id;
  const roleNon = interaction.options.getRole('nonverif')?.id;
  const roleVerif = interaction.options.getRole('verif')?.id;
  const ticketCat = interaction.options.getChannel('ticketcat')?.id;

  // Sauvegarde dans le fichier JSON
  saveGuildConfig(guildId, { log, welcome, captcha, roleNon, roleVerif, ticketCat });

  // Mets à jour les Maps en mémoire
  if (log) logChannels.set(guildId, log);
  if (welcome) welcomeChannels.set(guildId, welcome);
  if (captcha) captchaChannels.set(guildId, captcha);
  if (roleNon) rolesNonVerif.set(guildId, roleNon);
  if (roleVerif) rolesVerif.set(guildId, roleVerif);
  if (ticketCat) ticketCategory.set(guildId, ticketCat);

  await interaction.reply({ content: 'Configuration mise à jour !', ephemeral: true });
}
