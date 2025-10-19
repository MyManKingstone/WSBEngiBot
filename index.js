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

  // Support array of commands
  if (Array.isArray(command.data)) {
    for (const cmdData of command.data) {
      if (!cmdData || !cmdData.name) continue;
      client.commands.set(cmdData.name, { data: cmdData, execute: command.execute });
    }
  } else {
    client.commands.set(command.data.name, command);
  }
}

// ---- Register slash commands ----
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
  try {
    const slashCommands = [];
    for (const cmd of client.commands.values()) {
      slashCommands.push(cmd.data.toJSON());
    }

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: slashCommands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();

// ------- Handle Per User Reactions -----------
client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('markdone-')) {
    const hwId = interaction.customId.split('-')[1];
    if (!homeworkStatus[hwId]) homeworkStatus[hwId] = {};

    const userId = interaction.user.id;
    homeworkStatus[hwId][userId] = !homeworkStatus[hwId][userId]; // toggle done status

    await interaction.reply({
      content: homeworkStatus[hwId][userId] ? '✅ You marked this homework as done!' : '❌ You unmarked this homework.',
      ephemeral: true
    });
  }
});

// ---- Handle interactions ----
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error executing command ${interaction.commandName}:`, err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Error occurred', ephemeral: true });
    }
  }
});

// ---- Start modular web server ----
startWebServer();

// ---- Log in Discord bot ----
client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Discord bot logged in.'))
  .catch(err => console.error('❌ Login failed:', err));
