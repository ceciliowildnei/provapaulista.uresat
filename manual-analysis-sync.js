(()=>{
  'use strict';
  if(window.__DF_MANUAL_ANALYSIS_SYNC__)return;
  window.__DF_MANUAL_ANALYSIS_SYNC__=true;

  const DB_NAME='df-manual-captures-v3';
  const TURMA_DB='df-turma-captures-v1';
  const DB_VERSION=1;
  const LEGACY_STORE='df-inteligencia-v2';
  const SOURCE_MAP={
    superbi:'superbi',
    alunoPresente:'presenca',
    recomposicao:'recomposicaoGeral',
    pp1:'pp1',
    pp2:'pp2',
    pp3:'pp3',
    pda:'pda',
    professorTutor:'professorTutor'
  };
  const LABELS={
    superbi:'Super BI',
    presenca:'Frequência / Aluno Presente',
    recomposicaoGeral:'Recomposição Geral',
    pp1:'Prova Paulista 1',
    pp2:'Prova Paulista 2',
    pp3:'Prova Paulista 3',
    pda:'PDA / Plano de Ação',
    professorTutor:'Professor Tutor',
    tutoriaLp:'Professor Tutor / Tutoria LP',
    tutoriaMat:'Professor Tutor / Tutoria MAT',
    eletivaFundamentosLp:'Eletiva Fundamentos LP',
    eletivaFundamentosMat:'Eletiva Fundamentos MAT'
  };

  let syncTimer=null;
  let syncing=false;
  let lastHash='';

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const now=()=>new Date().toISOString();
  const rowText=row=>fold(Object.entries(row||{}).filter(([k])=>!k.startsWith('__')).map(([k,v])=>`${k} ${v}`).join(' '));
  const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);

  function openDb(name){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(name,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('captures')){
          const store=db.createObjectStore('captures',{keyPath:'captureId'});
          store.createIndex('sourceId','sourceId',{unique:false});
          store.createIndex('timestamp','timestamp',{unique:false});
          store.createIndex('school','school',{unique:false});
          if(name===TURMA_DB)store.createIndex('turma','turma',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Falha ao abrir capturas para análise.'));
    });
  }

  async function readDbCaptures(name){
    try{
      const db=await openDb(name);
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('captures','readonly');
        const req=tx.objectStore('captures').getAll();
        req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
        req.onerror=()=>reject(req.error||new Error('Falha ao ler capturas para análise.'));
      });
    }catch{return[];}
  }

  async function readAllCaptures(){
    const [manual,turmas]=await Promise.all([readDbCaptures(DB_NAME),readDbCaptures(TURMA_DB)]);
    return [...manual,...turmas];
  }

  function captureRows(capture){
    const direct=Array.isArray(capture?.normalizedRows)&&capture.normalizedRows.length
      ? capture.normalizedRows
      : Array.isArray(capture?.rawRows)&&capture.rawRows.length
        ? capture.rawRows
        : Object.entries(capture?.datasets||{}).flatMap(([key,d])=>(d?.rows||[]).map(row=>({...row,__dataset:key})));
    return direct.filter(row=>row&&typeof row==='object'&&!Array.isArray(row));
  }

  function normalizeRow(row,capture){
    const out={};
    for(const [k,v] of Object.entries(row||{}))if(!k.startsWith('__'))out[k]=v;
    const keys=Object.keys(out);
    const hasSchool=keys.some(k=>/^(escola|unidade escolar|nome da escola)$/i.test(clean(k)));
    const hasTurma=keys.some(k=>/^(turma|classe|sala|turma atual)$/i.test(clean(k)));
    if(!hasSchool&&capture?.school&&fold(capture.school)!=='nao identificada')out.Escola=capture.school;
    const captureTurma=clean(capture?.turma||capture?.context?.turma||'');
    if(!hasTurma&&captureTurma)out.Turma=captureTurma;
    if(capture?.ure&&!hasOwn(out,'URE'))out.URE=capture.ure;
    out.__manualSource=capture?.sourceId||'';
    out.__capturedAt=capture?.timestamp||'';
    if(capture?.turmaCapture)out.__turmaCapture='1';
    return out;
  }

  function rowIdentity(row){
    const entries=Object.entries(row||{}).filter(([k])=>!k.startsWith('__')).sort(([a],[b])=>a.localeCompare(b,'pt-BR'));
    return JSON.stringify(entries);
  }

  function dedupe(rows){
    const seen=new Set(),out=[];
    for(const row of rows){const id=rowIdentity(row);if(seen.has(id))continue;seen.add(id);out.push(row);}
    return out;
  }

  function splitRecomposition(sourceId,rows){
    const buckets={};
    const add=(key,row)=>{(buckets[key]||(buckets[key]=[])).push(row);};
    for(const row of rows){
      const text=rowText(row);
      const mat=/\bmat\b|matematica/.test(text);
      const lp=/\blp\b|portugues|lingua portuguesa/.test(text);
      if(sourceId==='professorTutor'){
        if(mat)add('tutoriaMat',row);
        else if(lp)add('tutoriaLp',row);
        else add('professorTutor',row);
        continue;
      }
      const fundamentos=/fundamento|eletiva/.test(text);
      const tutoria=/tutoria|professor tutor|tutor/.test(text);
      if(fundamentos&&mat)add('eletivaFundamentosMat',row);
      else if(fundamentos&&lp)add('eletivaFundamentosLp',row);
      else if(tutoria&&mat)add('tutoriaMat',row);
      else if(tutoria&&lp)add('tutoriaLp',row);
      else add('recomposicaoGeral',row);
    }
    return buckets;
  }

  function newestCaptures(captures){
    const chosen=new Map();
    for(const capture of captures){
      if(!SOURCE_MAP[capture?.sourceId]||!capture?.records)continue;
      const school=fold(capture.school||'nao-identificada');
      const turma=capture?.turmaCapture?fold(capture.turma||'turma-nao-identificada'):'__school__';
      const key=`${capture.sourceId}|${school}|${turma}`;
      const prev=chosen.get(key);
      const t=Date.parse(capture.timestamp||0)||0;
      const pt=Date.parse(prev?.timestamp||0)||0;
      if(!prev||t>=pt)chosen.set(key,capture);
    }
    return [...chosen.values()];
  }

  function toDatasets(captures){
    const datasets={};
    for(const capture of newestCaptures(captures)){
      const sourceId=capture.sourceId;
      const baseKey=SOURCE_MAP[sourceId];
      const rows=dedupe(captureRows(capture).map(row=>normalizeRow(row,capture)));
      if(!rows.length)continue;
      const parts=(sourceId==='recomposicao'||sourceId==='professorTutor')?splitRecomposition(sourceId,rows):{[baseKey]:rows};
      for(const [key,partRows] of Object.entries(parts)){
        if(!partRows.length)continue;
        const current=datasets[key]?.rows||[];
        datasets[key]={
          key,
          label:LABELS[key]||key,
          rows:dedupe([...current,...partRows]),
          coverage:capture.coverage||'complete',
          capturedAt:capture.timestamp||now(),
          manual:true,
          includesTurmaCaptures:true
        };
      }
    }
    return datasets;
  }

  function mergeIntoLocalStore(datasets){
    if(!Object.keys(datasets).length)return;
    let current={};
    try{current=JSON.parse(localStorage.getItem(LEGACY_STORE)||'{}')||{};}catch{current={};}
    const summary=current.biSummary&&typeof current.biSummary==='object'?current.biSummary:{};
    summary.datasets={...(summary.datasets||{}),...datasets};
    summary.manualAnalysisSync={updatedAt:now(),datasetKeys:Object.keys(datasets),includesTurmaCaptures:true};
    localStorage.setItem(LEGACY_STORE,JSON.stringify({biSummary:summary}));
  }

  function applyToLiveAnalysis(datasets){
    if(!Object.keys(datasets).length)return false;
    window.postMessage({
      source:'ure-sat-conector',
      type:'ESCOLA_TOTAL_CAPTURE_DATA',
      requestId:`analysis-sync-${Date.now()}`,
      __manualAnalysisSync:true,
      payload:{datasets,manualAnalysisSync:true,includesTurmaCaptures:true}
    },location.origin);
    return true;
  }

  function datasetHash(datasets){
    return Object.entries(datasets).sort(([a],[b])=>a.localeCompare(b)).map(([k,d])=>`${k}:${d.rows?.length||0}:${d.capturedAt||''}`).join('|');
  }

  function paintStatus(datasets){
    const keys=Object.keys(datasets);
    const host=document.getElementById('df-overview-analysis');
    if(host&&keys.length){
      const rows=keys.reduce((n,k)=>n+(datasets[k]?.rows?.length||0),0);
      host.dataset.analysisSynced='1';
      host.title=`Análise sincronizada com ${keys.length} conjunto(s) e ${rows} registro(s), incluindo capturas por turma.`;
    }
  }

  async function sync(reason='manual'){
    if(syncing)return;
    syncing=true;
    try{
      const captures=await readAllCaptures();
      const datasets=toDatasets(captures);
      const hash=datasetHash(datasets);
      if(!hash){
        window.__DF_ANALYSIS_SYNC_STATUS__={ok:true,reason,datasets:0,rows:0,updatedAt:now()};
        return;
      }
      mergeIntoLocalStore(datasets);
      const live=applyToLiveAnalysis(datasets);
      paintStatus(datasets);
      lastHash=hash;
      const rows=Object.values(datasets).reduce((n,d)=>n+(d?.rows?.length||0),0);
      window.__DF_ANALYSIS_SYNC_STATUS__={ok:true,reason,datasets:Object.keys(datasets).length,rows,live,includesTurmaCaptures:true,updatedAt:now()};
      window.dispatchEvent(new CustomEvent('df-analysis-synced',{detail:window.__DF_ANALYSIS_SYNC_STATUS__}));
    }catch(error){
      window.__DF_ANALYSIS_SYNC_STATUS__={ok:false,reason,error:String(error?.message||error),updatedAt:now()};
      console.warn('[Diagnóstico Fácil] Falha ao sincronizar análise:',error);
    }finally{syncing=false;}
  }

  function schedule(reason='manual',delay=120){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>sync(reason),delay);
  }

  window.__DF_SYNC_ANALYSIS_NOW__=()=>sync('manual-api');
  window.addEventListener('df-manual-capture-saved',()=>schedule('capture-saved',80));
  window.addEventListener('df-turma-capture-saved',()=>schedule('turma-capture-saved',80));
  window.addEventListener('storage',e=>{if(e.key==='df-manual-capture-meta-v3')schedule('storage-change',120);});
  window.addEventListener('message',e=>{
    const d=e.data;
    if(e.source===window&&d?.source==='ure-sat-conector'&&d?.type==='DF_SOURCE_SESSION_COMPLETE')schedule('capture-complete',500);
  },true);

  schedule('startup',500);
  setTimeout(()=>{if(!lastHash)schedule('startup-retry',0);},1800);
})();
