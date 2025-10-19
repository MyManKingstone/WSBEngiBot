// commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands with detailed descriptions'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📘 WSB Engi Bot — Help Menu')
      .setColor(0x5865F2)
      .setDescription('Here’s a detailed overview of all commands grouped by category:')

      // Reaction Roles
      .addFields(
        { 
          name: '🎭 Reaction Roles', 
          value: [
            '`/createdropdown <category> <options> <roleids>` — Create a dropdown menu for role assignment.',
            '`/listdropdowns` — List all saved dropdown menus.',
            '`/deletedropdown <id>` — Delete a dropdown menu by ID.'
          ].join('\n') 
        },

        // Class Schedules
        { 
          name: '📅 Class Schedules', 
          value: [
            '`/schedule menu` — Create a new class schedule (Admin only).',
            '`/schedule edit <id> <field> <value>` — Edit a schedule entry (Admin only).',
            '`/schedule delete <id>` — Delete a schedule entry (Admin only).',
            '`/schedule copy <id>` — Copy an existing schedule entry (Admin only).',
            '`/schedule list` — View all schedules.'
          ].join('\n')
        },

        // Homework
        { 
          name: '📝 Homework', 
          value: [
            '`/homework add <title> <desc> <due_date> <type>` — Add a homework entry (Admin only).',
            '`/homework edit <id> <field> <value>` — Edit an existing homework (Admin only).',
            '`/homework delete <id>` — Delete a homework entry (Admin only).',
            '`/homework copy <id>` — Copy a homework entry (Admin only).',
            '`/homework list` — List all homework entries.'
          ].join('\n')
        },

        // Admin Setup
        { 
          name: '⚙️ Admin Setup', 
          value: [
            '`/schedule_config` — Configure channels, professors, locations, etc.',
            '`/createdropdown` — Manage role dropdown menus.'
          ].join('\n')
        }
      )
      .setFooter({ text: 'Use / in any server channel where the bot is allowed.' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
