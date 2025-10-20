require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const { startWebServer } = require('./utils/web');
const { schedules, saveJSON, SCHEDULE_FILE, scheduleConfig } = require('./utils/storage');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ---------- Global menu state ----------
client.menuState = {}; // store per-user menu sessions

// ---------- Load Commands ----------
client.commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  if (!cmd.data || !cmd.execute) continue;
  client.commands.set(cmd.data.name, cmd);
}

// ---------- Register Slash Commands ----------
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
  try {
    const commandsJSON = Array.from(client.commands.values())
      .filter(c => c.data && typeof c.data.toJSON === 'function')
      .map(c => c.data.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsJSON }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();

// ---------- Homework Button Tracking ----------
const homeworkStatus = {};
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  // Homework mark done toggle
  if (interaction.customId.startsWith('markdone-')) {
    const hwId = interaction.customId.split('-')[1];
    if (!homeworkStatus[hwId]) homeworkStatus[hwId] = {};

    const userId = interaction.user.id;
    homeworkStatus[hwId][userId] = !homeworkStatus[hwId][userId];

    return interaction.reply({
      content: homeworkStatus[hwId][userId]
        ? '✅ You marked this homework as done!'
        : '❌ You unmarked this homework.',
      ephemeral: true
    });
  }
});

// ---------- Unified Interaction Handler ----------
client.on('interactionCreate', async interaction => {
  try {
    // ---- Slash Commands ----
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`❌ Error executing ${interaction.commandName}:`, err);
        if (!interaction.replied && !interaction.deferred)
          await interaction.reply({ content: '❌ Error occurred', ephemeral: true });
      }
    }

    // ---- Component Handling (Buttons/Dropdowns) ----
    if (interaction.isStringSelectMenu() || interaction.isButton()) {
      const scheduleCommand = client.commands.get('schedule'); // only schedule has component handling
      if (!scheduleCommand || !scheduleCommand.handleComponent) return;
      await scheduleCommand.handleComponent(interaction, client);
    }
  } catch (err) {
    console.error('❌ Interaction handler failed:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Internal error occurred', ephemeral: true });
      }
    } catch (_) {}
  }
});

// ---------- Start Web Server ----------
startWebServer();

// ---------- Discord Bot Login ----------
client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Discord bot logged in.'))
  .catch(err => console.error('❌ Login failed:', err));
