// index.js
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
  ChannelType
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

// ======================
// Maps de configuration (en mémoire)
//  - si tu veux persister entre redémarrages, sauvegarde ces maps dans un fichier/DB
// ======================
const logChannels = new Map();      // guildId -> channelId
const welcomeChannels = new Map();  // guildId -> channelId
const captchaChannels = new Map();  // guildId -> channelId
const ticketButtonChannels = new Map(); // guildId -> channelId where button is posted
const ticketCategory = new Map();   // guildId -> categoryId
const openTickets = new Map();      // userId -> channelId (limit 1 ticket per user)

// ======================
// Déploiement des commandes slash (guild only -> remplace GUILD_ID_HERE)
// ======================
client.on('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag} ! Déploiement des commandes...`);

  const commands = [
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('Définir le salon des logs')
      .addChannelOption(opt => opt.setName('channel').setDescription('Salon de logs').setRequired(true)),

    new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('Définir le salon de bienvenue')
      .addChannelOption(opt => opt.setName('channel').setDescription('Salon de bienvenue').setRequired(true)),

    new SlashCommandBuilder()
      .setName('captcha')
      .setDescription('Définir le salon du captcha')
      .addChannelOption(opt => opt.setName('channel').setDescription('Salon pour captcha').setRequired(true)),

    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Poster le bouton de ticket dans un salon et définir la catégorie')
      .addChannelOption(opt => opt.setName('channel').setDescription('Salon pour le bouton de ticket').setRequired(true))
      .addChannelOption(opt => opt.setName('category').setDescription('Catégorie où seront créés les tickets').setRequired(false)),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    // REMPLACE 'GUILD_ID_HERE' par ton ID de serveur pour déployer sur ce serveur uniquement (rapide)
    await rest.put(Routes.applicationGuildCommands(client.user.id, '371158107319042048'), { body: commands });
    console.log('Commandes slash déployées sur le serveur (guild).');
  } catch (err) {
    console.error('Erreur déploiement commandes slash :', err);
  }
});

// ======================
// Helper : créer embed de log
// ======================
function makeLogEmbed({ guild, action, user, extra }) {
  const embed = new EmbedBuilder()
    .setTitle('Log - ' + action)
    .addFields(
      { name: 'Utilisateur', value: user ? `${user.tag} (${user.id})` : 'N/A', inline: true },
      { name: 'Serveur', value: guild ? `${guild.name} (${guild.id})` : 'N/A', inline: true },
      { name: 'Date', value: new Date().toISOString(), inline: false },
    )
    .setDescription(extra || '')
    .setColor('Blue')
    .setTimestamp();
  return embed;
}

// ======================
// sendLog: envoie un embed dans le salon de logs si défini
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
  if (message.author.bot) return;
  const now = Date.now();
  const cooldown = 5000;
  if (cooldowns.has(message.author.id)) {
    const expiration = cooldowns.get(message.author.id) + cooldown;
    if (now < expiration) {
      // try delete message if possible
      message.delete().catch(() => {});
      sendLog(message.guild?.id, { action: 'Anti-spam', user: message.author, extra: `Message supprimé pour spam de ${message.author.tag}` });
      return;
    }
  }
  cooldowns.set(message.author.id, now);
  setTimeout(() => cooldowns.delete(message.author.id), cooldown);
});

