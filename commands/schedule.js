// commands/schedule.js
const { 
  StringSelectMenuBuilder, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { schedules, scheduleConfig, saveSchedules, saveConfig } = require('../utils/storage');
const { CLASS_TYPE_COLORS } = require('../config');
const { ephemeralReply, ephemeralReplyWithDelete, generateId, splitIntoChunks } = require('../utils/helpers');

// Global menu state for schedule builder
const menuState = {};

// ---------- SCHEDULE CONFIG COMMANDS ----------
async function handleScheduleAddProfessor(interaction) {
  const value = interaction.options.getString('name');
  if (!value) return ephemeralReply(interaction, '⚠️ Missing value.');

  if (!scheduleConfig.professors.includes(value)) {
    scheduleConfig.professors.push(value);
    await saveConfig();
    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`professors\``);
  } else {
    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`professors\`.`);
  }
}

async function handleScheduleAddLocation(interaction) {
  const value = interaction.options.getString('name');
  if (!value) return ephemeralReply(interaction, '⚠️ Missing value.');

  if (!scheduleConfig.locations.includes(value)) {
    scheduleConfig.locations.push(value);
    await saveConfig();
    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`locations\``);
  } else {
    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`locations\`.`);
  }
}

async function handleScheduleAddClassname(interaction) {
  const value = interaction.options.getString('name');
  if (!value) return ephemeralReply(interaction, '⚠️ Missing value.');

  if (!scheduleConfig.classnames.includes(value)) {
    scheduleConfig.classnames.push(value);
    await saveConfig();
    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`classnames\``);
  } else {
    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`classnames\`.`);
  }
}

async function handleScheduleAddDate(interaction) {
  const value = interaction.options.getString('date');
  if (!value) return ephemeralReply(interaction, '⚠️ Missing value.');

  if (!scheduleConfig.dates.includes(value)) {
    scheduleConfig.dates.push(value);
    await saveConfig();
    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`dates\``);
  } else {
    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`dates\`.`);
  }
}

async function handleScheduleAddTime(interaction) {
  const value = interaction.options.getString('time');
  if (!value) return ephemeralReply(interaction, '⚠️ Missing value.');

  if (!scheduleConfig.times.includes(value)) {
    scheduleConfig.times.push(value);
    await saveConfig();
    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`times\``);
  } else {
    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`times\`.`);
  }
}

async function handleScheduleAddChannel(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!channel) return ephemeralReply(interaction, '⚠️ Invalid channel.');
  
  scheduleConfig.channelId = channel.id;
  await saveConfig();
  return ephemeralReplyWithDelete(interaction, `✅ Schedule posting channel set to ${channel}`);
}

// ---------- SCHEDULE MENU ----------
async function handleScheduleMenu(interaction) {
  if (!scheduleConfig.channelId) {
    return ephemeralReply(interaction, '⚠️ Schedule channel not set. Use /schedule_addchannel');
  }

  if (!scheduleConfig.professors.length || !scheduleConfig.classnames.length || 
      !scheduleConfig.dates.length || !scheduleConfig.times.length || !scheduleConfig.locations.length) {
    return ephemeralReply(interaction, '⚠️ Populate professors, classnames, dates, times, and locations first.');
  }

  // Step 1 menus: class, professor, type
  const classMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step1-classname')
    .setPlaceholder('Select Class Name')
    .addOptions(scheduleConfig.classnames.map(c => ({
      label: c,
      value: c
    })));

  const professorMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step1-professor')
    .setPlaceholder('Select Professor')
    .addOptions(scheduleConfig.professors.map(p => ({
      label: p,
      value: p
    })));

  const typeMenu = new StringSelectMenuBuilder()
    .setCustomId('sched-step1-type')
    .setPlaceholder('Select Class Type')
    .addOptions(Object.keys(CLASS_TYPE_COLORS).map(t => ({
      label: t,
      value: t
    })));

  const row1 = new ActionRowBuilder().addComponents(classMenu);
  const row2 = new ActionRowBuilder().addComponents(professorMenu);
  const row3 = new ActionRowBuilder().addComponents(typeMenu);

  const nextButton = new ButtonBuilder()
    .setCustomId('sched-step1-next')
    .setLabel('➡️ Next')
    .setStyle(ButtonStyle.Primary);
  const row4 = new ActionRowBuilder().addComponents(nextButton);

  await interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📅 Schedule Builder – Step 1').setDescription('Select class name, professor, and type.')],
    components: [row1, row2, row3, row4],
    ephemeral: true
  });

  // Initialize menuState for this user
  menuState[interaction.user.id] = {
    step1: {},
    step2: {},
    channelId: scheduleConfig.channelId
  };
}

