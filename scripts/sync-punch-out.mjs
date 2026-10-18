import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { approved, budget, checkMarkup, collect, destination, publishedNames, sha256 } from './punch-out-assets.mjs';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args[2] === '--dry-run';
  if (args.length !== (dryRun ? 3 : 2) || args[0] !== '--source' || !args[1]) throw new Error('Usage: node scripts/sync-punch-out.mjs --source PATH_TO_NATIVE [--dry-run]');
  const source = path.resolve(args[1]);
  if (source === path.resolve(destination)) throw new Error('Source cannot be the publication directory');
  const files = await collect(source);
  const html = files.get('index.html').toString('utf8');
  if (!html.includes('href="/native/" class="wordmark"') || !html.includes('<header>')) throw new Error('Native navigation changed: review the publication transform');
  files.set('index.html', Buffer.from(html.replace('href="/native/" class="wordmark"', 'href="/punch-out/index.html" class="wordmark"').replace('<header>', '<header><a href="/" class="arcade-home">Daily Arcade</a>')));
  files.set('app.css', Buffer.from(files.get('app.css').toString('utf8') + '\n.arcade-home{color:var(--accent);font-size:12px;white-space:nowrap}.arcade-home:focus-visible{outline:2px solid var(--accent);outline-offset:4px}\n'));
  checkMarkup(files.get('index.html').toString('utf8'), files.get('app.css').toString('utf8'), true);
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', 'HEAD');
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Cannot determine native source commit');
  const sourceDirty = Boolean(git('status', '--porcelain', '--', '.'));
  const manifest = {
    schema: 1,
    source: { repository: 'ASCII Punch Out', path: 'projects/ascii-punch-out/native', commit, dirty: sourceDirty },
    transform: 'daily-arcade-navigation-v1',
    files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha256(bytes) }])),
  };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, Buffer.byteLength(manifestText));
  if (totalBytes > budget) throw new Error(`Publication exceeds ${budget} bytes: ${totalBytes}`);
  if (dryRun) {
    console.log(`Dry run: ${files.size} approved files, ${totalBytes} bytes, native commit ${commit}${sourceDirty ? ' (working tree modified)' : ''}. No files written.`);
    return;
  }
  await mkdir(destination, { recursive: true });
  // Never erase unexplained files. An old closure must be reviewed explicitly.
  for (const name of await publishedNames()) {
    if (name !== 'manifest.json' && (!approved.has(name) || !files.has(name))) throw new Error(`Unexpected published file; review before syncing: ${name}`);
  }
  for (const [name, bytes] of files) await writeFile(path.join(destination, name), bytes);
  await writeFile(path.join(destination, 'manifest.json'), manifestText);
  console.log(`Published ${files.size} native files from ${commit}${sourceDirty ? ' (working tree modified)' : ''}. Run npm run punchout:check.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
