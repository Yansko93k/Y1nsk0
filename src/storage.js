import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Récupère le dossier actuel du fichier
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier pour stocker les configs
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Chemin absolu vers le fichier JSON
const filePath = path.join(dataDir, 'guildConfigs.json');

// Sauvegarde la config d'une guild
export function saveGuildConfig(guildId, data) {
  const configs = loadAllConfigs();
  configs[guildId] = { ...(configs[guildId] || {}), ...data };
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2));
  console.log(`🔹 Config sauvegardée pour ${guildId}:`, configs[guildId]);
}

// Charge la config d'une guild
export function loadGuildConfig(guildId) {
  const configs = loadAllConfigs();
  return configs[guildId] || {};
}

// Charge toutes les configs
export function loadAllConfigs() {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