// ======================
// Bienvenue + captcha + rôles
// ======================
client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    const welcomeChannelId = welcomeChannels.get(guild.id);
    const captchaChannelId = captchaChannels.get(guild.id);
    const logChannelId = logChannels.get(guild.id);

    const welcomeChannel = welcomeChannelId ? guild.channels.cache.get(welcomeChannelId) : guild.systemChannel;
    const captchaChannel = captchaChannelId ? guild.channels.cache.get(captchaChannelId) : welcomeChannel;
    const logChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;

    if (!welcomeChannel || !captchaChannel || !captchaChannel.isTextBased()) {
      // si salon non configuré proprement, log et stop
      sendLog(guild.id, { action: 'GuildMemberAdd', user: member.user, extra: 'Welcome or captcha channel not configured or not text based.' });
      return;
    }

    // rôles
    const roleNon = guild.roles.cache.find(r => r.name === 'Non vérifié');
    const roleVerif = guild.roles.cache.find(r => r.name === 'Vérifié');

    // ajouter rôle non vérifié si existe
    if (roleNon) {
      await member.roles.add(roleNon).catch(err => {
        sendLog(guild.id, { action: 'RoleAddFailed', user: member.user, extra: `Impossible d'ajouter rôle Non vérifié: ${String(err)}` });
      });
    }

    // MP de bienvenue
    try {
      await member.send(`Bienvenue sur ${guild.name} ! Pour accéder au serveur, merci de valider le captcha dans ${captchaChannel}.\nVous recevrez le rôle "Vérifié" une fois validé.`);
    } catch {
      // utilisateur peut avoir les DM fermés
      sendLog(guild.id, { action: 'DMFail', user: member.user, extra: 'Impossible d’envoyer le MP de bienvenue (DM fermé).' });
    }

    // message de bienvenue public
    await welcomeChannel.send({ content: `Bienvenue ${member} sur le serveur !` }).catch(() => {});

    // Captcha : générer code
    const captchaCode = Math.floor(1000 + Math.random() * 9000).toString();

    const captchaMessage = await captchaChannel.send({
      content: `${member}, envoyez le code suivant en message privé (dans ce salon) pour valider : \`${captchaCode}\``
    }).catch(err => {
      sendLog(guild.id, { action: 'CaptchaSendFail', user: member.user, extra: `Impossible d'envoyer message captcha: ${String(err)}` });
      return null;
    });
    if (!captchaMessage) return;

    // collector pour la réponse (dans le canal captcha)
    const collector = captchaChannel.createMessageCollector({
      filter: m => m.author.id === member.id,
      max: 1,
      time: 120000
    });

    collector.on('collect', async (msg) => {
      try {
        if (msg.content.trim() === captchaCode) {
          // suppression messages (captcha + réponse)
          await msg.delete().catch(() => {});
          await captchaMessage.delete().catch(() => {});

          // changer rôles
          if (roleNon) await member.roles.remove(roleNon).catch(() => {});
          if (roleVerif) await member.roles.add(roleVerif).catch(() => {});

          // log succès
          await sendLog(guild.id, {
            action: 'Captcha Validé',
            user: member.user,
            extra: `Captcha : ${captchaCode}`
          });

          // DM confirmation
          try { await member.send(`Captcha validé ! Vous êtes maintenant vérifié sur ${guild.name}.`); } catch {}

        } else {
          // Mauvais code -> kick
          await msg.delete().catch(() => {});
          await captchaMessage.delete().catch(() => {});
          if (member.kickable) await member.kick('Captcha non validé (mauvais code)').catch(() => {});
          await sendLog(guild.id, { action: 'Captcha Échoué', user: member.user, extra: `Mauvais code entré: "${msg.content}" (attendu ${captchaCode})` });
        }
      } catch (err) {
        console.error('collector.collect error:', err);
      }
    });

    collector.on('end', async (collected) => {
      try {
        if (collected.size === 0) {
          // timeout
          await captchaMessage.delete().catch(() => {});
          if (member.kickable) await member.kick('Captcha non validé (timeout)').catch(() => {});
          await sendLog(guild.id, { action: 'Captcha Timeout', user: member.user, extra: `Code: ${captchaCode}` });
        }
      } catch (err) {
        console.error('collector.end error:', err);
      }
    });

  } catch (err) {
    console.error('guildMemberAdd error:', err);
  }
});

