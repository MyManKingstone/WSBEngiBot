
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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const express = require('express');
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;


// ✅ Universal fetch fix for CommonJS (works on Render)
let fetch;
try {
    fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
} catch (e) {
    console.warn('⚠️ Could not initialize node-fetch:', e);
}
// ---------- GitHub JSON helpers ----------
async function fetchJSON(filePath) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    const data = await res.json();
    if (!data.content) return {
        json: {},
        sha: null
    };
    return {
        json: JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8')),
        sha: data.sha
    };
}

async function writeJSON(filePath, jsonData, sha) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;
    const content = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            message: `Update ${filePath}`,
            content,
            sha,
            branch: GITHUB_BRANCH
        })
    });
    const data = await res.json();
    return data.content.sha;
}

// ---------- Discord client ----------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ---------- File paths ----------
const DROPDOWN_PATH = 'data/dropdowns.json';
const SCHEDULE_PATH = 'data/schedules.json';
const CONFIG_PATH = 'data/schedule_config.json';
const STATUS_PATH = 'data/status.json';

// ---------- Persistent Data ----------
let dropdownMappings = {};
let dropdownSHA = null;

let schedules = {};
let schedulesSHA = null;

let scheduleConfig = {
    professors: [],
    locations: [],
    classnames: [],
    dates: [],
    times: [],
    channelId: ''
};
let scheduleConfigSHA = null;

let botStatus = { activity: '' };
let statusSHA = null;

// ---------- Load all JSON from GitHub ----------
(async () => {
    try {
        const dropdownData = await fetchJSON(DROPDOWN_PATH);
        dropdownMappings = dropdownData.json;
        dropdownSHA = dropdownData.sha;

        const scheduleData = await fetchJSON(SCHEDULE_PATH);
        schedules = scheduleData.json;
        schedulesSHA = scheduleData.sha;

        const configData = await fetchJSON(CONFIG_PATH);
        scheduleConfig = configData.json;
        scheduleConfigSHA = configData.sha;

        const statusData = await fetchJSON(STATUS_PATH);
        botStatus = statusData.json;
        statusSHA = statusData.sha;

        console.log('✅ GitHub JSON files loaded successfully');
    } catch (err) {
        console.error('⚠️ Failed to fetch JSON from GitHub:', err);
    }
})();

// ---------- Save functions ----------
async function saveDropdowns() {
    dropdownSHA = await writeJSON(DROPDOWN_PATH, dropdownMappings, dropdownSHA);
}
async function saveSchedules() {
    schedulesSHA = await writeJSON(SCHEDULE_PATH, schedules, schedulesSHA);
}
async function saveConfig() {
    scheduleConfigSHA = await writeJSON(CONFIG_PATH, scheduleConfig, scheduleConfigSHA);
}
async function saveStatus() {
    statusSHA = await writeJSON(STATUS_PATH, botStatus, statusSHA);
}

// ---------- Class type colors ----------
const CLASS_TYPE_COLORS = {
    'Wyklad': 0x3db1ff,
    'Cwiczenia': 0xcc0088,
    'E-Learning': 0xf1c40f
};

// ---------- Global menu state ----------
const menuState = {}; // keyed by userId

// ---------- Slash commands ----------
const commands = [{
        name: 'help',
        description: 'Show bot help and commands'
    },
    {
        name: 'status',
        description: 'Owner only - Set bot status',
        options: [{
            name: 'activity',
            type: 3,
            description: 'Status activity text',
            required: true
        }]
    },
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
            }
        ]
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

    // Schedule config commands
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
        name: 'schedule_addchannel',
        description: 'Set schedule posting channel',
        options: [{
            name: 'channel',
            type: 7,
            description: 'Choose a channel',
            required: true
        }]
    },
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
        description: 'Admin only – Copy an existing schedule',
        options: [{
            name: 'id',
            type: 3,
            description: 'Schedule ID to copy',
            required: true
        }]
    },
    {
        name: 'schedule_menu',
        description: 'Admin only - Open schedule builder menu'
    },
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
                description: 'Schedule ID',
                required: true
            },
            {
                name: 'field',
                type: 3,
                description: 'Field to edit',
                required: true
            },
            {
                name: 'value',
                type: 3,
                description: 'New value',
                required: true
            }
        ]
    },
    {
        name: 'experiment_schedule',
        description: 'Admin only - Run schedule experiment from Book1.xlsx'
    }
];

