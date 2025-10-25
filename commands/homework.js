// commands/homework.js
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
const { homeworks, homeworkConfig, scheduleConfig, saveHomeworks, saveHomeworkConfig } = require('../utils/storage');
const { CLASS_TYPE_COLORS } = require('../config');
const { ephemeralReply, ephemeralReplyWithDelete, generateId, validateDateFormat, splitIntoChunks } = require('../utils/helpers');

// Global menu state for homework builder
const menuState = {};

// ---------- HOMEWORK CHANNEL CONFIG ----------
async function handleHomeworkAddChannel(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!channel) return ephemeralReply(interaction, '⚠️ Invalid channel.');
  
  homeworkConfig.channelId = channel.id;
  await saveHomeworkConfig();
  return ephemeralReplyWithDelete(interaction, `✅ Homework posting channel set to ${channel}`);
}

// ---------- HOMEWORK MENU ----------
async function handleHomeworkMenu(interaction) {
  if (!homeworkConfig.channelId) {
    return ephemeralReply(interaction, '⚠️ Homework channel not set. Use /homework_addchannel');
  }

  if (!scheduleConfig.professors.length || !scheduleConfig.classnames.length) {
    return ephemeralReply(interaction, '⚠️ Populate professors and classnames first using schedule commands.');
  }

  // Step 1 menus: class, professor, type, turn-in method
  const classMenu = new StringSelectMenuBuilder()
    .setCustomId('hw-step1-classname')
    .setPlaceholder('Select Class Name')
    .addOptions(scheduleConfig.classnames.map(c => ({
      label: c,
      value: c
    })));

  const professorMenu = new StringSelectMenuBuilder()
    .setCustomId('hw-step1-professor')
    .setPlaceholder('Select Professor')
    .addOptions(scheduleConfig.professors.map(p => ({
      label: p,
      value: p
    })));

  const typeMenu = new StringSelectMenuBuilder()
    .setCustomId('hw-step1-type')
    .setPlaceholder('Select Class Type')
    .addOptions(Object.keys(CLASS_TYPE_COLORS).map(t => ({
      label: t,
      value: t
    })));

  const turnInMenu = new StringSelectMenuBuilder()
    .setCustomId('hw-step1-turnin')
    .setPlaceholder('Select Turn-in Method')
    .addOptions([
      { label: 'Email', value: 'Email' },
      { label: 'Moodle', value: 'Moodle' },
      { label: 'Teams', value: 'Teams' }
    ]);

  const row1 = new ActionRowBuilder().addComponents(classMenu);
  const row2 = new ActionRowBuilder().addComponents(professorMenu);
  const row3 = new ActionRowBuilder().addComponents(typeMenu);
  const row4 = new ActionRowBuilder().addComponents(turnInMenu);

  const nextButton = new ButtonBuilder()
    .setCustomId('hw-step1-next')
    .setLabel('➡️ Next')
    .setStyle(ButtonStyle.Primary);
  const row5 = new ActionRowBuilder().addComponents(nextButton);

  await interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📝 Homework Builder – Step 1').setDescription('Select class name, professor, type, and turn-in method.')],
    components: [row1, row2, row3, row4, row5],
    ephemeral: true
  });

  // Initialize menuState for this user
  menuState[interaction.user.id] = {
    step1: {},
    step2: {},
    channelId: homeworkConfig.channelId
  };
}

// ---------- HOMEWORK LIST ----------
async function handleHomeworkList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ids = Object.keys(homeworks);
  if (!ids.length) return interaction.editReply({ content: '📭 No homework assignments found.' });

  const chunks = [];
  let currentDesc = '';

  for (const id of ids) {
    const h = homeworks[id];
    const line = `• **${h.classname}** (ID: \`${id}\`) — Due: ${h.due} | ${h.type} | Prof: ${h.professor} | Turn-in: ${h.turnInMethod}\n`;
    if ((currentDesc + line).length > 4000) {
      chunks.push(currentDesc);
      currentDesc = '';
    }
    currentDesc += line;
  }
  if (currentDesc) chunks.push(currentDesc);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? '📝 Saved Homework Assignments' : '📝 Saved Homework Assignments (cont.)')
      .setDescription(chunks[i])
      .setColor(0x3498db);

    if (i === 0) await interaction.editReply({ embeds: [embed] });
    else await interaction.followUp({ embeds: [embed], ephemeral: true });
  }
}

