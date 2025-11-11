import 'dotenv/config'; // Charge les variables d'environnement
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'fs/promises';
import path from 'path';

const commands = [];

// Chemin vers le dossier des commandes
const folder = path.join(process.cwd(), 'src', 'commands');
const files = await readdir(folder);

for (const file of files) {
  // On ignore index.js qui sert à registerCommands
  if (!file.endsWith('.js') || file === 'index.js') continue;

  try {
    // Import dynamique correct pour Node ES Modules
    const filePath = path.join(folder, file);
    const command = await import(`file://${filePath}`);
    if (!command.data) {
      console.warn(`⚠️ Le fichier ${file} n'exporte pas de "data"`);
      continue;
    }
    commands.push(command.data.toJSON());
  } catch (err) {
    console.error(`❌ Erreur en important ${file}:`, err);
  }
}

// Variables d'environnement
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('❌ DISCORD_TOKEN non défini !');
  process.exit(1);
}
if (!clientId) {
  console.error('❌ CLIENT_ID non défini !');
  process.exit(1);
}

// Création du REST client
const rest = new REST({ version: '10' }).setToken(token);

try {
  console.log('🚀 Déploiement des commandes...');
  if (guildId) {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Commandes déployées sur le serveur !');
  } else {
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('✅ Commandes globales déployées !');
  }
} catch (error) {
  console.error('❌ Erreur lors du déploiement des commandes :', error);
}
