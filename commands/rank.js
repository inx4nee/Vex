const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const fs = require('fs');
module.exports = {
    data: new SlashCommandBuilder().setName('rank').setDescription('Check level'),
    async execute(interaction) {
        const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
        const stats = data[interaction.guild.id]?.levels[interaction.user.id] || { xp: 0, level: 1 };
        
        const canvas = Canvas.createCanvas(700, 250);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#23272a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '40px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(interaction.user.username, 220, 100);
        ctx.font = '30px sans-serif'; ctx.fillStyle = '#7289da'; ctx.fillText(`Lvl: ${stats.level} | XP: ${stats.xp}`, 220, 150);
        
        ctx.beginPath(); ctx.arc(125, 125, 80, 0, Math.PI*2, true); ctx.closePath(); ctx.clip();
        const avatar = await Canvas.loadImage(interaction.user.displayAvatarURL({ extension: 'jpg' }));
        ctx.drawImage(avatar, 25, 25, 200, 200);
        
        interaction.reply({ files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' })] });
    }
};
