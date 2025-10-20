require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const { startWebServer } = require('./utils/web');
const { schedules, saveJSON, SCHEDULE_FILE, scheduleConfig } = require('./utils/storage');
const { getClassColor } = require('./utils/colors');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ---- Global temporary menu state ----
const menuState = {};
client.menuState = menuState;

// Command map
client.commands = new Map();

// ---------- Load Commands ----------
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (!command.data || !command.execute) continue;
  client.commands.set(command.data.name, command);
}

// ---------- Register Slash Commands ----------
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
  try {
    const slashCommands = Array.from(client.commands.values())
  .filter(cmd => cmd.data && typeof cmd.data.toJSON === 'function')
  .map(cmd => cmd.data.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: slashCommands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
})();

// ---------- Homework Done Button ----------
const homeworkStatus = {};
client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('markdone-')) {
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

// ---------- Handle Slash Commands ----------
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`❌ Error executing ${interaction.commandName}:`, err);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Error occurred', ephemeral: true });
      }
    }
  }

  // ---------- Handle Schedule Menu Steps ----------
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step1-')) {
    const userId = interaction.user.id;
    const state = menuState[userId];
    if (!state) return interaction.reply({ content: '⚠️ Session expired.', ephemeral: true });

    const field = interaction.customId.replace('sched-step1-', '');
    state.step1[field] = interaction.values[0];
    return interaction.reply({ content: `✅ Selected **${field}: ${interaction.values[0]}**`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'sched-step1-next') {
    const userId = interaction.user.id;
    const state = menuState[userId];
    if (!state) return interaction.reply({ content: '⚠️ Session expired.', ephemeral: true });

    const required = ['classname', 'professor', 'type'];
    for (const f of required) {
      if (!state.step1[f])
        return interaction.reply({ content: `⚠️ Please select **${f}** first.`, ephemeral: true });
    }

    // Step 2 menus
    const dateMenu = new StringSelectMenuBuilder()
      .setCustomId('sched-step2-date')
      .setPlaceholder('Select Date')
      .addOptions(scheduleConfig.dates.map(d => ({ label: d, value: d })));

    const timeMenu = new StringSelectMenuBuilder()
      .setCustomId('sched-step2-time')
      .setPlaceholder('Select Time')
      .addOptions(scheduleConfig.times.map(t => ({ label: t, value: t })));

    const locationMenu = new StringSelectMenuBuilder()
      .setCustomId('sched-step2-location')
      .setPlaceholder('Select Location')
      .addOptions(scheduleConfig.locations.map(l => ({ label: l, value: l })));

    const createButton = new ButtonBuilder()
      .setCustomId('sched-step2-create')
      .setLabel('✅ Create Schedule')
      .setStyle(ButtonStyle.Success);

    const rows = [
      new ActionRowBuilder().addComponents(dateMenu),
      new ActionRowBuilder().addComponents(timeMenu),
      new ActionRowBuilder().addComponents(locationMenu),
      new ActionRowBuilder().addComponents(createButton),
    ];

    await interaction.update({
      embeds: [new EmbedBuilder().setTitle('📅 Schedule Builder – Step 2').setDescription('Select date, time, and location.')],
      components: rows
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step2-')) {
    const userId = interaction.user.id;
    const state = menuState[userId];
    if (!state) return interaction.reply({ content: '⚠️ Session expired.', ephemeral: true });

    const field = interaction.customId.replace('sched-step2-', '');
    state.step2[field] = interaction.values[0];
    return interaction.reply({ content: `✅ Selected **${field}: ${interaction.values[0]}**`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'sched-step2-create') {
    const userId = interaction.user.id;
    const state = menuState[userId];
    if (!state) return interaction.reply({ content: '⚠️ Session expired.', ephemeral: true });

    const required = ['date', 'time', 'location'];
    for (const f of required) {
      if (!state.step2[f])
        return interaction.reply({ content: `⚠️ Please select **${f}** before creating.`, ephemeral: true });
    }

    const { classname, professor, type } = state.step1;
    const { date, time, location } = state.step2;
    const color = getClassColor(type);

    const embed = new EmbedBuilder()
      .setTitle(`📚 ${classname}`)
      .addFields(
        { name: 'Professor', value: professor, inline: true },
        { name: 'Location', value: location, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Date', value: date, inline: true },
        { name: 'Time', value: time, inline: true }
      )
      .setColor(color);

    try {
      const ch = await client.channels.fetch(state.channelId);
      const msg = await ch.send({ embeds: [embed] });

      const id = `class-${Date.now()}`;
      schedules[id] = { id, name: classname, professor, type, date, time, location, channelId: ch.id, messageId: msg.id };
      saveJSON(SCHEDULE_FILE, schedules);

      delete menuState[userId];
      await interaction.update({ content: `✅ Schedule created in <#${ch.id}> (\`${id}\`)`, embeds: [], components: [] });
    } catch (err) {
      console.error('❌ Failed to post schedule:', err);
      return interaction.reply({ content: '❌ Failed to post schedule. Check permissions.', ephemeral: true });
    }
  }
});

// ---------- Start Web Server + Bot ----------
startWebServer();

client.once('ready', () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Discord bot logged in.'))
  .catch(err => console.error('❌ Login failed:', err));
