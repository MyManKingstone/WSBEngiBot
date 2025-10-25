// commands/help.js
const { EmbedBuilder } = require('discord.js');

// ---------- HELP COMMAND ----------
async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('📘 Bot Help')
    .setColor(0x5865f2)
    .setDescription('Admin-only commands are restricted to users with Manage Server permission.')
    .addFields(
      {
        name: '🎓 Role Dropdowns',
        value: '`/createdropdown` `/listdropdowns` `/deletedropdown`',
        inline: false
      },
      {
        name: '🗓️ Schedule Config & Builder',
        value: '`/schedule_addprofessor`, `/schedule_addlocation`, `/schedule_addclassname`, `/schedule_adddate`, `/schedule_addtime`, `/schedule_addchannel`, `/schedule_menu`',
        inline: false
      },
      {
        name: '🧰 Schedule Management',
        value: '`/schedule_list`, `/schedule_edit`, `/schedule_delete`, `/schedule_copy`',
        inline: false
      },
      {
        name: '📝 Homework Builder & Management',
        value: '`/homework_menu`, `/homework_list`, `/homework_edit`, `/homework_delete`, `/homework_copy`, `/homework_addchannel`',
        inline: false
      }
    );
  
  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

module.exports = {
  handleHelp
};