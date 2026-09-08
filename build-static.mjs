import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

const [html, p1, p2, p3, p4, removeMultiplica, layout, stability, compat, turmaManager, turmaCards, analysisSync, ppPersistence, externalAnalysisIngest, unifiedAnalysisLauncher, pedagogicalAnalysis, analysisExperience] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('manual-capture-v3-part1.js', 'utf8'),
  readFile('manual-capture-v3-part2.js', 'utf8'),
  readFile('manual-capture-v3-part3.js', 'utf8'),
  readFile('manual-capture-v3-part4.js', 'utf8'),
  readFile('manual-remove-multiplica.js', 'utf8'),
  readFile('manual-layout-fix.js', 'utf8'),
  readFile('ui-stability-fix.js', 'utf8'),
  readFile('connector-compat.js', 'utf8'),
  readFile('turma-capture-manager.js', 'utf8'),
  readFile('turma-card-view.js', 'utf8'),
  readFile('manual-analysis-sync.js', 'utf8'),
  readFile('pp-persistence-fix.js', 'utf8'),
  readFile('external-analysis-ingest.js', 'utf8'),
  readFile('unified-analysis-launcher.js', 'utf8'),
  readFile('pedagogical-analysis-v2.js', 'utf8'),
  readFile('analysis-experience-v3.js', 'utf8')
]);

const marker = '<script>';
if (!html.includes(marker)) throw new Error('Main script marker not found in index.html');

const manual = `${p1}\n${p2}\n${p3}\n${p4}`;

new Function(manual);
new Function(removeMultiplica);
new Function(layout);
new Function(stability);
new Function(compat);
new Function(turmaManager);
new Function(turmaCards);
new Function(analysisSync);
new Function(ppPersistence);
new Function(externalAnalysisIngest);
new Function(unifiedAnalysisLauncher);
new Function(pedagogicalAnalysis);
new Function(analysisExperience);

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
if (!turmaManager.includes('df-turma-captures-v1')) throw new Error('Turma-by-turma capture persistence missing.');
if (!turmaManager.includes('Resetar dados')) throw new Error('Data reset control missing.');
if (!turmaCards.includes('Turmas da escola')) throw new Error('Turma card view missing.');
if (!analysisSync.includes('ESCOLA_TOTAL_CAPTURE_DATA')) throw new Error('Manual analysis live merge bridge missing.');
if (!analysisSync.includes('df-inteligencia-v2')) throw new Error('Manual analysis persistence bridge missing.');
if (!ppPersistence.includes('df-pp-persistent-v1')) throw new Error('PP1/PP2/PP3 persistence guard missing.');
if (!externalAnalysisIngest.includes('ESCOLA_TOTAL_CAPTURE_DATA')) throw new Error('External extension analysis ingestion missing.');
if (!externalAnalysisIngest.includes('df-analysis-synced')) throw new Error('External analysis refresh notification missing.');
if (!unifiedAnalysisLauncher.includes('__DF_GENERATE_UNIFIED_ANALYSIS__')) throw new Error('Unified all-source analysis launcher missing.');
if (!pedagogicalAnalysis.includes('Análise Pedagógica')) throw new Error('Pedagogical analysis module missing.');
if (!analysisExperience.includes('CADERNO DE LEITURA PEDAGÓGICA')) throw new Error('Distinct pedagogical analysis experience missing.');

const built = html.replace(marker, `<script>\n${manual}\n</script><script>\n${removeMultiplica}\n</script><script>\n${layout}\n</script><script>\n${stability}\n</script><script>\n${compat}\n</script><script>\n${turmaManager}\n</script><script>\n${turmaCards}\n</script><script>\n${analysisSync}\n</script><script>\n${ppPersistence}\n</script><script>\n${externalAnalysisIngest}\n</script><script>\n${unifiedAnalysisLauncher}\n</script><script>\n${pedagogicalAnalysis}\n</script><script>\n${analysisExperience}\n</script><script>`);
await writeFile('dist/index.html', built, 'utf8');

console.log('Diagnostico Facil build validated: capture, turma cards, reset, persistence, PP1/PP2/PP3 protection, external extension ingestion, unified all-source analysis, live analysis sync, pedagogical analysis and distinct decision-oriented analysis experience.');