// ---------- HOMEWORK EDIT ----------
async function handleHomeworkEdit(interaction) {
  const id = interaction.options.getString('id');
  const field = interaction.options.getString('field').toLowerCase();
  const value = interaction.options.getString('value');

  if (!homeworks[id]) return ephemeralReply(interaction, '⚠️ Homework ID not found.');

  const allowed = ['classname', 'professor', 'type', 'turninmethod', 'due', 'description'];
  if (!allowed.includes(field)) return ephemeralReply(interaction, `⚠️ Field must be one of: ${allowed.join(', ')}`);

  // Handle field name mapping
  const fieldMap = {
    'turninmethod': 'turnInMethod'
  };
  const actualField = fieldMap[field] || field;

  homeworks[id][actualField] = value;

  try {
    const ch = await interaction.client.channels.fetch(homeworks[id].channelId);
    const msg = await ch.messages.fetch(homeworks[id].messageId);

    const embed = new EmbedBuilder()
      .setTitle(`📝 ${homeworks[id].classname} - Homework`)
      .addFields(
        { name: 'Professor', value: homeworks[id].professor, inline: true },
        { name: 'Type', value: homeworks[id].type, inline: true },
        { name: 'Turn-in Method', value: homeworks[id].turnInMethod, inline: true },
        { name: 'Due Date', value: homeworks[id].due, inline: true },
        { name: 'Description', value: homeworks[id].description, inline: false }
      )
      .setColor(CLASS_TYPE_COLORS[homeworks[id].type] || 0x2f3136)
      .setFooter({ text: `ID: ${id}` });

    await msg.edit({ embeds: [embed] });
    await saveHomeworks();
    ephemeralReplyWithDelete(interaction, `✅ Homework \`${id}\` updated successfully.`);
  } catch (err) {
    console.error(err);
    ephemeralReply(interaction, '❌ Failed to edit homework embed. Check permissions.');
  }
}

// ---------- HOMEWORK DELETE ----------
async function handleHomeworkDelete(interaction) {
  const id = interaction.options.getString('id');
  if (!id || !homeworks[id]) return ephemeralReply(interaction, `⚠️ Homework ID \`${id}\` not found.`);

  try {
    const ch = await interaction.client.channels.fetch(homeworks[id].channelId);
    const msg = await ch.messages.fetch(homeworks[id].messageId);
    await msg.delete().catch(() => {});
  } catch {}

  delete homeworks[id];
  await saveHomeworks();
  ephemeralReplyWithDelete(interaction, `✅ Homework \`${id}\` deleted successfully.`);
}

// ---------- HOMEWORK COPY ----------
async function handleHomeworkCopy(interaction) {
  const id = interaction.options.getString('id');
  if (!id || !homeworks[id]) return ephemeralReply(interaction, `⚠️ Homework ID \`${id}\` not found.`);

  const original = homeworks[id];
  const newId = generateId('homework');
  try {
    const ch = await interaction.client.channels.fetch(original.channelId);
    const embed = new EmbedBuilder()
      .setTitle(`📝 ${original.classname} - Homework`)
      .addFields(
        { name: 'Professor', value: original.professor, inline: true },
        { name: 'Type', value: original.type, inline: true },
        { name: 'Turn-in Method', value: original.turnInMethod, inline: true },
        { name: 'Due Date', value: original.due, inline: true },
        { name: 'Description', value: original.description, inline: false }
      )
      .setColor(CLASS_TYPE_COLORS[original.type] || 0x2f3136)
      .setFooter({ text: `ID: ${newId}` });

    const msg = await ch.send({ embeds: [embed] });

    homeworks[newId] = {
      ...original,
      messageId: msg.id,
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString()
    };
    await saveHomeworks();
    ephemeralReplyWithDelete(interaction, `✅ Homework copied! New ID: \`${newId}\`.`);
  } catch (err) {
    console.error(err);
    ephemeralReply(interaction, '❌ Failed to copy homework. Check permissions.');
  }
}

module.exports = {
  // Config commands
  handleHomeworkAddChannel,
  
  // Homework management
  handleHomeworkMenu,
  handleHomeworkList,
  handleHomeworkEdit,
  handleHomeworkDelete,
  handleHomeworkCopy,
  
  // Menu state for homework builder
  menuState
};
