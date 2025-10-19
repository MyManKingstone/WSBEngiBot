// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

// Import the modular web server
const { startWebServer } = require('./utils/web');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Map();

// ---- Dynamically load all commands ----
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data || !command.execute) continue;
  client.commands.set(command.data.name, command);
}

// ---- Register slash commands ----
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
  try {
    const slashCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: slashCommands });
  } catch (err) { console.error(err); }
})();

// ---- Handle interactions ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try { await command.execute(interaction, client); } 
  catch (err) { console.error(err); if (!interaction.replied) await interaction.reply({ content: '❌ Error occurred', ephemeral: true }); }
});

// ---- Start modular web server ----
startWebServer();

// ---- Log in Discord bot ----
client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_BOT_TOKEN);
