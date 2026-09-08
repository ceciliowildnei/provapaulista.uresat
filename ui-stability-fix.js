(()=>{
  'use strict';
  if(window.__DF_UI_STABILITY_FIX__)return;
  window.__DF_UI_STABILITY_FIX__=true;

  const EXT='ure-sat-conector';
  const SITE='diagnostico-facil';
  const nativeSetInterval=window.setInterval.bind(window);
  let lastUserMove=0;
  let restoreToken=0;
  let sourceCaptureUntil=0;

  window.setInterval=function(fn,delay,...args){
    const src=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
    if((delay===4000||delay===8000)&&src.includes('DIAG_REQUEST_PING')) return nativeSetInterval(fn,30000,...args);
    return nativeSetInterval(fn,delay,...args);
  };

  const style=document.createElement('style');
  style.id='df-ui-stability-css';
  style.textContent='html,body{overflow-anchor:none!important}#df-session-center{overflow-anchor:none!important}';
  (document.head||document.documentElement).appendChild(style);

  const markUserMove=()=>{lastUserMove=Date.now();};
  ['wheel','touchstart','pointerdown','keydown'].forEach(type=>window.addEventListener(type,markUserMove,{capture:true,passive:true}));

  function preserveScroll(){
    const y=window.scrollY,x=window.scrollX,token=++restoreToken;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==restoreToken||Date.now()-lastUserMove<350)return;
      if(Math.abs(window.scrollY-y)>2||Math.abs(window.scrollX-x)>2)window.scrollTo(x,y);
    }));
  }

  window.addEventListener('message',e=>{
    if(e.source!==window)return;
    const d=e.data;if(!d||typeof d!=='object')return;
    const type=String(d.type||d.event||'');

    if(d.source===SITE){
      if(type==='DIAG_CAPTURE_CURRENT_VIEW'||type==='DIAG_REQUEST_SOURCE_SESSION'){
        sourceCaptureUntil=Date.now()+270000;
        preserveScroll();
      }
      return;
    }
    if(d.source!==EXT)return;

    if(d.__manualAnalysisSync===true){
      preserveScroll();
      return;
    }

    if(['DF_SOURCE_SESSION_COMPLETE','DF_SOURCE_SESSION_ERROR','DF_SOURCE_SESSION_UNAVAILABLE'].includes(type)){
      sourceCaptureUntil=0;preserveScroll();
    }

    const manualMode=!!window.__DF_MANUAL_CAPTURE_MODE_V3__;
    const legacyRenderEvents=new Set([
      'DF_SESSION','DF_CATALOG','DF_PROFILE','DF_SCHOOL_SYNC',
      'DF_CAPTURE_PROGRESS','DF_DATA','DF_CAPTURE_COMPLETE','DF_ERROR',
      'DF_SOURCE_SESSION_PROGRESS','DF_SOURCE_SESSION_DATA','DF_SOURCE_SESSION_COMPLETE','DF_SOURCE_SESSION_ERROR','DF_SOURCE_SESSION_UNAVAILABLE',
      'ESCOLA_TOTAL_SESSION','ESCOLA_TOTAL_CATALOG','ESCOLA_TOTAL_SCHOOL_SELECTED',
      'ESCOLA_TOTAL_FULL_CAPTURE_PROGRESS','ESCOLA_TOTAL_CAPTURE_DATA','ESCOLA_TOTAL_FULL_CAPTURE_COMPLETE','ESCOLA_TOTAL_ERROR',
      'ESCOLA_TOTAL_DIAGNOSTIC','ESCOLA_TOTAL_LOGIN_REQUIRED'
    ]);

    if(legacyRenderEvents.has(type))preserveScroll();

    if(manualMode&&legacyRenderEvents.has(type)){
      e.stopImmediatePropagation();
      return;
    }

    if(Date.now()<sourceCaptureUntil&&['DF_SESSION','DF_CATALOG','ESCOLA_TOTAL_SESSION','ESCOLA_TOTAL_CATALOG','DF_PROFILE','DF_SCHOOL_SYNC','ESCOLA_TOTAL_SCHOOL_SELECTED'].includes(type)){
      e.stopImmediatePropagation();
    }
  },true);
})();
