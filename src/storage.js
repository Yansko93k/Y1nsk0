import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import { logChannels } from './logs.js';
import { welcomeChannels, captchaChannels, rolesNonVerif, rolesVerif } from './captcha.js';
import { ticketCategory } from './tickets.js';

// Récupère le dossier actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier pour stocker les configs
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Chemin vers le fichier SQLite (unifié avec db.js)
const dbPath = path.join(dataDir, 'bot.sqlite'); // <-- utiliser la même base que db.js

// Initialise la base de données
const db = new Database(dbPath);

// Crée la table si elle n'existe pas
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

// Sauvegarde ou met à jour la config
export function saveGuildConfig(guildId, data) {
  const stmt = db.prepare(`
    INSERT INTO guildConfigs (guildId, log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId)
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
  const stmt = db.prepare('SELECT * FROM guildConfigs WHERE guildId = ?');
  const row = stmt.get(guildId);
  if (!row) return {};
  
  // Remplir les Maps pour que tout fonctionne
  if (row.log) logChannels.set(guildId, row.log);
  if (row.welcome) welcomeChannels.set(guildId, row.welcome);
  if (row.captcha) captchaChannels.set(guildId, row.captcha);
  if (row.roleNon) rolesNonVerif.set(guildId, row.roleNon);
  if (row.roleVerif) rolesVerif.set(guildId, row.roleVerif);
  if (row.ticketCat) ticketCategory.set(guildId, row.ticketCat);

  return row;
}

// Charge toutes les configs
export function loadAllConfigs() {
  const stmt = db.prepare('SELECT * FROM guildConfigs');
  const rows = stmt.all();
  const result = {};
  for (const row of rows) {
    const { guildId, log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId } = row;

    // Mettre à jour les Maps dès le démarrage
    if (log) logChannels.set(guildId, log);
    if (welcome) welcomeChannels.set(guildId, welcome);
    if (captcha) captchaChannels.set(guildId, captcha);
    if (roleNon) rolesNonVerif.set(guildId, roleNon);
    if (roleVerif) rolesVerif.set(guildId, roleVerif);
    if (ticketCat) ticketCategory.set(guildId, ticketCat);

    result[row.guildId] = { log, welcome, captcha, roleNon, roleVerif, ticketCat, supportRoleId };
  }
  return result;
}
