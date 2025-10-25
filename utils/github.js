// utils/github.js
const { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN } = require('../config');

// ✅ Universal fetch fix for CommonJS (works on Render)
let fetch;
try {
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
} catch (e) {
  console.warn('⚠️ Could not initialize node-fetch:', e);
}

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

module.exports = { fetchJSON, writeJSON };
