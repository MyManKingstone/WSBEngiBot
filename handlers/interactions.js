// handlers/interactions.js
const { 
  StringSelectMenuBuilder, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { CLASS_TYPE_COLORS } = require('../config');
const { ephemeralReplyWithDelete, generateId, validateDateFormat } = require('../utils/helpers');
const { schedules, homeworks, saveSchedules, saveHomeworks } = require('../utils/storage');
const { menuState: scheduleMenuState } = require('../commands/schedule');
const { menuState: homeworkMenuState } = require('../commands/homework');

// ---------- SCHEDULE MENU INTERACTIONS ----------
async function handleScheduleStep1Select(interaction) {
  const userId = interaction.user.id;
  const state = scheduleMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const field = interaction.customId.replace('sched-step1-', '');
  state.step1[field] = interaction.values[0];

  return ephemeralReplyWithDelete(interaction, `✅ Selected **${field}: ${interaction.values[0]}**`);
}

async function handleScheduleStep1Next(interaction) {
  const userId = interaction.user.id;
  const state = scheduleMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const required = ['classname', 'professor', 'type'];
  for (const f of required) {
    if (!state.step1[f]) return interaction.reply({
      content: `⚠️ Please select **${f}** before proceeding.`,
      ephemeral: true
    });
  }

  // Step 2 menus: date, time, location
  const { scheduleConfig } = require('../utils/storage');
  
  const dateMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step2-date')
    .setPlaceholder('Select Date')
    .addOptions(scheduleConfig.dates.map(d => ({
      label: d,
      value: d
    })));

  const timeMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step2-time')
    .setPlaceholder('Select Time')
    .addOptions(scheduleConfig.times.map(t => ({
      label: t,
      value: t
    })));

  const locationMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step2-location')
    .setPlaceholder('Select Location')
    .addOptions(scheduleConfig.locations.map(l => ({
      label: l,
      value: l
    })));

  const row1 = new ActionRowBuilder().addComponents(dateMenu);
  const row2 = new ActionRowBuilder().addComponents(timeMenu);
  const row3 = new ActionRowBuilder().addComponents(locationMenu);

  const createButton = new ButtonBuilder()
    .setCustomId('sched-step2-create')
    .setLabel('✅ Create Schedule')
    .setStyle(ButtonStyle.Success);
  const row4 = new ActionRowBuilder().addComponents(createButton);

  await interaction.update({
    embeds: [new EmbedBuilder().setTitle('📅 Schedule Builder – Step 2').setDescription('Select date, time, and location.')],
    components: [row1, row2, row3, row4]
  });
}

async function handleScheduleStep2Select(interaction) {
  const userId = interaction.user.id;
  const state = scheduleMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const field = interaction.customId.replace('sched-step2-', '');
  state.step2[field] = interaction.values[0];

  return ephemeralReplyWithDelete(interaction, `✅ Selected **${field}: ${interaction.values[0]}**`);
}

async function handleScheduleStep2Create(interaction) {
  const userId = interaction.user.id;
  const state = scheduleMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const required = ['date', 'time', 'location'];
  for (const f of required) {
    if (!state.step2[f]) return interaction.reply({
      content: `⚠️ Please select **${f}** before creating schedule.`,
      ephemeral: true
    });
  }

  const { classname, professor, type } = state.step1;
  const { date, time, location } = state.step2;
  const color = CLASS_TYPE_COLORS[type] || 0x2f3136;

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
    const ch = await interaction.client.channels.fetch(state.channelId);
    const msg = await ch.send({ embeds: [embed] });

    // Save schedule
    const id = generateId('class');
    schedules[id] = {
      name: classname,
      professor,
      type,
      date,
      time,
      location,
      channelId: ch.id,
      messageId: msg.id,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    await saveSchedules();

    // Cleanup menuState
    delete scheduleMenuState[userId];

    await interaction.update({
      content: `✅ Schedule created in <#${ch.id}> (ID: \`${id}\`).`,
      embeds: [],
      components: []
    });
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to post schedule. Check bot permissions.',
      ephemeral: true
    });
  }
}

// ---------- HOMEWORK MENU INTERACTIONS ----------
async function handleHomeworkStep1Select(interaction) {
  const userId = interaction.user.id;
  const state = homeworkMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const field = interaction.customId.replace('hw-step1-', '');
  state.step1[field] = interaction.values[0];

  return ephemeralReplyWithDelete(interaction, `✅ Selected **${field}: ${interaction.values[0]}**`);
}

async function handleHomeworkStep1Next(interaction) {
  const userId = interaction.user.id;
  const state = homeworkMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const required = ['classname', 'professor', 'type', 'turnin'];
  for (const f of required) {
    if (!state.step1[f]) return interaction.reply({
      content: `⚠️ Please select **${f}** before proceeding.`,
      ephemeral: true
    });
  }

  // Show modal for Step 2
  const modal = new ModalBuilder()
    .setCustomId('hw-step2-modal')
    .setTitle('Homework Details');

  const dueDateInput = new TextInputBuilder()
    .setCustomId('hw-due-date')
    .setLabel('Due Date (YYYY-MM-DD)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2024-01-15')
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('hw-description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe the homework assignment...')
    .setRequired(true);

  const row1 = new ActionRowBuilder().addComponents(dueDateInput);
  const row2 = new ActionRowBuilder().addComponents(descriptionInput);

  modal.addComponents(row1, row2);

  await interaction.showModal(modal);
}

async function handleHomeworkStep2Modal(interaction) {
  const userId = interaction.user.id;
  const state = homeworkMenuState[userId];
  if (!state) return interaction.reply({
    content: '⚠️ Menu session expired.',
    ephemeral: true
  });

  const dueDate = interaction.fields.getTextInputValue('hw-due-date');
  const description = interaction.fields.getTextInputValue('hw-description');

  // Validate date format
  if (!validateDateFormat(dueDate)) {
    return interaction.reply({
      content: '⚠️ Invalid date format. Use YYYY-MM-DD.',
      ephemeral: true
    });
  }

  const { classname, professor, type, turnin } = state.step1;
  const color = CLASS_TYPE_COLORS[type] || 0x2f3136;

  // Generate ID first
  const id = generateId('homework');

  const embed = new EmbedBuilder()
    .setTitle(`📝 ${classname} - Homework`)
    .addFields(
      { name: 'Professor', value: professor, inline: true },
      { name: 'Type', value: type, inline: true },
      { name: 'Turn-in Method', value: turnin, inline: true },
      { name: 'Due Date', value: dueDate, inline: true },
      { name: 'Description', value: description, inline: false }
    )
    .setColor(color)
    .setFooter({ text: `ID: ${id}` });

  try {
    const ch = await interaction.client.channels.fetch(state.channelId);
    const msg = await ch.send({ embeds: [embed] });

    // Save homework
    homeworks[id] = {
      classname,
      professor,
      type,
      turnInMethod: turnin,
      due: dueDate,
      description,
      channelId: ch.id,
      messageId: msg.id,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    await saveHomeworks();

    // Cleanup menuState
    delete homeworkMenuState[userId];

    await ephemeralReplyWithDelete(interaction, `✅ Homework created in <#${ch.id}> (ID: \`${id}\`).`);
  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: '❌ Failed to post homework. Check bot permissions.',
      ephemeral: true
    });
  }
}

module.exports = {
  // Schedule interactions
  handleScheduleStep1Select,
  handleScheduleStep1Next,
  handleScheduleStep2Select,
  handleScheduleStep2Create,
  
  // Homework interactions
  handleHomeworkStep1Select,
  handleHomeworkStep1Next,
  handleHomeworkStep2Modal
};
