import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Chemin du dossier courant
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer le dossier data si inexistant
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Chemin vers la base SQLite
const dbPath = path.join(dataDir, 'bot.sqlite');
const db = new Database(dbPath);

// Créer la table guildConfigs si elle n'existe pas
db.prepare(`
  CREATE TABLE IF NOT EXISTS guildConfigs (
    guildId TEXT PRIMARY KEY,
    log TEXT,
    welcome TEXT,
    captcha TEXT,
    roleNon TEXT,
    roleVerif TEXT,
    ticketCat TEXT,
    supportRoleId TEXT
  )
`).run();

export default db;
