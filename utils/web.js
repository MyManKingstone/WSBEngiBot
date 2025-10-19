// utils/web.js
const express = require('express');
const { schedules } = require('./storage');

function startWebServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Serve basic HTML page
  app.get('/', (req, res) => {
    const scheduleRows = Object.values(schedules).map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.professor || '—'}</td>
        <td>${s.location || '—'}</td>
        <td>${s.date || '—'}</td>
        <td>${s.time || '—'}</td>
        <td>${s.type || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>WSB Engi Bot Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f9; padding: 20px; color: #333; }
            h1 { color: #5865F2; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #5865F2; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .status { font-weight: bold; color: green; }
          </style>
        </head>
        <body>
          <h1>WSB Engi Bot Dashboard</h1>
          <p>Bot Status: <span class="status">Online ✅</span></p>

          <h2>Current Schedules</h2>
          <table>
            <tr>
              <th>ID</th>
              <th>Professor</th>
              <th>Location</th>
              <th>Date</th>
              <th>Time</th>
              <th>Type</th>
            </tr>
            ${scheduleRows || '<tr><td colspan="6">No schedules found.</td></tr>'}
          </table>
        </body>
      </html>
    `;
    res.send(html);
  });

  app.listen(PORT, () => console.log(`🌐 Web server online at http://localhost:${PORT}`));
}

module.exports = { startWebServer };
