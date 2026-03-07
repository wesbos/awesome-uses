import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const DATA_FILE = 'src/data.js';
const REPO = 'wesbos/awesome-uses';
const BATCH_SIZE = 80;
const BATCH_DELAY_MS = 2_000;

// Any commit touching more than this many lines in data.js is a bulk edit
const BULK_COMMIT_LINE_THRESHOLD = 200;

// GitHub usernames that are never the actual contributor
const IGNORE_USERNAMES = new Set(['wesbos', 'web-flow', 'github-actions[bot]']);

type BlameChunk = {
  commitHash: string;
  authorName: string;
  authorEmail: string;
  lineNumber: number;
  content: string;
};

type PersonEntry = {
  nameLineNum: number;
  openBraceLine: number;
  closeBraceLine: number;
  name: string;
  lines: BlameChunk[];
};

function runBlame(): BlameChunk[] {
  console.log('Running git blame --porcelain (this takes a moment)...');
  const raw = execSync(`git blame --porcelain ${DATA_FILE}`, {
    maxBuffer: 100 * 1024 * 1024,
    encoding: 'utf-8',
  });

  const chunks: BlameChunk[] = [];
  const lines = raw.split('\n');
  let i = 0;

  while (i < lines.length) {
    const headerMatch = lines[i].match(
      /^([0-9a-f]{40})\s+\d+\s+(\d+)/
    );
    if (!headerMatch) {
      i++;
      continue;
    }

    const commitHash = headerMatch[1];
    const lineNumber = parseInt(headerMatch[2], 10);
    let authorName = '';
    let authorEmail = '';

    i++;
    while (i < lines.length && !lines[i].startsWith('\t')) {
      if (lines[i].startsWith('author ')) {
        authorName = lines[i].slice(7);
      } else if (lines[i].startsWith('author-mail ')) {
        authorEmail = lines[i].slice(12).replace(/[<>]/g, '');
      }
      i++;
    }

    const content = i < lines.length ? lines[i].slice(1) : '';
    chunks.push({ commitHash, authorName, authorEmail, lineNumber, content });
    i++;
  }

  return chunks;
}

function findBulkCommits(chunks: BlameChunk[]): Set<string> {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.commitHash, (counts.get(chunk.commitHash) || 0) + 1);
  }

  const bulkCommits = new Set<string>();
  for (const [hash, count] of counts) {
    if (count >= BULK_COMMIT_LINE_THRESHOLD) {
      bulkCommits.add(hash);
    }
  }

  // Always ignore the zero hash (uncommitted changes)
  bulkCommits.add('0000000000000000000000000000000000000000');

  if (bulkCommits.size > 0) {
    console.log(`Detected ${bulkCommits.size} bulk/bot commits to skip:`);
    for (const hash of bulkCommits) {
      const count = counts.get(hash) || 0;
      const sample = chunks.find((c) => c.commitHash === hash);
      console.log(`  ${hash.slice(0, 10)} (${count} lines) by ${sample?.authorName || 'unknown'}`);
    }
  }

  return bulkCommits;
}

