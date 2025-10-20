// commands/schedule.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');
const {
  schedules,
  scheduleConfig,
  saveJSON,
  SCHEDULE_FILE,
  CLASS_TYPE_COLORS
} = require('../utils/storage');

const menuState = {}; // temporary memory per user

function generateId() {
  return `class-${Math.random().toString(36).slice(2, 8)}`;
}

function createScheduleEmbed(data, id) {
  return new EmbedBuilder()
    .setTitle(`📚 ${data.name}`)
    .addFields(
      { name: 'Professor', value: data.professor, inline: true },
      { name: 'Location', value: data.location, inline: true },
      { name: 'Type', value: data.type, inline: true },
      { name: 'Date', value: data.date, inline: true },
      { name: 'Time', value: data.time, inline: true }
    )
    .setColor(CLASS_TYPE_COLORS[data.type?.toLowerCase()] || 0x2f3136)
    .setFooter({ text: `ID: ${id}` });
}

async function ephemeralReply(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied)
      await interaction.followUp({ content, ephemeral: true });
    else
      await interaction.reply({ content, ephemeral: true });
  } catch (_) {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage and create class schedules')
    .addSubcommand(sub =>
      sub
        .setName('menu')
        .setDescription('Interactive schedule builder (admin only)')
    )
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit an existing schedule')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Class ID').setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('field')
            .setDescription('Field to edit')
            .setRequired(true)
            .addChoices(
              { name: 'Name', value: 'name' },
              { name: 'Professor', value: 'professor' },
              { name: 'Location', value: 'location' },
              { name: 'Date', value: 'date' },
              { name: 'Time', value: 'time' },
              { name: 'Type', value: 'type' }
            )
        )
        .addStringOption(opt =>
          opt.setName('value').setDescription('New value').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a schedule entry')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Class ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('copy')
        .setDescription('Copy a schedule entry')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Class ID').setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List all schedules'))
    .addSubcommand(sub =>
      sub.setName('refresh').setDescription('Refresh schedule embeds')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'menu') {
      // permission check
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
          content: '🚫 Admins only.',
          ephemeral: true
        });
      }

      // sanity checks
      if (!scheduleConfig.channelId)
        return interaction.reply({
          content: '⚠️ Schedule channel not set. Use /schedule_addchannel.',
          ephemeral: true
        });

      const requiredFields = [
        'professors',
        'classnames',
        'dates',
        'times',
        'locations'
      ];
      if (requiredFields.some(f => !scheduleConfig[f]?.length)) {
        return interaction.reply({
          content:
            '⚠️ Populate professors, classnames, dates, times, and locations first.',
          ephemeral: true
        });
      }

      // Step 1 dropdowns
      const classMenu = new StringSelectMenuBuilder()
        .setCustomId('sched-step1-classname')
        .setPlaceholder('Select Class Name')
        .addOptions(scheduleConfig.classnames.map(c => ({ label: c, value: c })));

      const professorMenu = new StringSelectMenuBuilder()
        .setCustomId('sched-step1-professor')
        .setPlaceholder('Select Professor')
        .addOptions(scheduleConfig.professors.map(p => ({ label: p, value: p })));

      const typeMenu = new StringSelectMenuBuilder()
        .setCustomId('sched-step1-type')
        .setPlaceholder('Select Class Type')
        .addOptions(
          Object.keys(CLASS_TYPE_COLORS).map(t => ({
            label: t.charAt(0).toUpperCase() + t.slice(1),
            value: t
          }))
        );

      const nextBtn = new ButtonBuilder()
        .setCustomId('sched-step1-next')
        .setLabel('➡️ Next')
        .setStyle(ButtonStyle.Primary);

      const rows = [
        new ActionRowBuilder().addComponents(classMenu),
        new ActionRowBuilder().addComponents(professorMenu),
        new ActionRowBuilder().addComponents(typeMenu),
        new ActionRowBuilder().addComponents(nextBtn)
      ];

      menuState[interaction.user.id] = { step1: {}, step2: {} };

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📅 Schedule Builder – Step 1')
            .setDescription('Select class name, professor, and type.')
        ],
        components: rows,
        ephemeral: true
      });
    }

    // ---- /edit, /delete, /copy, /list, /refresh keep old behavior ----
    // These can be identical to your previous version.
    if (sub === 'edit' || sub === 'delete' || sub === 'copy' || sub === 'list' || sub === 'refresh') {
      // ... (reuse your existing code from before for these subcommands)
    }
  },

  // ---------- COMPONENT HANDLERS ----------
  async handleComponent(interaction, client) {
    const userId = interaction.user.id;
    const state = menuState[userId];

    // Step 1 select menus
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step1-')) {
      if (!state)
        return ephemeralReply(interaction, '⚠️ Menu session expired.');

      const field = interaction.customId.replace('sched-step1-', '');
      state.step1[field] = interaction.values[0];
      return ephemeralReply(interaction, `✅ Selected **${field}: ${interaction.values[0]}**`);
    }

    // Step 1 next button
    if (interaction.isButton() && interaction.customId === 'sched-step1-next') {
      if (!state)
        return ephemeralReply(interaction, '⚠️ Menu session expired.');

      const required = ['classname', 'professor', 'type'];
      for (const r of required) {
        if (!state.step1[r])
          return ephemeralReply(interaction, `⚠️ Please select **${r}** first.`);
      }

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

      const createBtn = new ButtonBuilder()
        .setCustomId('sched-step2-create')
        .setLabel('✅ Create Schedule')
        .setStyle(ButtonStyle.Success);

      const rows = [
        new ActionRowBuilder().addComponents(dateMenu),
        new ActionRowBuilder().addComponents(timeMenu),
        new ActionRowBuilder().addComponents(locationMenu),
        new ActionRowBuilder().addComponents(createBtn)
      ];

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('📅 Schedule Builder – Step 2')
            .setDescription('Select date, time, and location.')
        ],
        components: rows
      });
    }

    // Step 2 select menus
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step2-')) {
      if (!state)
        return ephemeralReply(interaction, '⚠️ Menu session expired.');

      const field = interaction.customId.replace('sched-step2-', '');
      state.step2[field] = interaction.values[0];
      return ephemeralReply(interaction, `✅ Selected **${field}: ${interaction.values[0]}**`);
    }

    // Step 2 create button
    if (interaction.isButton() && interaction.customId === 'sched-step2-create') {
      if (!state)
        return ephemeralReply(interaction, '⚠️ Menu session expired.');

      const required = ['date', 'time', 'location'];
      for (const r of required) {
        if (!state.step2[r])
          return ephemeralReply(interaction, `⚠️ Please select **${r}** first.`);
      }

      const { classname, professor, type } = state.step1;
      const { date, time, location } = state.step2;
      const id = generateId();

      const scheduleData = {
        id,
        name: classname,
        professor,
        type,
        date,
        time,
        location,
        createdBy: userId,
        createdAt: new Date().toISOString()
      };

      try {
        const ch = await client.channels.fetch(scheduleConfig.channelId);
        const embed = createScheduleEmbed(scheduleData, id);
        const msg = await ch.send({ embeds: [embed] });

        scheduleData.channelId = ch.id;
        scheduleData.messageId = msg.id;
        schedules[id] = scheduleData;
        saveJSON(SCHEDULE_FILE, schedules);

        delete menuState[userId];
        return interaction.update({
          content: `✅ Schedule created in <#${ch.id}> (ID: \`${id}\`).`,
          embeds: [],
          components: []
        });
      } catch (err) {
        console.error('Schedule create failed:', err);
        return ephemeralReply(interaction, '❌ Failed to post schedule.');
      }
    }
  }
};
