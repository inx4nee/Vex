const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption(option => 
            option.setName('target').setDescription('The member to kick').setRequired(true))
        .addStringOption(option => 
            option.setName('reason').setDescription('The reason for the kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const user = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id);

        // Security Check
        if (!member.kickable) {
            return interaction.reply({ content: "❌ I cannot kick this user! They might have a higher role than me.", ephemeral: true });
        }

        await member.kick(reason);
        await interaction.reply(`👢 **${user.tag}** has been kicked. Reason: ${reason}`);
    },
};
