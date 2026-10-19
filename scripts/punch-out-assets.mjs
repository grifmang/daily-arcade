import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const destination = fileURLToPath(new URL('../public/punch-out/', import.meta.url));
export const budget = 64 * 1024 * 1024;
export const fileBudget = 25 * 1024 * 1024;
export const approved = new Set([
  'index.html', 'app.css', 'app.mjs', 'controller.mjs',
  'engine.mjs', 'recovered-data.mjs', 'fight-seeds.mjs', 'opponent-vm.mjs',
  'fight-control.mjs', 'player-state.mjs', 'combat-resolution.mjs',
  'input-clockwork.mjs', 'round-flow.mjs', 'circuit-flow.mjs', 'palette.mjs',
  'round-setup.mjs', 'corner-presentation.mjs', 'corner-art.mjs',
  'corner-animation.mjs', 'fighter-art.mjs', 'opponent-glyphs.mjs', 'audio.mjs', 'audio-data.mjs',
  'postfight-presentation.mjs', 'postfight-art.mjs',
  'ring-presentation.mjs', 'ring-art.mjs', 'star-art.mjs',
  'career-password.mjs',
  'career-menu.mjs', 'menu-art.mjs', 'demo-art.mjs', 'demo-seed.mjs',
  'bout-identity.mjs', 'another-world-art.mjs',
  'special-password-presentation.mjs', 'special-password-art.mjs',
  'audio-routines.mjs', 'audio-seeds.mjs', 'audio-output.mjs', 'audio-samples.mjs',
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// A deliberately narrow lexer: imports must use literal strings. Comments,
// quoted data, and template text cannot masquerade as import declarations.
function tokens(code) {
  const result = [];
  for (let i = 0; i < code.length;) {
    if (/\s/.test(code[i])) { i++; continue; }
    if (code.startsWith('//', i)) { i = code.indexOf('\n', i); if (i < 0) break; continue; }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unclosed module comment');
      i = end + 2; continue;
    }
    const quote = code[i];
    if (quote === '"' || quote === "'" || quote === '`') {
      const start = i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      if (i >= code.length) throw new Error('Unclosed module string');
      const value = code.slice(start + 1, i++);
      if (quote === '`' && /\bimport\b/.test(value)) throw new Error('Imports inside templates require explicit audit');
      result.push({ kind: quote === '`' ? 'template' : 'string', value });
      continue;
    }
    const identifier = /^[A-Za-z_$][\w$]*/.exec(code.slice(i));
    if (identifier) { result.push({ kind: 'word', value: identifier[0] }); i += identifier[0].length; }
    else result.push({ kind: 'punctuation', value: code[i++] });
  }
  return result;
}

export function moduleImports(code) {
  const list = tokens(code), imports = [];
  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token.kind !== 'word' || !['import', 'export'].includes(token.value)) continue;
    if (token.value === 'import') {
      const next = list[i + 1];
      if (next?.value === '.') continue; // import.meta
      if (next?.value === '(') {
        if (list[i + 2]?.kind !== 'string' || list[i + 3]?.value !== ')') throw new Error('Computed import is forbidden');
        imports.push(list[i + 2].value); continue;
      }
      if (next?.kind === 'string') { imports.push(next.value); continue; }
      let j = i + 1;
      while (j < list.length && list[j].value !== ';' && list[j].value !== 'from') j++;
      if (list[j]?.value !== 'from' || list[j + 1]?.kind !== 'string') throw new Error('Unrecognized import declaration');
      imports.push(list[j + 1].value);
    } else if (['*', '{'].includes(list[i + 1]?.value)) {
      let j = i + 1;
      while (j < list.length && list[j].value !== ';' && list[j].value !== 'from') j++;
      if (list[j]?.value === 'from') {
        if (list[j + 1]?.kind !== 'string') throw new Error('Unrecognized export source');
        imports.push(list[j + 1].value);
      }
    }
  }
  return imports;
}

function localImport(from, specifier) {
  if (!/^\.\/[a-z0-9-]+\.mjs$/.test(specifier)) throw new Error(`External or unsupported import in ${from}: ${specifier}`);
  const name = path.posix.join(path.posix.dirname(from), specifier);
  if (!approved.has(name)) throw new Error(`Unapproved native file: ${name}`);
  return name;
}

export function checkMarkup(html, css, published = false) {
  const references = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  if ([...html.matchAll(/\b(?:src|href)\s*=/gi)].length !== references.length) throw new Error('HTML asset references must be quoted');
  const allowed = new Set(['./app.css', './app.mjs', published ? '/punch-out/index.html' : '/native/', '/']);
  for (const ref of references) if (!allowed.has(ref)) throw new Error(`Unapproved HTML reference: ${ref}`);
  if (!/<script\s+type="module"\s+src="\.\/app\.mjs"\s*>\s*<\/script>/.test(html)) throw new Error('Expected native module entry point');
  if (!/<link\s+rel="stylesheet"\s+href="\.\/app\.css"\s*>/.test(html)) throw new Error('Expected native stylesheet');
  if (/<(?:iframe|object|embed|base)\b/i.test(html) || /\b(?:on\w+|style)\s*=/i.test(html)) throw new Error('Unsupported embedded HTML behavior');
  if ([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].some(match => match[1].trim())) throw new Error('Inline scripts are forbidden');
  if (/@import\b|url\s*\(/i.test(css)) throw new Error('CSS asset dependencies require explicit approval');
  if (published && (!/<a\b[^>]*href="\/"[^>]*>\s*Daily Arcade\s*<\/a>/.test(html) || !html.includes('href="/punch-out/index.html" class="wordmark"'))) throw new Error('Missing visible arcade or cabinet navigation');
  if (published && !css.includes('.arcade-home{color:var(--accent);')) throw new Error('Missing arcade navigation styling');
}

export async function collect(root) {
  const files = new Map();
  async function visit(name) {
    if (files.has(name)) return;
    if (!approved.has(name)) throw new Error(`Unapproved native file: ${name}`);
    const filename = path.join(root, name), stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected regular file: ${name}`);
    const bytes = await readFile(filename);
    if (bytes.length > fileBudget) throw new Error(`Native file exceeds 25 MiB: ${name}`);
    files.set(name, bytes);
    if (name.endsWith('.mjs')) {
      for (const specifier of moduleImports(bytes.toString('utf8'))) await visit(localImport(name, specifier));
    }
  }
  for (const name of ['index.html', 'app.css', 'app.mjs']) await visit(name);
  checkMarkup(files.get('index.html').toString('utf8'), files.get('app.css').toString('utf8'), root === destination);
  const size = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (size > budget) throw new Error(`Native assets exceed ${budget} byte budget: ${size}`);
  return files;
}

export async function publishedNames() {
  const entries = await readdir(destination, { withFileTypes: true });
  if (entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) throw new Error('Unexpected directory or symlink in published assets');
  return entries.map(entry => entry.name).sort();
}
