// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
});

async function loadAllData() {
    try {
        const [schedules, status, notifications] = await Promise.all([
            fetchData('schedules'),
            fetchData('bot_status'),
            fetchData('notification_channels')
        ]);

        displaySchedules(schedules);
        displayStatus(status);
        displayNotifications(notifications);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function fetchData(file) {
    const response = await fetch(`/api/data/${file}`);
    return await response.json();
}

async function updateData(file, data) {
    const response = await fetch(`/api/data/${file}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return await response.json();
}

function displaySchedules(data) {
    const container = document.getElementById('schedules');
    container.innerHTML = '<h2>Harmonogramy</h2>';

    for (const [key, schedule] of Object.entries(data)) {
        container.innerHTML += `
            <div class="section">
                <h3>${key}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Godzina</th>
                            <th>Przedmiot</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schedule.map(item => `
                            <tr>
                                <td>${item.date}</td>
                                <td>${item.time}</td>
                                <td>${item.subject}</td>
                                <td>
                                    <button class="btn btn-danger" onclick="deleteScheduleItem('${key}', '${item.subject}')">Usuń</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function displayStatus(data) {
    const container = document.getElementById('status');
    container.innerHTML = `
        <h2>Status Bota</h2>
        <p><strong>Status:</strong> ${data.status}</p>
        <p><strong>Ostatnia aktualizacja:</strong> ${data.lastUpdate}</p>
        <button class="btn" onclick="updateStatus()">Aktualizuj Status</button>
    `;
}

function displayNotifications(data) {
    const container = document.getElementById('notifications');
    container.innerHTML = '<h2>Kanały Powiadomień</h2>';

    const table = `
        <table>
            <thead>
                <tr>
                    <th>Serwer ID</th>
                    <th>Kanał ID</th>
                    <th>Akcje</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data).map(([guildId, channelId]) => `
                    <tr>
                        <td>${guildId}</td>
                        <td>${channelId}</td>
                        <td>
                            <button class="btn btn-danger" onclick="deleteNotification('${guildId}')">Usuń</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML += table;
}

// Placeholder functions for actions
function deleteScheduleItem(scheduleKey, subject) {
    alert(`Usuwanie ${subject} z ${scheduleKey} - funkcjonalność do zaimplementowania`);
}

function updateStatus() {
    alert('Aktualizacja statusu - funkcjonalność do zaimplementowania');
}

function deleteNotification(guildId) {
    alert(`Usuwanie powiadomienia dla ${guildId} - funkcjonalność do zaimplementowania`);
}