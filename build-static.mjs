import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const [html, p1, p2, p3, p4, removeMultiplica, layout, stability, compat, analysisSync] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('manual-capture-v3-part1.js', 'utf8'),
  readFile('manual-capture-v3-part2.js', 'utf8'),
  readFile('manual-capture-v3-part3.js', 'utf8'),
  readFile('manual-capture-v3-part4.js', 'utf8'),
  readFile('manual-remove-multiplica.js', 'utf8'),
  readFile('manual-layout-fix.js', 'utf8'),
  readFile('ui-stability-fix.js', 'utf8'),
  readFile('connector-compat.js', 'utf8'),
  readFile('manual-analysis-sync.js', 'utf8')
]);

const marker = '<script>';
if (!html.includes(marker)) throw new Error('Main script marker not found in index.html');

const manual = `${p1}\n${p2}\n${p3}\n${p4}`;

new Function(manual);
new Function(removeMultiplica);
new Function(layout);
new Function(stability);
new Function(compat);
new Function(analysisSync);

const requiredSources = ['superbi','alunoPresente','recomposicao','pp1','pp2','pp3','pda','professorTutor'];
for (const source of requiredSources) {
  if (!manual.includes(source)) throw new Error(`Manual capture source missing: ${source}`);
}
if (/multiplica\s*:\s*\{\s*label\s*:\s*['"]Multiplica/i.test(manual)) {
  throw new Error('Multiplica must not exist in the active manual capture definitions.');
}
if (!manual.includes('DIAG_CAPTURE_CURRENT_VIEW')) throw new Error('Manual current-view capture protocol missing.');
if (!manual.includes('df-manual-captures-v3')) throw new Error('Manual capture persistence missing.');
if (!manual.includes('df-manual-capture-saved')) throw new Error('Manual analysis save notification missing.');
if (!analysisSync.includes('ESCOLA_TOTAL_CAPTURE_DATA')) throw new Error('Manual analysis live merge bridge missing.');
if (!analysisSync.includes('df-inteligencia-v2')) throw new Error('Manual analysis persistence bridge missing.');

const built = html.replace(marker, `<script>\n${manual}\n</script><script>\n${removeMultiplica}\n</script><script>\n${layout}\n</script><script>\n${stability}\n</script><script>\n${compat}\n</script><script>\n${analysisSync}\n</script><script>`);
await writeFile('dist/index.html', built, 'utf8');

console.log('Diagnostico Facil build validated: capture, persistence, live analysis sync, required sources, Multiplica removed.');
