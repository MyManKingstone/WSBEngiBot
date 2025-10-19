// commands/schedule.js
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { schedules, scheduleConfig, saveJSON, SCHEDULE_FILE } = require('../utils/storage');
const { getClassColor } = require('../utils/colors');
const path = require('path');

function generateId() {
  return `class-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage class schedules')
    .addSubcommand(sub => 
      sub.setName('menu')
        .setDescription('Admin only — Create a new schedule entry'))
    .addSubcommand(sub => 
      sub.setName('edit')
        .setDescription('Edit an existing schedule')
        .addStringOption(opt => opt.setName('id').setDescription('Class ID to edit').setRequired(true))
        .addStringOption(opt => opt.setName('field').setDescription('Field to edit').setRequired(true)
          .addChoices(
            { name: 'Professor', value: 'professor' },
            { name: 'Location', value: 'location' },
            { name: 'Date', value: 'date' },
            { name: 'Time', value: 'time' },
            { name: 'Type of Class', value: 'type' }
          ))
        .addStringOption(opt => opt.setName('value').setDescription('New value').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a schedule entry')
        .addStringOption(opt => opt.setName('id').setDescription('Class ID to delete').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('copy')
        .setDescription('Copy a schedule entry to create a new one')
        .addStringOption(opt => opt.setName('id').setDescription('Class ID to copy').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all current schedules')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Only allow admins for modification commands
    if (['menu', 'edit', 'delete', 'copy'].includes(sub) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ You must be an admin to use this command.', ephemeral: true });
    }

    switch (sub) {
      case 'menu': {
        const id = generateId();

        const embed = new EmbedBuilder()
          .setTitle('🆕 New Class Schedule Created')
          .setDescription('This is a placeholder schedule. Use `/schedule edit` to update its fields.')
          .setColor(0x95A5A6)
          .addFields(
            { name: 'ID', value: id, inline: true },
            { name: 'Professor', value: '—', inline: true },
            { name: 'Location', value: '—', inline: true },
            { name: 'Date', value: '—', inline: true },
            { name: 'Time', value: '—', inline: true },
            { name: 'Type', value: '—', inline: true }
          );

        const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
        if (!channel) {
          return interaction.reply({ content: '⚠️ No schedule channel configured. Set one first in config.', ephemeral: true });
        }

        const msg = await channel.send({ embeds: [embed] });

        schedules[id] = {
          id,
          professor: '',
          location: '',
          date: '',
          time: '',
          type: '',
          messageId: msg.id,
          channelId: msg.channel.id,
        };

        saveJSON(SCHEDULE_FILE, schedules);
        return interaction.reply({ content: `✅ Schedule created with ID **${id}**`, ephemeral: true });
      }

      case 'edit': {
        const id = interaction.options.getString('id');
        const field = interaction.options.getString('field');
        const value = interaction.options.getString('value');

        if (!schedules[id]) {
          return interaction.reply({ content: '❌ No schedule found with that ID.', ephemeral: true });
        }

        schedules[id][field] = value;

        const updatedEmbed = new EmbedBuilder()
          .setTitle('📘 Class Schedule')
          .setColor(getClassColor(schedules[id].type))
          .addFields(
            { name: 'ID', value: id, inline: true },
            { name: 'Professor', value: schedules[id].professor || '—', inline: true },
            { name: 'Location', value: schedules[id].location || '—', inline: true },
            { name: 'Date', value: schedules[id].date || '—', inline: true },
            { name: 'Time', value: schedules[id].time || '—', inline: true },
            { name: 'Type', value: schedules[id].type || '—', inline: true }
          );

        try {
          const channel = await interaction.guild.channels.fetch(schedules[id].channelId);
          const msg = await channel.messages.fetch(schedules[id].messageId);
          await msg.edit({ embeds: [updatedEmbed] });
        } catch {
          return interaction.reply({ content: '⚠️ Failed to update message — maybe it was deleted?', ephemeral: true });
        }

        saveJSON(SCHEDULE_FILE, schedules);
        return interaction.reply({ content: `✅ Updated ${field} for ${id}.`, ephemeral: true });
      }

      case 'delete': {
        const id = interaction.options.getString('id');
        if (!schedules[id]) return interaction.reply({ content: '❌ Schedule not found.', ephemeral: true });

        try {
          const channel = await interaction.guild.channels.fetch(schedules[id].channelId);
          const msg = await channel.messages.fetch(schedules[id].messageId);
          await msg.delete().catch(() => null);
        } catch {
          console.warn(`⚠️ Could not delete embed message for ${id}`);
        }

        delete schedules[id];
        saveJSON(SCHEDULE_FILE, schedules);
        return interaction.reply({ content: `🗑️ Deleted schedule ${id}.`, ephemeral: true });
      }

      case 'copy': {
        const id = interaction.options.getString('id');
        if (!schedules[id]) return interaction.reply({ content: '❌ Schedule not found.', ephemeral: true });

        const newId = generateId();
        const clone = { ...schedules[id], id: newId };

        const embed = new EmbedBuilder()
          .setTitle('📘 Class Schedule (Copied)')
          .setColor(getClassColor(clone.type))
          .addFields(
            { name: 'ID', value: newId, inline: true },
            { name: 'Professor', value: clone.professor || '—', inline: true },
            { name: 'Location', value: clone.location || '—', inline: true },
            { name: 'Date', value: clone.date || '—', inline: true },
            { name: 'Time', value: clone.time || '—', inline: true },
            { name: 'Type', value: clone.type || '—', inline: true }
          );

        const channel = await interaction.guild.channels.fetch(scheduleConfig.channelId).catch(() => null);
        if (!channel) {
          return interaction.reply({ content: '⚠️ Schedule channel not configured.', ephemeral: true });
        }

        const msg = await channel.send({ embeds: [embed] });
        clone.messageId = msg.id;
        clone.channelId = msg.channel.id;

        schedules[newId] = clone;
        saveJSON(SCHEDULE_FILE, schedules);
        return interaction.reply({ content: `✅ Schedule copied as ${newId}`, ephemeral: true });
      }

      case 'list': {
        const list = Object.values(schedules);
        if (list.length === 0)
          return interaction.reply({ content: '📭 No schedules found.', ephemeral: true });

        const text = list.map(s =>
          `**${s.id}** → ${s.professor || '—'} | ${s.location || '—'} | ${s.date || '—'} ${s.time || ''} (${s.type || '—'})`
        ).join('\n');

        return interaction.reply({ content: `📘 Current schedules:\n${text}`, ephemeral: true });
      }
    }
  },
};
