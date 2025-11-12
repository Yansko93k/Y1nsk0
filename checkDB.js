import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data/guildConfigs.sqlite'); // ajuste le chemin si besoin

const db = new Database(dbPath);

const rows = db.prepare('SELECT * FROM guild_configs').all();
console.log('Contenu de la DB :', rows);
