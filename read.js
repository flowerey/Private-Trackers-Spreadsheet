const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { fetch } = require('undici');

const OWNER = 'Jackett';
const REPO = 'Jackett';
const BRANCH = 'master';
const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

let trackers = { trackers: [] };

// Load existing trackers.json to avoid duplicates
const mainJson = JSON.parse(fs.readFileSync('trackers.json'));

// Build a set of existing tracker names (normalized)
const existingTrackers = new Set(mainJson.trackers.map(obj => obj.Name.trim().toLowerCase()));

// Custom ignore list
const customIgnore = [
  'beyond-hd (oneurl)',
  'efecto doppler',
  'empornium2fa',
  'hdbits (api)',
  'hon3y hd',
  'insane tracker',
  'jptv',
  'm-team - tp',
  'mteamtp2fa',
  'racing4everyone (r4e)',
  'snowpt',
  'the geeks',
  'the place',
  'the vault',
  'totheglorycookie',
  'xwtorrents',
];

// Type cleanup mapping
const cleanTypes = {
  "audioaudiobook": "Audiobooks", "audioforeign": "Audio", "audiolossless": "Audio",
  "audiomp3": "Audio", "audioother": "Audio", "audiovideo": "Audio",
  "bookscomics": "Comics", "booksebook": "Books", "booksforeign": "Books",
  "booksmagazines": "Magazines", "booksmags": "Magazines", "booksother": "Books",
  "bookstechnical": "Books", "console3ds": "Console", "consolends": "Console",
  "consoleother": "Console", "consoleps3": "Console", "consoleps4": "Console",
  "consolepsp": "Console", "consolepsvita": "Console", "consolewii": "Console",
  "consolewiiu": "Console", "consolewiiwarevc": "Console", "consolexbox": "Console",
  "consolexbox360": "Console", "consolexbox360dlc": "Console", "consolexboxone": "Console",
  "movies3d": "Movies", "moviesbluray": "Movies", "moviesdvd": "Movies",
  "moviesforeign": "Movies", "movieshd": "Movies", "moviesother": "Movies",
  "moviessd": "Movies", "moviesuhd": "Movies", "movieswebdl": "Movies",
  "other": "General", "otherhashed": "General", "othermisc": "General",
  "pc0day": "PC", "pcgames": "Games", "pciso": "PC", "pcmac": "Mac Software",
  "pcmobileandroid": "Android", "pcmobileios": "iOS", "pcmobileother": "Phone",
  "pcphoneandroid": "Android", "pcphoneios": "iOS", "pcphoneother": "Phone",
  "tvanime": "Anime", "tvdocumentary": "TV", "tvforeign": "TV", "tvhd": "TV",
  "tvother": "TV", "tvsd": "TV", "tvsport": "Sports", "tvuhd": "TV",
  "tvwebdl": "TV", "xxxdvd": "XXX", "xxximageset": "XXX", "xxxother": "XXX",
  "xxxpack": "XXX", "xxxpacks": "XXX", "xxxsd": "XXX", "xxxuhd": "XXX",
  "xxxwmv": "XXX", "xxxx264": "XXX", "xxxxvid": "XXX",
};

function cleanTypeDefinition(type) {
  const types = new Map([['Other', 'General']]);
  return types.get(type) || type;
}

function authHeaders(extra) {
  const headers = {
    'User-Agent': 'private-trackers-spreadsheet/1.0',
    'Accept': 'application/vnd.github+json'
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return Object.assign(headers, extra || {});
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options = {}, maxAttempts = 6) {
  let attempt = 0;
  let lastError;
  while (attempt < maxAttempts) {
    attempt++;
    const res = await fetch(url, options);
    if (res.ok) return res;
    const status = res.status;
    const body = await res.text();
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    if ([429, 502, 503, 504].includes(status) || (status === 403 && body.includes('abuse detection'))) {
      const baseDelay = retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 500 * Math.pow(2, attempt));
      await sleep(baseDelay + Math.floor(Math.random() * 250));
      continue;
    }
    lastError = new Error(`HTTP ${status}: ${body}`);
    break;
  }
  if (!lastError) lastError = new Error('Max retry attempts exceeded');
  throw lastError;
}

async function githubJson(url) {
  const res = await fetchWithRetry(url, { headers: authHeaders() });
  return res.json();
}

