// commands/dropdowns.js
const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { dropdownMappings, saveDropdowns } = require('../utils/storage');
const { ephemeralReplyWithDelete, generateId } = require('../utils/helpers');

// ---------- DROPDOWN COMMANDS ----------
async function handleCreateDropdown(interaction) {
  const category = interaction.options.getString('category');
  const description = interaction.options.getString('description') || 'Select from the menu below:';
  const optionsInput = interaction.options.getString('options').split(',').map(s => s.trim()).filter(Boolean);
  const roleIds = interaction.options.getString('roleids').split(',').map(s => s.trim()).filter(Boolean);

  if (optionsInput.length !== roleIds.length) {
    return interaction.reply({
      content: '⚠️ Number of options and role IDs must match.',
      ephemeral: true
    });
  }

  const customId = generateId('dropdown');
  const embed = new EmbedBuilder().setTitle(`🎓 ${category}`).setDescription(description).setColor(0x5865f2);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select your roles')
    .setMinValues(0)
    .setMaxValues(optionsInput.length)
    .addOptions(optionsInput.map((label, i) => ({
      label,
      value: String(i),
      description: `Gives ${label} role`
    })));

  const row = new ActionRowBuilder().addComponents(menu);
  const msg = await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  dropdownMappings[customId] = {
    messageId: msg.id,
    channelId: msg.channel.id,
    roleIds,
    options: optionsInput
  };
  await saveDropdowns();

  return ephemeralReplyWithDelete(interaction, `✅ Dropdown created! ID: \`${customId}\``);
}

async function handleListDropdowns(interaction) {
  const ids = Object.keys(dropdownMappings);
  if (!ids.length) return interaction.reply({
    content: '📭 No dropdowns saved.',
    ephemeral: true
  });
  const list = ids.map(id => `• **${id}** → ${dropdownMappings[id].options.join(', ')}`).join('\n');
  return interaction.reply({
    content: `📋 Dropdowns:\n${list}`,
    ephemeral: true
  });
}

async function handleDeleteDropdown(interaction) {
  const id = interaction.options.getString('id');
  if (!dropdownMappings[id]) return interaction.reply({
    content: '⚠️ Invalid dropdown ID.',
    ephemeral: true
  });
  try {
    const ch = await interaction.client.channels.fetch(dropdownMappings[id].channelId);
    const m = await ch.messages.fetch(dropdownMappings[id].messageId);
    await m.delete();
  } catch {}
  delete dropdownMappings[id];
  await saveDropdowns();
  return ephemeralReplyWithDelete(interaction, `✅ Dropdown \`${id}\` deleted.`);
}

// ---------- DROPDOWN ROLE SELECTION ----------
async function handleDropdownSelection(interaction) {
  const mapping = dropdownMappings[interaction.customId];
  if (!mapping) return interaction.reply({
    content: '⚠️ Unknown dropdown.',
    ephemeral: true
  });

  const member = await interaction.guild.members.fetch(interaction.user.id);

  // Remove all mapping roles first
  for (const roleId of mapping.roleIds) {
    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
  }

  // Add selected roles
  for (const idxStr of interaction.values) {
    const idx = Number(idxStr);
    const roleId = mapping.roleIds[idx];
    if (roleId) await member.roles.add(roleId).catch(() => {});
  }

  return ephemeralReplyWithDelete(interaction, '✅ Your roles have been updated.');
}

module.exports = {
  handleCreateDropdown,
  handleListDropdowns,
  handleDeleteDropdown,
  handleDropdownSelection
};
