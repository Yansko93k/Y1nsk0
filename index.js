import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';
import { registerLogs } from './logs.js';
import { registerTickets } from './tickets.js';
import { registerCaptcha } from './captcha.js';
import { registerCommands } from './commands/config.js';


/** 
 * @type {import('discord.js').Client & { commands: Map<string, any> }} 
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Initialisation de la collection de commandes
client.commands = new Map();

// Serveur web pour Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot en ligne !'));
app.listen(PORT, () => console.log(`Serveur web démarré sur le port ${PORT}`));

// Vérification du token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Erreur : le token Discord n\'est pas défini !');
  process.exit(1);
}

// Enregistrement des modules
registerLogs(client);
registerTickets(client);
registerCaptcha(client);
registerCommands(client);

// Event ready
client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

// Login Discord
client.login(token);