// ---------- Register slash commands ----------
const rest = new REST({
    version: '10'
}).setToken(process.env.DISCORD_BOT_TOKEN);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
                body: commands
            }
        );
        console.log('✅ Commands registered');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
})();

// ---------- Client ready ----------
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity(botStatus.activity);
});

// ---------- Interaction handler ----------
client.on('interactionCreate', async (interaction) => {
    try {
        const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) ?? false;

        // ---------- HELP COMMAND ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('📘 Pomoc Bota')
                .setColor(0x5865f2)
                .setDescription('Komendy tylko dla administratorów są ograniczone do użytkowników z uprawnieniem Zarządzanie Serwerem. Komendy tylko dla właściciela są ograniczone do właściciela bota.')
                .addFields({
                    name: '🎓 Menu Rol',
                    value: '`/createdropdown` `/listdropdowns` `/deletedropdown`',
                    inline: false
                }, {
                    name: '🗓️ Konfiguracja i Budowniczy Harmonogramów',
                    value: '`/schedule_addprofessor`, `/schedule_addlocation`, `/schedule_addclassname`, `/schedule_addchannel`, `/schedule_menu`',
                    inline: false
                }, {
                    name: '🧰 Zarządzanie Harmonogramami',
                    value: '`/schedule_list`, `/schedule_edit`, `/schedule_delete`, `/schedule_copy`',
                    inline: false
                }, {
                    name: '🔧 Komendy Właściciela',
                    value: '`/status`',
                    inline: false
                });
            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        // ---------- STATUS COMMAND ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
            if (interaction.user.id !== process.env.OWNER_ID) {
                return interaction.reply({ content: 'Tylko właściciel bota może używać tej komendy.', ephemeral: true });
            }
            const activity = interaction.options.getString('activity');
            botStatus.activity = activity;
            await saveStatus();
            client.user.setActivity(activity);
            return interaction.reply({ content: `Status bota ustawiony na: ${activity}`, ephemeral: true });
        }

        // Admin-only check for other commands
        if (!isAdmin && interaction.isChatInputCommand() && interaction.commandName !== 'help') {
            return interaction.reply({
                content: '🚫 Tylko administratorzy.',
                ephemeral: true
            });
        }

        // ---------- DROPDOWN COMMANDS ----------
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'createdropdown') {
                const category = interaction.options.getString('category');
                const description = interaction.options.getString('description') || 'Select from the menu below:';
                const optionsInput = interaction.options.getString('options').split(',').map(s => s.trim()).filter(Boolean);
                const roleIds = interaction.options.getString('roleids').split(',').map(s => s.trim()).filter(Boolean);

                if (optionsInput.length !== roleIds.length) {
                    return interaction.reply({
                        content: '⚠️ Liczba opcji i ID ról musi się zgadzać.',
                        ephemeral: true
                    });
                }

                const customId = `dropdown-${Date.now()}`;
                const embed = new EmbedBuilder().setTitle(`🎓 ${category}`).setDescription(description).setColor(0x5865f2);
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(customId)
                    .setPlaceholder('Wybierz swoje role')
                    .setMinValues(0)
                    .setMaxValues(optionsInput.length)
                    .addOptions(optionsInput.map((label, i) => ({
                        label,
                        value: String(i),
                        description: `Nadaje rolę ${label}`
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

                return ephemeralReplyWithDelete(interaction, `✅ Menu rozwijane utworzone! ID: \`${customId}\``);
            }

            if (interaction.commandName === 'listdropdowns') {
                const ids = Object.keys(dropdownMappings);
                if (!ids.length) return interaction.reply({
                    content: '📭 Brak zapisanych menu rozwijanych.',
                    ephemeral: true
                });
                const list = ids.map(id => `• **${id}** → ${dropdownMappings[id].options.join(', ')}`).join('\n');
                return interaction.reply({
                    content: `📋 Menu rozwijane:\n${list}`,
                    ephemeral: true
                });
            }

            if (interaction.commandName === 'deletedropdown') {
                const id = interaction.options.getString('id');
                if (!dropdownMappings[id]) return interaction.reply({
                    content: '⚠️ Nieprawidłowe ID menu rozwijanego.',
                    ephemeral: true
                });
                try {
                    const ch = await client.channels.fetch(dropdownMappings[id].channelId);
                    const m = await ch.messages.fetch(dropdownMappings[id].messageId);
                    await m.delete();
                } catch {}
                delete dropdownMappings[id];
                await saveDropdowns();
                return ephemeralReplyWithDelete(interaction, `✅ Menu rozwijane \`${id}\` usunięte.`);
            }

            // ---------- SCHEDULE CONFIG COMMANDS ----------
            if (interaction.commandName.startsWith('schedule_add')) {
                const sub = interaction.commandName.replace('schedule_add', '').toLowerCase();

                // Disallowed subs
                if (['time'].includes(sub)) {
                    return interaction.reply({
                        content: '⚠️ Ta komenda została usunięta. Czas można teraz wpisać bezpośrednio podczas tworzenia harmonogramu.',
                        ephemeral: true
                    });
                }

                // Adding the schedule posting channel
                if (sub === 'channel') {
                    const channel = interaction.options.getChannel('channel');
                    if (!channel) return interaction.reply({
                        content: '⚠️ Nieprawidłowy kanał.',
                        ephemeral: true
                    });
                    scheduleConfig.channelId = channel.id;
                    await saveConfig();
                    return ephemeralReplyWithDelete(interaction, `✅ Kanał do publikowania harmonogramów ustawiony na ${channel}`);
                }

                const value = interaction.options.getString('name') || interaction.options.getString('date') || interaction.options.getString('time');
                if (!value) return interaction.reply({
                    content: '⚠️ Brakująca wartość.',
                    ephemeral: true
                });

                let key = '';
                if (sub === 'classname') key = 'classnames';
                else key = sub + 's'; // e.g., professor -> professors

                if (!Object.prototype.hasOwnProperty.call(scheduleConfig, key)) scheduleConfig[key] = [];
                if (!scheduleConfig[key].includes(value)) {
                    scheduleConfig[key].push(value);
                    await saveConfig();
                    return ephemeralReplyWithDelete(interaction, `✅ Added **${value}** to \`${key}\``);
                } else {
                    return ephemeralReplyWithDelete(interaction, `ℹ️ **${value}** already exists in \`${key}\`.`);
                }
            }
        }

    } catch (err) {
        console.error('Interaction handler error:', err);
        if (interaction && !interaction.replied) {
            try {
                await interaction.reply({
                    content: '❌ Wystąpił błąd.',
                    ephemeral: true
                });
            } catch {}
        }
    }
});

