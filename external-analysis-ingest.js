(()=>{
  'use strict';
  if(window.__DF_EXTERNAL_ANALYSIS_INGEST__)return;
  window.__DF_EXTERNAL_ANALYSIS_INGEST__=true;

  const STORE='df-inteligencia-v2';
  const SOURCES=new Set(['diagnostico-facil-extrator','escola-total-extrator','ure-sat-conector','ure-sat-escola-total']);
  const TYPES=new Set(['ESCOLA_TOTAL_DATA','ESCOLA_TOTAL_MODULE_DATA','ESCOLA_TOTAL_COMBO_DATA','ESCOLA_TOTAL_CAPTURE_DATA','ESCOLA_TOTAL_FULL_CAPTURE_DATA','DF_DATA']);
  const now=()=>new Date().toISOString();
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function datasetKey(k,d){
    const m=fold(`${k} ${d?.key||''} ${d?.label||''}`);
    if(/pp\s*1|prova paulista.*1/.test(m))return'pp1';
    if(/pp\s*2|prova paulista.*2/.test(m))return'pp2';
    if(/pp\s*3|prova paulista.*3/.test(m))return'pp3';
    if(/diagnostica.*1|avd\s*1|avd1/.test(m))return'diagnostica1';
    if(/diagnostica.*2|avd\s*2|avd2/.test(m))return'diagnostica2';
    if(/aluno presente|presenca|frequencia/.test(m))return'presenca';
    if(/super\s*bi/.test(m))return'superbi';
    if(/planejamento|plano de aula/.test(m))return'planejamento';
    return clean(d?.key||k);
  }

  function readStore(){
    try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{return{}}
  }

  function incomingDatasets(payload){
    const p=payload||{};
    const bi=p.biSummary&&typeof p.biSummary==='object'?p.biSummary:{};
    const raw={...(bi.datasets||{}),...(p.datasets||{})};
    if(p.dataset&&Array.isArray(p.dataset.rows))raw[p.moduleKey||p.dataset.key||p.dataset.label||'dataset']=p.dataset;
    const out={};
    for(const [k,d] of Object.entries(raw)){
      if(!d||!Array.isArray(d.rows))continue;
      const key=datasetKey(k,d);
      if(!key)continue;
      out[key]={...d,key,capturedAt:d.capturedAt||p.capturedAt||now()};
    }
    return out;
  }

  function notify(detail){
    window.__DF_EXTERNAL_ANALYSIS_STATUS__=detail;
    const fire=()=>window.dispatchEvent(new CustomEvent('df-analysis-synced',{detail}));
    fire();
    setTimeout(fire,120);
    setTimeout(fire,650);
    setTimeout(fire,1600);
  }

  function ingest(payload,reason='extension-data'){
    const incoming=incomingDatasets(payload);
    const keys=Object.keys(incoming);
    if(!keys.length)return false;
    const root=readStore();
    const previous=root.biSummary&&typeof root.biSummary==='object'?root.biSummary:{};
    const bi=payload?.biSummary&&typeof payload.biSummary==='object'?payload.biSummary:{};
    const merged={...(previous.datasets||{}),...incoming};
    const summary={...previous,...bi,...payload,datasets:merged};
    delete summary.biSummary;
    summary.externalAnalysisSync={updatedAt:now(),reason,datasetKeys:keys,allDatasetKeys:Object.keys(merged)};
    localStorage.setItem(STORE,JSON.stringify({biSummary:summary}));
    const rows=Object.values(merged).reduce((n,d)=>n+(Array.isArray(d?.rows)?d.rows.length:0),0);
    notify({ok:true,reason,updatedAt:now(),datasetKeys:keys,allDatasetKeys:Object.keys(merged),rows});
    return true;
  }

  window.addEventListener('message',event=>{
    if(event.source!==window)return;
    const d=event.data;
    if(!d||typeof d!=='object'||!SOURCES.has(d.source))return;
    if(!TYPES.has(String(d.type||'')))return;
    const payload=d.type==='DF_DATA'?(d.payload?.biSummary?d.payload:(d.data||d.payload||{})):(d.payload||d.data||{});
    ingest(payload,`message:${d.type}`);
  },true);

  window.addEventListener('df-pp-persistence-updated',()=>{
    const root=readStore();
    const summary=root.biSummary||{};
    const keys=Object.keys(summary.datasets||{});
    if(keys.length)notify({ok:true,reason:'pp-persistence',updatedAt:now(),datasetKeys:keys,allDatasetKeys:keys,rows:Object.values(summary.datasets||{}).reduce((n,d)=>n+(d?.rows?.length||0),0)});
  });

  setTimeout(()=>{
    const root=readStore();
    const summary=root.biSummary||{};
    const keys=Object.keys(summary.datasets||{}).filter(k=>Array.isArray(summary.datasets?.[k]?.rows)&&summary.datasets[k].rows.length);
    if(keys.length)notify({ok:true,reason:'startup-existing-data',updatedAt:now(),datasetKeys:keys,allDatasetKeys:keys,rows:Object.values(summary.datasets||{}).reduce((n,d)=>n+(d?.rows?.length||0),0)});
  },450);
})();
