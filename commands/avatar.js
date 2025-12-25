const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get the full-size avatar of a user.')
        .addUserOption(option => 
            option.setName('target').setDescription('The user to fetch').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('target') || interaction.user;

        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('#5865F2')
            .setFooter({ text: `Requested by ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });
    },
};