// ---------- Schedule Menu Command ----------
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

    // ---------- SCHEDULE MENU ----------
    if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_menu') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '🚫 Tylko administratorzy.',
                ephemeral: true
            });
        }

        if (!scheduleConfig.channelId) {
            return interaction.reply({
                content: '⚠️ Kanał harmonogramu nie jest ustawiony. Użyj /schedule_addchannel',
                ephemeral: true
            });
        }

        if (!scheduleConfig.professors.length || !scheduleConfig.classnames.length || !scheduleConfig.times.length || !scheduleConfig.locations.length) {
            return interaction.reply({
                content: '⚠️ Najpierw wypełnij profesorów, nazwy zajęć, czasy i lokalizacje.',
                ephemeral: true
            });
        }

        // Step 1 menus: class, professor, type
        const classMenu = new StringSelectMenuBuilder()
            .setCustomId('sched-step1-classname')
            .setPlaceholder('Wybierz nazwę zajęć')
            .addOptions(scheduleConfig.classnames.map(c => ({
                label: c,
                value: c
            })));

        const professorMenu = new StringSelectMenuBuilder()
            .setCustomId('sched-step1-professor')
            .setPlaceholder('Wybierz profesora')
            .addOptions(scheduleConfig.professors.map(p => ({
                label: p,
                value: p
            })));

        const typeMenu = new StringSelectMenuBuilder()
            .setCustomId('sched-step1-type')
            .setPlaceholder('Wybierz typ zajęć')
            .addOptions(Object.keys(CLASS_TYPE_COLORS).map(t => ({
                label: t,
                value: t
            })));

        const row1 = new ActionRowBuilder().addComponents(classMenu);
        const row2 = new ActionRowBuilder().addComponents(professorMenu);
        const row3 = new ActionRowBuilder().addComponents(typeMenu);

        const nextButton = new ButtonBuilder()
            .setCustomId('sched-step1-next')
            .setLabel('➡️ Dalej')
            .setStyle(ButtonStyle.Primary);
        const row4 = new ActionRowBuilder().addComponents(nextButton);

        await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('📅 Budowniczy Harmonogramu – Krok 1').setDescription('Wybierz nazwę zajęć, profesora i typ.')],
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

    // ---------- STEP 1 SELECT MENUS ----------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step1-')) {
        const userId = interaction.user.id;
        const state = menuState[userId];
        if (!state) return interaction.reply({
            content: '⚠️ Sesja menu wygasła.',
            ephemeral: true
        });

        const field = interaction.customId.replace('sched-step1-', '');
        state.step1[field] = interaction.values[0];

        return ephemeralReplyWithDelete(interaction, `✅ Wybrano **${field}: ${interaction.values[0]}**`);
    }

    // ---------- STEP 2 SELECT MENUS ----------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sched-step2-')) {
        const userId = interaction.user.id;
        const state = menuState[userId];
        if (!state) return interaction.reply({
            content: '⚠️ Sesja menu wygasła.',
            ephemeral: true
        });

        const field = interaction.customId.replace('sched-step2-', '');
        state.step2[field] = interaction.values[0];

        return ephemeralReplyWithDelete(interaction, `✅ Wybrano **${field}: ${interaction.values[0]}**`);
    }

    // ---------- STEP 2 NEXT BUTTON ----------
    if (interaction.isButton() && interaction.customId === 'sched-step1-next') {
        const userId = interaction.user.id;
        const state = menuState[userId];
        if (!state) return interaction.reply({
            content: '⚠️ Sesja menu wygasła.',
            ephemeral: true
        });

        const required = ['classname', 'professor', 'type'];
        for (const f of required) {
            if (!state.step1[f]) return interaction.reply({
                content: `⚠️ Wybierz **${f}** przed kontynuacją.`,
                ephemeral: true
            });
        }

        // Step 2 menus: time, location
        const timeMenu = new StringSelectMenuBuilder()
            .setCustomId('sched-step2-time')
            .setPlaceholder('Wybierz czas')
            .addOptions(scheduleConfig.times.map(t => ({
                label: t,
                value: t
            })));

        const locationMenu = new StringSelectMenuBuilder()
            .setCustomId('sched-step2-location')
            .setPlaceholder('Wybierz lokalizację')
            .addOptions(scheduleConfig.locations.map(l => ({
                label: l,
                value: l
            })));

        const row1 = new ActionRowBuilder().addComponents(timeMenu);
        const row2 = new ActionRowBuilder().addComponents(locationMenu);

        const nextButton = new ButtonBuilder()
            .setCustomId('sched-step2-next')
            .setLabel('➡️ Dalej')
            .setStyle(ButtonStyle.Primary);
        const row3 = new ActionRowBuilder().addComponents(nextButton);

        await interaction.update({
            embeds: [new EmbedBuilder().setTitle('📅 Budowniczy Harmonogramu – Krok 2').setDescription('Wybierz czas i lokalizację.')],
            components: [row1, row2, row3]
        });
    }

    // ---------- STEP 2 NEXT BUTTON ----------
    if (interaction.isButton() && interaction.customId === 'sched-step2-next') {
        const userId = interaction.user.id;
        const state = menuState[userId];
        if (!state) return interaction.reply({
            content: '⚠️ Sesja menu wygasła.',
            ephemeral: true
        });

        const required = ['time', 'location'];
        for (const f of required) {
            if (!state.step2[f]) return interaction.reply({
                content: `⚠️ Wybierz **${f}** przed kontynuacją.`,
                ephemeral: true
            });
        }

        // Show modal for date and description
        const modal = new ModalBuilder()
            .setCustomId('sched-details-modal')
            .setTitle('Szczegóły Harmonogramu');

        const dateInput = new TextInputBuilder()
            .setCustomId('sched-date')
            .setLabel('Data (RRRR-MM-DD)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('2024-01-15')
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('sched-description')
            .setLabel('Opis (opcjonalny)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Dodatkowe informacje...')
            .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(dateInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);

        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
    }

    // ---------- DETAILS MODAL SUBMIT ----------
    if (interaction.isModalSubmit() && interaction.customId === 'sched-details-modal') {
        const userId = interaction.user.id;
        const state = menuState[userId];
        if (!state) return interaction.reply({
            content: '⚠️ Sesja menu wygasła.',
            ephemeral: true
        });

        const date = interaction.fields.getTextInputValue('sched-date');
        const description = interaction.fields.getTextInputValue('sched-description') || '';

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return interaction.reply({
                content: '⚠️ Nieprawidłowy format daty. Użyj RRRR-MM-DD.',
                ephemeral: true
            });
        }

        const { classname, professor, type } = state.step1;
        const { time, location } = state.step2;
        const color = CLASS_TYPE_COLORS[type] || 0x2f3136;

        const embed = new EmbedBuilder()
            .setTitle(`📚 ${classname}`)
            .addFields({
                name: 'Profesor',
                value: professor,
                inline: true
            }, {
                name: 'Lokalizacja',
                value: location,
                inline: true
            }, {
                name: 'Typ',
                value: type,
                inline: true
            }, {
                name: 'Data',
                value: date,
                inline: true
            }, {
                name: 'Czas',
                value: time,
                inline: true
            })
            .setColor(color);

        if (description) {
            embed.addFields({
                name: 'Opis',
                value: description,
                inline: false
            });
        }

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
                description,
                channelId: ch.id,
                messageId: msg.id,
                createdBy: userId,
                createdAt: new Date().toISOString()
            };
            await saveSchedules();

            // Cleanup menuState
            delete menuState[userId];

            await interaction.reply({
                content: `✅ Harmonogram utworzony w <#${ch.id}> (ID: \`${id}\`).`,
                ephemeral: true
            });
        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: '❌ Nie udało się opublikować harmonogramu. Sprawdź uprawnienia bota.',
                ephemeral: true
            });
        }
    }

});

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

