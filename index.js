import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';
import { registerLogs } from './logs.js';
import { registerTickets } from './tickets.js';
import { registerCaptcha } from './captcha.js';
import { registerCommands } from './commands/index.js';

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

client.commands = new Map();

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot en ligne !'));
app.listen(PORT, () => console.log(`Serveur web démarré sur le port ${PORT}`));

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Erreur : token Discord non défini');
  process.exit(1);
}

registerLogs(client);
registerTickets(client);
registerCaptcha(client);
registerCommands(client);

client.once('ready', () => console.log(`Connecté en tant que ${client.user.tag}`));

client.login(token);
