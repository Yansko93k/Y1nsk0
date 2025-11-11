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
  ChannelType,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Erreur : le token Discord n'est pas défini !");
  process.exit(1);
}

client.login(token);

// ======================
// Maps de configuration (en mémoire)
// ======================
const logChannels = new Map();
const welcomeChannels = new Map();
const captchaChannels = new Map();
const ticketButtonChannels = new Map();
const ticketCategory = new Map();
const openTickets = new Map();

// ======================
// Helper : créer embed de log
// ======================
function makeLogEmbed({ guild, action, user, extra }) {
  const embed = new EmbedBuilder()
    .setTitle(`📌 Log: ${action}`)
    .setColor('Blue')
    .setTimestamp()
    .addFields(
      { name: 'Utilisateur', value: user ? `${user.tag} (${user.id})` : 'N/A', inline: false },
      { name: 'Serveur', value: guild ? `${guild.name} (${guild.id})` : 'N/A', inline: false },
    );

  if (extra) embed.addFields({ name: 'Détails', value: extra });
  return embed;
}

// ======================
// sendLog : envoyer un embed dans le salon configuré
// ======================
async function sendLog(guildId, { action, user, extra }) {
  try {
    const channelId = logChannels.get(guildId);
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = makeLogEmbed({ guild: channel.guild, action, user, extra });
    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('sendLog error:', err);
  }
}

// ======================
// Anti-spam simple
// ======================
const cooldowns = new Map();
client.on('messageCreate', (message) => {
  if (message.author.bot || !message.guild) return;

  const now = Date.now();
  const cooldown = 5000;

  if (cooldowns.has(message.author.id)) {
    const expiration = cooldowns.get(message.author.id) + cooldown;
    if (now < expiration) {
      message.delete().catch(() => {});
      sendLog(message.guild.id, {
        action: 'Anti-spam',
        user: message.author,
        extra: `Message supprimé :\n\`\`\`${message.content}\`\`\``
      });
      return;
    }
  }

  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), cooldown);
});

// ======================
// Bienvenue + Captcha
// ======================
client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    const welcomeChannelId = welcomeChannels.get(guild.id);
    const captchaChannelId = captchaChannels.get(guild.id);

    const welcomeChannel = welcomeChannelId ? guild.channels.cache.get(welcomeChannelId) : guild.systemChannel;
    const captchaChannel = captchaChannelId ? guild.channels.cache.get(captchaChannelId) : welcomeChannel;

    if (!welcomeChannel || !captchaChannel || !captchaChannel.isTextBased()) {
      sendLog(guild.id, { action: 'GuildMemberAdd', user: member.user, extra: 'Salon welcome/captcha invalide — action ignorée.' });
      return;
    }

    const roleNon = guild.roles.cache.find(r => r.name === 'Non vérifié');
    const roleVerif = guild.roles.cache.find(r => r.name === 'Vérifié');

    if (roleNon) await member.roles.add(roleNon).catch(() => {});
    member.send(`Bienvenue sur **${guild.name}** ! Valide ton captcha dans ${captchaChannel}.`).catch(() => {});
    await welcomeChannel.send(`Bienvenue ${member} !`);

    const captchaCode = Math.floor(1000 + Math.random() * 9000).toString();
    const captchaMessage = await captchaChannel.send({ content: `${member}, envoie le code suivant : \`${captchaCode}\`` });

    const collector = captchaChannel.createMessageCollector({ filter: m => m.author.id === member.id, time: 120000, max: 1 });

    collector.on('collect', async (msg) => {
      if (msg.content.trim() === captchaCode) {
        msg.delete().catch(() => {});
        captchaMessage.delete().catch(() => {});
        if (roleNon) member.roles.remove(roleNon).catch(() => {});
        if (roleVerif) member.roles.add(roleVerif).catch(() => {});
        sendLog(guild.id, { action: 'Captcha validé', user: member.user, extra: `Code : ${captchaCode}` });
        member.send(`Captcha validé ! Bienvenue !`).catch(() => {});
      } else {
        msg.delete().catch(() => {});
        captchaMessage.delete().catch(() => {});
        if (member.kickable) await member.kick('Captcha incorrect');
        sendLog(guild.id, { action: 'Captcha échoué', user: member.user, extra: `Entré : ${msg.content} — Attendu : ${captchaCode}` });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        captchaMessage.delete().catch(() => {});
        if (member.kickable) await member.kick('Timeout captcha');
        sendLog(guild.id, { action: 'Captcha timeout', user: member.user, extra: `Code attendu : ${captchaCode}` });
      }
    });
  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