// ---------- Component Interaction: Dropdowns and Buttons ----------
client.on('interactionCreate', async (interaction) => {
    try {
        // ---------- Dropdown Role Selection ----------
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('dropdown-')) {
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

        // ---------- /schedule_list ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_list') {
            await interaction.deferReply({
                ephemeral: true
            });

            const ids = Object.keys(schedules);
            if (!ids.length) return interaction.editReply({
                content: '📭 Brak znalezionych harmonogramów.'
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
                    .setTitle(i === 0 ? '🗓️ Zapisane Harmonogramy' : '🗓️ Zapisane Harmonogramy (cd.)')
                    .setDescription(chunks[i])
                    .setColor(0x3498db);

                if (i === 0) await interaction.editReply({
                    embeds: [embed]
                });
                else await interaction.followUp({
                    embeds: [embed],
                    ephemeral: true
                });
            }
        }

        // ---------- /schedule_edit ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_edit') {
            const id = interaction.options.getString('id');
            const field = interaction.options.getString('field').toLowerCase();
            const value = interaction.options.getString('value');

            if (!schedules[id]) return ephemeralReply(interaction, '⚠️ ID harmonogramu nie znalezione.');

            const allowed = ['name', 'professor', 'type', 'date', 'time', 'location'];
            if (!allowed.includes(field)) return ephemeralReply(interaction, `⚠️ Pole musi być jednym z: ${allowed.join(', ')}`);

            schedules[id][field] = value;

            try {
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
                    })
                    .setColor(CLASS_TYPE_COLORS[schedules[id].type] || 0x2f3136)
                    .setFooter({
                        text: `ID: ${id}`
                    });

                await msg.edit({
                    embeds: [embed]
                });
                await saveSchedules();
                ephemeralReplyWithDelete(interaction, `✅ Harmonogram \`${id}\` zaktualizowany pomyślnie.`);
            } catch (err) {
                console.error(err);
                ephemeralReply(interaction, '❌ Nie udało się edytować embedu harmonogramu. Sprawdź uprawnienia.');
            }
        }

        // ---------- /schedule_delete ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_delete') {
            const id = interaction.options.getString('id');
            if (!id || !schedules[id]) return ephemeralReply(interaction, `⚠️ ID harmonogramu \`${id}\` nie znalezione.`);

            try {
                const ch = await client.channels.fetch(schedules[id].channelId);
                const msg = await ch.messages.fetch(schedules[id].messageId);
                await msg.delete().catch(() => {});
            } catch {}

            delete schedules[id];
            await saveSchedules();
            ephemeralReplyWithDelete(interaction, `✅ Harmonogram \`${id}\` usunięty pomyślnie.`);
        }

        // ---------- /schedule_copy ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'schedule_copy') {
            const id = interaction.options.getString('id');
            if (!id || !schedules[id]) return ephemeralReply(interaction, `⚠️ Schedule ID \`${id}\` not found.`);

            const original = schedules[id];
            const newId = `class-${Date.now()}`;
            try {
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
                    })
                    .setColor(CLASS_TYPE_COLORS[original.type] || 0x2f3136)
                    .setFooter({
                        text: `ID: ${newId}`
                    });

                const msg = await ch.send({
                    embeds: [embed]
                });

                schedules[newId] = {
                    ...original,
                    messageId: msg.id,
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString()
                };
                await saveSchedules();
                ephemeralReplyWithDelete(interaction, `✅ Schedule copied! New ID: \`${newId}\`.`);
            } catch (err) {
                console.error(err);
                ephemeralReply(interaction, '❌ Failed to copy schedule. Check permissions.');
            }
        }

        // ---------- /experiment_schedule ----------
        if (interaction.isChatInputCommand() && interaction.commandName === 'experiment_schedule') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({
                    content: '🚫 Tylko administratorzy.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const { spawn } = require('child_process');
            const child = spawn('node', ['schedule_experiment.js'], { cwd: __dirname });

            child.on('exit', (code) => {
                if (code === 0) {
                    interaction.editReply('✅ Eksperyment harmonogramu zakończony pomyślnie.');
                } else {
                    interaction.editReply('❌ Błąd podczas eksperymentu harmonogramu.');
                }
            });

            child.on('error', (err) => {
                console.error('Child process error:', err);
                interaction.editReply('❌ Błąd uruchomienia child process.');
            });
        }

    } catch (err) {
        console.error('Interaction handler error:', err);
        if (interaction && !interaction.replied) {
            try {
                await interaction.reply({
                    content: '❌ Wystąpił błąd.',
                    ephemeral: true
                });
            } catch {}
        }
    }
});

