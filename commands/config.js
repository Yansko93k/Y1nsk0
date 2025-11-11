// commands/config.js
import { SlashCommandBuilder } from 'discord.js';
import { logChannels } from '../logs.js';
import { welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from '../captcha.js';
import { ticketCategory } from '../tickets.js';

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

  if (log) logChannels.set(guildId, log);
  if (welcome) welcomeChannels.set(guildId, welcome);
  if (captcha) captchaChannels.set(guildId, captcha);
  if (roleNon) rolesNonVerif.set(guildId, roleNon);
  if (roleVerif) rolesVerif.set(guildId, roleVerif);
  if (ticketCat) ticketCategory.set(guildId, ticketCat);

  await interaction.reply({ content: 'Configuration mise à jour !', ephemeral: true });
}
