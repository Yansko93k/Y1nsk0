import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'fs/promises';
import path from 'path';

const commands = [];

// Chemin correct vers le dossier des commandes
const folder = path.join(process.cwd(), 'src', 'commands');
const files = await readdir(folder);

for (const file of files) {
  if (!file.endsWith('.js') || file === 'index.js') continue;

  try {
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

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN ou CLIENT_ID non défini');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

try {
  console.log('🚀 Déploiement des commandes...');
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
  }
  console.log('✅ Commandes déployées !');
} catch (err) {
  console.error('❌ Erreur lors du déploiement des commandes :', err);
}
