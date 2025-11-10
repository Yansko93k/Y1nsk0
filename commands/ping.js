import { SlashCommandBuilder } from 'discord.js';


export const data = new SlashCommandBuilder()
.setName('ping')
.setDescription('Répond Pong !');


export async function execute(interaction) {
const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
const latency = sent.createdTimestamp - interaction.createdTimestamp;
await interaction.editReply(`Pong ! Latence : ${latency}ms`);
}