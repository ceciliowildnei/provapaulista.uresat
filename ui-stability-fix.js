(()=>{
  'use strict';
  if(window.__DF_UI_STABILITY_FIX__)return;
  window.__DF_UI_STABILITY_FIX__=true;

  const EXT='ure-sat-conector';
  const nativeSetInterval=window.setInterval.bind(window);
  const seen=new Map();
  let lastUserMove=0;
  let restoreToken=0;

  // Reduce background heartbeats that were causing the legacy app to rebuild the whole UI.
  window.setInterval=function(fn,delay,...args){
    const src=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
    if((delay===4000||delay===8000)&&src.includes('DIAG_REQUEST_PING')){
      return nativeSetInterval(fn,30000,...args);
    }
    return nativeSetInterval(fn,delay,...args);
  };

  const style=document.createElement('style');
  style.id='df-ui-stability-css';
  style.textContent='html,body{overflow-anchor:none!important}#df-session-center{overflow-anchor:none!important}';
  (document.head||document.documentElement).appendChild(style);

  const markUserMove=()=>{lastUserMove=Date.now();};
  ['wheel','touchstart','pointerdown','keydown'].forEach(type=>window.addEventListener(type,markUserMove,{capture:true,passive:true}));

  function stableSignature(d){
    const t=String(d?.type||'');
    if(t==='DF_SESSION'||t==='ESCOLA_TOTAL_SESSION'){
      const s=d.session||d.payload?.session||{};
      return JSON.stringify({t,loggedIn:!!s.loggedIn,ure:s.currentUre||'',school:s.currentSchool||'',scope:s.accessScope||s.profile?.accessScope||'',schools:[...(s.schools||[]),...(s.authorizedSchools||[]),...(s.profile?.associatedSchools||[])].map(String).sort()});
    }
    if(t==='DF_CATALOG'||t==='ESCOLA_TOTAL_CATALOG'){
      const c=d.catalog||d.payload?.catalog||{};
      return JSON.stringify({t,ure:c.selectedUre||'',school:c.selectedSchool||'',scope:c.accessScope||c.profile?.accessScope||'',schools:[...(c.schools||[]),...(c.profile?.associatedSchools||[])].map(String).sort(),needsBootstrap:!!c.needsBootstrap,error:String(c.error||'')});
    }
    if(t==='DF_READY'||t==='EXTRACTOR_READY')return JSON.stringify({t,version:d.version||d.extensionVersion||''});
    if(t==='DF_ERROR'||t==='ESCOLA_TOTAL_ERROR')return JSON.stringify({t,error:String(d.error||d.payload?.error||'')});
    return '';
  }

  function preserveScroll(){
    const y=window.scrollY;
    const x=window.scrollX;
    const token=++restoreToken;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==restoreToken)return;
      if(Date.now()-lastUserMove<350)return;
      if(Math.abs(window.scrollY-y)>2||Math.abs(window.scrollX-x)>2)window.scrollTo(x,y);
    }));
  }

  // This listener is registered before the legacy application listener.
  // Identical connection/catalog events are discarded so they cannot trigger app.innerHTML repeatedly.
  window.addEventListener('message',e=>{
    if(e.source!==window)return;
    const d=e.data;
    if(!d||typeof d!=='object'||d.source!==EXT)return;

    const type=String(d.type||'');
    const renderTypes=new Set(['DF_SESSION','DF_CATALOG','DF_READY','DF_PROFILE','DF_SCHOOL_SYNC','DF_CAPTURE_PROGRESS','DF_DATA','DF_CAPTURE_COMPLETE','DF_ERROR','ESCOLA_TOTAL_SESSION','ESCOLA_TOTAL_CATALOG','ESCOLA_TOTAL_SCHOOL_SELECTED','ESCOLA_TOTAL_FULL_CAPTURE_PROGRESS','ESCOLA_TOTAL_CAPTURE_DATA','ESCOLA_TOTAL_FULL_CAPTURE_COMPLETE','ESCOLA_TOTAL_ERROR']);
    if(renderTypes.has(type))preserveScroll();

    const sig=stableSignature(d);
    if(!sig)return;
    const now=Date.now();
    const prev=seen.get(type);
    if(prev&&prev.sig===sig&&now-prev.at<20000){
      e.stopImmediatePropagation();
      return;
    }
    seen.set(type,{sig,at:now});
  },true);
})();
