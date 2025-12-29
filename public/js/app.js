// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
});

async function loadAllData() {
    try {
        const [schedules, status, notifications] = await Promise.all([
            fetchData('schedules'),
            fetchData('status'),
            fetchData('notification_channels')
        ]);

        displayClock();
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

    // Znajdź najbliższe zajęcia
    const now = new Date();
    let upcomingEvents = [];

    for (const item of data) {
        const eventDate = parseEventDateTime(item.date, item.time);
        if (eventDate && eventDate > now) {
            upcomingEvents.push({ ...item, eventDate });
        }
    }

    upcomingEvents.sort((a, b) => a.eventDate - b.eventDate);

    // Wyświetl najbliższe zajęcia
    if (upcomingEvents.length > 0) {
        container.innerHTML += '<h3>Najbliższe zajęcia</h3>';
        const nextEvent = upcomingEvents[0];
        container.innerHTML += `
            <div class="upcoming-event">
                <h4>${nextEvent.subject}</h4>
                <p><strong>Profesor:</strong> ${nextEvent.type}</p>
                <p><strong>Data:</strong> ${nextEvent.date} ${nextEvent.time}</p>
                <p><strong>Lokalizacja:</strong> ${nextEvent.location || 'Nieznana'}</p>
                <button class="btn" onclick="addToCalendar('${nextEvent.subject}', '${nextEvent.date}', '${nextEvent.time}', '${nextEvent.professor}', '${nextEvent.location || ''}')">Dodaj do kalendarza</button>
            </div>
        `;
    }

    // Wyświetl wszystkie harmonogramy
    container.innerHTML += `
        <div class="section">
            <h3>Wszystkie harmonogramy</h3>
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Godzina</th>
                        <th>Przedmiot</th>
                        <th>Typ</th>
                        <th>Lokalizacja</th>
                        <th>Grupa</th>
                        <th>Opis</th>
                        <th>Akcje</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.filter(item => {
                        const eventDate = parseEventDateTime(item.date, item.time);
                        return eventDate && eventDate > new Date();
                    }).map((item, index) => `
                        <tr>
                            <td>${item.date}</td>
                            <td>${item.time}</td>
                            <td>${item.subject}</td>
                            <td>${item.type}</td>
                            <td>${item.location || ''}</td>
                            <td>${item.group || ''}</td>
                            <td>${item.description || ''}</td>
                            <td>
                                <button class="btn" onclick="addToCalendar('${item.subject}', '${item.date}', '${item.time}', '${item.professor}', '${item.location || ''}')">Dodaj do kalendarza</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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

function displayClock() {
    const container = document.getElementById('clock');
    container.innerHTML = `
        <h2>🕒 Zegar i Timer</h2>
        <div class="clock-display">
            <div class="time-info">
                <p><strong>Data:</strong> <span id="current-date"></span></p>
                <p><strong>Czas:</strong> <span id="current-time"></span></p>
                <p><strong>Tydzień ISO:</strong> <span id="iso-week"></span></p>
                <p><strong>Czas Unix:</strong> <span id="unix-time"></span></p>
            </div>
            <div class="timer-info">
                        <h3>Najbliższe zajęcia</h3>
                        <div class="next-event-row" id="next-event">Ładowanie...</div>
                        <div class="countdown-display"><strong>Pozostało:</strong> <span id="countdown">--:--:--</span></div>
                    </div>
        </div>
    `;

    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    
    // Aktualna data i czas
    document.getElementById('current-date').textContent = now.toLocaleDateString('pl-PL');
    document.getElementById('current-time').textContent = now.toLocaleTimeString('pl-PL');
    
    // Tydzień ISO
    const isoWeek = getISOWeek(now);
    document.getElementById('iso-week').textContent = isoWeek;
    
    // Czas Unix
    document.getElementById('unix-time').textContent = Math.floor(now.getTime() / 1000);
    
    // Timer do najbliższych zajęć
    updateNextEventTimer();
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function updateNextEventTimer() {
    // Pobierz najbliższe zajęcia z globalnej zmiennej lub ponownie oblicz
    // Zakładamy, że upcomingEvents jest dostępne globalnie lub pobierz ponownie
    fetchData('schedules').then(data => {
        const now = new Date();
        let upcomingEvents = [];

        for (const item of data) {
            const eventDate = parseEventDateTime(item.date, item.time);
            if (eventDate && eventDate > now) {
                upcomingEvents.push({ ...item, eventDate });
            }
        }

        upcomingEvents.sort((a, b) => a.eventDate - b.eventDate);

        if (upcomingEvents.length > 0) {
            const nextEvent = upcomingEvents[0];
            document.getElementById('next-event').textContent = `${nextEvent.subject} (${nextEvent.date} ${nextEvent.time})`;
            
            const timeDiff = nextEvent.eventDate - now;
            if (timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                const dayPart = days > 0 ? `${days}d ` : '';
                document.getElementById('countdown').textContent = 
                    `${dayPart}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                document.getElementById('countdown').textContent = 'Zajęcia w trakcie lub zakończone';
            }
        } else {
            document.getElementById('next-event').textContent = 'Brak nadchodzących zajęć';
            document.getElementById('countdown').textContent = '--:--:--';
        }
    }).catch(() => {
        document.getElementById('next-event').textContent = 'Błąd ładowania';
        document.getElementById('countdown').textContent = '--:--:--';
    });
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

function parseEventDateTime(dateStr, timeStr) {
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

function addToCalendar(subject, date, time, professor, location) {
    const eventDate = parseEventDateTime(date, time);
    if (!eventDate) {
        alert('Nie można sparsować daty wydarzenia');
        return;
    }

    // Oblicz czas zakończenia (zakładamy 1.5 godziny)
    const endDate = new Date(eventDate.getTime() + 90 * 60 * 1000);

    // Formatuj dla Google Calendar
    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startDateTime = formatDate(eventDate);
    const endDateTime = formatDate(endDate);

    const title = encodeURIComponent(subject);
    const details = encodeURIComponent(`Prowadzący: ${professor}\nOpis: Zajęcia`);
    const loc = encodeURIComponent(location);

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateTime}/${endDateTime}&details=${details}&location=${loc}`;

    // Otwórz w nowej karcie
    window.open(googleCalendarUrl, '_blank');
}