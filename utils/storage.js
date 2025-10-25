const { fetchJSON, writeJSON } = require('./github');
const { 
  DROPDOWN_PATH, 
  SCHEDULE_PATH, 
  CONFIG_PATH, 
  HOMEWORK_PATH,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_HOMEWORK_CONFIG
} = require('../config');

// ---------- Persistent Data ----------
let dropdownMappings = {};
let dropdownSHA = null;

let schedules = {};
let schedulesSHA = null;

let scheduleConfig = { ...DEFAULT_SCHEDULE_CONFIG };
let scheduleConfigSHA = null;

let homeworks = {};
let homeworksSHA = null;

let homeworkConfig = { ...DEFAULT_HOMEWORK_CONFIG };
let homeworkConfigSHA = null;

// ---------- Load all JSON from GitHub ----------
async function loadAllData() {
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

    const homeworkData = await fetchJSON(HOMEWORK_PATH);
    homeworks = homeworkData.json;
    homeworksSHA = homeworkData.sha;

    // Load homework config from schedule config for now (can be separated later)
    homeworkConfig = {
      channelId: scheduleConfig.homeworkChannelId || ''
    };

    console.log('✅ GitHub JSON files loaded successfully');
  } catch (err) {
    console.error('⚠️ Failed to fetch JSON from GitHub:', err);
  }
}

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

async function saveHomeworks() {
  homeworksSHA = await writeJSON(HOMEWORK_PATH, homeworks, homeworksSHA);
}

async function saveHomeworkConfig() {
  // Save homework config to schedule config for now
  scheduleConfig.homeworkChannelId = homeworkConfig.channelId;
  scheduleConfigSHA = await writeJSON(CONFIG_PATH, scheduleConfig, scheduleConfigSHA);
}

module.exports = {
  // Data objects
  dropdownMappings,
  schedules,
  scheduleConfig,
  homeworks,
  homeworkConfig,
  
  // Load function
  loadAllData,
  
  // Save functions
  saveDropdowns,
  saveSchedules,
  saveConfig,
  saveHomeworks,
  saveHomeworkConfig
};
