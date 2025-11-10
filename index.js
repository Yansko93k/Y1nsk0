import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';


const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();


import { readdir } from 'fs/promises';
import path from 'path';