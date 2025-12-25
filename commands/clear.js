const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete a specific amount of messages.')
        .addIntegerOption(option => 
            option.setName('amount').setDescription('Number of messages to clear (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        await interaction.channel.bulkDelete(amount, true).catch(error => {
            console.error(error);
            return interaction.reply({ content: 'There was an error trying to prune messages in this channel!', ephemeral: true });
        });

        await interaction.reply({ content: `🧹 Successfully deleted **${amount}** messages.`, ephemeral: true });
    },
};
