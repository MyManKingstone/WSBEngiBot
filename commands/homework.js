// commands/homework.js
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { homeworks, scheduleConfig, saveJSON, HOMEWORK_FILE, homeworkStatus, saveStatusJSON, HOMEWORK_STATUS_FILE } = require('../utils/storage');

function generateId() {
  return `hw-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('homework')
    .setDescription('Manage homework and assignments')
    .addSubcommand(sub => sub.setName('add').setDescription('Admin only — add a new homework')
      .addStringOption(opt => opt.setName('title').setDescription('Homework title').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Homework details').setRequired(true))
      .addStringOption(opt => opt.setName('due_date').setDescription('Due date (e.g. 2025-11-03)').setRequired(true)))
    .addSubcommand(sub => sub.setName('edit').setDescription('Edit an existing homework')
      .addStringOption(opt => opt.setName('id').setDescription('Homework ID').setRequired(true))
      .addStringOption(opt => opt.setName('field').setDescription('Field to edit').setRequired(true)
        .addChoices(
          { name: 'Title', value: 'title' },
          { name: 'Description', value: 'description' },
          { name: 'Due Date', value: 'due_date' }
        ))
      .addStringOption(opt => opt.setName('value').setDescription('New value').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a homework entry')
      .addStringOption(opt => opt.setName('id').setDescription('Homework ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('copy').setDescription('Copy a homework entry')
      .addStringOption(opt => opt.setName('id').setDescription('Homework ID to copy').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List all homework entries'))
    .addSubcommand(sub => sub.setName('refresh').setDescription('Retroactively update all homework embeds to the current style')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Admin-only restriction for modification
    if (['add','edit','delete','copy','refresh'].includes(sub) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ You must be an admin to use this command.', flags: 64 });
    }

    const createEmbedRow = (hwId, title, description, due_date) => {
      const embed = new EmbedBuilder()
        .setTitle(`📝 ${title}`)
        .setDescription(description) // ID removed from description
        .setColor(0x5865F2)
        .addFields({ name: 'Due Date', value: due_date, inline: true })
        .setFooter({ text: `Homework ID: ${hwId}` })
        .setTimestamp();

      const markDoneButton = new ButtonBuilder()
        .setCustomId(`markdone-${hwId}`)
        .setLabel('Mark as Done')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(markDoneButton);
      return { embed, row };
    };

    // ---- Handle per-user "Mark as Done" button ----
    if (interaction.isButton() && interaction.customId.startsWith('markdone-')) {
      const hwId = interaction.customId.split('-')[1];
      if (!homeworks[hwId]) return interaction.reply({ content: '⚠️ Homework no longer exists.', flags: 64 });
      if (!homeworkStatus[hwId]) homeworkStatus[hwId] = {};
      homeworkStatus[hwId][interaction.user.id] = true;
      await saveStatusJSON(HOMEWORK_STATUS_FILE, homeworkStatus);
      return interaction.reply({ content: '✅ Marked as done for you!', flags: 64 });
    }

    switch(sub) {
      case 'add': {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const dueDate = interaction.options.getString('due_date');
        const id = generateId();

        const { embed, row } = createEmbedRow(id, title, description, dueDate);

        const channel = await interaction.guild.channels.fetch(scheduleConfig.homeworkChannelId).catch(() => null);
        if (!channel) return interaction.reply({ content: '⚠️ No homework channel configured.', flags: 64 });

        const msg = await channel.send({ embeds: [embed], components: [row] });
        homeworks[id] = { id, title, description, due_date: dueDate, messageId: msg.id, channelId: msg.channel.id };
        homeworkStatus[id] = {};
        saveJSON(HOMEWORK_FILE, homeworks);
        await saveStatusJSON(HOMEWORK_STATUS_FILE, homeworkStatus);

        return interaction.reply({ content: `✅ Homework added with ID **${id}**`, flags: 64 });
      }

      case 'edit': {
        const id = interaction.options.getString('id');
        const field = interaction.options.getString('field');
        const value = interaction.options.getString('value');
        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', flags: 64 });

        homeworks[id][field] = value;
        const { embed, row } = createEmbedRow(id, homeworks[id].title, homeworks[id].description, homeworks[id].due_date);

        try {
          const channel = await interaction.guild.channels.fetch(homeworks[id].channelId);
          const msg = await channel.messages.fetch(homeworks[id].messageId);
          await msg.edit({ embeds: [embed], components: [row] });
        } catch {
          return interaction.reply({ content: '⚠️ Failed to update message.', flags: 64 });
        }

        saveJSON(HOMEWORK_FILE, homeworks);
        return interaction.reply({ content: `✅ Updated ${field} for ${id}`, flags: 64 });
      }

      case 'delete': {
        const id = interaction.options.getString('id');
        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', flags: 64 });

        try {
          const channel = await interaction.guild.channels.fetch(homeworks[id].channelId);
          const msg = await channel.messages.fetch(homeworks[id].messageId);
          await msg.delete().catch(() => null);
        } catch {}

        delete homeworks[id];
        delete homeworkStatus[id];
        saveJSON(HOMEWORK_FILE, homeworks);
        await saveStatusJSON(HOMEWORK_STATUS_FILE, homeworkStatus);
        return interaction.reply({ content: `🗑️ Deleted homework ${id}.`, flags: 64 });
      }

      case 'copy': {
        const id = interaction.options.getString('id');
        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', flags: 64 });

        const newId = generateId();
        const clone = { ...homeworks[id], id: newId };
        const { embed, row } = createEmbedRow(newId, clone.title, clone.description, clone.due_date);

        const channel = await interaction.guild.channels.fetch(scheduleConfig.homeworkChannelId).catch(() => null);
        if (!channel) return interaction.reply({ content: '⚠️ Homework channel not configured.', flags: 64 });

        const msg = await channel.send({ embeds: [embed], components: [row] });
        clone.messageId = msg.id;
        clone.channelId = msg.channel.id;

        homeworks[newId] = clone;
        homeworkStatus[newId] = {};
        saveJSON(HOMEWORK_FILE, homeworks);
        await saveStatusJSON(HOMEWORK_STATUS_FILE, homeworkStatus);
        return interaction.reply({ content: `✅ Homework copied as ${newId}`, flags: 64 });
      }

      case 'list': {
        const list = Object.values(homeworks);
        if (!list.length) return interaction.reply({ content: '📭 No homework entries found.', flags: 64 });

        // Ensure homeworkStatus exists for all entries
        for (const hw of list) if (!homeworkStatus[hw.id]) homeworkStatus[hw.id] = {};

        const text = list.map(hw => {
          const doneUsers = Object.keys(homeworkStatus[hw.id]).length;
          return `**${hw.id || 'Unknown'}** → ${hw.title} | due: ${hw.due_date} | ✅ marked done: ${doneUsers}`;
        }).join('\n');

        return interaction.reply({ content: `📝 Homework List:\n${text}`, flags: 64 });
      }

      case 'refresh': {
        const updated = [];
        for (const id in homeworks) {
          const hw = homeworks[id];
          if (!hw) continue;
          try {
            const channel = await interaction.guild.channels.fetch(hw.channelId);
            const msg = await channel.messages.fetch(hw.messageId);
            const { embed, row } = createEmbedRow(id, hw.title, hw.description, hw.due_date);
            await msg.edit({ embeds: [embed], components: [row] });
            updated.push(id);
          } catch (err) {
            console.warn(`⚠️ Failed to refresh homework ${id}:`, err.message);
          }
        }
        return interaction.reply({ content: `✅ Refreshed ${updated.length} homework embed(s).`, flags: 64 });
      }
    }
  }
};
