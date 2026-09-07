import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const [html, compat] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('connector-compat.js', 'utf8')
]);

const marker = '<script>';
if (!html.includes(marker)) {
  throw new Error('Main script marker not found in index.html');
}

const built = html.replace(marker, `<script>\n${compat}\n</script><script>`);
await writeFile('dist/index.html', built, 'utf8');

console.log('Diagnostico Facil static build ready with connector compatibility layer.');
