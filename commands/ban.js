const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user').addUserOption(o=>o.setName('target').setRequired(true).setDescription('User')).addStringOption(o=>o.setName('reason').setDescription('Reason')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const user = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(user.id);
        if (!member.bannable) return interaction.reply({content:'Cannot ban this user.', ephemeral:true});
        await member.ban({ reason: interaction.options.getString('reason') ?? 'No reason' });
        interaction.reply(`🔨 Banned ${user.tag}`);
    }
};
