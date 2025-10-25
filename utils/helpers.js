const { EmbedBuilder } = require('discord.js');

// ---------- Helper: Ephemeral reply ----------
async function ephemeralReply(interaction, contentOrEmbed) {
  if (contentOrEmbed instanceof EmbedBuilder) {
    await interaction.reply({
      embeds: [contentOrEmbed],
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: contentOrEmbed,
      ephemeral: true
    });
  }
}

// ---------- Helper: Ephemeral reply with auto-delete ----------
async function ephemeralReplyWithDelete(interaction, contentOrEmbed, deleteAfter = 5000) {
  if (contentOrEmbed instanceof EmbedBuilder) {
    const reply = await interaction.reply({
      embeds: [contentOrEmbed],
      ephemeral: true
    });
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, deleteAfter);
  } else {
    const reply = await interaction.reply({
      content: contentOrEmbed,
      ephemeral: true
    });
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, deleteAfter);
  }
}

// ---------- Helper: Check if user is admin ----------
function isAdmin(interaction) {
  return interaction.member?.permissions.has('ManageGuild') ?? false;
}

// ---------- Helper: Validate date format ----------
function validateDateFormat(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
}

// ---------- Helper: Generate unique ID ----------
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}`;
}

// ---------- Helper: Split long text into chunks ----------
function splitIntoChunks(text, maxLength = 4000) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }
    currentChunk += line + '\n';
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

module.exports = {
  ephemeralReply,
  ephemeralReplyWithDelete,
  isAdmin,
  validateDateFormat,
  generateId,
  splitIntoChunks
};
