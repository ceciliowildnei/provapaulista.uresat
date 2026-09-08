(()=>{
  'use strict';
  if(window.__DF_PDA_LABEL_FIX__)return;
  window.__DF_PDA_LABEL_FIX__=true;
  function apply(){
    document.querySelectorAll('#df-session-center .dfso-title b').forEach(el=>{
      if(String(el.textContent||'').trim().toUpperCase()==='PRA')el.textContent='PDA';
    });
  }
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(apply).observe(root,{childList:true,subtree:true});
  apply();
})();
