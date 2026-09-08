import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const [html, p1, p2, p3, p4, layout, stability, compat] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('manual-capture-v3-part1.js', 'utf8'),
  readFile('manual-capture-v3-part2.js', 'utf8'),
  readFile('manual-capture-v3-part3.js', 'utf8'),
  readFile('manual-capture-v3-part4.js', 'utf8'),
  readFile('manual-layout-fix.js', 'utf8'),
  readFile('ui-stability-fix.js', 'utf8'),
  readFile('connector-compat.js', 'utf8')
]);

const marker = '<script>';
if (!html.includes(marker)) throw new Error('Main script marker not found in index.html');

const manual = `${p1}\n${p2}\n${p3}\n${p4}`;
const built = html.replace(marker, `<script>\n${manual}\n</script><script>\n${layout}\n</script><script>\n${stability}\n</script><script>\n${compat}\n</script><script>`);
await writeFile('dist/index.html', built, 'utf8');

console.log('Diagnostico Facil built in robust manual current-view mode with restored structured capture layout.');