// ---------- SCHEDULE LIST ----------
async function handleScheduleList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ids = Object.keys(schedules);
  if (!ids.length) return interaction.editReply({ content: '📭 No schedules found.' });

  const chunks = [];
  let currentDesc = '';

  for (const id of ids) {
    const s = schedules[id];
    const line = `• **${s.name}** (ID: \`${id}\`) — ${s.date} ${s.time} | ${s.type} | Prof: ${s.professor} | Loc: ${s.location}\n`;
    if ((currentDesc + line).length > 4000) {
      chunks.push(currentDesc);
      currentDesc = '';
    }
    currentDesc += line;
  }
  if (currentDesc) chunks.push(currentDesc);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? '🗓️ Saved Schedules' : '🗓️ Saved Schedules (cont.)')
      .setDescription(chunks[i])
      .setColor(0x3498db);

    if (i === 0) await interaction.editReply({ embeds: [embed] });
    else await interaction.followUp({ embeds: [embed], ephemeral: true });
  }
}

// ---------- SCHEDULE EDIT ----------
async function handleScheduleEdit(interaction) {
  const id = interaction.options.getString('id');
  const field = interaction.options.getString('field').toLowerCase();
  const value = interaction.options.getString('value');

  if (!schedules[id]) return ephemeralReply(interaction, '⚠️ Schedule ID not found.');

  const allowed = ['name', 'professor', 'type', 'date', 'time', 'location'];
  if (!allowed.includes(field)) return ephemeralReply(interaction, `⚠️ Field must be one of: ${allowed.join(', ')}`);

  schedules[id][field] = value;

  try {
    const ch = await interaction.client.channels.fetch(schedules[id].channelId);
    const msg = await ch.messages.fetch(schedules[id].messageId);

    const embed = new EmbedBuilder()
      .setTitle(`📚 ${schedules[id].name}`)
      .addFields(
        { name: 'Professor', value: schedules[id].professor, inline: true },
        { name: 'Location', value: schedules[id].location, inline: true },
        { name: 'Type', value: schedules[id].type, inline: true },
        { name: 'Date', value: schedules[id].date, inline: true },
        { name: 'Time', value: schedules[id].time, inline: true }
      )
      .setColor(CLASS_TYPE_COLORS[schedules[id].type] || 0x2f3136)
      .setFooter({ text: `ID: ${id}` });

              await msg.edit({ embeds: [embed] });
    await saveSchedules();
    ephemeralReplyWithDelete(interaction, `✅ Schedule \`${id}\` updated successfully.`);
            } catch (err) {
    console.error(err);
    ephemeralReply(interaction, '❌ Failed to edit schedule embed. Check permissions.');
  }
}

// ---------- SCHEDULE DELETE ----------
async function handleScheduleDelete(interaction) {
  const id = interaction.options.getString('id');
  if (!id || !schedules[id]) return ephemeralReply(interaction, `⚠️ Schedule ID \`${id}\` not found.`);

  try {
    const ch = await interaction.client.channels.fetch(schedules[id].channelId);
    const msg = await ch.messages.fetch(schedules[id].messageId);
    await msg.delete().catch(() => {});
  } catch {}

  delete schedules[id];
  await saveSchedules();
  ephemeralReplyWithDelete(interaction, `✅ Schedule \`${id}\` deleted successfully.`);
}

// ---------- SCHEDULE COPY ----------
async function handleScheduleCopy(interaction) {
  const id = interaction.options.getString('id');
  if (!id || !schedules[id]) return ephemeralReply(interaction, `⚠️ Schedule ID \`${id}\` not found.`);

  const original = schedules[id];
  const newId = generateId('class');
  try {
    const ch = await interaction.client.channels.fetch(original.channelId);
    const embed = new EmbedBuilder()
      .setTitle(`📚 ${original.name}`)
      .addFields(
        { name: 'Professor', value: original.professor, inline: true },
        { name: 'Location', value: original.location, inline: true },
        { name: 'Type', value: original.type, inline: true },
        { name: 'Date', value: original.date, inline: true },
        { name: 'Time', value: original.time, inline: true }
      )
      .setColor(CLASS_TYPE_COLORS[original.type] || 0x2f3136)
      .setFooter({ text: `ID: ${newId}` });

    const msg = await ch.send({ embeds: [embed] });

    schedules[newId] = {
      ...original,
      messageId: msg.id,
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString()
    };
    await saveSchedules();
    ephemeralReplyWithDelete(interaction, `✅ Schedule copied! New ID: \`${newId}\`.`);
    } catch (err) {
    console.error(err);
    ephemeralReply(interaction, '❌ Failed to copy schedule. Check permissions.');
  }
}

module.exports = {
  // Config commands
  handleScheduleAddProfessor,
  handleScheduleAddLocation,
  handleScheduleAddClassname,
  handleScheduleAddDate,
  handleScheduleAddTime,
  handleScheduleAddChannel,
  
  // Schedule management
  handleScheduleMenu,
  handleScheduleList,
  handleScheduleEdit,
  handleScheduleDelete,
  handleScheduleCopy,
  
  // Menu state for schedule builder
  menuState
};
