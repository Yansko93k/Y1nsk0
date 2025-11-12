import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { registerLogs, logChannels } from './logs.js';
import { registerTickets, ticketCategory } from './tickets.js';
import { registerCaptcha, welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from './captcha.js';
import { registerCommands } from './commands/index.js';
import { loadAllConfigs, saveGuildConfig } from './storage.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Map();

// --- Chargement automatique des configs sauvegardées ---
const allConfigs = loadAllConfigs();
for (const [guildId, cfg] of Object.entries(allConfigs)) {
  if (cfg.log) logChannels.set(guildId, cfg.log);
  if (cfg.welcome) welcomeChannels.set(guildId, cfg.welcome);
  if (cfg.captcha) captchaChannels.set(guildId, cfg.captcha);
  if (cfg.roleNon) rolesNonVerif.set(guildId, cfg.roleNon);
  if (cfg.roleVerif) rolesVerif.set(guildId, cfg.roleVerif);
  if (cfg.ticketCat) ticketCategory.set(guildId, cfg.ticketCat);
}
// ---------------------------------------------------------

// Serveur web minimal (pour Render)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('✅ Bot en ligne !'));
app.listen(PORT, () => console.log(`🌐 Serveur web démarré sur le port ${PORT}`));

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Erreur : token Discord non défini dans .env');
  process.exit(1);
}

// Enregistrement des fonctionnalités
registerLogs(client);
registerTickets(client);
registerCaptcha(client);
registerCommands(client);

// Sécurisation des erreurs non gérées
process.on('unhandledRejection', err => {
  console.error('🚨 Erreur non gérée :', err);
});
process.on('uncaughtException', err => {
  console.error('🔥 Exception non interceptée :', err);
});

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.login(token);
