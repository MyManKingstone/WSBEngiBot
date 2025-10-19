// utils/storage.js
const fs = require('fs');
const path = require('path');

// ---- Base data folder ----
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// ---- File paths ----
const DROPDOWN_FILE = path.join(DATA_DIR, 'dropdowns.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedules.json');
const CONFIG_FILE = path.join(DATA_DIR, 'schedule_config.json');
const HOMEWORK_FILE = path.join(DATA_DIR, 'homeworks.json');

// ---- Helper functions ----
function loadJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`⚠️ Failed to load ${path.basename(file)}:`, err);
  }
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`⚠️ Failed to save ${path.basename(file)}:`, err);
  }
}

// ---- Load all data ----
const dropdownMappings = loadJSON(DROPDOWN_FILE, {});
const schedules = loadJSON(SCHEDULE_FILE, {});
const homeworks = loadJSON(HOMEWORK_FILE, {});
const scheduleConfig = loadJSON(CONFIG_FILE, {
  professors: [],
  locations: [],
  classnames: [],
  dates: [],
  times: [],
  channelId: '',
  homeworkChannelId: '',
});

// ---- Shared constants ----
const CLASS_TYPE_COLORS = {
  lecture: 0x2ECC71, // green
  lab: 0xE67E22,     // orange
  seminar: 0x3498DB, // blue
};

// ---- Exports ----
module.exports = {
  DATA_DIR,
  DROPDOWN_FILE,
  SCHEDULE_FILE,
  HOMEWORK_FILE,
  CONFIG_FILE,
  dropdownMappings,
  schedules,
  homeworks,
  scheduleConfig,
  CLASS_TYPE_COLORS,
  loadJSON,
  saveJSON
};
