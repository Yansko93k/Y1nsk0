import { EmbedBuilder } from 'discord.js';

export const logChannels = new Map(); // guildId -> channelId

export function makeLogEmbed({ guild, action, user, extra }) {
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

export async function sendLog(client, guildId, { action, user, extra }) {
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

export function registerLogs(client) {
  client.on('guildMemberAdd', member => sendLog(client, member.guild.id, { action: 'Nouveau membre', user: member.user }));
  client.on('guildMemberRemove', member => sendLog(client, member.guild.id, { action: 'Membre quitté', user: member.user }));
  client.on('guildMemberUpdate', (oldMember, newMember) => {
    const changes = [];
    if (oldMember.nickname !== newMember.nickname) changes.push(`Pseudo: ${oldMember.nickname || oldMember.user.username} → ${newMember.nickname || newMember.user.username}`);
    const oldRoles = oldMember.roles.cache.map(r => r.id).join(',');
    const newRoles = newMember.roles.cache.map(r => r.id).join(',');
    if (oldRoles !== newRoles) changes.push(`Rôles: ${oldRoles} → ${newRoles}`);
    if (changes.length) sendLog(client, newMember.guild.id, { action: 'Membre modifié', user: newMember.user, extra: changes.join('\n') });
  });

  client.on('messageCreate', m => { if (!m.author.bot) sendLog(client, m.guild.id, { action: 'Message créé', user: m.author, extra: m.content }) });
  client.on('messageUpdate', (oldM, newM) => {
    if (oldM.content !== newM.content) sendLog(client, oldM.guild.id, { action: 'Message modifié', user: oldM.author, extra: `Avant: ${oldM.content}\nAprès: ${newM.content}` });
  });
  client.on('messageDelete', m => { if (!m.author.bot) sendLog(client, m.guild.id, { action: 'Message supprimé', user: m.author, extra: m.content }) });
  client.on('messageDeleteBulk', msgs => {
    const guild = msgs.first()?.guild;
    if (guild) sendLog(client, guild.id, { action: 'Suppression massive', extra: `Nombre: ${msgs.size}` });
  });

  client.on('channelCreate', ch => sendLog(client, ch.guild.id, { action: 'Salon créé', extra: `${ch.name} | Type: ${ch.type}` }));
  client.on('channelDelete', ch => sendLog(client, ch.guild.id, { action: 'Salon supprimé', extra: `${ch.name} | Type: ${ch.type}` }));
  client.on('channelUpdate', (oldCh, newCh) => {
    const changes = [];
    if (oldCh.name !== newCh.name) changes.push(`Nom: ${oldCh.name} → ${newCh.name}`);
    if (oldCh.topic !== newCh.topic) changes.push(`Topic: ${oldCh.topic} → ${newCh.topic}`);
    if (oldCh.rateLimitPerUser !== newCh.rateLimitPerUser) changes.push(`Slowmode: ${oldCh.rateLimitPerUser}s → ${newCh.rateLimitPerUser}s`);
    if (changes.length) sendLog(client, newCh.guild.id, { action: 'Salon modifié', extra: changes.join('\n') });
  });

  client.on('roleCreate', r => sendLog(client, r.guild.id, { action: 'Rôle créé', extra: `${r.name} | ID: ${r.id}` }));
  client.on('roleDelete', r => sendLog(client, r.guild.id, { action: 'Rôle supprimé', extra: `${r.name} | ID: ${r.id}` }));
  client.on('roleUpdate', (oldR, newR) => {
    const changes = [];
    if (oldR.name !== newR.name) changes.push(`Nom: ${oldR.name} → ${newR.name}`);
    if (oldR.color !== newR.color) changes.push(`Couleur: ${oldR.color} → ${newR.color}`);
    if (changes.length) sendLog(client, newR.guild.id, { action: 'Rôle modifié', extra: changes.join('\n') });
  });

  client.on('voiceStateUpdate', (oldS, newS) => {
    const user = newS.member?.user || oldS.member?.user;
    const guildId = newS.guild.id;
    if (!user) return;
    if (!oldS.channel && newS.channel) sendLog(client, guildId, { action: 'Entrée vocal', user, extra: `Salon: ${newS.channel.name}` });
    if (oldS.channel && !newS.channel) sendLog(client, guildId, { action: 'Sortie vocal', user, extra: `Salon: ${oldS.channel.name}` });
    if (oldS.channelId !== newS.channelId) sendLog(client, guildId, { action: 'Déplacement vocal', user, extra: `${oldS.channel.name} → ${newS.channel.name}` });
    if (oldS.serverMute !== newS.serverMute) sendLog(client, guildId, { action: `Mute: ${newS.serverMute}`, user });
    if (oldS.serverDeaf !== newS.serverDeaf) sendLog(client, guildId, { action: `Deaf: ${newS.serverDeaf}`, user });
  });

  client.on('guildBanAdd', ban => sendLog(client, ban.guild.id, { action: 'Ban', user: ban.user }));
  client.on('guildBanRemove', ban => sendLog(client, ban.guild.id, { action: 'Unban', user: ban.user }));
}
