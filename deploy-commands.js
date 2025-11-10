import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdir } from 'fs/promises';
import path from 'path';


const commands = [];
const folder = path.join(process.cwd(), 'commands');
const files = await readdir(folder);
for (const file of files) {
if (!file.endsWith('.js')) continue;
const { data } = await import(`./commands/${file}`);
commands.push(data.toJSON());
}


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
try {
console.log('Déploiement des commandes...');
if (process.env.GUILD_ID) {
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
console.log('Commandes déployées sur le serveur !');
} else {
await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
console.log('Commandes globales déployées !');
}
} catch (error) {
console.error(error);
}