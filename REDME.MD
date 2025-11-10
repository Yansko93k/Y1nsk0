# Bot Discord Node.js prêt à l'emploi


## Installation
1. Copier les fichiers sur D:\BotDiscord
2. Ouvrir VS Code dans ce dossier
3. Installer les dépendances :
```
npm install
```


## Configuration
1. Copier `.env.example` en `.env`
2. Remplir `DISCORD_TOKEN`, `CLIENT_ID` et (optionnel) `GUILD_ID`


## Déployer les commandes slash
```
npm run deploy-commands
```


## Lancer le bot
```
npm start
```


## Déploiement sur Render
- Build command : `npm install`
- Start command : `npm start`
- Variables : DISCORD_TOKEN, CLIENT_ID, GUILD_ID (optionnel)
