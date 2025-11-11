import 'dotenv/config'; // Assure le chargement des variables d'environnement locales
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'fs/promises';
import path from 'path';

const commands = [];
const folder = path.join(process.cwd(), 'commands');
const files = await readdir(folder);

for (const file of files) {
  if (!file.endsWith('.js')) continue;

  try {
    const command = await import(`./commands/${file}`);
    if (!command.data) {
      console.warn(`⚠️ Le fichier ${file} n'exporte pas de "data"`);
      continue;
    }
    commands.push(command.data.toJSON());
  } catch (err) {
    console.error(`❌ Erreur en important ${file}:`, err);
  }
}

// Récupération des variables d'environnement
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('❌ DISCORD_TOKEN non défini ! Ajoute-le dans ton .env ou dans Render.');
  process.exit(1);
}
if (!clientId) {
  console.error('❌ CLIENT_ID non défini ! Ajoute-le dans ton .env ou dans Render.');
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
