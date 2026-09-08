(()=>{
  'use strict';
  if(window.__DF_MANUAL_ERROR_GUARD__)return;
  window.__DF_MANUAL_ERROR_GUARD__=true;
  const EXT='ure-sat-conector';
  const errors=new Map();
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  function apply(id){
    const msg=errors.get(id);if(!msg)return;
    const btn=document.querySelector(`[data-session-source="${id}"]`);const card=btn?.closest('.dfso-card');if(!card)return;
    ['pending','capturing','complete','partial','unavailable'].forEach(c=>card.classList.remove(c));card.classList.add('error');
    const state=card.querySelector('.dfso-state');if(state&&state.textContent!=='⚠️ Erro')state.textContent='⚠️ Erro';
    const p=card.querySelector('p');if(p&&p.textContent!==msg)p.textContent=msg;
    if(btn&&btn.textContent!=='Tentar captura novamente')btn.textContent='Tentar captura novamente';
  }
  function applyAll(){for(const id of errors.keys())apply(id)}
  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!==EXT)return;
    const id=clean(d.sessionSource||'');if(!id)return;
    if(d.type==='DF_SOURCE_SESSION_ERROR'||d.type==='DF_SOURCE_SESSION_UNAVAILABLE'){
      errors.set(id,clean(d.error||d.payload?.error||d.payload?.reason||'Não foi possível capturar esta fonte na tela atual.'));setTimeout(()=>apply(id),100);return;
    }
    if(d.type==='DF_SOURCE_SESSION_PROGRESS'||d.type==='DF_SOURCE_SESSION_DATA'||d.type==='DF_SOURCE_SESSION_COMPLETE')errors.delete(id);
  },true);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-session-source]');if(b)errors.delete(b.dataset.sessionSource||'');},true);
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(()=>setTimeout(applyAll,90)).observe(root,{childList:true,subtree:true});
})();
