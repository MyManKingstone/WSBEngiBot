// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Map();

// ---- Dynamically load all commands ----
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data || !command.execute) {
    console.warn(`⚠️ Skipping invalid command file: ${file}`);
    continue;
  }
  client.commands.set(command.data.name, command);
  console.log(`✅ Loaded command: ${command.data.name}`);
}

// ---- Register slash commands with Discord ----
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    const slashCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: slashCommands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();

// ---- Handle interactions ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error running command ${interaction.commandName}:`, err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred while executing the command.', ephemeral: true });
    }
  }
});

// ---- Keep-alive web server (for Replit / Render) ----
const app = express();
app.get('/', (req, res) => res.send('✅ Bot is running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server online on port ${PORT}`));

// ---- Log in ----
client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));

client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Discord bot logged in.'))
  .catch(err => console.error('❌ Login failed:', err));
