// ======================
// Serveur web Express
// ======================
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot en ligne !'));

app.listen(PORT, () => {
  console.log(`Serveur web démarré sur le port ${PORT}`);
});

// ======================
// Bot Discord
// ======================
import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdir } from 'fs/promises';
import path from 'path';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.commands = new Collection();

// ======================
// Connexion sécurisée
// ======================
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Erreur : le token Discord n'est pas défini !");
  process.exit(1); // Arrête le bot si pas de token
}

client.login(token);

client.on('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag} !`);
});

// ======================
// Exemple lecture commandes (si tu veux ajouter des commandes)
// ======================
const commandsPath = path.join(process.cwd(), 'commands');
(async () => {
  try {
    const commandFiles = await readdir(commandsPath);
    for (const file of commandFiles) {
      if (file.endsWith('.js')) {
        const filePath = path.join(commandsPath, file);
        const command = (await import(filePath)).default;
        client.commands.set(command.data.name, command);
      }
    }
    console.log(`Commandes chargées : ${client.commands.size}`);
  } catch (err) {
    console.warn("Aucune commande à charger ou dossier 'commands' introuvable.");
  }
})();
