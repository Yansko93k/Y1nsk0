import { EmbedBuilder } from 'discord.js';

export const logChannels = new Map(); // guildId -> channelId

export function makeLogEmbed({ guild, action, user, extra }) {
  const embed = new EmbedBuilder()
    .setTitle(`📌 Log : ${action}`)
    .setColor('Blue')
    .setTimestamp()
    .addFields(
      { name: 'Utilisateur', value: user ? `${user.tag} (${user.id})` : 'N/A', inline: false },
      { name: 'Serveur', value: guild ? `${guild.name} (${guild.id})` : 'N/A', inline: false }
    );

  if (extra) embed.addFields({ name: 'Détails', value: extra.slice(0, 1024) });
  return embed;
}

export async function sendLog(client, guildId, { action, user, extra }) {
  try {
    const channelId = logChannels.get(guildId);
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = makeLogEmbed({ guild: channel.guild, action, user, extra });
    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('⚠️ Erreur dans sendLog:', err);
  }
}

export function registerLogs(client) {
  const safeLog = (fn) => (...args) => {
    try { fn(...args); } catch (e) { console.error('Erreur dans un listener log:', e); }
  };

  client.on('guildMemberAdd', safeLog(m => sendLog(client, m.guild.id, { action: 'Nouveau membre', user: m.user })));
  client.on('guildMemberRemove', safeLog(m => sendLog(client, m.guild.id, { action: 'Membre quitté', user: m.user })));
  client.on('guildMemberUpdate', safeLog((oldM, newM) => {
    const changes = [];
    if (oldM.nickname !== newM.nickname) changes.push(`Pseudo: ${oldM.nickname || oldM.user.username} → ${newM.nickname || newM.user.username}`);
    const oldRoles = oldM.roles.cache.map(r => r.id).join(',');
    const newRoles = newM.roles.cache.map(r => r.id).join(',');
    if (oldRoles !== newRoles) changes.push(`Rôles: ${oldRoles} → ${newRoles}`);
    if (changes.length) sendLog(client, newM.guild.id, { action: 'Membre modifié', user: newM.user, extra: changes.join('\n') });
  }));

  client.on('messageCreate', safeLog(m => { if (!m.author.bot) sendLog(client, m.guild.id, { action: 'Message créé', user: m.author, extra: m.content }); }));
  client.on('messageUpdate', safeLog((o, n) => {
    if (o.content !== n.content) sendLog(client, o.guild.id, { action: 'Message modifié', user: o.author, extra: `Avant: ${o.content}\nAprès: ${n.content}` });
  }));
  client.on('messageDelete', safeLog(m => { if (!m.author.bot) sendLog(client, m.guild.id, { action: 'Message supprimé', user: m.author, extra: m.content }); }));
  client.on('messageDeleteBulk', safeLog(msgs => {
    const guild = msgs.first()?.guild;
    if (guild) sendLog(client, guild.id, { action: 'Suppression massive', extra: `Nombre: ${msgs.size}` });
  }));

  client.on('channelCreate', safeLog(c => sendLog(client, c.guild.id, { action: 'Salon créé', extra: `${c.name} | Type: ${c.type}` })));
  client.on('channelDelete', safeLog(c => sendLog(client, c.guild.id, { action: 'Salon supprimé', extra: `${c.name} | Type: ${c.type}` })));
  client.on('channelUpdate', safeLog((o, n) => {
    const changes = [];
    if (o.name !== n.name) changes.push(`Nom: ${o.name} → ${n.name}`);
    if (o.topic !== n.topic) changes.push(`Topic: ${o.topic} → ${n.topic}`);
    if (o.rateLimitPerUser !== n.rateLimitPerUser) changes.push(`Slowmode: ${o.rateLimitPerUser}s → ${n.rateLimitPerUser}s`);
    if (changes.length) sendLog(client, n.guild.id, { action: 'Salon modifié', extra: changes.join('\n') });
  }));

  client.on('roleCreate', safeLog(r => sendLog(client, r.guild.id, { action: 'Rôle créé', extra: `${r.name} | ID: ${r.id}` })));
  client.on('roleDelete', safeLog(r => sendLog(client, r.guild.id, { action: 'Rôle supprimé', extra: `${r.name} | ID: ${r.id}` })));
  client.on('roleUpdate', safeLog((o, n) => {
    const changes = [];
    if (o.name !== n.name) changes.push(`Nom: ${o.name} → ${n.name}`);
    if (o.color !== n.color) changes.push(`Couleur: ${o.color} → ${n.color}`);
    if (changes.length) sendLog(client, n.guild.id, { action: 'Rôle modifié', extra: changes.join('\n') });
  }));

  client.on('voiceStateUpdate', safeLog((o, n) => {
    const user = n.member?.user || o.member?.user;
    const guildId = n.guild.id;
    if (!user) return;
    const oldName = o.channel ? o.channel.name : 'aucun';
    const newName = n.channel ? n.channel.name : 'aucun';

    if (!o.channel && n.channel) sendLog(client, guildId, { action: 'Entrée vocal', user, extra: `Salon: ${newName}` });
    else if (o.channel && !n.channel) sendLog(client, guildId, { action: 'Sortie vocal', user, extra: `Salon: ${oldName}` });
    else if (o.channelId !== n.channelId) sendLog(client, guildId, { action: 'Déplacement vocal', user, extra: `${oldName} → ${newName}` });

    if (o.serverMute !== n.serverMute) sendLog(client, guildId, { action: `Mute: ${n.serverMute}`, user });
    if (o.serverDeaf !== n.serverDeaf) sendLog(client, guildId, { action: `Deaf: ${n.serverDeaf}`, user });
  }));

  client.on('guildBanAdd', safeLog(b => sendLog(client, b.guild.id, { action: 'Ban', user: b.user })));
  client.on('guildBanRemove', safeLog(b => sendLog(client, b.guild.id, { action: 'Unban', user: b.user })));
}