async function githubRawByPath(owner, repo, branch, filePath) {
  const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${filePath}`;
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'private-trackers-spreadsheet/1.0' } });
  return res.text();
}

async function getBranchSha(owner, repo, branch) {
  const data = await githubJson(`${GITHUB_API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  if (!data || !data.commit || !data.commit.sha) throw new Error('Invalid branch response from GitHub');
  return data.commit.sha;
}

async function getRepoTreeRecursive(owner, repo, branch) {
  const branchSha = await getBranchSha(owner, repo, branch);
  const data = await githubJson(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branchSha}?recursive=1`);
  if (!data || !data.tree) throw new Error('Invalid tree response from GitHub');
  return data.tree;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0, active = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (index >= items.length && active === 0) { resolve(results); return; }
      while (active < limit && index < items.length) {
        const current = index++;
        active++;
        Promise.resolve().then(() => mapper(items[current], current))
          .then(value => results[current] = value)
          .catch(reject)
          .finally(() => { active--; next(); });
      }
    };
    next();
  });
}

async function main() {
  try {
    console.log('Fetching Jackett repository tree…');
    const tree = await getRepoTreeRecursive(OWNER, REPO, BRANCH);

    const definitions = tree.filter(t => t.type === 'blob' &&
      t.path.startsWith('src/Jackett.Common/Definitions/') &&
      (t.path.endsWith('.yml') || t.path.endsWith('.yaml')));

    const indexers = tree.filter(t => t.type === 'blob' &&
      t.path.startsWith('src/Jackett.Common/Indexers/') &&
      t.path.endsWith('.cs'));

    console.log(`Found ${definitions.length} definitions and ${indexers.length} indexers`);

    let defsProcessed = 0;
    await mapWithConcurrency(definitions, 3, async entry => {
      try {
        const content = await githubRawByPath(OWNER, REPO, BRANCH, entry.path);
        let data = yaml.safeLoad(content, { skipInvalid: true, json: true });
        if (data && data.type === 'private') {
          const tracker = { name: data.name || '', description: data.description || '', type: '' };
          if (data.caps?.categorymappings) {
            tracker.type = Array.from(new Set(data.caps.categorymappings.map(c => cleanTypeDefinition(c.cat.split("/")[0])))).join(", ");
          }
          if (tracker.name.trim()) trackers.trackers.push(tracker);
        }
      } catch (err) { console.log(err); }
      finally { defsProcessed++; if (defsProcessed % 25 === 0 || defsProcessed === definitions.length) console.log(`Definitions processed: ${defsProcessed}/${definitions.length}`); }
    });

    console.log('Without indexers: ' + trackers.trackers.length);

    let idxProcessed = 0;
    await mapWithConcurrency(indexers, 2, async entry => {
      try {
        const content = await githubRawByPath(OWNER, REPO, BRANCH, entry.path);
        const isPrivate = /Type\s+=\s+"private"/i.test(content) || /AvistazTracker/i.test(content);
        if (isPrivate) {
          const tracker = { name: '', description: '', type: '' };
          const baseMatch = content.match(/:\s+base\([^{}]*"/s);
          if (baseMatch) {
            const lines = baseMatch[0].match(/[^\r\n]+/g);
            for (const line of lines) {
              const nameMatch = line.match(/.*name:\s+"([\w\s.\-()]+)"/i) || line.match(/.*base\("([\w\s.\-()]+)"/i);
              if (nameMatch) tracker.name = nameMatch[1];
              const descMatch = line.match(/.*(?:desc|description):\s+"([^"]+)"/i);
              if (descMatch) tracker.description = descMatch[1];
            }
          }
          const types = new Set();
          for (const line of content.match(/[^\r\n]+/g)) {
            if (line.includes("AddCategoryMapping")) {
              const category = line.match(/TorznabCatType\.([^,]+),/i);
              if (category) types.add(cleanTypes[category[1].toLowerCase()] || category[1]);
            }
          }
          tracker.type = Array.from(types).join(", ");
          if (tracker.name.trim()) trackers.trackers.push(tracker);
        }
      } catch (err) { console.log(err); }
      finally { idxProcessed++; if (idxProcessed % 25 === 0 || idxProcessed === indexers.length) console.log(`Indexers processed: ${idxProcessed}/${indexers.length}`); }
    });

    console.log('With indexers: ' + trackers.trackers.length);

    // --- FILTER EXISTING AND IGNORED TRACKERS ---
    trackers.trackers = trackers.trackers.filter(tracker => {
      if (!tracker.name || !tracker.name.trim()) return false;
      const normalized = tracker.name.trim().toLowerCase();
      return !existingTrackers.has(normalized) && !customIgnore.includes(normalized);
    });

    trackers.trackers.sort((a, b) => a.name.localeCompare(b.name));

    // --- ALWAYS OVERWRITE trackers2.json ---
    fs.writeFileSync('trackers2.json', JSON.stringify(trackers, null, 2) + '\n');
    console.log('trackers2.json overwritten with latest data');

  } catch (e) {
    console.log('Unable to fetch from GitHub API: ' + e.message);
    if (!GITHUB_TOKEN) console.log('Hint: set GITHUB_TOKEN to increase rate limits and avoid 403 errors.');
    process.exitCode = 1;
  }
}

main();
