// commands/schedule.js
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { schedules, scheduleConfig, saveJSON, SCHEDULE_FILE } = require('../utils/storage');
const { getClassColor } = require('../utils/colors');

function generateId() {
  return `class-${Math.random().toString(36).slice(2, 8)}`;
}

const createEmbed = (schedule) => {
  return new EmbedBuilder()
    .setTitle(schedule.name || '📘 Class Schedule')
    .setColor(getClassColor(schedule.type))
    .addFields(
      { name: 'Professor', value: schedule.professor || '—', inline: true },
      { name: 'Location', value: schedule.location || '—', inline: true },
      { name: 'Date', value: schedule.date || '—', inline: true },
      { name: 'Time', value: schedule.time || '—', inline: true },
      { name: 'Type', value: schedule.type || '—', inline: true }
    )
    .setFooter({ text: `ID: ${schedule.id}` });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage class schedules')
    .addSubcommand(sub => sub.setName('menu').setDescription('Admin only — Create a new schedule entry'))
    .addSubcommand(sub => sub.setName('edit')
      .setDescription('Edit an existing schedule')
      .addStringOption(opt => opt.setName('id').setDescription('Class ID to edit').setRequired(true))
      .addStringOption(opt => opt.setName('field').setDescription('Field to edit').setRequired(true)
        .addChoices(
          { name: 'Name', value: 'name' },
          { name: 'Professor', value: 'professor' },
          { name: 'Location', value: 'location' },
          { name: 'Date', value: 'date' },
          { name: 'Time', value: 'time' },
          { name: 'Type of Class', value: 'type' }
        ))
      .addStringOption(opt => opt.setName('value').setDescription('New value').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a schedule entry')
      .addStringOption(opt => opt.setName('id').setDescription('Class ID to delete').setRequired(true)))
    .addSubcommand(sub => sub.setName('copy').setDescription('Copy a schedule entry')
      .addStringOption(opt => opt.setName('id').setDescription('Class ID to copy').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List all schedules'))
    .addSubcommand(sub => sub.setName('refresh').setDescription('Retroactively update all schedule embeds')),

  async execute(interaction) {
    try {
      const sub = interaction.options.getSubcommand();

      if (['menu','edit','delete','copy','refresh'].includes(sub) &&
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '❌ You must be an admin to use this command.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      switch(sub) {
        case 'menu': {
          const id = generateId();
          const schedule = { id, name: 'New Class', professor: '', location: '', date: '', time: '', type: '' };
          const embed = createEmbed(schedule);

          const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
          if (!channel) return interaction.editReply({ content: '⚠️ No schedule channel configured.' });

          const msg = await channel.send({ embeds: [embed] });
          schedule.messageId = msg.id;
          schedule.channelId = msg.channel.id;
          schedules[id] = schedule;
          saveJSON(SCHEDULE_FILE, schedules);

          return interaction.editReply({ content: `✅ Schedule created with ID **${id}**` });
        }

        case 'edit': {
          const id = interaction.options.getString('id');
          const field = interaction.options.getString('field');
          const value = interaction.options.getString('value');

          const schedule = schedules[id];
          if (!schedule) return interaction.editReply({ content: '❌ Schedule not found.' });

          schedule[field] = value;
          // ensure ID is present
          if (!schedule.id) schedule.id = id;

          const embed = createEmbed(schedule);
          try {
            const channel = await interaction.guild.channels.fetch(schedule.channelId);
            const msg = await channel.messages.fetch(schedule.messageId);
            await msg.edit({ embeds: [embed] });
          } catch {
            return interaction.editReply({ content: '⚠️ Failed to update message.' });
          }

          saveJSON(SCHEDULE_FILE, schedules);
          return interaction.editReply({ content: `✅ Updated ${field} for ${id}.` });
        }

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

        case 'copy': {
          const id = interaction.options.getString('id');
          const schedule = schedules[id];
          if (!schedule) return interaction.editReply({ content: '❌ Schedule not found.' });

          const newId = generateId();
          const clone = { ...schedule, id: newId };
          const embed = createEmbed(clone);

          const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
          if (!channel) return interaction.editReply({ content: '⚠️ Schedule channel not configured.' });

          const msg = await channel.send({ embeds: [embed] });
          clone.messageId = msg.id;
          clone.channelId = msg.channel.id;

          schedules[newId] = clone;
          saveJSON(SCHEDULE_FILE, schedules);
          return interaction.editReply({ content: `✅ Schedule copied as ${newId}` });
        }

        case 'list': {
          const list = Object.entries(schedules);
          if (!list.length) return interaction.editReply({ content: '📭 No schedules found.' });

          const text = list.map(([key, s]) => {
            const id = s.id || key;
            return `**${id}** → ${s.name || '—'} | ${s.professor || '—'} | ${s.location || '—'} | ${s.date || '—'} ${s.time || ''} (${s.type || '—'})`;
          }).join('\n');

          return interaction.editReply({ content: `📘 Current schedules:\n${text}` });
        }

        case 'refresh': {
          const updated = [];
          for (const id in schedules) {
            try {
              const schedule = schedules[id];
              if (!schedule.id) schedule.id = id;
              const embed = createEmbed(schedule);

              const channel = await interaction.guild.channels.fetch(schedule.channelId);
              const msg = await channel.messages.fetch(schedule.messageId);
              await msg.edit({ embeds: [embed] });
              updated.push(id);
            } catch (err) {
              console.warn(`⚠️ Failed to refresh schedule ${id}: ${err.message}`);
            }
          }
          return interaction.editReply({ content: `✅ Refreshed ${updated.length} schedule embed(s).` });
        }
      }
    } catch (err) {
      console.error('Error in schedule command:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ An error occurred.' });
      }
    }
  }
};
