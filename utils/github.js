// utils/github.js
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function fetchJSON(path) {
  const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}?ref=${process.env.GITHUB_BRANCH}`;
  
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    console.error(`⚠️ Failed to fetch ${path}: ${res.statusText}`);
    return { json: {}, sha: null };
  }

  const data = await res.json();
  if (!data.content) return { json: {}, sha: null };

  const json = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  return { json, sha: data.sha };
}

async function writeJSON(path, json, sha = null) {
  const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(json, null, 2)).toString('base64');

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Update ${path}`,
      content,
      sha,
      branch: process.env.GITHUB_BRANCH
    })
  });

  if (!res.ok) {
    console.error(`⚠️ Failed to write ${path}: ${res.statusText}`);
  }

  const data = await res.json();
  return data.content?.sha || sha;
}

module.exports = { fetchJSON, writeJSON };
