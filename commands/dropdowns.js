// commands/dropdowns.js
const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { dropdownMappings, saveJSON, DROPDOWN_FILE } = require('../utils/storage');

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName('createdropdown')
      .setDescription('Admin only — create a role dropdown')
      .addStringOption(opt => opt.setName('category').setDescription('Dropdown title').setRequired(true))
      .addStringOption(opt => opt.setName('options').setDescription('Comma-separated role labels').setRequired(true))
      .addStringOption(opt => opt.setName('roleids').setDescription('Comma-separated role IDs').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Embed description')),

    new SlashCommandBuilder()
      .setName('listdropdowns')
      .setDescription('List all saved dropdowns'),

    new SlashCommandBuilder()
      .setName('deletedropdown')
      .setDescription('Delete a dropdown')
      .addStringOption(opt => opt.setName('id').setDescription('Dropdown ID').setRequired(true))
  ],

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚫 Admins only.', ephemeral: true });
    }

    const cmd = interaction.commandName;

    if (cmd === 'createdropdown') {
      const category = interaction.options.getString('category');
      const description = interaction.options.getString('description') || 'Select your roles:';
      const optionsInput = interaction.options.getString('options').split(',').map(s => s.trim()).filter(Boolean);
      const roleIds = interaction.options.getString('roleids').split(',').map(s => s.trim()).filter(Boolean);

      if (optionsInput.length !== roleIds.length) {
        return interaction.reply({ content: '⚠️ Options and role IDs count must match.', ephemeral: true });
      }

      const customId = `dropdown-${Date.now()}`;
      const embed = new EmbedBuilder().setTitle(`🎓 ${category}`).setDescription(description).setColor(0x5865f2);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Select your roles')
        .setMinValues(0)
        .setMaxValues(optionsInput.length)
        .addOptions(optionsInput.map((label, i) => ({ label, value: String(i), description: `Gives ${label} role` })));

      const row = new ActionRowBuilder().addComponents(menu);
      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      dropdownMappings[customId] = {
        messageId: msg.id,
        channelId: msg.channel.id,
        roleIds,
        options: optionsInput
      };

      await saveJSON(DROPDOWN_FILE, dropdownMappings);
      return interaction.reply({ content: `✅ Dropdown created! ID: \`${customId}\``, ephemeral: true });
    }

    if (cmd === 'listdropdowns') {
      const ids = Object.keys(dropdownMappings);
      if (!ids.length) return interaction.reply({ content: '📭 No dropdowns found.', ephemeral: true });

      const list = ids.map(id => `• **${id}** → ${dropdownMappings[id].options.join(', ')}`).join('\n');
      return interaction.reply({ content: `📋 Dropdowns:\n${list}`, ephemeral: true });
    }

    if (cmd === 'deletedropdown') {
      const id = interaction.options.getString('id');
      if (!dropdownMappings[id]) return interaction.reply({ content: '⚠️ Invalid dropdown ID.', ephemeral: true });

      try {
        const ch = await interaction.client.channels.fetch(dropdownMappings[id].channelId);
        const m = await ch.messages.fetch(dropdownMappings[id].messageId);
        await m.delete();
      } catch {}

      delete dropdownMappings[id];
      await saveJSON(DROPDOWN_FILE, dropdownMappings);
      return interaction.reply({ content: `✅ Dropdown \`${id}\` deleted.`, ephemeral: true });
    }
  }
};
