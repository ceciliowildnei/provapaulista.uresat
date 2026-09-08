(()=>{
  'use strict';
  if(window.__DF_UNIFIED_ANALYSIS_LAUNCHER__) return;
  window.__DF_UNIFIED_ANALYSIS_LAUNCHER__=true;

  const STORE='df-inteligencia-v2';
  const META='df-manual-capture-meta-v3';
  const SOURCE_LABELS={
    superbi:'Super BI',
    presenca:'Aluno Presente',
    recomposicaoGeral:'Recomposição',
    diagnostica1:'Diagnóstica 1',
    diagnostica2:'Diagnóstica 2',
    diagnostica3:'Diagnóstica 3',
    pp1:'Prova Paulista 1',
    pp2:'Prova Paulista 2',
    pp3:'Prova Paulista 3',
    pda:'PDA',
    planejamento:'Planejamento',
    professorTutor:'Professor Tutor',
    tutoriaLp:'Tutoria LP',
    tutoriaMat:'Tutoria MAT',
    eletivaFundamentosLp:'Fundamentos LP',
    eletivaFundamentosMat:'Fundamentos MAT'
  };

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const now=()=>new Date().toISOString();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function summary(){
    try{return JSON.parse(localStorage.getItem(STORE)||'{}')?.biSummary||{};}catch{return{};}
  }
  function capturedMeta(){
    try{return JSON.parse(localStorage.getItem(META)||'{}')||{};}catch{return{};}
  }
  function validDatasets(s){
    return Object.entries(s?.datasets||{}).filter(([,d])=>Array.isArray(d?.rows)&&d.rows.length);
  }
  function statusHost(){
    return document.getElementById('df-overview-analysis')||document.querySelector('#df-session-center .dfso-overview');
  }
  function paint(message,kind='info'){
    const host=statusHost();
    if(!host)return;
    host.dataset.unifiedAnalysis=kind;
    host.textContent=message;
    host.style.borderLeft=`4px solid ${kind==='ok'?'#14886f':kind==='error'?'#bf4d57':'#1859b7'}`;
    host.style.background=kind==='ok'?'#effaf6':kind==='error'?'#fff0f1':'#f5f9ff';
  }

  function coverageText(s){
    const ds=validDatasets(s);
    const totalRows=ds.reduce((n,[,d])=>n+d.rows.length,0);
    const names=ds.map(([k])=>SOURCE_LABELS[k]||k);
    return {ds,totalRows,names};
  }

  async function syncAll(){
    paint('Juntando todas as fontes e todas as turmas salvas...');
    if(typeof window.__DF_SYNC_ANALYSIS_NOW__==='function'){
      await window.__DF_SYNC_ANALYSIS_NOW__();
    }
    await sleep(180);
    const s=summary();
    const {ds,totalRows,names}=coverageText(s);
    const meta=capturedMeta();
    const savedSources=Object.entries(meta).filter(([,m])=>m?.status==='saved').map(([k])=>k);

    s.unifiedAnalysis={
      generatedAt:now(),
      datasetKeys:ds.map(([k])=>k),
      rows:totalRows,
      savedSources,
      allSourcesCombined:true
    };
    localStorage.setItem(STORE,JSON.stringify({biSummary:s}));

    window.__DF_UNIFIED_ANALYSIS_STATUS__={
      ok:ds.length>0,
      updatedAt:now(),
      datasets:ds.length,
      rows:totalRows,
      names,
      savedSources
    };
    window.dispatchEvent(new CustomEvent('df-analysis-synced',{detail:window.__DF_UNIFIED_ANALYSIS_STATUS__}));
    window.dispatchEvent(new CustomEvent('df-unified-analysis-ready',{detail:window.__DF_UNIFIED_ANALYSIS_STATUS__}));

    if(!ds.length){
      paint('Nenhuma base válida foi encontrada. Salve pelo menos uma fonte/turma antes de gerar a análise.','error');
      return false;
    }

    paint(`Análise consolidada pronta: ${ds.length} fonte(s) · ${totalRows.toLocaleString('pt-BR')} registro(s). ${names.join(' + ')}.`, 'ok');
    return true;
  }

  function openAnalysis(){
    const btn=document.querySelector('#app aside nav [data-tab="analisePedagogica"],#app aside nav [data-tab="analiseV4"]');
    if(btn){btn.click();return true;}
    return false;
  }

  async function generateAndOpen(){
    const ok=await syncAll();
    if(!ok)return;
    await sleep(100);
    if(!openAnalysis()) paint('As fontes foram unificadas. Abra “Análise Pedagógica” no menu lateral para visualizar o diagnóstico.', 'ok');
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-generate-overview]');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    generateAndOpen().catch(err=>paint(`Falha ao gerar análise consolidada: ${clean(err?.message||err)}`,'error'));
  },true);

  window.__DF_GENERATE_UNIFIED_ANALYSIS__=generateAndOpen;
})();