function parsePersonEntries(chunks: BlameChunk[]): PersonEntry[] {
  const entries: PersonEntry[] = [];
  let current: PersonEntry | null = null;
  let braceDepth = 0;
  let insideArray = false;

  for (const chunk of chunks) {
    const trimmed = chunk.content.trim();

    if (!insideArray) {
      if (trimmed.includes('module.exports') || trimmed.includes('export default')) {
        insideArray = true;
      }
      continue;
    }

    if (trimmed === '{' && braceDepth === 0) {
      current = {
        nameLineNum: 0,
        openBraceLine: chunk.lineNumber,
        closeBraceLine: 0,
        name: '',
        lines: [],
      };
      braceDepth = 1;
      current.lines.push(chunk);
      continue;
    }

    if (!current) continue;

    current.lines.push(chunk);

    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
    }

    const nameMatch = trimmed.match(/^name:\s*['"](.+?)['"]/);
    if (nameMatch) {
      current.name = nameMatch[1].trim();
      current.nameLineNum = chunk.lineNumber;
    }

    if (braceDepth === 0 && current.name) {
      current.closeBraceLine = chunk.lineNumber;
      entries.push(current);
      current = null;
    } else if (braceDepth === 0) {
      current = null;
    }
  }

  return entries;
}

function pickBestCommit(entry: PersonEntry, bulkCommits: Set<string>): string | null {
  const isUsable = (chunk: BlameChunk) => !bulkCommits.has(chunk.commitHash);

  // Prefer the `name:` line's commit
  const nameLine = entry.lines.find((l) => l.lineNumber === entry.nameLineNum);
  if (nameLine && isUsable(nameLine)) {
    return nameLine.commitHash;
  }

  // Try key property lines in priority order
  const priorityKeys = ['url:', 'description:', 'emoji:', 'country:', 'twitter:', 'mastodon:', 'bluesky:', 'computer:', 'phone:'];
  for (const key of priorityKeys) {
    const line = entry.lines.find(
      (l) => l.content.trim().startsWith(key) && isUsable(l)
    );
    if (line) return line.commitHash;
  }

  // Fall back to any non-bulk line
  const fallback = entry.lines.find(isUsable);
  return fallback?.commitHash ?? null;
}

async function resolveGitHubUsernames(
  commitHashes: Set<string>
): Promise<Map<string, string>> {
  const hashToUsername = new Map<string, string>();
  const hashes = [...commitHashes];

  console.log(`Resolving ${hashes.length} unique commits via GitHub API...`);

  for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
    const batch = hashes.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (hash) => {
        const result = execSync(
          `gh api "/repos/${REPO}/commits/${hash}" --jq '.author.login // empty'`,
          { encoding: 'utf-8', timeout: 15_000 }
        ).trim();
        return { hash, username: result || null };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.username && !IGNORE_USERNAMES.has(r.value.username)) {
        hashToUsername.set(r.value.hash, r.value.username);
      }
    }

    const done = Math.min(i + BATCH_SIZE, hashes.length);
    console.log(`  ${done}/${hashes.length} commits resolved`);

    if (i + BATCH_SIZE < hashes.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return hashToUsername;
}

function extractNoreplyUsername(email: string): string | null {
  const match = email.match(/^\d+\+(.+)@users\.noreply\.github\.com$/);
  return match?.[1] ?? null;
}

function resolveViaGitLogS(name: string): string | null {
  const escaped = name.replace(/'/g, "'\\''");
  try {
    const raw = execSync(
      `git log --all -S "${escaped}" --format='%H %ae' -- ${DATA_FILE}`,
      { encoding: 'utf-8', timeout: 10_000 }
    ).trim();
    if (!raw) return null;

    // Check each commit (oldest first = most likely the original add)
    const lines = raw.split('\n').reverse();
    for (const line of lines) {
      const [hash, email] = line.split(' ', 2);

      const noreply = extractNoreplyUsername(email);
      if (noreply && !IGNORE_USERNAMES.has(noreply)) return noreply;

      if (hash && hash.length >= 7) {
        try {
          const username = execSync(
            `gh api "/repos/${REPO}/commits/${hash}" --jq '.author.login // empty'`,
            { encoding: 'utf-8', timeout: 15_000 }
          ).trim();
          if (username && !IGNORE_USERNAMES.has(username)) return username;
        } catch { /* ignore */ }
      }
    }

    return null;
  } catch {
    return null;
  }
}

function insertGitHubField(
  fileContent: string,
  entries: PersonEntry[],
  usernameMap: Map<string, string>,
  bulkCommits: Set<string>
): { content: string; skippedNames: string[] } {
  const lines = fileContent.split('\n');

  // Work backwards so line numbers stay valid after splicing
  const sorted = [...entries].sort((a, b) => b.nameLineNum - a.nameLineNum);

  let added = 0;
  let skipped = 0;
  const skippedNames: string[] = [];

  for (const entry of sorted) {
    // Check if github field already exists in the original file
    const entryLines = lines.slice(entry.openBraceLine - 1, entry.closeBraceLine);
    if (entryLines.some((l) => l.includes('github:'))) {
      continue;
    }

    const commit = pickBestCommit(entry, bulkCommits);
    let username: string | undefined;

    if (commit) {
      username = usernameMap.get(commit);
      if (!username) {
        const line = entry.lines.find((l) => l.commitHash === commit);
        if (line) {
          username = extractNoreplyUsername(line.authorEmail) ?? undefined;
        }
      }
    }

    // Fallback: use git log -S to find the commit that originally added this name
    if (!username) {
      const found = resolveViaGitLogS(entry.name);
      if (found) username = found;
    }

    // Special case: if the entry IS Wes Bos, allow it
    if (!username && entry.name.toLowerCase().includes('wes bos')) {
      username = 'wesbos';
    }

    if (!username) {
      skipped++;
      skippedNames.push(entry.name);
      continue;
    }

    const nameIdx = entry.nameLineNum - 1;
    const nameLine = lines[nameIdx];
    const indent = nameLine.match(/^(\s*)/)?.[1] ?? '    ';
    const githubLine = `${indent}github: '${username}',`;
    lines.splice(nameIdx + 1, 0, githubLine);
    added++;
  }

  console.log(`Added github field to ${added} entries, skipped ${skipped}`);
  if (skippedNames.length > 0) {
    console.log(`Still unresolved (${skippedNames.length}):\n  ${skippedNames.join('\n  ')}`);
  }
  return { content: lines.join('\n'), skippedNames };
}

async function main() {
  const chunks = runBlame();
  console.log(`Parsed ${chunks.length} blame chunks`);

  const bulkCommits = findBulkCommits(chunks);

  const entries = parsePersonEntries(chunks);
  console.log(`Found ${entries.length} person entries`);

  // Collect unique commit hashes we need to resolve
  const commitHashes = new Set<string>();
  const entryCommitMap = new Map<PersonEntry, string>();

  for (const entry of entries) {
    const commit = pickBestCommit(entry, bulkCommits);
    if (commit) {
      commitHashes.add(commit);
      entryCommitMap.set(entry, commit);
    }
  }

  // First pass: extract usernames from noreply emails (no API call needed)
  const usernameMap = new Map<string, string>();
  for (const entry of entries) {
    const commit = entryCommitMap.get(entry);
    if (!commit) continue;
    const line = entry.lines.find((l) => l.commitHash === commit);
    if (line) {
      const noreply = extractNoreplyUsername(line.authorEmail);
      if (noreply && !IGNORE_USERNAMES.has(noreply)) {
        usernameMap.set(commit, noreply);
        commitHashes.delete(commit);
      }
    }
  }

  console.log(`Resolved ${usernameMap.size} usernames from noreply emails`);
  console.log(`${commitHashes.size} commits still need GitHub API lookup`);

  // Second pass: GitHub API for remaining
  const apiResults = await resolveGitHubUsernames(commitHashes);
  for (const [hash, username] of apiResults) {
    usernameMap.set(hash, username);
  }

  console.log(`Total resolved: ${usernameMap.size} usernames`);

  const fileContent = readFileSync(DATA_FILE, 'utf-8');
  const { content: updated, skippedNames } = insertGitHubField(fileContent, entries, usernameMap, bulkCommits);
  writeFileSync(DATA_FILE, updated, 'utf-8');

  if (skippedNames.length > 0) {
    console.log(`\n${skippedNames.length} entries could not be resolved. You may need to manually add github IDs for these.`);
  }
  console.log('Done! data.js updated.');
}

void main();
