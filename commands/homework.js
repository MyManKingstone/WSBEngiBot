// commands/homework.js
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { homeworks, scheduleConfig, saveJSON, HOMEWORK_FILE, homeworkStatus } = require('../utils/storage');

function generateId() {
  return `hw-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('homework')
    .setDescription('Manage homework and assignments')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Admin only — add a new homework')
        .addStringOption(opt => opt.setName('title').setDescription('Homework title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Homework details').setRequired(true))
        .addStringOption(opt => opt.setName('due_date').setDescription('Due date (e.g. 2025-11-03)').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('edit')
        .setDescription('Edit an existing homework')
        .addStringOption(opt => opt.setName('id').setDescription('Homework ID').setRequired(true))
        .addStringOption(opt => opt.setName('field').setDescription('Field to edit').setRequired(true)
          .addChoices(
            { name: 'Title', value: 'title' },
            { name: 'Description', value: 'description' },
            { name: 'Due Date', value: 'due_date' }
          ))
        .addStringOption(opt => opt.setName('value').setDescription('New value').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a homework entry')
        .addStringOption(opt => opt.setName('id').setDescription('Homework ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('copy')
        .setDescription('Copy a homework entry')
        .addStringOption(opt => opt.setName('id').setDescription('Homework ID to copy').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all homework entries')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Restrict add/edit/delete/copy to admins only
    if (['add', 'edit', 'delete', 'copy'].includes(sub) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ You must be an admin to use this command.', ephemeral: true });
    }

    switch (sub) {
      case 'add': {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const dueDate = interaction.options.getString('due_date');

        const id = generateId();

        const embed = new EmbedBuilder()
          .setTitle(`📝 ${title}`)
          .setDescription(description)
          .setColor(0x5865F2)
          .addFields(
            { name: 'ID', value: id, inline: true },
            { name: 'Due Date', value: dueDate, inline: true }
          )
          .setFooter({ text: `Homework ID: ${id}` })
          .setTimestamp();

        const markDoneButton = new ButtonBuilder()
          .setCustomId(`markdone-${id}`)
          .setLabel('Mark as Done')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(markDoneButton);

        const channel = await interaction.guild.channels.fetch(scheduleConfig.homeworkChannelId).catch(() => null);
        if (!channel) {
          return interaction.reply({ content: '⚠️ No homework channel configured. Set one in config.', ephemeral: true });
        }

        const msg = await channel.send({ embeds: [embed], components: [row] });

        homeworks[id] = {
          id,
          title,
          description,
          due_date: dueDate,
          messageId: msg.id,
          channelId: msg.channel.id
        };

        saveJSON(HOMEWORK_FILE, homeworks);
        homeworkStatus[id] = {}; // per-user tracking

        return interaction.reply({ content: `✅ Homework added with ID **${id}**`, ephemeral: true });
      }

      case 'edit': {
        const id = interaction.options.getString('id');
        const field = interaction.options.getString('field');
        const value = interaction.options.getString('value');

        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', ephemeral: true });

        homeworks[id][field] = value;

        const hw = homeworks[id];
        const updatedEmbed = new EmbedBuilder()
          .setTitle(`📝 ${hw.title}`)
          .setDescription(hw.description)
          .setColor(0x5865F2)
          .addFields(
            { name: 'ID', value: hw.id, inline: true },
            { name: 'Due Date', value: hw.due_date, inline: true }
          )
          .setFooter({ text: `Homework ID: ${hw.id}` })
          .setTimestamp();

        const markDoneButton = new ButtonBuilder()
          .setCustomId(`markdone-${id}`)
          .setLabel('Mark as Done')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(markDoneButton);

        try {
          const channel = await interaction.guild.channels.fetch(hw.channelId);
          const msg = await channel.messages.fetch(hw.messageId);
          await msg.edit({ embeds: [updatedEmbed], components: [row] });
        } catch {
          return interaction.reply({ content: '⚠️ Failed to update message (was it deleted?)', ephemeral: true });
        }

        saveJSON(HOMEWORK_FILE, homeworks);
        return interaction.reply({ content: `✅ Updated ${field} for ${id}`, ephemeral: true });
      }

      case 'delete': {
        const id = interaction.options.getString('id');
        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', ephemeral: true });

        try {
          const channel = await interaction.guild.channels.fetch(homeworks[id].channelId);
          const msg = await channel.messages.fetch(homeworks[id].messageId);
          await msg.delete().catch(() => null);
        } catch {}

        delete homeworks[id];
        delete homeworkStatus[id];
        saveJSON(HOMEWORK_FILE, homeworks);
        return interaction.reply({ content: `🗑️ Deleted homework ${id}.`, ephemeral: true });
      }

      case 'copy': {
        const id = interaction.options.getString('id');
        if (!homeworks[id]) return interaction.reply({ content: '❌ Homework not found.', ephemeral: true });

        const newId = generateId();
        const clone = { ...homeworks[id], id: newId };

        const embed = new EmbedBuilder()
          .setTitle(`📝 ${clone.title} (Copy)`)
          .setDescription(clone.description)
          .setColor(0x5865F2)
          .addFields(
            { name: 'ID', value: newId, inline: true },
            { name: 'Due Date', value: clone.due_date, inline: true }
          )
          .setFooter({ text: `Homework ID: ${newId}` })
          .setTimestamp();

        const markDoneButton = new ButtonBuilder()
          .setCustomId(`markdone-${newId}`)
          .setLabel('Mark as Done')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(markDoneButton);

        const channel = await interaction.guild.channels.fetch(scheduleConfig.homeworkChannelId).catch(() => null);
        if (!channel) {
          return interaction.reply({ content: '⚠️ Homework channel not configured.', ephemeral: true });
        }

        const msg = await channel.send({ embeds: [embed], components: [row] });
        clone.messageId = msg.id;
        clone.channelId = msg.channel.id;

        homeworks[newId] = clone;
        homeworkStatus[newId] = {};
        saveJSON(HOMEWORK_FILE, homeworks);
        return interaction.reply({ content: `✅ Homework copied as ${newId}`, ephemeral: true });
      }

      case 'list': {
        const list = Object.values(homeworks);
        if (list.length === 0) return interaction.reply({ content: '📭 No homework entries found.', ephemeral: true });

        const text = list.map(hw =>
          `**${hw.id}** → ${hw.title} | due: ${hw.due_date}`
        ).join('\n');

        return interaction.reply({ content: `📝 Homework List:\n${text}`, ephemeral: true });
      }
    }
  },
};