// ---------- Schedule Notifications ----------

function startScheduleNotifications() {
    const schedulePath = path.join(__dirname, 'data', 'schedule_experiment.json');
    const notificationChannelId = '1454411252418740365'; // Kanał do powiadomień
    const sentNotifications = new Set(); // Aby uniknąć duplikatów

    setInterval(async () => {
        try {
            if (!fs.existsSync(schedulePath)) return;

            const scheduleData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
            const now = new Date();

            for (const event of scheduleData) {
                const eventDate = parseDateTime(event.date, event.time);
                if (!eventDate) continue;

                const notificationTime = new Date(eventDate.getTime() - 60 * 60 * 1000); // 1 godzina przed
                const timeDiff = Math.abs(now - notificationTime);

                // Sprawdź czy jest dokładnie czas (z tolerancją 1 minuty)
                if (timeDiff <= 60 * 1000 && !sentNotifications.has(event.subject + event.time)) {
                    const channel = await client.channels.fetch(notificationChannelId);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle('⏰ Powiadomienie o zajęciach')
                            .setDescription(`Za 1 godzinę rozpoczynają się zajęcia!`)
                            .addFields(
                                { name: '📚 Przedmiot', value: event.subject, inline: true },
                                { name: '👨‍🏫 Prowadzący', value: event.professor, inline: true },
                                { name: '📅 Data i czas', value: `${event.date} ${event.time}`, inline: true },
                                { name: '📍 Lokalizacja', value: event.location, inline: true },
                                { name: '🏷️ Typ', value: event.type, inline: true }
                            )
                            .setColor(0xffa500) // Pomarańczowy dla powiadomień
                            .setTimestamp();

                        if (event.group) {
                            embed.addFields({ name: '👥 Grupa', value: event.group, inline: true });
                        }
                        if (event.description) {
                            embed.addFields({ name: '📝 Opis', value: event.description, inline: false });
                        }

                        await channel.send({ embeds: [embed] });
                        sentNotifications.add(event.subject + event.time);
                        console.log(`📢 Wysłano powiadomienie dla: ${event.subject}`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Błąd podczas sprawdzania harmonogramu:', error);
        }
    }, 60 * 1000); // Sprawdzaj co minutę

    console.log('🔔 System powiadomień harmonogramu uruchomiony');
}

function parseDateTime(dateStr, timeStr) {
    try {
        // Parsuj datę - zakładamy format DD.MM.YYYY lub "Dzień DD.MM.YYYY"
        let datePart = dateStr;
        if (dateStr.includes(' ')) {
            const parts = dateStr.split(' ');
            if (parts.length >= 2) {
                datePart = parts[1]; // Weź część z datą
            }
        }

        const [day, month, year] = datePart.split('.').map(Number);
        const [startTime] = timeStr.split(' - ');
        const [hours, minutes] = startTime.split(':').map(Number);

        return new Date(year, month - 1, day, hours, minutes);
    } catch {
        return null;
    }
}

// ---------- Keep-alive Express server for Render ----------
const app = express();

// Simple health check
app.get('/', (req, res) => res.send('Bot is running'));

// Use Render's assigned port or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webserver listening on port ${PORT}`));

// ---------- Login Discord Bot ----------
client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => {
        console.log('✅ Discord bot logged in');
        startScheduleNotifications();
    })
    .catch(err => console.error('❌ Failed to login:', err));
