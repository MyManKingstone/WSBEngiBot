// commands/schedule.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require('discord.js');

const {
  schedules,
  scheduleConfig,
  dropdownMappings,
  saveJSON,
  SCHEDULE_FILE,
  DROPDOWN_FILE
} = require('../utils/storage');
const { getClassColor } = require('../utils/colors');

// Generate unique IDs for each schedule
function generateId() {
  return `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Create a properly formatted embed for a schedule
function createScheduleEmbed(schedule) {
  return new EmbedBuilder()
    .setTitle(schedule.name || '📘 New Class Schedule')
    .setColor(getClassColor(schedule.type))
    .addFields(
      { name: 'Professor', value: schedule.professor || '—', inline: true },
      { name: 'Location', value: schedule.location || '—', inline: true },
      { name: 'Date', value: schedule.date || '—', inline: true },
      { name: 'Time', value: schedule.time || '—', inline: true },
      { name: 'Type', value: schedule.type || '—', inline: true }
    )
    .setFooter({ text: `ID: ${schedule.id}` });
}

// Create dropdown component sets
function createDropdowns(id) {
  const makeSelect = (customId, placeholder, options) =>
    new StringSelectMenuBuilder()
      .setCustomId(`${customId}-${id}`)
      .setPlaceholder(placeholder)
      .addOptions(options.map(opt => ({ label: opt, value: opt })));

  const classMenu = makeSelect('name', '📘 Select Class Name', scheduleConfig.classnames);
  const professorMenu = makeSelect('professor', '👩‍🏫 Select Professor', scheduleConfig.professors);
  const locationMenu = makeSelect('location', '📍 Select Location', scheduleConfig.locations);
  const dateMenu = makeSelect('date', '📅 Select Date', scheduleConfig.dates);
  const timeMenu = makeSelect('time', '⏰ Select Time', scheduleConfig.times);

  const typeMenu = new StringSelectMenuBuilder()
    .setCustomId(`type-${id}`)
    .setPlaceholder('🎓 Select Class Type')
    .addOptions([
      { label: 'Lecture', value: 'Wyklad' },
      { label: 'Lab', value: 'Laboratorium' },
      { label: 'Seminar', value: 'Seminarium' },
      { label: 'E-Learning', value: 'E-Learning' }
    ]);

  return [
    new ActionRowBuilder().addComponents(classMenu),
    new ActionRowBuilder().addComponents(professorMenu),
    new ActionRowBuilder().addComponents(locationMenu),
    new ActionRowBuilder().addComponents(dateMenu),
    new ActionRowBuilder().addComponents(timeMenu),
    new ActionRowBuilder().addComponents(typeMenu)
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage and edit the class schedule system.')
    .addSubcommand(sub =>
      sub.setName('menu').setDescription('🧑‍💼 Admin only — Create a new schedule entry'))
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('✏️ Edit an existing schedule entry')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Class ID to edit')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('field')
            .setDescription('Which field to edit')
            .setRequired(true)
            .addChoices(
              { name: 'Name', value: 'name' },
              { name: 'Professor', value: 'professor' },
              { name: 'Location', value: 'location' },
              { name: 'Date', value: 'date' },
              { name: 'Time', value: 'time' },
              { name: 'Type', value: 'type' }
            ))
        .addStringOption(opt =>
          opt.setName('value')
            .setDescription('New value')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('🗑️ Delete a schedule entry')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Class ID to delete')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('copy')
        .setDescription('📋 Copy a schedule entry')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Class ID to copy')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('📜 List all schedules'))
    .addSubcommand(sub =>
      sub.setName('refresh')
        .setDescription('🔄 Update all existing schedule embeds')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (
        ['menu', 'edit', 'delete', 'copy', 'refresh'].includes(sub) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return interaction.reply({
          content: '❌ You must be an administrator to use this command.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      switch (sub) {
        // 🧩 CREATE NEW SCHEDULE
        case 'menu': {
          const id = generateId();
          const schedule = {
            id,
            name: 'New Class',
            professor: '',
            location: '',
            date: '',
            time: '',
            type: ''
          };

          const embed = createScheduleEmbed(schedule);
          const components = createDropdowns(id);

          const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
          if (!channel)
            return interaction.editReply({
              content: '⚠️ No schedule channel configured in `schedule_config.json`.'
            });

          const msg = await channel.send({ embeds: [embed], components });
          schedule.messageId = msg.id;
          schedule.channelId = msg.channel.id;

          schedules[id] = schedule;
          dropdownMappings[msg.id] = id;

          saveJSON(SCHEDULE_FILE, schedules);
          saveJSON(DROPDOWN_FILE, dropdownMappings);

          return interaction.editReply({
            content: `✅ Created new schedule **${id}** and posted embed in <#${channel.id}>`
          });
        }

        // 📝 MANUAL EDIT VIA COMMAND
        case 'edit': {
          const id = interaction.options.getString('id');
          const field = interaction.options.getString('field');
          const value = interaction.options.getString('value');

          const schedule = schedules[id];
          if (!schedule) return interaction.editReply({ content: '❌ Schedule not found.' });

          schedule[field] = value;
          const embed = createScheduleEmbed(schedule);

          try {
            const channel = await interaction.guild.channels.fetch(schedule.channelId);
            const msg = await channel.messages.fetch(schedule.messageId);
            await msg.edit({ embeds: [embed] });
          } catch {
            return interaction.editReply({ content: '⚠️ Failed to update the embed message.' });
          }

          saveJSON(SCHEDULE_FILE, schedules);
          return interaction.editReply({ content: `✅ Updated **${field}** for ${id}.` });
        }

        // 🗑️ DELETE SCHEDULE
        case 'delete': {
          const id = interaction.options.getString('id');
          const schedule = schedules[id];
          if (!schedule) return interaction.editReply({ content: '❌ Schedule not found.' });

          try {
            const channel = await interaction.guild.channels.fetch(schedule.channelId);
            const msg = await channel.messages.fetch(schedule.messageId);
            await msg.delete().catch(() => null);
          } catch {}

          delete schedules[id];
          saveJSON(SCHEDULE_FILE, schedules);

          return interaction.editReply({ content: `🗑️ Deleted schedule ${id}.` });
        }

        // 📋 COPY SCHEDULE
        case 'copy': {
          const id = interaction.options.getString('id');
          const original = schedules[id];
          if (!original) return interaction.editReply({ content: '❌ Schedule not found.' });

          const newId = generateId();
          const clone = { ...original, id: newId };
          const embed = createScheduleEmbed(clone);
          const components = createDropdowns(newId);

          const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
          if (!channel)
            return interaction.editReply({
              content: '⚠️ Schedule channel not configured in `schedule_config.json`.'
            });

          const msg = await channel.send({ embeds: [embed], components });
          clone.messageId = msg.id;
          clone.channelId = msg.channel.id;

          schedules[newId] = clone;
          dropdownMappings[msg.id] = newId;

          saveJSON(SCHEDULE_FILE, schedules);
          saveJSON(DROPDOWN_FILE, dropdownMappings);

          return interaction.editReply({ content: `✅ Schedule copied as ${newId}.` });
        }

        // 📜 LIST ALL
        case 'list': {
          const entries = Object.values(schedules);
          if (!entries.length)
            return interaction.editReply({ content: '📭 No schedules currently stored.' });

          const list = entries
            .map(
              s =>
                `**${s.id}** → ${s.name || '—'} | ${s.professor || '—'} | ${s.date || '—'} ${s.time || ''} (${s.type || '—'})`
            )
            .join('\n');

          return interaction.editReply({ content: `📘 **Current Schedules:**\n${list}` });
        }

        // 🔄 REFRESH EMBEDS
        case 'refresh': {
          let updated = 0;

          for (const id in schedules) {
            try {
              const schedule = schedules[id];
              const channel = await interaction.guild.channels.fetch(schedule.channelId);
              const msg = await channel.messages.fetch(schedule.messageId);

              const embed = createScheduleEmbed(schedule);
              const components = createDropdowns(id);
              await msg.edit({ embeds: [embed], components });
              updated++;
            } catch (err) {
              console.warn(`⚠️ Failed to refresh ${id}: ${err.message}`);
            }
          }

          return interaction.editReply({
            content: `✅ Refreshed ${updated} schedule embed${updated === 1 ? '' : 's'}.`
          });
        }
      }
    } catch (err) {
      console.error('Error executing /schedule:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ An error occurred.' });
      }
    }
  }
};
