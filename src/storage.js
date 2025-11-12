import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';

// Récupère le dossier actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier pour stocker les configs
const dataDir = path.join(__dirname, '../data');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Chemin du fichier SQLite
const dbPath = path.join(dataDir, 'guildConfigs.sqlite');

// Initialise la base de données
const db = new Database(dbPath);

// Crée la table si elle n'existe pas
db.prepare(`
  CREATE TABLE IF NOT EXISTS guild_configs (
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

// Sauvegarde ou met à jour la config
export function saveGuildConfig(guildId, data) {
  const stmt = db.prepare(`
    INSERT INTO guild_configs (guildId, log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId)
    VALUES (@guildId, @log, @welcome, @captcha, @roleNon, @roleVerif, @ticketCat, @supportRoleId)
    ON CONFLICT(guildId) DO UPDATE SET
      log=@log,
      welcome=@welcome,
      captcha=@captcha,
      roleNon=@roleNon,
      roleVerif=@roleVerif,
      ticketCat=@ticketCat,
      supportRoleId=@supportRoleId
  `);
  stmt.run({ guildId, ...data });
  console.log(`🔹 Config sauvegardée pour ${guildId}:`, data);
}

// Charge la config d’une guild
export function loadGuildConfig(guildId) {
  const stmt = db.prepare('SELECT * FROM guild_configs WHERE guildId = ?');
  return stmt.get(guildId) || {};
}

// Charge toutes les configs
export function loadAllConfigs() {
  const stmt = db.prepare('SELECT * FROM guild_configs');
  const rows = stmt.all();
  const result = {};
  for (const row of rows) {
    const { guildId, ...data } = row;
    result[guildId] = data;
  }
  return result;
}