// ======================
// Déploiement des commandes & Ready
// ======================
client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  // Exemple : enregistrer une commande /ping pour le serveur actuel
  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Répond pong !').toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('Déploiement des commandes...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Commandes déployées !');
  } catch (err) {
    console.error(err);
  }
});

// ======================
// Interaction Slash + Buttons
// ======================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // Exemple Slash /ping
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Pong !', ephemeral: true });
    }
  }

  // Exemple Button ticket
  if (interaction.isButton()) {
    const guild = interaction.guild;
    const userId = interaction.user.id;
    const categoryId = ticketCategory.get(guild.id);
    if (!categoryId) return interaction.reply({ content: 'Catégorie ticket non définie.', ephemeral: true });

    const open = openTickets.get(userId);
    if (open) return interaction.reply({ content: 'Vous avez déjà un ticket ouvert !', ephemeral: true });

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    openTickets.set(userId, channel.id);
    interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
  }
});

// ======================

client.login(token);

// ======================
// Logs avancés
// ======================

// Messages
client.on('messageDelete', (message) => {
  if (!message.guild || message.author?.bot) return;
  sendLog(message.guild.id, { action: 'Message supprimé', user: message.author, extra: `Salon : ${message.channel.name}\nContenu : ${message.content || 'N/A'}` });
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  sendLog(oldMessage.guild.id, { action: 'Message modifié', user: oldMessage.author, extra: `Salon : ${oldMessage.channel.name}\nAvant : ${oldMessage.content}\nAprès : ${newMessage.content}` });
});

client.on('messageDeleteBulk', (messages) => {
  const guild = messages.first()?.guild;
  if (!guild) return;
  sendLog(guild.id, { action: 'Suppression massive de messages', extra: `Nombre : ${messages.size}` });
});

// Membres
client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    sendLog(newMember.guild.id, { action: 'Pseudo modifié', user: newMember.user, extra: `Ancien : ${oldMember.nickname || oldMember.user.username}\nNouveau : ${newMember.nickname || newMember.user.username}` });
  }
  const oldRoles = oldMember.roles.cache.map(r => r.id).join(',');
  const newRoles = newMember.roles.cache.map(r => r.id).join(',');
  if (oldRoles !== newRoles) sendLog(newMember.guild.id, { action: 'Rôles modifiés', user: newMember.user, extra: `Avant : ${oldRoles}\nAprès : ${newRoles}` });
});

client.on('guildMemberRemove', (member) => sendLog(member.guild.id, { action: 'Membre quitté', user: member.user, extra: `ID : ${member.id}` }));
client.on('guildBanAdd', (ban) => sendLog(ban.guild.id, { action: 'Ban', user: ban.user, extra: 'Utilisateur banni.' }));
client.on('guildBanRemove', (ban) => sendLog(ban.guild.id, { action: 'Unban', user: ban.user, extra: 'Utilisateur débanni.' }));

