const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
let botClient = null;

// Permission Helper
function isUserAdmin(guild) {
    return (guild.permissions & 0x20) === 0x20; 
}

// Config
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Passport Strategy
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

// Middleware
function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Routes
app.get('/login', (req, res) => res.render('login'));
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));
app.get('/logout', (req, res) => { req.logout(() => res.redirect('/login')); });

// 1. SELECT SERVER
app.get('/', checkAuth, (req, res) => {
    const adminGuilds = req.user.guilds.filter(guild => isUserAdmin(guild));
    res.render('select-server', { user: req.user, guilds: adminGuilds });
});

// 2. MANAGE SERVER
app.get('/manage/:guildId', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const guild = req.user.guilds.find(g => g.id === guildId);
    if (!guild || !isUserAdmin(guild)) return res.send("⛔ Unauthorized.");

    let data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) data[guildId] = { badWords: [], welcome: {}, customCommands: {}, logging: {} };

    res.render('manage-server', { 
        user: req.user,
        guild: guild,
        badWords: data[guildId].badWords || [],
        welcome: data[guildId].welcome || {},
        customCommands: data[guildId].customCommands || {},
        logging: data[guildId].logging || {}
    });
});

// 3. POST ROUTES
// Add Bad Word
app.post('/manage/:guildId/add', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) data[guildId] = { badWords: [] };
    if (!data[guildId].badWords.includes(req.body.word)) {
        data[guildId].badWords.push(req.body.word);
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    }
    res.redirect(`/manage/${guildId}`);
});

// Remove Bad Word
app.post('/manage/:guildId/remove', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (data[guildId]) {
        data[guildId].badWords = data[guildId].badWords.filter(w => w !== req.body.word);
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    }
    res.redirect(`/manage/${guildId}`);
});

// Welcome Settings
app.post('/manage/:guildId/welcome', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) data[guildId] = {};
    data[guildId].welcome = {
        enabled: req.body.enabled === 'true',
        channelId: req.body.channelId,
        message: req.body.message
    };
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    res.redirect(`/manage/${guildId}`);
});

// Custom Commands
app.post('/manage/:guildId/custom-command', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId].customCommands) data[guildId].customCommands = {};
    data[guildId].customCommands[req.body.trigger] = req.body.reply;
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    res.redirect(`/manage/${guildId}`);
});

// Delete Custom Command
app.post('/manage/:guildId/delete-command', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (data[guildId]?.customCommands) {
        delete data[guildId].customCommands[req.body.trigger];
        fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    }
    res.redirect(`/manage/${guildId}`);
});

// Create Reaction Role Panel
app.post('/manage/:guildId/create-role-panel', checkAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const { channelId, roleId, buttonLabel, messageText } = req.body;
    try {
        const discordGuild = botClient.guilds.cache.get(guildId);
        const channel = discordGuild.channels.cache.get(channelId);
        if (channel) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`role_${roleId}`).setLabel(buttonLabel || "Get Role").setStyle(ButtonStyle.Primary)
            );
            await channel.send({ content: messageText, components: [row] });
        }
    } catch (e) { console.error(e); }
    res.redirect(`/manage/${guildId}`);
});

// Create Ticket Panel
app.post('/manage/:guildId/create-ticket-panel', checkAuth, async (req, res) => {
    const guildId = req.params.guildId;
    const { channelId, title } = req.body;
    try {
        const discordGuild = botClient.guilds.cache.get(guildId);
        const channel = discordGuild.channels.cache.get(channelId);
        if (channel) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_create').setLabel('📩 Open Ticket').setStyle(ButtonStyle.Success)
            );
            await channel.send({ content: `**${title}**\nClick below to contact support.`, components: [row] });
        }
    } catch (e) { console.error(e); }
    res.redirect(`/manage/${guildId}`);
});

// Logging
app.post('/manage/:guildId/logging', checkAuth, (req, res) => {
    const guildId = req.params.guildId;
    const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    if (!data[guildId]) data[guildId] = {};
    data[guildId].logging = { channelId: req.body.logChannelId };
    fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
    res.redirect(`/manage/${guildId}`);
});

function run(client) {
    botClient = client;
    app.listen(PORT, () => console.log(`🌐 Dashboard running on port ${PORT}`));
}
module.exports = { run };
