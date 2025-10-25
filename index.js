
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes
} = require('discord.js');

const express = require('express');

// Import modularized components
const { 
  DISCORD_BOT_TOKEN, 
  CLIENT_ID, 
  GUILD_ID, 
  PORT 
} = require('./config');
const { loadAllData } = require('./utils/storage');
const commands = require('./commands');
const { isAdmin } = require('./utils/helpers');

// Import command handlers
const { handleHelp } = require('./commands/help');
const { 
  handleCreateDropdown, 
  handleListDropdowns, 
  handleDeleteDropdown, 
  handleDropdownSelection 
} = require('./commands/dropdowns');
const {
  handleScheduleAddProfessor,
  handleScheduleAddLocation,
  handleScheduleAddClassname,
  handleScheduleAddDate,
  handleScheduleAddTime,
  handleScheduleAddChannel,
  handleScheduleMenu,
  handleScheduleList,
  handleScheduleEdit,
  handleScheduleDelete,
  handleScheduleCopy
} = require('./commands/schedule');
const {
  handleHomeworkAddChannel,
  handleHomeworkMenu,
  handleHomeworkList,
  handleHomeworkEdit,
  handleHomeworkDelete,
  handleHomeworkCopy
} = require('./commands/homework');

// Import interaction handlers
const {
  handleScheduleStep1Select,
  handleScheduleStep1Next,
  handleScheduleStep2Select,
  handleScheduleStep2Create,
  handleHomeworkStep1Select,
  handleHomeworkStep1Next,
  handleHomeworkStep2Modal
} = require('./handlers/interactions');

// ---------- Discord client ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ---------- Load all data from GitHub ----------
(async () => {
  await loadAllData();
})();

// ---------- Slash commands ----------

// ---------- Register slash commands ----------
const rest = new REST({
  version: '10'
}).setToken(DISCORD_BOT_TOKEN);
(async () => {
  try {
      console.log('Registering slash commands...');
      await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
              body: commands
          }
      );
      console.log('✅ Commands registered');
  } catch (err) {
      console.error('Failed to register commands:', err);
  }
})();

// ---------- Client ready ----------
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------- Interaction handler ----------
client.on('interactionCreate', async (interaction) => {
  try {
      const userIsAdmin = isAdmin(interaction);

      // ---------- HELP COMMAND ----------
      if (interaction.isChatInputCommand() && interaction.commandName === 'help') {
          return handleHelp(interaction);
      }

      // Admin-only check for other commands
      if (!userIsAdmin && interaction.isChatInputCommand() && interaction.commandName !== 'help') {
          return interaction.reply({
              content: '🚫 Admins only.',
              ephemeral: true
          });
      }

      // ---------- DROPDOWN COMMANDS ----------
      if (interaction.isChatInputCommand()) {
          if (interaction.commandName === 'createdropdown') {
              return handleCreateDropdown(interaction);
          }
          if (interaction.commandName === 'listdropdowns') {
              return handleListDropdowns(interaction);
          }
          if (interaction.commandName === 'deletedropdown') {
              return handleDeleteDropdown(interaction);
          }

          // ---------- HOMEWORK CHANNEL CONFIG ----------
          if (interaction.commandName === 'homework_addchannel') {
              return handleHomeworkAddChannel(interaction);
          }

          // ---------- SCHEDULE CONFIG COMMANDS ----------
          if (interaction.commandName === 'schedule_addprofessor') {
              return handleScheduleAddProfessor(interaction);
          }
          if (interaction.commandName === 'schedule_addlocation') {
              return handleScheduleAddLocation(interaction);
          }
          if (interaction.commandName === 'schedule_addclassname') {
              return handleScheduleAddClassname(interaction);
          }
          if (interaction.commandName === 'schedule_adddate') {
              return handleScheduleAddDate(interaction);
          }
          if (interaction.commandName === 'schedule_addtime') {
              return handleScheduleAddTime(interaction);
          }
          if (interaction.commandName === 'schedule_addchannel') {
              return handleScheduleAddChannel(interaction);
          }
      }

  } catch (err) {
      console.error('Interaction handler error:', err);
      if (interaction && !interaction.replied) {
          try {
              await interaction.reply({
                  content: '❌ An error occurred.',
                  ephemeral: true
              });
          } catch {}
      }
  }
});

