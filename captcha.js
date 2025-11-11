// captcha.js
import { sendLog } from './logs.js';

export const welcomeChannels = new Map(); // guildId -> channelId
export const captchaChannels = new Map(); // guildId -> channelId
export const rolesNonVerif = new Map();   // guildId -> roleId Non vérifié
export const rolesVerif = new Map();      // guildId -> roleId Vérifié

export async function handleNewMember(client, member) {
  try {
    const guild = member.guild;
    const welcomeChannel = guild.channels.cache.get(welcomeChannels.get(guild.id)) || guild.systemChannel;
    const captchaChannel = guild.channels.cache.get(captchaChannels.get(guild.id)) || welcomeChannel;
    const roleNon = guild.roles.cache.get(rolesNonVerif.get(guild.id));
    const roleVerif = guild.roles.cache.get(rolesVerif.get(guild.id));

    if (roleNon) await member.roles.add(roleNon).catch(() => {});

    const captchaCode = Math.floor(1000 + Math.random() * 9000).toString();
    const captchaMessage = await captchaChannel.send({ content: `${member}, envoie ce code : \`${captchaCode}\`` });

    const collector = captchaChannel.createMessageCollector({ filter: m => m.author.id === member.id, time: 120000, max: 1 });

    collector.on('collect', async (msg) => {
      if (msg.content.trim() === captchaCode) {
        msg.delete().catch(() => {});
        captchaMessage.delete().catch(() => {});
        if (roleNon) member.roles.remove(roleNon).catch(() => {});
        if (roleVerif) member.roles.add(roleVerif).catch(() => {});
        sendLog(client, guild.id, { action: 'Captcha validé', user: member.user });
        member.send('Captcha validé, bienvenue !').catch(() => {});
      } else {
        msg.delete().catch(() => {});
        captchaMessage.delete().catch(() => {});
        if (member.kickable) await member.kick('Captcha incorrect');
        sendLog(client, guild.id, { action: 'Captcha échoué', user: member.user, extra: `Entré : ${msg.content}` });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        captchaMessage.delete().catch(() => {});
        if (member.kickable) await member.kick('Timeout captcha');
        sendLog(client, guild.id, { action: 'Captcha timeout', user: member.user, extra: `Code attendu : ${captchaCode}` });
      }
    });

  } catch (err) {
    console.error('handleNewMember error:', err);
  }
}
