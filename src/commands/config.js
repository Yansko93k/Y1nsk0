import { SlashCommandBuilder } from 'discord.js';
import { logChannels } from '../logs.js';
import { welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from '../captcha.js';
import { ticketCategory } from '../tickets.js';
import { saveGuildConfig } from '../storage.js';

// Constantes par défaut
export const TICKET_CATEGORY_ID = '1309138297733517364';
export const SUPPORT_ROLE_ID = '1311063281838067712';
export const TICKET_MESSAGE_CHANNEL_ID = '1309245840778596362';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configurer le bot')
  .addChannelOption(opt => opt.setName('log').setDescription('Salon des logs'))
  .addChannelOption(opt => opt.setName('welcome').setDescription('Salon de bienvenue'))
  .addChannelOption(opt => opt.setName('captcha').setDescription('Salon du captcha'))
  .addRoleOption(opt => opt.setName('nonverif').setDescription('Rôle Non vérifié'))
  .addRoleOption(opt => opt.setName('verif').setDescription('Rôle Vérifié'))
  .addChannelOption(opt => opt.setName('ticketcat').setDescription('Catégorie tickets'))
  .addRoleOption(opt => opt.setName('support').setDescription('Rôle support'));

export async function execute(interaction) {
  try {
    // Défère la réponse immédiatement pour éviter l'erreur Unknown interaction
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;

    const log = interaction.options.getChannel('log')?.id || logChannels.get(guildId);
    const welcome = interaction.options.getChannel('welcome')?.id || welcomeChannels.get(guildId);
    const captcha = interaction.options.getChannel('captcha')?.id || captchaChannels.get(guildId);
    const roleNon = interaction.options.getRole('nonverif')?.id || rolesNonVerif.get(guildId);
    const roleVerif = interaction.options.getRole('verif')?.id || rolesVerif.get(guildId);
    const ticketCat = interaction.options.getChannel('ticketcat')?.id || ticketCategory.get(guildId);
    const supportRoleId = interaction.options.getRole('support')?.id;

    // Mise à jour des Maps
    if (log) logChannels.set(guildId, log);
    if (welcome) welcomeChannels.set(guildId, welcome);
    if (captcha) captchaChannels.set(guildId, captcha);
    if (roleNon) rolesNonVerif.set(guildId, roleNon);
    if (roleVerif) rolesVerif.set(guildId, roleVerif);
    if (ticketCat) ticketCategory.set(guildId, ticketCat);

    // Sauvegarde en DB
    saveGuildConfig(guildId, { log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId });

    await interaction.editReply({ content: '✅ Configuration mise à jour et sauvegardée !', flags: 64 });
  } catch (err) {
    console.error('Erreur dans /config :', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: '❌ Une erreur est survenue.' });
      } else {
        await interaction.reply({ content: '❌ Une erreur est survenue.', flags: 64 });
      }
    } catch {}
  }
}