// ---------- Schedule and Homework Menu Interactions ----------
client.on('interactionCreate', async (interaction) => {
  try {
      const userIsAdmin = isAdmin(interaction);

  // ---------- SCHEDULE MENU ----------
  if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_menu') {
          if (!userIsAdmin) {
          return interaction.reply({
              content: '🚫 Admins only.',
              ephemeral: true
          });
      }
          return handleScheduleMenu(interaction);
      }

      // ---------- HOMEWORK MENU ----------
      if (interaction.isChatInputCommand() && interaction.commandName === 'homework_menu') {
          if (!userIsAdmin) {
          return interaction.reply({
                  content: '🚫 Admins only.',
              ephemeral: true
          });
      }
          return handleHomeworkMenu(interaction);
      }

      // ---------- SCHEDULE STEP 1 SELECT MENUS ----------
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step1-')) {
          return handleScheduleStep1Select(interaction);
      }

      // ---------- SCHEDULE STEP 1 NEXT BUTTON ----------
  if (interaction.isButton() && interaction.customId === 'sched-step1-next') {
          return handleScheduleStep1Next(interaction);
      }

      // ---------- SCHEDULE STEP 2 SELECT MENUS ----------
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step2-')) {
          return handleScheduleStep2Select(interaction);
      }

      // ---------- SCHEDULE STEP 2 CREATE BUTTON ----------
  if (interaction.isButton() && interaction.customId === 'sched-step2-create') {
          return handleScheduleStep2Create(interaction);
  }

  // ---------- HOMEWORK STEP 1 SELECT MENUS ----------
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('hw-step1-')) {
          return handleHomeworkStep1Select(interaction);
  }

  // ---------- HOMEWORK STEP 1 NEXT BUTTON ----------
  if (interaction.isButton() && interaction.customId === 'hw-step1-next') {
          return handleHomeworkStep1Next(interaction);
  }

  // ---------- HOMEWORK STEP 2 MODAL ----------
  if (interaction.isModalSubmit() && interaction.customId === 'hw-step2-modal') {
          return handleHomeworkStep2Modal(interaction);
      }

      } catch (err) {
      console.error('Menu interaction handler error:', err);
      if (interaction && !interaction.replied) {
          try {
      await interaction.reply({
                  content: '❌ An error occurred.',
          ephemeral: true
      });
          } catch {}
      }
  }
});

// ---------- Component Interaction: Dropdowns and Management Commands ----------
client.on('interactionCreate', async (interaction) => {
  try {
      // ---------- Dropdown Role Selection ----------
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('dropdown-')) {
          return handleDropdownSelection(interaction);
      }

      // ---------- Schedule Management Commands ----------
      if (interaction.isChatInputCommand()) {
          if (interaction.commandName === 'schedule_list') {
              return handleScheduleList(interaction);
          }
          if (interaction.commandName === 'schedule_edit') {
              return handleScheduleEdit(interaction);
          }
          if (interaction.commandName === 'schedule_delete') {
              return handleScheduleDelete(interaction);
          }
          if (interaction.commandName === 'schedule_copy') {
              return handleScheduleCopy(interaction);
          }

          // ---------- Homework Management Commands ----------
          if (interaction.commandName === 'homework_list') {
              return handleHomeworkList(interaction);
          }
          if (interaction.commandName === 'homework_edit') {
              return handleHomeworkEdit(interaction);
          }
          if (interaction.commandName === 'homework_delete') {
              return handleHomeworkDelete(interaction);
          }
          if (interaction.commandName === 'homework_copy') {
              return handleHomeworkCopy(interaction);
          }
      }

          } catch (err) {
      console.error('Component interaction handler error:', err);
      if (interaction && !interaction.replied) {
          try {
              await interaction.reply({
                  content: '❌ An error occurred.',
                  ephemeral: true
              });
          } catch {}
      }
  }
});

// ---------- Keep-alive Express server for Render ----------
const app = express();

// Simple health check
app.get('/', (req, res) => res.send('Bot is running'));

// Use Render's assigned port or default to 3000
app.listen(PORT, () => console.log(`Webserver listening on port ${PORT}`));

// ---------- Login Discord Bot ----------
client.login(DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Discord bot logged in'))
  .catch(err => console.error('❌ Failed to login:', err));
