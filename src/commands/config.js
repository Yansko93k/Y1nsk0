import { SlashCommandBuilder } from 'discord.js';
import { logChannels } from '../logs.js';
import { welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from '../captcha.js';
import { ticketCategory } from '../tickets.js';
import { saveGuildConfig } from '../storage.js';

// Constantes fixes pour les tickets
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
  .addChannelOption(opt => opt.setName('ticketcat').setDescription('Catégorie tickets'));

export async function execute(interaction) {
  try {
    const guildId = interaction.guild.id;

    const log = interaction.options.getChannel('log')?.id || logChannels.get(guildId);
    const welcome = interaction.options.getChannel('welcome')?.id || welcomeChannels.get(guildId);
    const captcha = interaction.options.getChannel('captcha')?.id || captchaChannels.get(guildId);
    const roleNon = interaction.options.getRole('nonverif')?.id || rolesNonVerif.get(guildId);
    const roleVerif = interaction.options.getRole('verif')?.id || rolesVerif.get(guildId);
    const ticketCat = interaction.options.getChannel('ticketcat')?.id || ticketCategory.get(guildId);

    // Mise à jour des Maps en mémoire
    if (log) logChannels.set(guildId, log);
    if (welcome) welcomeChannels.set(guildId, welcome);
    if (captcha) captchaChannels.set(guildId, captcha);
    if (roleNon) rolesNonVerif.set(guildId, roleNon);
    if (roleVerif) rolesVerif.set(guildId, roleVerif);
    if (ticketCat) ticketCategory.set(guildId, ticketCat);

    // Sauvegarde persistante
    saveGuildConfig(guildId, { log, welcome, captcha, roleNon, roleVerif, ticketCat });

    // Réponse à l'utilisateur
    await interaction.reply({
      content: '✅ Configuration mise à jour et sauvegardée !',
      flags: 64, // remplace ephemeral: true
    });
  } catch (err) {
    console.error('Erreur dans /config :', err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: '❌ Une erreur est survenue lors de la configuration.',
        flags: 64,
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la configuration.',
        flags: 64,
      }).catch(() => {});
    }
  }
}
