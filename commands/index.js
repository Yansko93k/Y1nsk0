import fs from 'fs';
import path from 'path';

export async function registerCommands(client) {
  const commandFiles = fs.readdirSync(new URL('.', import.meta.url))
    .filter(file => file.endsWith('.js') && file !== 'index.js');

  for (const file of commandFiles) {
    const filePath = path.join(new URL('.', import.meta.url).pathname, file);
    const command = await import(`file://${filePath}`);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`Commande chargée : ${command.data.name}`);
    }
  }

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Erreur lors de l’exécution de la commande.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Erreur lors de l’exécution de la commande.', ephemeral: true });
      }
    }
  });
}
