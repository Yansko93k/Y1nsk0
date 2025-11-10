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
// Maps de configuration
// ======================
const logChannels = new Map();
const welcomeChannels = new Map();
const captchaChannels = new Map();
const ticketChannels = new Map(); // salon où le bouton sera mis
const ticketCategory = new Map(); // catégorie pour les tickets
const openTickets = new Map(); // Limiter 1 ticket par utilisateur

// ======================
// Déploiement des commandes slash
// ======================
client.on('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag} !`);

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
      .setDescription('Créer le bouton de ticket dans un salon et définir la catégorie')
      .addChannelOption(option =>
        option.setName('channel').setDescription('Salon pour le bouton de ticket').setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('category').setDescription('Catégorie des tickets').setRequired(false)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('Déploiement des commandes slash...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, '371158107319042048'), // Remplace par ton ID serveur
      { body: commands }
    );
    console.log('Commandes slash déployées !');
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
// Bienvenue + captcha + rôles
// ======================
client.on('guildMemberAdd', async (member) => {
  try {
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannels.get(member.guild.id)) || member.guild.systemChannel;
    const captchaChannel = member.guild.channels.cache.get(captchaChannels.get(member.guild.id)) || welcomeChannel;
    const logChannel = member.guild.channels.cache.get(logChannels.get(member.guild.id));
    if (!welcomeChannel) return;

    const roleNonVerifié = member.guild.roles.cache.find(r => r.name === 'Non vérifié');
    const roleVérifié = member.guild.roles.cache.find(r => r.name === 'Vérifié');

    if (roleNonVerifié) await member.roles.add(roleNonVerifié);

    // MP de bienvenue
    try { await member.send(`Bienvenue sur ${member.guild.name} ! Veuillez valider le captcha pour accéder au serveur.`); }
    catch { console.warn(`Impossible d’envoyer le MP à ${member.user.tag}`); }

    welcomeChannel.send(`Bienvenue ${member} sur le serveur !`);

    // Captcha
    const captcha = Math.floor(1000 + Math.random() * 9000);
    const filter = m => m.author.id === member.id && m.content === captcha.toString();
    const captchaMessage = await captchaChannel.send(`${member}, envoyez le code suivant pour vérifier que vous êtes humain : \`${captcha}\``);

    const collected = await captchaChannel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] }).catch(() => null);

    if (!collected) {
      if (member.kickable) await member.kick("Captcha non validé");
      if (captchaMessage) await captchaMessage.delete().catch(() => {});
      if (collected) collected.forEach(msg => msg.delete().catch(() => {}));
      sendLog(member.guild.id, `Captcha échoué : ${member.user.tag}`);
      return;
    }

    // Supprimer messages captcha
    if (captchaMessage) await captchaMessage.delete().catch(() => {});
    collected.forEach(msg => msg.delete().catch(() => {}));

    // Changer les rôles
    if (roleNonVerifié) await member.roles.remove(roleNonVerifié);
    if (roleVérifié) await member.roles.add(roleVérifié);

    // Message dans le salon de logs
    if (logChannel) logChannel.send(`${member.user.tag} a validé le captcha et est maintenant vérifié !`).catch(() => {});

    // MP confirmation
    try { await member.send(`Captcha validé ! Votre rôle a été mis à jour.`); }
    catch { console.warn(`Impossible d’envoyer le MP à ${member.user.tag}`); }

  } catch (err) { console.error(err); }
});

// ======================
// Système de tickets via bouton
// ======================
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const userId = interaction.user.id;

      if (interaction.customId === 'create_ticket') {
        if (openTickets.has(userId)) {
          await interaction.reply({ content: 'Vous avez déjà un ticket ouvert !', ephemeral: true });
          return;
        }

        const categoryId = ticketCategory.get(interaction.guild.id);
        const ticketName = `ticket-${interaction.user.username}`;

        const ticketChannel = await interaction.guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: categoryId || undefined,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ],
        });

        openTickets.set(userId, ticketChannel.id);

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
        const userEntry = [...openTickets.entries()].find(([_, chId]) => chId === channel.id);
        if (userEntry) openTickets.delete(userEntry[0]);

        if (channel.name.startsWith('ticket-')) {
          await channel.delete().catch(() => {});
          sendLog(interaction.guild.id, `Ticket fermé : ${channel.name}`);
        }
      }
    }

    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'logs':
          const logChannel = interaction.options.getChannel('channel');
          logChannels.set(interaction.guild.id, logChannel.id);
          await interaction.reply({ content: `Salon de logs défini : ${logChannel}`, flags: 64 });
          break;

        case 'welcome':
          const welcomeChannel = interaction.options.getChannel('channel');
          welcomeChannels.set(interaction.guild.id, welcomeChannel.id);
          await interaction.reply({ content: `Salon de bienvenue défini : ${welcomeChannel}`, flags: 64 });
          break;

        case 'captcha':
          const captchaChannel = interaction.options.getChannel('channel');
          captchaChannels.set(interaction.guild.id, captchaChannel.id);
          await interaction.reply({ content: `Salon de captcha défini : ${captchaChannel}`, flags: 64 });
          break;

        case 'ticket':
          const ticketSalon = interaction.options.getChannel('channel');
          ticketChannels.set(interaction.guild.id, ticketSalon.id);
          const category = interaction.options.getChannel('category');
          if (category && category.type === ChannelType.GuildCategory) ticketCategory.set(interaction.guild.id, category.id);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('create_ticket')
              .setLabel('Créer un ticket')
              .setStyle(ButtonStyle.Primary)
          );

          await ticketSalon.send({ content: 'Cliquez sur le bouton ci-dessous pour créer un ticket.', components: [row] });
          await interaction.reply({ content: `Bouton de ticket envoyé dans ${ticketSalon}`, flags: 64 });
          break;
      }
    }
  } catch (err) { console.error(err); }
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
