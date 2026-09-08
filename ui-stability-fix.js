(()=>{
  'use strict';
  if(window.__DF_UI_STABILITY_FIX__)return;
  window.__DF_UI_STABILITY_FIX__=true;

  const EXT='ure-sat-conector';
  const SITE='diagnostico-facil';
  const nativeSetInterval=window.setInterval.bind(window);
  const seen=new Map();
  let lastUserMove=0;
  let restoreToken=0;
  let sourceCaptureUntil=0;

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

  // Registered before the legacy app. During a new session capture we suppress
  // catalog/session echoes because the old app would rebuild #app and reset the page.
  window.addEventListener('message',e=>{
    if(e.source!==window)return;
    const d=e.data;
    if(!d||typeof d!=='object')return;

    const type=String(d.type||d.event||'');

    if(d.source===SITE){
      if(type==='DIAG_REQUEST_SOURCE_SESSION'){
        sourceCaptureUntil=Date.now()+270000;
        preserveScroll();
      }
      return;
    }

    if(d.source!==EXT)return;

    if(['DF_SOURCE_SESSION_COMPLETE','DF_SOURCE_SESSION_ERROR','DF_SOURCE_SESSION_UNAVAILABLE'].includes(type)){
      sourceCaptureUntil=0;
      preserveScroll();
    }

    if(Date.now()<sourceCaptureUntil && ['DF_SESSION','DF_CATALOG','ESCOLA_TOTAL_SESSION','ESCOLA_TOTAL_CATALOG','DF_PROFILE','DF_SCHOOL_SYNC','ESCOLA_TOTAL_SCHOOL_SELECTED'].includes(type)){
      e.stopImmediatePropagation();
      return;
    }

    const renderTypes=new Set(['DF_SESSION','DF_CATALOG','DF_READY','DF_PROFILE','DF_SCHOOL_SYNC','DF_CAPTURE_PROGRESS','DF_DATA','DF_CAPTURE_COMPLETE','DF_ERROR','DF_SOURCE_SESSION_PROGRESS','DF_SOURCE_SESSION_DATA','DF_SOURCE_SESSION_COMPLETE','DF_SOURCE_SESSION_ERROR','DF_SOURCE_SESSION_UNAVAILABLE','ESCOLA_TOTAL_SESSION','ESCOLA_TOTAL_CATALOG','ESCOLA_TOTAL_SCHOOL_SELECTED','ESCOLA_TOTAL_FULL_CAPTURE_PROGRESS','ESCOLA_TOTAL_CAPTURE_DATA','ESCOLA_TOTAL_FULL_CAPTURE_COMPLETE','ESCOLA_TOTAL_ERROR']);
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
