function assessmentRows(base){
  if(!window.state||!state.dados)return[];
  if(base==='pp')return state.dados.pp||[];
  if(base==='saresp')return state.dados.saresp||[];
  if(base==='diag')return state.dados.diag||[];
  return state.comparativo||[];
}
function baseStatusField(base,disc){
  if(base==='pp')return disc==='LP'?'LP Status Prova Paulista':'MAT Status Prova Paulista';
  if(base==='saresp')return disc==='LP'?'LP Status SARESP':'MAT Status SARESP';
  if(base==='diag')return disc==='LP'?'LP Status Diagnóstica':'MAT Status Diagnóstica';
  return disc==='LP'?'Status Final LP':'Status Final MAT';
}
function baseTitle(base){return {pp:'Prova Paulista',saresp:'SARESP',diag:'Diagnóstica',consolidado:'Consolidado'}[base]||base}
function rowAnoSerie(row){return typeof extrairAnoSerie==='function'?extrairAnoSerie(row.Turma||row['Ano/Série']||row.Serie||row['Série']):'Sem Ano/Série'}
function normalizeBaseRow(row,base){
  return {AnoSerie:rowAnoSerie(row),Turma:row.Turma||'SEM TURMA',Estudante:row.Estudante||'',RA:row.RA||'—',LP:row[baseStatusField(base,'LP')]||'SEM DADO',MAT:row[baseStatusField(base,'MAT')]||'SEM DADO',Geral:base==='consolidado'?(row['Status Final Geral 1º Bimestre']||'SEM DADO'):geral(row[baseStatusField(base,'LP')]||'SEM DADO',row[baseStatusField(base,'MAT')]||'SEM DADO')};
}
function renderAssessmentBase(base,targetId){
  const host=document.getElementById(targetId);if(!host)return;
  const raw=assessmentRows(base);
  if(!raw.length){host.innerHTML='<div class="empty-base">Nenhum dado de '+baseTitle(base)+' foi encontrado. Se você enviar somente outra avaliação, esta aba ficará vazia.</div>';return;}
  const rows=raw.map(r=>normalizeBaseRow(r,base)).filter(r=>r.Estudante||r.RA!=='—');
  const summary={total:rows.length,abaixo:rows.filter(r=>r.Geral==='Abaixo do Básico'||r.Geral==='REGREDIU').length,basico:rows.filter(r=>r.Geral==='Básico'||r.Geral==='MANTEVE').length,prof:rows.filter(r=>r.Geral==='Proficiente'||r.Geral==='AVANÇOU').length,sem:rows.filter(r=>r.Geral==='SEM DADO').length};
  const groups={};rows.forEach(r=>{const key=r.AnoSerie+'||'+r.Turma;if(!groups[key])groups[key]=[];groups[key].push(r)});
  const summaryHtml='<div class="summary-mini"><article><span>Total</span><strong>'+summary.total+'</strong></article><article><span>Abaixo/Regrediu</span><strong>'+summary.abaixo+'</strong></article><article><span>Básico/Manteve</span><strong>'+summary.basico+'</strong></article><article><span>Proficiente/Avançou</span><strong>'+summary.prof+'</strong></article></div>';
  const body=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([key,list])=>{
    const [ano,turma]=key.split('||');
    const abaixo=list.filter(r=>r.Geral==='Abaixo do Básico'||r.Geral==='REGREDIU');
    const basico=list.filter(r=>r.Geral==='Básico'||r.Geral==='MANTEVE');
    const prof=list.filter(r=>r.Geral==='Proficiente'||r.Geral==='AVANÇOU');
    const sem=list.filter(r=>r.Geral==='SEM DADO');
    function chips(arr){return arr.length?'<div class="student-list">'+arr.map(s=>'<span class="student-chip">'+esc(s.Estudante||'Sem nome')+' <small>'+esc(s.RA)+'</small></span>').join('')+'</div>':'<p class="muted">Nenhum estudante.</p>'}
    return '<div class="level-section"><div class="level-title">'+esc(ano)+' — '+esc(turma)+' • '+list.length+' estudante(s)</div><div class="level-body"><h4>Abaixo do Básico / Regrediu</h4>'+chips(abaixo)+'<h4>Básico / Manteve</h4>'+chips(basico)+'<h4>Proficiente / Avançou</h4>'+chips(prof)+(sem.length?'<h4>Sem dado</h4>'+chips(sem):'')+'</div></div>';
  }).join('');
  host.innerHTML=summaryHtml+body;
}
function renderAssessmentTabs(){renderAssessmentBase('pp','tabPPContent');renderAssessmentBase('saresp','tabSarespContent');renderAssessmentBase('diag','tabDiagContent');renderAssessmentBase('consolidado','tabConsContent')}
function activateAssessmentTabs(){
  document.querySelectorAll('[data-assessment-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-assessment-tab]').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.assessment-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const p=document.getElementById(btn.dataset.assessmentTab);if(p)p.classList.add('active');
  }));
}
const oldRenderAssessment=typeof render==='function'?render:null;if(oldRenderAssessment){render=function(){oldRenderAssessment();setTimeout(renderAssessmentTabs,0)}}
document.addEventListener('DOMContentLoaded',()=>{activateAssessmentTabs();setInterval(renderAssessmentTabs,1500)});
