import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { budget, collect, destination, publishedNames, sha256 } from './punch-out-assets.mjs';

async function main() {
  const manifestBytes = await readFile(path.join(destination, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schema !== 1 || manifest.transform !== 'daily-arcade-navigation-v2-lf' || manifest.source?.repository !== 'ASCII Punch Out' || manifest.source?.path !== 'projects/ascii-punch-out/native' || !/^[a-f0-9]{40,64}$/.test(manifest.source?.commit ?? '') || manifest.source?.dirty !== false || !manifest.files || typeof manifest.files !== 'object') throw new Error('Invalid native provenance manifest');
  const files = await collect(destination);
  const expected = [...files.keys(), 'manifest.json'].sort();
  if (JSON.stringify(await publishedNames()) !== JSON.stringify(expected)) throw new Error('Unexpected or missing published files');
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...files.keys()].sort())) throw new Error('Manifest does not describe the complete browser import closure');
  let size = manifestBytes.length;
  for (const [name, bytes] of files) {
    const entry = manifest.files[name];
    if (entry?.bytes !== bytes.length || entry?.sha256 !== sha256(bytes)) throw new Error(`Published hash/size mismatch: ${name}`);
    size += bytes.length;
  }
  if (size > budget) throw new Error(`Publication exceeds ${budget} bytes: ${size}`);
  console.log(`Punch-Out publication verified: ${files.size} files, ${size} bytes, native commit ${manifest.source.commit}${manifest.source.dirty ? ' (modified source)' : ''}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
