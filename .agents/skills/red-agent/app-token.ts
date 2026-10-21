// Prints an installation token of the red agent's GitHub App for this repository: what it files issues
// and uploads videos with, so that GitHub shows them as <app>[bot]. Valid for an hour.
// RED_AGENT_APP_ID: the App ID; RED_AGENT_APP_KEY: its private key, the whole .pem.
// node .agents/skills/red-agent/app-token.ts [owner/repo]
import { createSign } from 'node:crypto';

const repo = process.argv[2] ?? 'eugeniastrelkova/ai-workshop-start';
const id = process.env.RED_AGENT_APP_ID;
const key = process.env.RED_AGENT_APP_KEY;
if (!id || !key) throw new Error('RED_AGENT_APP_ID and RED_AGENT_APP_KEY are needed');

// The App signs in as itself with a JWT, then asks for a token of its installation on the repository.
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const body = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iat: now - 60, exp: now + 540, iss: id }))}`;
const jwt = `${body}.${b64(createSign('RSA-SHA256').update(body).sign(key.replace(/\\n/g, '\n')))}`;

async function github(method: string, path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const installation = await github('GET', `/repos/${repo}/installation`);
const { token } = await github('POST', `/app/installations/${installation.id}/access_tokens`);
console.log(token);
