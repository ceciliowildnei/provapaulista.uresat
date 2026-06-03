function extrairAnoSerie(valor){
  const raw=String(valor||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const compact=raw.replace(/\s+/g,' ');
  let m=compact.match(/\b([6-9])\s*(ANO|º|°)?\b/);
  if(m)return m[1]+'º Ano';
  m=compact.match(/\b([1-3])\s*(SERIE|ª|A)?\s*(EM|ENSINO MEDIO)?\b/);
  if(m)return m[1]+'ª Série EM';
  m=compact.match(/\b([6-9])[A-Z]\b/);
  if(m)return m[1]+'º Ano';
  m=compact.match(/\b([1-3])[A-Z]\b/);
  if(m)return m[1]+'ª Série EM';
  return 'Sem Ano/Série';
}
function normalizarTurma(valor){return String(valor||'SEM TURMA').trim()||'SEM TURMA'}
function enriquecerAnoSerie(){
  if(!window.state)return;
  (state.comparativo||[]).forEach(r=>{r['Ano/Série']=extrairAnoSerie(r.Turma||r.Serie||r['Série']||r['Ano/Série']||r['Ano Serie']);r.Turma=normalizarTurma(r.Turma)});
  ['saresp','diag','pp'].forEach(base=>{((state.dados&&state.dados[base])||[]).forEach(r=>{r['Ano/Série']=extrairAnoSerie(r.Turma||r.Serie||r['Série']||r['Ano/Série']||r['Ano Serie']);r.Turma=normalizarTurma(r.Turma)})});
}
function grupoAnoSerie(){enriquecerAnoSerie();const rows=(window.state&&state.comparativo)||[];const out={};rows.forEach(r=>{const ano=r['Ano/Série']||extrairAnoSerie(r.Turma);const turma=normalizarTurma(r.Turma);if(!out[ano])out[ano]={};if(!out[ano][turma])out[ano][turma]=[];out[ano][turma].push(r)});return out}
function renderTurmasPorAnoSerie(){
  const el=document.getElementById('turmasContent');if(!el)return;
  const grupos=grupoAnoSerie();const anos=Object.keys(grupos).sort();
  if(!anos.length){el.innerHTML='<p>Após clicar em Analisar, aparecerá aqui o resumo por Ano/Série e Turma.</p>';return;}
  el.innerHTML=anos.map(ano=>{
    const turmas=Object.entries(grupos[ano]).sort(([a],[b])=>a.localeCompare(b));
    return '<div class="analysis-card"><h3>'+esc(ano)+'</h3><table class="analysis-table"><thead><tr><th>Turma</th><th>Estudantes</th><th>Avançou</th><th>Manteve</th><th>Regrediu</th><th>Sem dado</th></tr></thead><tbody>'+turmas.map(([turma,list])=>{const av=list.filter(r=>r['Status Final Geral 1º Bimestre']==='AVANÇOU').length;const ma=list.filter(r=>r['Status Final Geral 1º Bimestre']==='MANTEVE').length;const re=list.filter(r=>r['Status Final Geral 1º Bimestre']==='REGREDIU').length;const sd=list.filter(r=>r['Status Final Geral 1º Bimestre']==='SEM DADO').length;return '<tr><td>'+esc(turma)+'</td><td>'+list.length+'</td><td>'+av+'</td><td>'+ma+'</td><td>'+re+'</td><td>'+sd+'</td></tr>'}).join('')+'</tbody></table></div>'
  }).join('');
}
function renderDadosPorAnoSerie(){
  const el=document.getElementById('dadosContent');if(!el)return;
  enriquecerAnoSerie();const rows=(window.state&&state.comparativo)||[];
  if(!rows.length){el.innerHTML='<p>Após clicar em Analisar, aparecerão aqui os dados consolidados por Ano/Série e Turma.</p>';return;}
  el.innerHTML='<table class="analysis-table"><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudante</th><th>RA</th><th>LP Final</th><th>MAT Final</th><th>Geral</th></tr></thead><tbody>'+rows.slice(0,200).map(r=>'<tr><td>'+esc(r['Ano/Série'])+'</td><td>'+esc(r.Turma)+'</td><td>'+esc(r.Estudante)+'</td><td>'+esc(r.RA)+'</td><td>'+esc(r['Status Final LP'])+'</td><td>'+esc(r['Status Final MAT'])+'</td><td><b>'+esc(r['Status Final Geral 1º Bimestre'])+'</b></td></tr>').join('')+'</tbody></table>';
}
function renderEvolucaoPorAnoSerie(){
  const el=document.getElementById('evolucaoContent');if(!el)return;
  const grupos=grupoAnoSerie();const linhas=[];
  Object.entries(grupos).forEach(([ano,turmas])=>Object.entries(turmas).forEach(([turma,list])=>{const av=list.filter(r=>r['Status Final Geral 1º Bimestre']==='AVANÇOU').length;const re=list.filter(r=>r['Status Final Geral 1º Bimestre']==='REGREDIU').length;linhas.push({ano,turma,total:list.length,av,re,indice:list.length?Number(((av-re)/list.length*100).toFixed(1)):0})}));
  if(!linhas.length){el.innerHTML='<p>Após clicar em Analisar, aparecerá aqui o ranking por Ano/Série e Turma.</p>';return;}
  linhas.sort((a,b)=>b.indice-a.indice);
  el.innerHTML='<table class="analysis-table"><thead><tr><th>Ranking</th><th>Ano/Série</th><th>Turma</th><th>Índice</th><th>Avançou</th><th>Regrediu</th><th>Total</th></tr></thead><tbody>'+linhas.map((g,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(g.ano)+'</td><td>'+esc(g.turma)+'</td><td><b>'+g.indice+'%</b></td><td>'+g.av+'</td><td>'+g.re+'</td><td>'+g.total+'</td></tr>').join('')+'</tbody></table>';
}
function patchAnoSerieExport(){
  if(typeof exportExcel!=='function'||exportExcel.__anoSeriePatched)return;
  const old=exportExcel;
  exportExcel=async function(){
    if(!state.comparativo.length)await analyze();
    enriquecerAnoSerie();
    const XLSX=await loadXLSX();const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.comparativo),'Comparativo Geral');
    const resumo=[];Object.entries(grupoAnoSerie()).forEach(([ano,turmas])=>Object.entries(turmas).forEach(([turma,list])=>{resumo.push({'Ano/Série':ano,Turma:turma,Estudantes:list.length,Avancou:list.filter(r=>r['Status Final Geral 1º Bimestre']==='AVANÇOU').length,Manteve:list.filter(r=>r['Status Final Geral 1º Bimestre']==='MANTEVE').length,Regrediu:list.filter(r=>r['Status Final Geral 1º Bimestre']==='REGREDIU').length,'Sem dado':list.filter(r=>r['Status Final Geral 1º Bimestre']==='SEM DADO').length})}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(resumo),'Resumo Ano-Série Turma');
    if(typeof ppAllDiscRows==='function')XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ppAllDiscRows().map(r=>({...r,'Ano/Série':extrairAnoSerie(r.Turma)}))),'PP Todas Disciplinas');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.saresp||[]),'Dados SARESP');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.diag||[]),'Dados Diagnóstica');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.pp||[]),'Dados Prova Paulista');
    XLSX.writeFile(wb,'Consolidacao_por_Ano_Serie_Turma.xlsx');
    msg('Excel gerado separado por Ano/Série e Turma.','success');
  };
  exportExcel.__anoSeriePatched=true;
}
function renderAnoSerieTudo(){renderTurmasPorAnoSerie();renderDadosPorAnoSerie();renderEvolucaoPorAnoSerie();patchAnoSerieExport()}
const oldRenderAnoSerie=typeof render==='function'?render:null;if(oldRenderAnoSerie){render=function(){oldRenderAnoSerie();setTimeout(renderAnoSerieTudo,0)}}
document.addEventListener('DOMContentLoaded',()=>setInterval(renderAnoSerieTudo,1200));