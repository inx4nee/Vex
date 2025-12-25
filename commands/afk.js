const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
module.exports = {
    data: new SlashCommandBuilder().setName('afk').setDescription('Set AFK status').addStringOption(o=>o.setName('reason').setDescription('Reason')),
    async execute(interaction) {
        let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
        if (!data[interaction.guild.id]) data[interaction.guild.id] = {};
        if (!data[interaction.guild.id].afk) data[interaction.guild.id].afk = {};
        data[interaction.guild.id].afk[interaction.user.id] = { reason: interaction.options.getString('reason') || 'Busy', timestamp: Date.now() };
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
        interaction.reply({ content: '💤 Set to AFK.', ephemeral: true });
    }
};
