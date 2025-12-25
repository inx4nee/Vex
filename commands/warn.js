const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user and log it.')
        .addUserOption(option => 
            option.setName('target').setDescription('User to warn').setRequired(true))
        .addStringOption(option => 
            option.setName('reason').setDescription('Reason for warning').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');
        const guildId = interaction.guild.id;

        // 1. Load Data
        let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
        
        // Ensure data structure exists
        if (!data[guildId]) data[guildId] = {};
        if (!data[guildId].warnings) data[guildId].warnings = {};
        if (!data[guildId].warnings[target.id]) data[guildId].warnings[target.id] = [];
        
        // 2. Add Warning
        const warningInfo = {
            reason: reason,
            moderator: interaction.user.tag,
            date: new Date().toLocaleDateString()
        };

        data[guildId].warnings[target.id].push(warningInfo);
        
        // Save Data
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));

        // 3. Reply to Chat
        const embed = new EmbedBuilder()
            .setTitle('⚠️ User Warned')
            .setColor('#DA373C')
            .addFields(
                { name: 'User', value: target.tag, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Total Warns', value: `${data[guildId].warnings[target.id].length}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });

        // 4. DM the user
        try {
            await target.send(`⚠️ You were warned in **${interaction.guild.name}** for: ${reason}`);
        } catch (err) {
            // User probably has DMs off, ignore error
        }
    },
};
