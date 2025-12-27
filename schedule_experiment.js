const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Kolory jak w oryginalnej komendzie
const CLASS_TYPE_COLORS = {
    'Wykład': 0x3db1ff,
    'Ćwiczenia': 0xcc0088,
    'E-Learning': 0xf1c40f,
    'Egzamin/Zaliczenie': 0xff0000 // Dodany dla egzaminów
};

// Ścieżki
const excelFile = path.join(__dirname, 'Book1.xlsx');
const jsonFile = path.join(__dirname, 'data', 'schedule_experiment.json');

// Inicjalizuj client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Funkcja do czytania Excel
function readExcel() {
    const workbook = XLSX.readFile(excelFile);
    const sheetName = workbook.SheetNames[0]; // Pierwszy arkusz
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
}

// Funkcja do zapisywania JSON
function saveJSON(data) {
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
    console.log('✅ Dane zapisane do schedule_experiment.json');
}

// Funkcja do tworzenia embedów i wysyłania
async function sendEmbeds(data) {
    const channelId = '1429221945441915000'; // Zmień na właściwe ID kanału
    const channel = await client.channels.fetch(channelId);

    for (const row of data) {
        // Mapuj typ do koloru
        const color = CLASS_TYPE_COLORS[row.type] || 0x0099FF; // Domyślny niebieski

        const embed = new EmbedBuilder()
            .setTitle(`📚 ${row.subject}`)
            .addFields(
                { name: 'Profesor', value: row.professor, inline: true },
                { name: 'Lokalizacja', value: row.location, inline: true },
                { name: 'Typ', value: row.type, inline: true },
                { name: 'Data', value: row.date, inline: true },
                { name: 'Czas', value: row.time, inline: true }
            )
            .setColor(color);

        if (row.group) {
            embed.addFields({ name: 'Grupa', value: row.group, inline: true });
        }

        if (row.description) {
            embed.addFields({ name: 'Opis', value: row.description, inline: false });
        }

        await channel.send({ embeds: [embed] });
    }

    console.log(`✅ Wysłano ${data.length} embedów na kanał ${channelId}`);
}

// Główna funkcja
async function main() {
    try {
        await client.login(process.env.DISCORD_BOT_TOKEN);
        console.log('✅ Bot zalogowany w child process');

        const data = readExcel();
        console.log('Odczytane dane:', data);

        // Zinterpretuj dane
        const processedData = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (row.Przedmiot && row.Data && row.Godzina) {
                let date = row.Data;
                let group = '';
                // Sprawdź następny wiersz dla daty lub grupy
                if (i + 1 < data.length) {
                    const next = data[i + 1];
                    if (typeof next.Data === 'number') {
                        // Parsuj datę Excel (46039 to 10.01.2026)
                        const excelDate = new Date((next.Data - 25569) * 86400 * 1000);
                        const formatted = excelDate.toLocaleDateString('pl-PL');
                        if (date === 'Sobota' || date === 'Niedziela') {
                            date += ' ' + formatted;
                        }
                    }
                    if (next.Szczegóły && next.Szczegóły.startsWith('Grupa:')) {
                        group = next.Szczegóły;
                    }
                }
                processedData.push({
                    date,
                    time: row.Godzina || '',
                    subject: row.Przedmiot || '',
                    professor: row.Szczegóły || '',
                    location: row.Sala || '',
                    type: row['Rodzaj zajęć'] || '',
                    description: row.Uwagi || '',
                    group
                });
            }
        }

        saveJSON(processedData);
        await sendEmbeds(processedData);

        console.log('✅ Eksperyment zakończony pomyślnie');
        client.destroy();
        process.exit(0);
    } catch (err) {
        console.error('❌ Błąd:', err);
        client.destroy();
        process.exit(1);
    }
}

main();