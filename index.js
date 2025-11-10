// ======================
// Serveur web Express
// ======================
import express from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot en ligne !'));
app.listen(PORT, () => console.log(`Serveur web démarré sur le port ${PORT}`));

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
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Erreur : le token Discord n'est pas défini !");
  process.exit(1);
}

client.login(token);
client.on('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag} !`);

  // Déployer les commandes slash sur le serveur
  const commands = [
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Définir le salon des logs')
      .addChannelOption(option =>
        option.setName('channel').setDescription('Salon de logs').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('Définir le salon de bienvenue')
      .addChannelOption(option =>
        option.setName('channel').setDescription('Salon de bienvenue').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('captcha')
      .setDescription('Définir le salon du captcha')
      .addChannelOption(option =>
        option.setName('channel').setDescription('Salon pour captcha').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Créer un ticket via bouton'),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('Déploiement des commandes slash...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, '371158107319042048'), // <-- remplace par ton ID serveur
      { body: commands }
    );
    console.log('Commandes slash déployées !');
  } catch (err) {
    console.error(err);
  }
});

// ======================
// Maps de configuration
// ======================
const logChannels = new Map();
const welcomeChannels = new Map();
const captchaChannels = new Map();

// ======================
// Anti-spam simple
// ======================
const cooldowns = new Map();
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  const now = Date.now();
  const cooldown = 5000;
  if (cooldowns.has(message.author.id)) {
    const expiration = cooldowns.get(message.author.id) + cooldown;
    if (now < expiration) {
      message.delete().catch(() => {});
      sendLog(message.guild.id, `Message supprimé pour spam : ${message.author.tag}`);
      return;
    }
  }
  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), cooldown);
});

// ======================
// Bienvenue + captcha
// ======================
client.on('guildMemberAdd', async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannels.get(member.guild.id)) || member.guild.systemChannel;
    const captchaChannel = member.guild.channels.cache.get(captchaChannels.get(member.guild.id)) || welcomeChannel;
    if (!welcomeChannel) return;

    // Message de bienvenue
    welcomeChannel.send(`Bienvenue ${member} sur le serveur !`);

    // Captcha
    const captcha = Math.floor(1000 + Math.random() * 9000);
    const filter = m => m.author.id === member.id && m.content === captcha.toString();

    await captchaChannel.send(`${member}, envoyez le code suivant pour vérifier que vous êtes humain : \`${captcha}\``);
    const collected = await captchaChannel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] }).catch(() => null);

    if (!collected) {
      if (member.kickable) await member.kick("Captcha non validé");
      sendLog(member.guild.id, `Captcha échoué : ${member.tag}`);
      return;
    }

    captchaChannel.send(`${member} a validé le captcha !`);
    sendLog(member.guild.id, `Captcha validé : ${member.tag}`);
  } catch (err) {
    console.error(err);
  }
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

  if (interaction.isChatInputCommand()) {
    const channel = interaction.options.getChannel('channel');
    switch (interaction.commandName) {
      case 'logs':
        logChannels.set(interaction.guild.id, channel.id);
        await interaction.reply({ content: `Salon de logs défini : ${channel}`, ephemeral: true });
        break;
      case 'welcome':
        welcomeChannels.set(interaction.guild.id, channel.id);
        await interaction.reply({ content: `Salon de bienvenue défini : ${channel}`, ephemeral: true });
        break;
      case 'captcha':
        captchaChannels.set(interaction.guild.id, channel.id);
        await interaction.reply({ content: `Salon de captcha défini : ${channel}`, ephemeral: true });
        break;
      case 'ticket':
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
        break;
    }
  }
});

// ======================
// Fonction pour envoyer les logs
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

