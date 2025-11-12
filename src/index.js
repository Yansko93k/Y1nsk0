import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { registerLogs, logChannels } from './logs.js';
import { registerTickets, ticketCategory } from './tickets.js';
import { registerCaptcha, welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from './captcha.js';
import { registerCommands } from './commands/index.js';
import { loadAllConfigs } from './storage.js';

export let SUPPORT_ROLE_ID = null; // dynamique

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

// --- Chargement automatique des configs depuis SQLite ---
const allConfigs = loadAllConfigs();
for (const [guildId, cfg] of Object.entries(allConfigs)) {
  if (cfg.log) logChannels.set(guildId, cfg.log);
  if (cfg.welcome) welcomeChannels.set(guildId, cfg.welcome);
  if (cfg.captcha) captchaChannels.set(guildId, cfg.captcha);
  if (cfg.roleNon) rolesNonVerif.set(guildId, cfg.roleNon);
  if (cfg.roleVerif) rolesVerif.set(guildId, cfg.roleVerif);
  if (cfg.ticketCat) ticketCategory.set(guildId, cfg.ticketCat);
  if (cfg.supportRoleId) SUPPORT_ROLE_ID = cfg.supportRoleId;
}
// ---------------------------------------------------------

// Serveur web minimal (pour Render)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('✅ Bot en ligne !'));
app.listen(PORT, () => console.log(`🌐 Serveur web démarré sur le port ${PORT}`));

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Token Discord non défini');
  process.exit(1);
}

// Enregistrement des fonctionnalités
registerLogs(client);
registerTickets(client);
registerCaptcha(client);
registerCommands(client);

// Gestion des erreurs
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.once('ready', () => console.log(`✅ Connecté en tant que ${client.user.tag}`));

client.login(token);
