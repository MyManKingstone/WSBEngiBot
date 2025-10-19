// web.js
const express = require('express');

function startWebServer(port = process.env.PORT || 3000) {
  const app = express();

  // Health check route
  app.get('/', (req, res) => res.send('Bot is running ✅'));

  app.listen(port, () => {
    console.log(`🌐 Webserver listening on port ${port}`);
  });
}

module.exports = { startWebServer };
