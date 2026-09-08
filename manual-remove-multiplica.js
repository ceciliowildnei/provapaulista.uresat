(()=>{
  'use strict';
  if(window.__DF_REMOVE_MULTIPLICA__)return;
  window.__DF_REMOVE_MULTIPLICA__=true;
  const META='df-manual-capture-meta-v3';
  const DB='df-manual-captures-v3';

  function cleanStorage(){
    try{
      const meta=JSON.parse(localStorage.getItem(META)||'{}')||{};
      if('multiplica' in meta){delete meta.multiplica;localStorage.setItem(META,JSON.stringify(meta));}
    }catch{}
    try{
      const req=indexedDB.open(DB,1);
      req.onsuccess=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('captures'))return;
        const tx=db.transaction('captures','readwrite');
        const store=tx.objectStore('captures');
        const all=store.getAll();
        all.onsuccess=()=>{for(const row of all.result||[])if(String(row?.sourceId||'').toLowerCase()==='multiplica')store.delete(row.captureId);};
      };
    }catch{}
  }

  function removeCard(){
    const btn=document.querySelector('[data-session-source="multiplica"],[data-manual-capture="multiplica"]');
    btn?.closest('.dfso-card')?.remove();
  }

  function removeOverviewRow(){
    document.querySelectorAll('#df-session-center .df-overview-source').forEach(row=>{
      const label=(row.querySelector('b')?.textContent||'').trim().toLowerCase();
      if(label==='multiplica')row.remove();
    });
  }

  function fixCoverage(){
    const host=document.querySelector('#df-session-center .dfso-overview');
    if(!host)return;
    const first=host.querySelector('.dfso-kpis>div:first-child b');
    if(!first)return;
    const meta=(()=>{try{return JSON.parse(localStorage.getItem(META)||'{}')||{}}catch{return{}}})();
    const ids=['superbi','alunoPresente','recomposicao','pp1','pp2','pp3','pda','professorTutor'];
    const available=ids.filter(id=>meta[id]?.status!=='unavailable');
    const saved=available.filter(id=>meta[id]?.status==='saved');
    const text=`${saved.length}/${available.length}`;
    if(first.textContent!==text)first.textContent=text;
  }

  function scrubText(){
    document.querySelectorAll('#df-session-center *').forEach(el=>{
      if(el.children.length)return;
      if((el.textContent||'').trim()==='Multiplica')el.closest('.dfso-card,.df-overview-source')?.remove();
    });
  }

  function apply(){removeCard();removeOverviewRow();fixCoverage();scrubText();}
  cleanStorage();
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(()=>queueMicrotask(apply)).observe(root,{childList:true,subtree:true});
  apply();
})();