// ======================
// Gestion des interactions (slash + boutons)
// ======================
client.on('interactionCreate', async (interaction) => {
  try {
    // --------- Slash commands ----------
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;
      // UTILISER flags:64 pour réponses éphémères (aucun warning)
      if (name === 'logs') {
        const ch = interaction.options.getChannel('channel');
        if (!ch || !ch.isTextBased()) return interaction.reply({ content: 'Merci de fournir un salon textuel.', flags: 64 });
        logChannels.set(interaction.guild.id, ch.id);
        await interaction.reply({ content: `Salon de logs défini : ${ch}`, flags: 64 });
        await sendLog(interaction.guild.id, { action: 'Config logs', user: interaction.user, extra: `Salon logs défini: ${ch.id}` });
        return;
      }

      if (name === 'welcome') {
        const ch = interaction.options.getChannel('channel');
        if (!ch || !ch.isTextBased()) return interaction.reply({ content: 'Merci de fournir un salon textuel.', flags: 64 });
        welcomeChannels.set(interaction.guild.id, ch.id);
        await interaction.reply({ content: `Salon de bienvenue défini : ${ch}`, flags: 64 });
        await sendLog(interaction.guild.id, { action: 'Config welcome', user: interaction.user, extra: `Salon welcome défini: ${ch.id}` });
        return;
      }

      if (name === 'captcha') {
        const ch = interaction.options.getChannel('channel');
        if (!ch || !ch.isTextBased()) return interaction.reply({ content: 'Merci de fournir un salon textuel.', flags: 64 });
        captchaChannels.set(interaction.guild.id, ch.id);
        await interaction.reply({ content: `Salon de captcha défini : ${ch}`, flags: 64 });
        await sendLog(interaction.guild.id, { action: 'Config captcha', user: interaction.user, extra: `Salon captcha défini: ${ch.id}` });
        return;
      }

      if (name === 'ticket') {
        const buttonChannel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category'); // facultatif
        if (!buttonChannel || !buttonChannel.isTextBased()) return interaction.reply({ content: 'Merci de fournir un salon textuel pour le bouton.', flags: 64 });

        ticketButtonChannels.set(interaction.guild.id, buttonChannel.id);
        if (category && category.type === ChannelType.GuildCategory) ticketCategory.set(interaction.guild.id, category.id);

        // créer le bouton et l'envoyer
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('create_ticket').setLabel('Créer un ticket').setStyle(ButtonStyle.Primary)
        );

        await buttonChannel.send({ content: 'Cliquez sur le bouton ci-dessous pour créer un ticket.', components: [row] }).catch(err => {
          console.error('send ticket button error:', err);
        });

        await interaction.reply({ content: `Bouton de ticket posté dans ${buttonChannel}${category ? `, catégorie: ${category.name}` : ''}`, flags: 64 });
        await sendLog(interaction.guild.id, { action: 'Config ticket', user: interaction.user, extra: `Button dans: ${buttonChannel.id} category: ${category?.id || 'none'}` });
        return;
      }
    }

    // --------- Buttons ----------
    if (interaction.isButton()) {
      // Pour buttons, on répond rapidement pour éviter Unknown interaction.
      // create_ticket: créer salon ticket, limiter 1 ticket par user, mettre dans la catégorie si configurée
      if (interaction.customId === 'create_ticket') {
        // empêcher spam multi-click : deferUpdate (répond sans message)
        await interaction.deferReply({ flags: 64 }).catch(() => {});

        const userId = interaction.user.id;
        if (openTickets.has(userId)) {
          await interaction.editReply({ content: 'Vous avez déjà un ticket ouvert !' }).catch(() => {});
          return;
        }

        const guild = interaction.guild;
        const categoryId = ticketCategory.get(guild.id);
        const ticketNameBase = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9\-]/g, '-').slice(0, 90);
        let ticketName = ticketNameBase;
        // éviter doublons en ajoutant compteur si nécessaire
        let counter = 1;
        while (guild.channels.cache.find(c => c.name === ticketName)) {
          ticketName = `${ticketNameBase}-${counter++}`;
        }

        // créer le channel dans la catégorie si défini
        const channelOptions = {
          name: ticketName,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ],
        };
        if (categoryId) channelOptions.parent = categoryId;

        let ticketChannel;
        try {
          ticketChannel = await guild.channels.create(channelOptions);
        } catch (err) {
          console.error('create ticket channel error:', err);
          await interaction.editReply({ content: 'Erreur: impossible de créer le salon de ticket (permissions manquantes).' }).catch(() => {});
          return;
        }

        openTickets.set(userId, ticketChannel.id);

        // envoyer message d'ouverture ticket avec bouton fermer
        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `Bonjour ${interaction.user}, votre ticket a été créé !`, components: [closeRow] }).catch(() => {});

        await interaction.editReply({ content: `Ticket créé : ${ticketChannel}` }).catch(() => {});
        await sendLog(guild.id, { action: 'Ticket créé', user: interaction.user, extra: `Channel: ${ticketChannel.id}` });
        return;
      }

      // close_ticket
      if (interaction.customId === 'close_ticket') {
        await interaction.deferReply({ flags: 64 }).catch(() => {});
        const ch = interaction.channel;
        const guild = interaction.guild;

        // trouver utilisateur qui a ouvert ce ticket via openTickets map
        const entry = [...openTickets.entries()].find(([uid, cid]) => cid === ch.id);
        if (entry) openTickets.delete(entry[0]);

        // supprimer salon
        if (ch && ch.name && ch.name.startsWith('ticket-')) {
          await ch.delete().catch(async (err) => {
            console.error('delete ticket channel error:', err);
            await interaction.editReply({ content: 'Impossible de supprimer le salon (permissions manquantes).' }).catch(() => {});
          });
          await sendLog(guild.id, { action: 'Ticket fermé', user: interaction.user, extra: `Channel supprimé: ${ch.id}` });
        } else {
          await interaction.editReply({ content: 'Ce bouton ne peut être utilisé que dans un salon de ticket.' }).catch(() => {});
        }
        return;
      }
    }

  } catch (err) {
    console.error('interactionCreate error:', err);
  }
});

// ======================
// Fonction pour envoyer les logs via sendLog (définie plus haut)
// ======================
// (déjà définie)

// ======================
// Fin du fichier
// ======================
