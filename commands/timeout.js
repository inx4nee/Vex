const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout (mute) a member.')
        .addUserOption(option => 
            option.setName('target').setDescription('The member to timeout').setRequired(true))
        .addIntegerOption(option => 
            option.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => 
            option.setName('reason').setDescription('Reason for timeout'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const user = interaction.options.getUser('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id);

        if (!member.moderatable) {
            return interaction.reply({ content: "❌ I cannot timeout this user. Check my role position.", ephemeral: true });
        }

        // Convert minutes to milliseconds for Discord API
        await member.timeout(duration * 60 * 1000, reason);
        await interaction.reply(`🤐 **${user.tag}** has been timed out for ${duration} minutes. Reason: ${reason}`);
    },
};
