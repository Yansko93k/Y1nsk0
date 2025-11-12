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
// db.js (ajoute ceci en bas avant export)
export function saveConfig(guildId, config) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO guildConfigs
    (guildId, log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId)
    VALUES (@guildId, @log, @welcome, @captcha, @roleNon, @roleVerif, @ticketCat, @supportRoleId)
  `);

  stmt.run({
    guildId,
    log: config.log || null,
    welcome: config.welcome || null,
    captcha: config.captcha || null,
    roleNon: config.roleNon || null,
    roleVerif: config.roleVerif || null,
    ticketCat: config.ticketCat || null,
    supportRoleId: config.supportRoleId || null
  });

  console.log(`🔹 Config sauvegardée pour ${guildId}`);
}

export default db;
