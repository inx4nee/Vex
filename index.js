require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder, AuditLogEvent, ActivityType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dashboard = require('./dashboard');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// --- COMMAND HANDLER SETUP ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// --- HELPER: DATA MANAGEMENT ---
function getGuildData(guildId) {
    let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) {
        data[guildId] = { 
            badWords: [],
            welcome: { enabled: false, channelId: null, message: "Welcome {user} to {server}!" },
            levels: {}, 
            customCommands: {},
            logging: { channelId: null },
            afk: {},
            warnings: {}
        };
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    }
    return data;
}

function getLogChannel(guild) {
    const data = getGuildData(guild.id);
    const logChannelId = data[guild.id]?.logging?.channelId;
    if (!logChannelId) return null;
    return guild.channels.cache.get(logChannelId);
}

// --- EVENT: READY ---
client.once(Events.ClientReady, c => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    
    // START DASHBOARD
    dashboard.run(client);

    // RICH PRESENCE
    // Update the URL below to your Railway URL when deployed
    const dashboardURL = process.env.CALLBACK_URL.split('/auth')[0] || "vex-bot.railway.app";
    client.user.setPresence({
        activities: [{ 
            name: `/help | ${dashboardURL}`, 
            type: ActivityType.Watching 
        }],
        status: 'online',
    });
});

// --- EVENT: WELCOME MESSAGE ---
client.on(Events.GuildMemberAdd, async member => {
    const data = getGuildData(member.guild.id);
    const settings = data[member.guild.id].welcome;

    if (settings.enabled && settings.channelId) {
        const channel = member.guild.channels.cache.get(settings.channelId);
        if (channel) {
            let msg = settings.message
                .replace('{user}', `<@${member.id}>`)
                .replace('{server}', member.guild.name)
                .replace('{memberCount}', member.guild.memberCount);
            channel.send(msg);
        }
    }
});

// --- EVENT: MESSAGE CREATE (Auto-Mod, Leveling, AFK, Custom Commands) ---
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    const guildId = message.guild.id;
    // Ensure data exists
    if (!data[guildId]) data = getGuildData(guildId);
    
    const guildData = data[guildId];

    // 1. AFK CHECKS
    // Remove AFK if user speaks
    if (guildData.afk && guildData.afk[message.author.id]) {
        delete guildData.afk[message.author.id];
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
        message.reply(`👋 Welcome back, ${message.author}! I removed your AFK status.`);
    }
    // Check if mentioned user is AFK
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (guildData.afk && guildData.afk[user.id]) {
                const afkData = guildData.afk[user.id];
                message.reply(`💤 **${user.username}** is AFK: ${afkData.reason} (<t:${Math.floor(afkData.timestamp / 1000)}:R>)`);
            }
        });
    }

    // 2. AUTO-MOD (Bad Words)
    if (guildData.badWords && guildData.badWords.length > 0) {
        const foundBadWord = guildData.badWords.some(word => message.content.toLowerCase().includes(word.toLowerCase()));
        if (foundBadWord) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ **${message.author.tag}**, that language is not allowed!`);
                return; // Stop processing
            } catch (err) { console.log("Missing permissions to delete message"); }
        }
    }

    // 3. CUSTOM COMMANDS
    if (guildData.customCommands && guildData.customCommands[message.content]) {
        return message.channel.send(guildData.customCommands[message.content]);
    }

    // 4. LEVELING
    if (!guildData.levels[message.author.id]) {
        guildData.levels[message.author.id] = { xp: 0, level: 1 };
    }
    const userStats = guildData.levels[message.author.id];
    userStats.xp += Math.floor(Math.random() * 10) + 15;
    const xpNeeded = userStats.level * 100;
    
    if (userStats.xp >= xpNeeded) {
        userStats.level++;
        userStats.xp = 0;
        message.channel.send(`🎉 GG ${message.author}, you just advanced to **Level ${userStats.level}**!`);
    }
    
    // Save all changes
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
});

// --- EVENT: AUDIT LOGS ---
client.on(Events.MessageDelete, async message => {
    if (!message.guild || message.author.bot) return;
    const logChannel = getLogChannel(message.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(0xFF0000)
        .addFields(
            { name: 'User', value: `${message.author.tag}`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Content', value: message.content || '[Image/Embed]' }
        ).setTimestamp();
    logChannel.send({ embeds: [embed] });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannel = getLogChannel(oldMessage.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .setColor(0xFFA500)
        .addFields(
            { name: 'User', value: `${oldMessage.author.tag}`, inline: true },
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
            { name: 'Old', value: oldMessage.content || '[Unknown]' },
            { name: 'New', value: newMessage.content || '[Unknown]' }
        ).setTimestamp();
    logChannel.send({ embeds: [embed] });
});

// --- EVENT: INTERACTIONS (Slash Commands, Buttons) ---
client.on(Events.InteractionCreate, async interaction => {
    
    // 1. BUTTONS (Tickets & Roles)
    if (interaction.isButton()) {
        // TICKET CREATE
        if (interaction.customId === 'ticket_create') {
            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) return interaction.reply({ content: `❌ You already have a ticket: ${existingChannel}`, ephemeral: true });

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
            );
            await ticketChannel.send({ content: `👋 Hello ${interaction.user}! Support will be here shortly.`, components: [row] });
            return interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
        }

        // TICKET CLOSE
        if (interaction.customId === 'ticket_close') {
            await interaction.reply("Deleting ticket in 5 seconds...");
            setTimeout(() => interaction.channel.delete(), 5000);
            return;
        }

        // REACTION ROLES
        if (interaction.customId.startsWith('role_')) {
            const roleId = interaction.customId.split('_')[1];
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) return interaction.reply({ content: "❌ Role not found.", ephemeral: true });

            const member = interaction.member;
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                return interaction.reply({ content: `➖ Removed **${role.name}** role.`, ephemeral: true });
            } else {
                await member.roles.add(role);
                return interaction.reply({ content: `➕ Added **${role.name}** role!`, ephemeral: true });
            }
        }
    }

    // 2. SLASH COMMANDS
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Error executing command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Error executing command!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
