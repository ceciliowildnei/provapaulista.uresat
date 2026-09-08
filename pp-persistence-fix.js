(()=>{
  'use strict';
  if(window.__DF_PP_PERSISTENCE_FIX__)return;
  window.__DF_PP_PERSISTENCE_FIX__=true;

  const ANALYSIS_STORE='df-inteligencia-v2';
  const PP_STORE='df-pp-persistent-v1';
  const PP_KEYS=['pp1','pp2','pp3'];
  let applying=false;
  let timer=null;

  const now=()=>new Date().toISOString();
  const rowsOf=d=>Array.isArray(d?.rows)?d.rows:[];
  const valid=d=>d&&typeof d==='object'&&rowsOf(d).length>0;
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch{return fallback}};
  const writeJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));

  function readAnalysis(){
    const root=readJson(ANALYSIS_STORE,{});
    const summary=root.biSummary&&typeof root.biSummary==='object'?root.biSummary:{};
    return{root,summary,datasets:summary.datasets&&typeof summary.datasets==='object'?summary.datasets:{}};
  }

  function readBackup(){
    const raw=readJson(PP_STORE,{});
    return raw.datasets&&typeof raw.datasets==='object'?raw.datasets:{};
  }

  function persistBackup(incoming={}){
    const current=readBackup();
    let changed=false;
    for(const key of PP_KEYS){
      const ds=incoming[key];
      if(valid(ds)){
        const old=current[key];
        const nextTime=Date.parse(ds.capturedAt||0)||0;
        const oldTime=Date.parse(old?.capturedAt||0)||0;
        if(!valid(old)||nextTime>=oldTime||rowsOf(ds).length>=rowsOf(old).length){
          current[key]={...ds,key,capturedAt:ds.capturedAt||now()};
          changed=true;
        }
      }
    }
    if(changed)writeJson(PP_STORE,{version:1,updatedAt:now(),datasets:current});
    return current;
  }

  function restore(reason='restore'){
    if(applying)return;
    applying=true;
    try{
      const state=readAnalysis();
      const backup=persistBackup(state.datasets);
      const merged={...state.datasets};
      let changed=false;
      for(const key of PP_KEYS){
        if(valid(backup[key])&&(!valid(merged[key])||rowsOf(merged[key]).length<rowsOf(backup[key]).length)){
          merged[key]=backup[key];
          changed=true;
        }
      }
      const counts=Object.fromEntries(PP_KEYS.map(k=>[k,rowsOf(merged[k]).length]));
      window.__DF_PP_PERSISTENCE_STATUS__={ok:true,reason,counts,updatedAt:now()};
      if(changed){
        state.summary.datasets=merged;
        state.summary.ppPersistence={version:1,updatedAt:now(),counts,reason};
        writeJson(ANALYSIS_STORE,{...state.root,biSummary:state.summary});
        window.postMessage({source:'ure-sat-conector',type:'ESCOLA_TOTAL_CAPTURE_DATA',requestId:`pp-persist-${Date.now()}`,__ppPersistenceFix:true,payload:{datasets:Object.fromEntries(PP_KEYS.filter(k=>valid(merged[k])).map(k=>[k,merged[k]])),ppPersistence:true}},location.origin);
        window.dispatchEvent(new CustomEvent('df-pp-persistence-updated',{detail:window.__DF_PP_PERSISTENCE_STATUS__}));
      }
    }finally{applying=false;}
  }

  function schedule(reason,delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>restore(reason),delay);
  }

  window.addEventListener('message',event=>{
    const d=event.data;
    if(event.source!==window||d?.__ppPersistenceFix)return;
    if(d?.source==='ure-sat-conector'&&d?.type==='ESCOLA_TOTAL_CAPTURE_DATA'){
      const incoming=d?.payload?.datasets||{};
      persistBackup(incoming);
      schedule('capture-data',120);
    }
  },true);

  window.addEventListener('df-analysis-synced',()=>schedule('analysis-synced',100));
  window.addEventListener('df-manual-capture-saved',()=>schedule('manual-capture',120));
  window.addEventListener('df-turma-capture-saved',()=>schedule('turma-capture',120));
  window.addEventListener('storage',event=>{
    if(event.key===ANALYSIS_STORE||event.key===PP_STORE)schedule('storage-change',120);
  });

  restore('startup');
  setTimeout(()=>restore('startup-confirm'),900);
})();
