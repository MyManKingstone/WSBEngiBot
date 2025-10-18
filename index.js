// index.js
require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    REST,
    Routes,
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ---------- File paths ----------
const DROPDOWN_FILE = path.join(__dirname, 'dropdowns.json');
const SCHEDULE_FILE = path.join(__dirname, 'schedules.json');
const CONFIG_FILE = path.join(__dirname, 'schedule_config.json');

// ---------- Load / initialize persistent data ----------
let dropdownMappings = {};
let schedules = {};
let scheduleConfig = {
    professors: [],
    locations: [],
    classnames: [],
    dates: [],
    times: [],
    channelId: '',
};

try {
    if (fs.existsSync(DROPDOWN_FILE)) dropdownMappings = JSON.parse(fs.readFileSync(DROPDOWN_FILE, 'utf8'));
    if (fs.existsSync(SCHEDULE_FILE)) schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    if (fs.existsSync(CONFIG_FILE)) scheduleConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (err) {
    console.error('⚠️ Failed to load data files:', err);
}

function saveDropdowns() {
    fs.writeFileSync(DROPDOWN_FILE, JSON.stringify(dropdownMappings, null, 2));
}

function saveSchedules() {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(scheduleConfig, null, 2));
}

// ---------- Class type colors (hardcoded) ----------
const CLASS_TYPE_COLORS = {
    'Wyklad': 0x3db1ff, // niebieski
    'Cwiczenia': 0xcc0088, // rozowy
    'E-Learning': 0xf1c40f, // yellow
};

// ---------- Temporary in-memory menu state ----------
/*
  menuState keyed by menuMessageId:
  {
    createdBy: userId,
    selections: { 'sched-professor': 'Dr X', 'sched-location': 'Room 101', ... }
  }
*/
const menuState = {};

// ---------- Slash command definitions ----------
const commands = [{
        name: 'help',
        description: 'Show bot help and commands'
    },

    // Dropdown roles
    {
        name: 'createdropdown',
        description: 'Admin only - Create role dropdown',
        options: [{
                name: 'category',
                type: 3,
                description: 'Category title',
                required: true
            },
            {
                name: 'options',
                type: 3,
                description: 'Comma-separated labels',
                required: true
            },
            {
                name: 'roleids',
                type: 3,
                description: 'Comma-separated role IDs',
                required: true
            },
            {
                name: 'description',
                type: 3,
                description: 'Embed description',
                required: false
            },
        ],
    },
    {
        name: 'listdropdowns',
        description: 'Admin only - List dropdowns'
    },
    {
        name: 'deletedropdown',
        description: 'Admin only - Delete dropdown',
        options: [{
            name: 'id',
            type: 3,
            description: 'Dropdown ID',
            required: true
        }]
    },

    // Schedule config commands (admin-only)
    {
        name: 'schedule_addprofessor',
        description: 'Add professor',
        options: [{
            name: 'name',
            type: 3,
            description: 'Professor name',
            required: true
        }]
    },
    {
        name: 'schedule_addlocation',
        description: 'Add location',
        options: [{
            name: 'name',
            type: 3,
            description: 'Location name',
            required: true
        }]
    },
    {
        name: 'schedule_addclassname',
        description: 'Add class name',
        options: [{
            name: 'name',
            type: 3,
            description: 'Class name',
            required: true
        }]
    },
    {
        name: 'schedule_adddate',
        description: 'Add date',
        options: [{
            name: 'date',
            type: 3,
            description: 'Date (YYYY-MM-DD)',
            required: true
        }]
    },
    {
        name: 'schedule_addtime',
        description: 'Add time',
        options: [{
            name: 'time',
            type: 3,
            description: 'Time (HH:MM)',
            required: true
        }]
    },
    {
        name: 'schedule_addchannel',
        description: 'Set schedule posting channel',
        options: [{
            name: 'channel',
            type: 7,
            description: 'Choose a channel',
            required: true
        }]
    },

    //Schedule delete command
    {
        name: 'schedule_delete',
        description: 'Admin only - Delete a schedule by ID',
        options: [{
            name: 'id',
            type: 3,
            description: 'Schedule ID to delete',
            required: true
        }]
    },

    {
        name: 'schedule_copy',
        description: 'Admin only – Copy an existing schedule to create a new one',
        options: [{
            name: 'id',
            type: 3, // STRING
            description: 'Schedule ID to copy',
            required: true
        }]
    },

    // Schedule menu
    {
        name: 'schedule_menu',
        description: 'Admin only - Open schedule builder menu'
    },

    // Schedule list / edit (simple)
    {
        name: 'schedule_list',
        description: 'Admin only - List saved schedules'
    },
    {
        name: 'schedule_edit',
        description: 'Admin only - Edit schedule field',
        options: [{
                name: 'id',
                type: 3,
                description: 'Schedule ID to edit',
                required: true
            },
            {
                name: 'field',
                type: 3,
                description: 'Field to edit (time/date/professor/location/type/name)',
                required: true
            },
            {
                name: 'value',
                type: 3,
                description: 'New value',
                required: true
            },
        ],
    },
];

