// storage.js
import fs from 'fs';
const filePath = './guildConfigs.json';

// Sauvegarde la config d'une guild
export function saveGuildConfig(guildId, data) {
  const configs = loadAllConfigs();
  configs[guildId] = { ...(configs[guildId] || {}), ...data };
  fs.writeFileSync(filePath, JSON.stringify(configs, null, 2));
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
