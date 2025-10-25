// Configuration and constants for the Discord bot

// Environment variables
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

// File paths
const DROPDOWN_PATH = 'data/dropdowns.json';
const SCHEDULE_PATH = 'data/schedules.json';
const CONFIG_PATH = 'data/schedule_config.json';
const HOMEWORK_PATH = 'data/homeworks.json';

// Class type colors
const CLASS_TYPE_COLORS = {
  'Wyklad': 0x3db1ff,
  'Cwiczenia': 0xcc0088,
  'E-Learning': 0xf1c40f
};

// Default configuration objects
const DEFAULT_SCHEDULE_CONFIG = {
  professors: [],
  locations: [],
  classnames: [],
  dates: [],
  times: [],
  channelId: ''
};

const DEFAULT_HOMEWORK_CONFIG = {
  channelId: ''
};

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  GITHUB_TOKEN,
  DISCORD_BOT_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  PORT,
  DROPDOWN_PATH,
  SCHEDULE_PATH,
  CONFIG_PATH,
  HOMEWORK_PATH,
  CLASS_TYPE_COLORS,
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_HOMEWORK_CONFIG
};
