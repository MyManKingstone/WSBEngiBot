// commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and their descriptions'),

  async execute(interaction) {
    try {
      // Defer reply to prevent interaction timeout
      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('📘 Uni Group Bot — Help Menu')
        .setColor(0x5865F2)
        .setDescription('Here’s a list of all commands and what they do:')
        .addFields(
          { name: '🎭 Reaction Roles', value: '`/createdropdown` — Create dropdown menus for role selection.' },
          { name: '📅 Schedules', value: '`/schedule_menu` — Create new schedules.\n`/schedule_edit` — Edit an existing schedule.\n`/schedule_delete` — Delete a schedule.\n`/schedule_copy` — Duplicate an existing schedule.\n`/schedule_list` — View all schedules.' },
          { name: '📝 Homework', value: '`/homework_add` — Add new homework.\n`/homework_edit` — Edit existing homework.\n`/homework_delete` — Remove a homework listing.\n`/homework_copy` — Duplicate a homework entry.' },
          { name: '⚙️ Admin-only setup', value: '`/schedule_config` — Configure professors, locations, etc.\n`/createdropdown` — Manage reaction role dropdowns.' }
        )
        .setFooter({ text: 'Use commands with / in any server channel where the bot is allowed.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in /help command:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ An error occurred.' });
      }
    }
  },
};
