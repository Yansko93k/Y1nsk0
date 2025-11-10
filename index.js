// ======================
// Serveur web Express
// ======================
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot en ligne !'));

app.listen(PORT, () => {
  console.log(`Serveur web démarré sur le port ${PORT}`);
});

// ======================
// Bot Discord
// ======================
import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Collection,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { readdir } from 'fs/promises';
import path from 'path';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ======================
// Connexion sécurisée
// ======================
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Erreur : le token Discord n'est pas défini !");
  process.exit(1);
}

client.login(token);

client.on('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag} !`);
});

// ======================
// Lecture des commandes
// ======================
const commandsPath = path.join(process.cwd(), 'commands');
(async () => {
  try {
    const commandFiles = await readdir(commandsPath);
    for (const file of commandFiles) {
      if (file.endsWith('.js')) {
        const filePath = path.join(commandsPath, file);
        const command = (await import(filePath)).default;
        client.commands.set(command.data.name, command);
      }
    }
    console.log(`Commandes chargées : ${client.commands.size}`);
  } catch (err) {
    console.warn("Aucune commande à charger ou dossier 'commands' introuvable.");
  }
})();

// ======================
// Map pour stocker les salons de logs par guild
// ======================
const logChannels = new Map();

// ======================
// Bienvenue et captcha
// ======================
client.on('guildMemberAdd', async (member) => {
  try {
    const channel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === 0);
    if (!channel) return;

    const captcha = Math.floor(1000 + Math.random() * 9000);
    const filter = m => m.author.id === member.id && m.content === captcha.toString();

    await channel.send({
      content: `Bienvenue ${member}! Pour vérifier que vous êtes humain, envoyez ce code : \`${captcha}\``
    });

    const collected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] }).catch(() => null);

    if (!collected) {
      await member.send("Vous n'avez pas répondu à temps au captcha, vous serez expulsé.");
      member.kick("Captcha non validé");
      sendLog(member.guild.id, `Captcha échoué : ${member.tag} a été expulsé`);
      return;
    }

    await member.send("Captcha validé ! Bienvenue sur le serveur !");
    await channel.send(`${member} a validé le captcha avec succès !`);
    sendLog(member.guild.id, `Captcha validé : ${member.tag}`);
  } catch (err) {
    console.error(err);
  }
});

// ======================
// Anti-spam simple
// ======================
const cooldowns = new Map();

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const now = Date.now();
  const cooldownAmount = 5000;
  if (cooldowns.has(message.author.id)) {
    const expiration = cooldowns.get(message.author.id) + cooldownAmount;
    if (now < expiration) {
      message.delete().catch(() => {});
      sendLog(message.guild.id, `Message supprimé pour spam : ${message.author.tag}`);
      return;
    }
  }
  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);
});

// ======================
// Système de tickets
// ======================
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
      });

      await ticketChannel.send({
        content: `Bonjour ${interaction.user}, votre ticket a été créé !`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Fermer le ticket')
              .setStyle(ButtonStyle.Danger)
          ),
        ],
      });

      await interaction.reply({ content: 'Ticket créé !', ephemeral: true });
      sendLog(interaction.guild.id, `Ticket créé par ${interaction.user.tag}`);
    } else if (interaction.customId === 'close_ticket') {
      const channel = interaction.channel;
      if (channel.name.startsWith('ticket-')) {
        await channel.delete().catch(() => {});
        sendLog(interaction.guild.id, `Ticket fermé : ${channel.name}`);
      }
    }
  }

  // Commande /ticket pour créer un ticket via interaction
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ticket') {
      await interaction.reply({
        content: 'Cliquez sur le bouton ci-dessous pour créer un ticket.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('create_ticket')
              .setLabel('Créer un ticket')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
        ephemeral: true,
      });
    }

    // Commande /logs pour définir le salon de logs
    if (interaction.commandName === 'logs') {
      const logChannel = interaction.options.getChannel('channel');
      if (!logChannel) {
        await interaction.reply({ content: "Vous devez mentionner un salon valide.", ephemeral: true });
        return;
      }

      logChannels.set(interaction.guild.id, logChannel.id);
      await interaction.reply({ content: `Salon de logs défini : ${logChannel}`, ephemeral: true });
    }
  }
});

// ======================
// Fonction pour envoyer des logs
// ======================
function sendLog(guildId, message) {
  const channelId = logChannels.get(guildId);
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor('Blue')
    .setDescription(message)
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
}