// ---------- Register commands (guild-scoped for immediate availability) ----------
const rest = new REST({
    version: '10'
}).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
            body: commands
        });
        console.log('✅ Commands registered');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
})();

// ---------- Ready ----------
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// ---------- Interaction handling ----------
client.on('interactionCreate', async (interaction) => {
    try {
        // Chat input commands
        if (interaction.isChatInputCommand()) {
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

            // HELP (available to everyone)
            if (interaction.commandName === 'help') {
                const embed = new EmbedBuilder()
                    .setTitle('📘 Bot Help')
                    .setColor(0x5865f2)
                    .setDescription('Admin-only commands are restricted to users with Manage Server permission.')
                    .addFields({
                        name: '🎓 Role Dropdowns',
                        value: '`/createdropdown` `/listdropdowns` `/deletedropdown`',
                        inline: false
                    }, {
                        name: '🗓️ Schedule Config & Builder',
                        value: '`/schedule_addprofessor`, `/schedule_addlocation`, `/schedule_addclassname`, `/schedule_adddate`, `/schedule_addtime`, `/schedule_addchannel`, `/schedule_menu`',
                        inline: false
                    }, {
                        name: '🧰 Schedule Management',
                        value: '`/schedule_list`, `/schedule_edit`',
                        inline: false
                    }, );
                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // Admin-only check
            if (!isAdmin) return interaction.reply({
                content: '🚫 Admins only.',
                ephemeral: true
            });

            // ---------------- Dropdown role commands ----------------
            if (interaction.commandName === 'createdropdown') {
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

                const customId = `dropdown-${Date.now()}`;
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

                // Save mapping of index -> roleId
                dropdownMappings[customId] = {
                    messageId: msg.id,
                    channelId: msg.channel.id,
                    roleIds,
                    options: optionsInput
                };
                saveDropdowns();

                return interaction.reply({
                    content: `✅ Dropdown created! ID: \`${customId}\``,
                    ephemeral: true
                });
            }

            if (interaction.commandName === 'listdropdowns') {
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

            if (interaction.commandName === 'deletedropdown') {
                const id = interaction.options.getString('id');
                if (!dropdownMappings[id]) return interaction.reply({
                    content: '⚠️ Invalid dropdown ID.',
                    ephemeral: true
                });
                try {
                    const ch = await client.channels.fetch(dropdownMappings[id].channelId);
                    const m = await ch.messages.fetch(dropdownMappings[id].messageId);
                    await m.delete();
                } catch (err) {
                    // ignore if cannot delete (message removed manually)
                }
                delete dropdownMappings[id];
                saveDropdowns();
                return interaction.reply({
                    content: `✅ Dropdown \`${id}\` deleted.`,
                    ephemeral: true
                });
            }

            // ---------------- Schedule config commands ----------------
            if (interaction.commandName.startsWith('schedule_add')) {
                const sub = interaction.commandName.replace('schedule_add', '').toLowerCase();

                if (sub === 'channel') {
                    const channel = interaction.options.getChannel('channel');
                    if (!channel || channel.type !== 0) { // 0 => GUILD_TEXT in discord.js v14's raw numeric types; but `type` can vary; we'll assume valid channel object
                        // channel.type check is not strict; accept whatever channel provided
                    }
                    scheduleConfig.channelId = channel.id;
                    saveConfig();
                    return interaction.reply({
                        content: `✅ Schedule posting channel set to ${channel}`,
                        ephemeral: true
                    });
                }

                // determine key pluralization
                const value = interaction.options.getString('name') || interaction.options.getString('date') || interaction.options.getString('time');
                if (!value) return interaction.reply({
                    content: '⚠️ Missing value.',
                    ephemeral: true
                });

                let key = '';
                if (sub === 'classname') key = 'classnames';
                else key = sub + 's'; // e.g., professor -> professors

                if (!Object.prototype.hasOwnProperty.call(scheduleConfig, key)) {
                    // create key if missing
                    scheduleConfig[key] = [];
                }
                if (!scheduleConfig[key].includes(value)) {
                    scheduleConfig[key].push(value);
                    saveConfig();
                    return interaction.reply({
                        content: `✅ Added **${value}** to \`${key}\``,
                        ephemeral: true
                    });
                } else {
                    return interaction.reply({
                        content: `ℹ️ **${value}** already exists in \`${key}\`.`,
                        ephemeral: true
                    });
                }
            }

            // ---------------- Schedule menu ----------------
            // ---------- Temporary menu state ----------
            /*
            menuState keyed by userId:
            {
              step1: { classname, professor, type },
              step2: { date, time, location },
              channelId: 'target schedule channel'
            }
            */
            const menuState = {};

            // ---------- Schedule Menu Command ----------
            if (interaction.commandName === 'schedule_menu') {
                // Admin validation
                const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild);
                if (!isAdmin) return interaction.reply({
                    content: '🚫 Admins only.',
                    ephemeral: true
                });

                // Check config
                if (!scheduleConfig.channelId) return interaction.reply({
                    content: '⚠️ Schedule channel not set. Use /schedule_addchannel',
                    ephemeral: true
                });
                if (!scheduleConfig.professors.length || !scheduleConfig.classnames.length) return interaction.reply({
                    content: '⚠️ Add some professors and class names first.',
                    ephemeral: true
                });

                // Step 1 menus
                const classMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched-step1-classname')
                    .setPlaceholder('Select Class Name')
                    .addOptions(scheduleConfig.classnames.map(c => ({
                        label: c,
                        value: c
                    })));

                const professorMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched-step1-professor')
                    .setPlaceholder('Select Professor')
                    .addOptions(scheduleConfig.professors.map(p => ({
                        label: p,
                        value: p
                    })));

                const typeMenu = new StringSelectMenuBuilder()
                    .setCustomId('sched-step1-type')
                    .setPlaceholder('Select Class Type')
                    .addOptions(Object.keys(CLASS_TYPE_COLORS).map(t => ({
                        label: t,
                        value: t
                    })));

                const row1 = new ActionRowBuilder().addComponents(classMenu);
                const row2 = new ActionRowBuilder().addComponents(professorMenu);
                const row3 = new ActionRowBuilder().addComponents(typeMenu);

                const nextButton = new ButtonBuilder()
                    .setCustomId('sched-step1-next')
                    .setLabel('➡️ Next')
                    .setStyle(ButtonStyle.Primary);
                const row4 = new ActionRowBuilder().addComponents(nextButton);

                await interaction.reply({
                    embeds: [new EmbedBuilder().setTitle('📅 Schedule Builder – Step 1').setDescription('Select class name, professor, and type.')],
                    components: [row1, row2, row3, row4],
                    ephemeral: true
                });

                // Initialize menuState for this user
                menuState[interaction.user.id] = {
                    step1: {},
                    step2: {},
                    channelId: scheduleConfig.channelId
                };
            }

            // ---------- Component Interaction Handler ----------
            client.on('interactionCreate', async (interaction) => {
                if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

                const userId = interaction.user.id;
                const state = menuState[userId];
                if (!state) return; // no active builder

                // ---------- Step 1 select menus ----------
                if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step1-')) {
                    const field = interaction.customId.replace('sched-step1-', '');
                    state.step1[field] = interaction.values[0]; // take the first selection
                    await interaction.reply({
                        content: `✅ Selected ${field}: **${interaction.values[0]}**`,
                        ephemeral: true
                    });
                }

                // ---------- Step 1 Next button ----------
                if (interaction.isButton() && interaction.customId === 'sched-step1-next') {
                    // validate all fields selected
                    const required = ['classname', 'professor', 'type'];
                    for (const f of required) {
                        if (!state.step1[f]) return interaction.reply({
                            content: `⚠️ Please select **${f}** before proceeding.`,
                            ephemeral: true
                        });
                    }

                    // Step 2 menus
                    if (!scheduleConfig.dates.length || !scheduleConfig.times.length || !scheduleConfig.locations.length) {
                        return interaction.reply({
                            content: '⚠️ Please populate dates, times, and locations first.',
                            ephemeral: true
                        });
                    }

                    const dateMenu = new StringSelectMenuBuilder()
                        .setCustomId('sched-step2-date')
                        .setPlaceholder('Select Date')
                        .addOptions(scheduleConfig.dates.map(d => ({
                            label: d,
                            value: d
                        })));

                    const timeMenu = new StringSelectMenuBuilder()
                        .setCustomId('sched-step2-time')
                        .setPlaceholder('Select Time')
                        .addOptions(scheduleConfig.times.map(t => ({
                            label: t,
                            value: t
                        })));

                    const locationMenu = new StringSelectMenuBuilder()
                        .setCustomId('sched-step2-location')
                        .setPlaceholder('Select Location')
                        .addOptions(scheduleConfig.locations.map(l => ({
                            label: l,
                            value: l
                        })));

                    const row1 = new ActionRowBuilder().addComponents(dateMenu);
                    const row2 = new ActionRowBuilder().addComponents(timeMenu);
                    const row3 = new ActionRowBuilder().addComponents(locationMenu);

                    const createButton = new ButtonBuilder()
                        .setCustomId('sched-step2-create')
                        .setLabel('✅ Create Schedule')
                        .setStyle(ButtonStyle.Success);
                    const row4 = new ActionRowBuilder().addComponents(createButton);

                    await interaction.update({
                        embeds: [new EmbedBuilder().setTitle('📅 Schedule Builder – Step 2').setDescription('Select date, time, and location.')],
                        components: [row1, row2, row3, row4]
                    });
                }

                // ---------- Step 2 select menus ----------
                if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step2-')) {
                    const field = interaction.customId.replace('sched-step2-', '');
                    state.step2[field] = interaction.values[0];
                    await interaction.reply({
                        content: `✅ Selected ${field}: **${interaction.values[0]}**`,
                        ephemeral: true
                    });
                }

                // ---------- Step 2 Create button ----------
                if (interaction.isButton() && interaction.customId === 'sched-step2-create') {
                    const required = ['date', 'time', 'location'];
                    for (const f of required) {
                        if (!state.step2[f]) return interaction.reply({
                            content: `⚠️ Please select **${f}** before creating schedule.`,
                            ephemeral: true
                        });
                    }

                    // Compile all selections
                    const {
                        classname,
                        professor,
                        type
                    } = state.step1;
                    const {
                        date,
                        time,
                        location
                    } = state.step2;
                    const color = CLASS_TYPE_COLORS[type] || 0x2f3136;

                    const embed = new EmbedBuilder()
                        .setTitle(`📚 ${classname}`)
                        .addFields({
                            name: 'Professor',
                            value: professor,
                            inline: true
                        }, {
                            name: 'Location',
                            value: location,
                            inline: true
                        }, {
                            name: 'Type',
                            value: type,
                            inline: true
                        }, {
                            name: 'Date',
                            value: date,
                            inline: true
                        }, {
                            name: 'Time',
                            value: time,
                            inline: true
                        }, )
                        .setColor(color);

                    try {
                        const ch = await client.channels.fetch(state.channelId);
                        const msg = await ch.send({
                            embeds: [embed]
                        });

                        // Save schedule
                        const id = `class-${Date.now()}`;
                        schedules[id] = {
                            name: classname,
                            professor,
                            type,
                            date,
                            time,
                            location,
                            channelId: ch.id,
                            messageId: msg.id,
                            createdBy: userId,
                            createdAt: new Date().toISOString()
                        };
                        saveSchedules();

                        delete menuState[userId]; // cleanup

                        await interaction.update({
                            content: `✅ Schedule created in <#${ch.id}> (ID: \`${id}\`).`,
                            embeds: [],
                            components: []
                        });
                    } catch (err) {
                        console.error(err);
                        return interaction.reply({
                            content: '❌ Failed to post schedule. Check bot permissions.',
                            ephemeral: true
                        });
                    }
                }
            });
        }

        // Handle select menus and buttons (component interactions)
        if (interaction.isStringSelectMenu()) {
            const menuId = interaction.customId; // e.g., 'sched-professor' or a dropdown customId like 'dropdown-123'
            // Role dropdowns:
            if (menuId.startsWith('dropdown-')) {
                const mapping = dropdownMappings[menuId];
                if (!mapping) return interaction.reply({
                    content: '⚠️ Unknown dropdown.',
                    ephemeral: true
                });

                const chosenIndexStrings = interaction.values; // array of selected values (we used index strings)
                const member = await interaction.guild.members.fetch(interaction.user.id);

                // Remove all mapping roles from this user then add selected ones
                for (const roleId of mapping.roleIds) {
                    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
                }
                for (const idxStr of chosenIndexStrings) {
                    const idx = Number(idxStr);
                    const roleId = mapping.roleIds[idx];
                    if (roleId) await member.roles.add(roleId).catch(() => {});
                }
                return interaction.reply({
                    content: '✅ Your roles have been updated.',
                    ephemeral: true
                });
            }

            // Schedule builder menus (they are part of a message with menuState)
            const validSchedMenus = ['sched-professor', 'sched-location', 'sched-type', 'sched-date', 'sched-time', 'sched-classname'];
            if (validSchedMenus.includes(menuId)) {
                const msgId = interaction.message.id;
                if (!menuState[msgId]) {
                    // Possibly old menu; ignore
                    return interaction.reply({
                        content: '⚠️ This menu is no longer active.',
                        ephemeral: true
                    });
                }
                // For simplicity, take the first selected value (single-select menus)
                const selected = interaction.values[0];
                menuState[msgId].selections[menuId] = selected;
                return interaction.reply({
                    content: `✅ Selected: **${selected}** for ${menuId.replace('sched-', '')}.`,
                    ephemeral: true
                });
            }
        }

        // Buttons
        if (interaction.isButton()) {
            if (interaction.customId === 'sched-create') {
                const msgId = interaction.message.id;
                const state = menuState[msgId];
                if (!state) return interaction.reply({
                    content: '⚠️ This schedule builder is no longer active.',
                    ephemeral: true
                });

                // Only allow creator or admins to finalize
                if (interaction.user.id !== state.createdBy && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return interaction.reply({
                        content: '🚫 Only the menu creator or admins can create schedules from this builder.',
                        ephemeral: true
                    });
                }

                // validate that all selections exist
                const required = ['sched-professor', 'sched-location', 'sched-type', 'sched-date', 'sched-time', 'sched-classname'];
                for (const key of required) {
                    if (!state.selections[key]) {
                        return interaction.reply({
                            content: `⚠️ Please select a value for **${key.replace('sched-', '')}** before creating.`,
                            ephemeral: true
                        });
                    }
                }

                // compile values
                const professor = state.selections['sched-professor'];
                const location = state.selections['sched-location'];
                const type = state.selections['sched-type'];
                const date = state.selections['sched-date'];
                const time = state.selections['sched-time'];
                const name = state.selections['sched-classname'];
                const targetChannelId = scheduleConfig.channelId;

                // guard
                if (!targetChannelId) {
                    return interaction.reply({
                        content: '⚠️ No schedule channel configured. Use `/schedule_addchannel`.',
                        ephemeral: true
                    });
                }

                // Build embed with color based on type
                const color = CLASS_TYPE_COLORS[type] || 0x2f3136;
                const embed = new EmbedBuilder()
                    .setTitle(`📚 ${name}`)
                    .addFields({
                        name: 'Professor',
                        value: professor,
                        inline: true
                    }, {
                        name: 'Location',
                        value: location,
                        inline: true
                    }, {
                        name: 'Type',
                        value: type,
                        inline: true
                    }, {
                        name: 'Date',
                        value: date,
                        inline: true
                    }, {
                        name: 'Time',
                        value: time,
                        inline: true
                    }, )
                    .setColor(color)
                    .setFooter({
                        text: `Created by ${interaction.user.tag}`
                    });

                // Post embed to configured channel
                try {
                    const ch = await client.channels.fetch(targetChannelId);
                    const posted = await ch.send({
                        embeds: [embed]
                    });

                    // Save to schedules.json
                    const id = `class-${Date.now()}`;
                    schedules[id] = {
                        name,
                        professor,
                        location,
                        type,
                        date,
                        time,
                        channelId: ch.id,
                        messageId: posted.id,
                        createdBy: interaction.user.id,
                        createdAt: new Date().toISOString(),
                    };
                    saveSchedules();

                    // Cleanup menu state (optionally)
                    delete menuState[msgId];

                    return interaction.reply({
                        content: `✅ Schedule created and posted in <#${ch.id}> (ID: \`${id}\`).`,
                        ephemeral: true
                    });
                } catch (err) {
                    console.error('Failed to post schedule:', err);
                    return interaction.reply({
                        content: '❌ Failed to post schedule. Check bot permissions and channel settings.',
                        ephemeral: true
                    });
                }
            }
        }
    } catch (err) {
        console.error('Interaction handler error:', err);
        if (interaction && !interaction.replied) {
            try {
                await interaction.reply({
                    content: '❌ An error occurred.',
                    ephemeral: true
                });
            } catch {}
        }
    }
    // ---------- Helper to send ephemeral messages that auto-delete ----------
    async function ephemeralReply(interaction, contentOrEmbed) {
        let reply;
        if (contentOrEmbed instanceof EmbedBuilder) {
            reply = await interaction.reply({
                embeds: [contentOrEmbed],
                ephemeral: true
            });
        } else {
            reply = await interaction.reply({
                content: contentOrEmbed,
                ephemeral: true
            });
        }

        // auto-delete after 5 seconds
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch {}
        }, 5000);
    }

    // ---------- /schedule_list command ----------
    if (interaction.commandName === 'schedule_list') {
        await interaction.deferReply({
            ephemeral: true
        });

        const ids = Object.keys(schedules);
        if (!ids.length) return interaction.editReply({
            content: '📭 No schedules found.'
        });

        const chunks = [];
        let currentDesc = '';

        for (const id of ids) {
            const s = schedules[id];
            const line = `• **${s.name}** (ID: \`${id}\`) — ${s.date} ${s.time} | ${s.type} | Prof: ${s.professor} | Loc: ${s.location}\n`;
            if ((currentDesc + line).length > 4000) {
                chunks.push(currentDesc);
                currentDesc = '';
            }
            currentDesc += line;
        }
        if (currentDesc) chunks.push(currentDesc);

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(i === 0 ? '🗓️ Saved Schedules' : '🗓️ Saved Schedules (cont.)')
                .setDescription(chunks[i])
                .setColor(0x3498db);

            if (i === 0) await interaction.editReply({
                embeds: [embed]
            });
            else await interaction.followUp({
                embeds: [embed],
                ephemeral: true
            }).then(msg => {
                setTimeout(async () => {
                    try {
                        await msg.delete();
                    } catch {}
                }, 5000);
            });
        }
    }

    // ---------- /schedule_edit command ----------
    if (interaction.commandName === 'schedule_edit') {
        const id = interaction.options.getString('id');
        const field = interaction.options.getString('field').toLowerCase();
        const value = interaction.options.getString('value');

        if (!schedules[id]) return ephemeralReply(interaction, '⚠️ Schedule ID not found.');

        const allowed = ['time', 'date', 'professor', 'location', 'type', 'name'];
        if (!allowed.includes(field)) return ephemeralReply(interaction, `⚠️ Field must be one of: ${allowed.join(', ')}`);

        // update schedule object
        if (field === 'name') schedules[id].name = value;
        else schedules[id][field] = value;

        try {
            // edit original embed
            const ch = await client.channels.fetch(schedules[id].channelId);
            const msg = await ch.messages.fetch(schedules[id].messageId);

            const embed = new EmbedBuilder()
                .setTitle(`📚 ${schedules[id].name}`)
                .addFields({
                    name: 'Professor',
                    value: schedules[id].professor,
                    inline: true
                }, {
                    name: 'Location',
                    value: schedules[id].location,
                    inline: true
                }, {
                    name: 'Type',
                    value: schedules[id].type,
                    inline: true
                }, {
                    name: 'Date',
                    value: schedules[id].date,
                    inline: true
                }, {
                    name: 'Time',
                    value: schedules[id].time,
                    inline: true
                }, )
                .setColor(CLASS_TYPE_COLORS[schedules[id].type] || 0x2f3136)
                .setFooter({
                    text: `ID: ${id}`
                });

            await msg.edit({
                embeds: [embed]
            });
            saveSchedules();
            ephemeralReply(interaction, `✅ Schedule \`${id}\` updated successfully.`);
        } catch (err) {
            console.error(err);
            ephemeralReply(interaction, '❌ Failed to edit schedule embed. Check permissions and channel.');
        }
    }

    // ---------- /schedule_delete command ----------
    if (interaction.commandName === 'schedule_delete') {
        const id = interaction.options.getString('id');
        if (!id) return ephemeralReply(interaction, '⚠️ Please provide a schedule ID.');
        if (!schedules[id]) return ephemeralReply(interaction, `⚠️ Schedule ID \`${id}\` not found.`);

        try {
            // Attempt to fetch channel & message
            const ch = await client.channels.fetch(schedules[id].channelId);
            const msg = await ch.messages.fetch(schedules[id].messageId);
            await msg.delete().catch(() => {}); // ignore if already deleted
        } catch (err) {
            console.warn('Could not delete schedule message:', err);
        }

        // Delete from schedules.json
        delete schedules[id];
        saveSchedules();

        ephemeralReply(interaction, `✅ Schedule \`${id}\` deleted successfully.`);
    }

    // ---------- /schedule_copy command ----------
    if (interaction.commandName === 'schedule_copy') {
        const id = interaction.options.getString('id');
        if (!id) return ephemeralReply(interaction, '⚠️ Please provide a schedule ID.');
        if (!schedules[id]) return ephemeralReply(interaction, `⚠️ Schedule ID \`${id}\` not found.`);

        const original = schedules[id];

        try {
            // create new schedule object
            const newId = `class-${Date.now()}`;
            const ch = await client.channels.fetch(original.channelId);

            const embed = new EmbedBuilder()
                .setTitle(`📚 ${original.name}`)
                .addFields({
                    name: 'Professor',
                    value: original.professor,
                    inline: true
                }, {
                    name: 'Location',
                    value: original.location,
                    inline: true
                }, {
                    name: 'Type',
                    value: original.type,
                    inline: true
                }, {
                    name: 'Date',
                    value: original.date,
                    inline: true
                }, {
                    name: 'Time',
                    value: original.time,
                    inline: true
                }, )
                .setColor(CLASS_TYPE_COLORS[original.type] || 0x2f3136)
                .setFooter({
                    text: `ID: ${newId}`
                });

            const msg = await ch.send({
                embeds: [embed]
            });

            // Save new schedule
            schedules[newId] = {
                ...original,
                messageId: msg.id,
                createdBy: interaction.user.id,
                createdAt: new Date().toISOString()
            };
            saveSchedules();

            ephemeralReply(interaction, `✅ Schedule copied! New ID: \`${newId}\`. You can now edit it with /schedule_edit.`);
        } catch (err) {
            console.error(err);
            ephemeralReply(interaction, '❌ Failed to copy schedule. Check permissions and channel.');
        }
    }


});

// ---------- Keep-alive simple server for Render ----------
const app = express();

// simple health check
app.get('/', (req, res) => res.send('Bot is running'));

// use Render's assigned port or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webserver listening on port ${PORT}`));

// ---------- Login Discord Bot ----------
client.login(process.env.DISCORD_BOT_TOKEN);