// Channels
client.on('channelCreate', (channel) => sendLog(channel.guild.id, { action: 'Channel créé', extra: `Nom : ${channel.name} | Type : ${channel.type}` }));
client.on('channelDelete', (channel) => sendLog(channel.guild.id, { action: 'Channel supprimé', extra: `Nom : ${channel.name} | Type : ${channel.type}` }));
client.on('channelUpdate', (oldChannel, newChannel) => {
  const changes = [];
  if (oldChannel.name !== newChannel.name) changes.push(`Nom : ${oldChannel.name} -> ${newChannel.name}`);
  if (oldChannel.topic !== newChannel.topic) changes.push(`Topic : ${oldChannel.topic} -> ${newChannel.topic}`);
  if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`Slowmode : ${oldChannel.rateLimitPerUser}s -> ${newChannel.rateLimitPerUser}s`);
  if (changes.length) sendLog(newChannel.guild.id, { action: 'Channel modifié', extra: changes.join('\n') });
});

// Roles
client.on('roleCreate', (role) => sendLog(role.guild.id, { action: 'Rôle créé', extra: `Nom : ${role.name} | ID : ${role.id}` }));
client.on('roleDelete', (role) => sendLog(role.guild.id, { action: 'Rôle supprimé', extra: `Nom : ${role.name} | ID : ${role.id}` }));
client.on('roleUpdate', (oldRole, newRole) => {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push(`Nom : ${oldRole.name} -> ${newRole.name}`);
  if (oldRole.color !== newRole.color) changes.push(`Couleur : ${oldRole.color} -> ${newRole.color}`);
  if (changes.length) sendLog(newRole.guild.id, { action: 'Rôle modifié', extra: changes.join('\n') });
});

// Vocaux
client.on('voiceStateUpdate', (oldState, newState) => {
  const user = newState.member?.user || oldState.member?.user;
  const guildId = newState.guild.id;
  if (!user) return;

  if (!oldState.channel && newState.channel) sendLog(guildId, { action: 'Vocal: entrée', user, extra: `Salon : ${newState.channel.name}` });
  else if (oldState.channel && !newState.channel) sendLog(guildId, { action: 'Vocal: sortie', user, extra: `Salon : ${oldState.channel.name}` });
  else if (oldState.channelId !== newState.channelId) sendLog(guildId, { action: 'Vocal: déplacement', user, extra: `De : ${oldState.channel.name} -> ${newState.channel.name}` });

  if (oldState.serverMute !== newState.serverMute) sendLog(guildId, { action: `Vocal: ${newState.serverMute ? 'mute' : 'unmute'}`, user });
  if (oldState.serverDeaf !== newState.serverDeaf) sendLog(guildId, { action: `Vocal: ${newState.serverDeaf ? 'deaf' : 'undeaf'}`, user });
  if (oldState.selfMute !== newState.selfMute) sendLog(guildId, { action: `Vocal: ${newState.selfMute ? 'mute micro' : 'unmute micro'}`, user });
  if (oldState.selfDeaf !== newState.selfDeaf) sendLog(guildId, { action: `Vocal: ${newState.selfDeaf ? 'deaf' : 'undeaf'}`, user });
  if (oldState.streaming !== newState.streaming) sendLog(guildId, { action: `Vocal: ${newState.streaming ? 'stream' : 'stop stream'}`, user });
  if (oldState.selfVideo !== newState.selfVideo) sendLog(guildId, { action: `Vocal: ${newState.selfVideo ? 'cam on' : 'cam off'}`, user });
});

// Utilisateur
client.on('userUpdate', (oldUser, newUser) => {
  const guilds = client.guilds.cache.filter(g => g.members.cache.has(newUser.id));
  if (oldUser.username !== newUser.username) guilds.forEach(g => sendLog(g.id, { action: 'Nom Discord modifié', user: newUser, extra: `Ancien : ${oldUser.username}\nNouveau : ${newUser.username}` }));
  if (oldUser.avatar !== newUser.avatar) guilds.forEach(g => sendLog(g.id, { action: 'Avatar modifié', user: newUser }));
  if (oldUser.banner !== newUser.banner) guilds.forEach(g => sendLog(g.id, { action: 'Bannière modifiée', user: newUser }));
});

// Pins
client.on('channelPinsUpdate', (channel) => sendLog(channel.guild.id, { action: 'Pins modifiés', extra: `Salon : ${channel.name}` }));
