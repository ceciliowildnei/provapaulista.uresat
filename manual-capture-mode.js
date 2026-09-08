(()=>{
  'use strict';
  if(window.__DF_MANUAL_CAPTURE_MODE__)return;
  window.__DF_MANUAL_CAPTURE_MODE__=true;

  const SITE='diagnostico-facil',EXT='ure-sat-conector',STORE='df-manual-current-view-v1';
  const defs={
    superbi:{label:'Super BI',mode:'super-bi'},
    alunoPresente:{label:'Aluno Presente',mode:'aluno-presente'},
    recomposicao:{label:'Recomposição',mode:'recomposicao'},
    provaPaulista:{label:'Provas Paulistas',mode:'prova-paulista'},
    multiplica:{label:'Multiplica',mode:'multiplica'},
    pra:{label:'PDA',mode:'pda'},
    professorTutor:{label:'Professor Tutor',mode:'professor-tutor'}
  };
  let active=null,loggedIn=false,renderTimer=null;
  let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{saved={}}
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const now=()=>new Date().toISOString();
  const fmt=v=>{try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return clean(v)}};
  const countRows=data=>{let n=0;for(const d of Object.values(data?.datasets||{}))if(Array.isArray(d?.rows))n+=d.rows.length;if(Array.isArray(data?.dataset?.rows))n+=data.dataset.rows.length;return n};
  const countSets=data=>Object.values(data?.datasets||{}).filter(d=>Array.isArray(d?.rows)&&d.rows.length).length+(Array.isArray(data?.dataset?.rows)&&data.dataset.rows.length?1:0);
  const post=(type,extra={})=>window.postMessage({source:SITE,type,requestId:extra.requestId||`manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,...extra},location.origin);
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const setHtml=(el,value)=>{if(el&&el.innerHTML!==value)el.innerHTML=value;};

  function save(){localStorage.setItem(STORE,JSON.stringify(saved));}
  function sourceCard(id){return document.querySelector(`[data-session-source="${id}"]`)?.closest('.dfso-card')||null;}
  function setCard(id,status,text,data){
    const card=sourceCard(id);if(!card)return;
    const btn=card.querySelector(`[data-session-source="${id}"]`);if(btn){btn.disabled=false;setText(btn,status==='capturing'?'Capturando…':'Capturar tela atual');}
    ['pending','capturing','complete','partial','error','unavailable'].forEach(c=>{if(c===(status||'pending'))card.classList.add(c);else card.classList.remove(c);});
    const state=card.querySelector('.dfso-state');setText(state,status==='complete'?'✅ Salvo':status==='partial'?'🟡 Parcial':status==='capturing'?'🔄 Captando':status==='error'?'⚠️ Erro':'○ Pendente');
    const p=card.querySelector('p');setText(p,text||'Abra a fonte no Escola Total e capture a tela atual.');
    const meta=card.querySelector('.dfso-meta');if(meta&&data){const html=`<span>${Number(data.rows||0).toLocaleString('pt-BR')} registros</span><span>${Number(data.datasets||0)} conjunto(s)</span>${data.capturedAt?`<span>${fmt(data.capturedAt)}</span>`:''}${data.school?`<span>${clean(data.school)}</span>`:''}`;setHtml(meta,html);}
  }
  function apply(){
    document.getElementById('df-bootstrap-box')?.remove();
    const host=document.getElementById('df-session-center');if(!host)return;
    host.querySelectorAll('.dfso-controls label,[data-session-action="new"],[data-session-action="all"]').forEach(el=>{if(el.style.display!=='none')el.style.display='none';});
    const connect=host.querySelector('[data-session-action="connect"]');if(connect){if(connect.style.display!=='inline-flex')connect.style.display='inline-flex';setText(connect,loggedIn?'Escola Total conectado':'Conectar Escola Total');}
    let info=document.getElementById('df-manual-info');
    if(!info){info=document.createElement('div');info.id='df-manual-info';info.style.cssText='margin:0 15px 12px;padding:11px 13px;border:1px solid #cfe0f1;border-radius:9px;background:#f7fbff;color:#315778;font-size:8.5px;line-height:1.55';const controls=host.querySelector('.dfso-controls');(controls||host.firstElementChild)?.insertAdjacentElement('afterend',info);}
    setHtml(info,'<strong>Modo manual de captura</strong><br>1. Clique em Conectar. 2. No Escola Total, escolha manualmente a escola e abra a fonte desejada. 3. Volte aqui e clique em <b>Capturar tela atual</b>. O Diagnóstico não muda escola, fonte ou página sozinho.');
    for(const [id,def] of Object.entries(defs)){
      const card=sourceCard(id);if(!card)continue;
      setText(card.querySelector('.dfso-title b'),def.label);
      const btn=card.querySelector(`[data-session-source="${id}"]`);if(btn){btn.disabled=false;setText(btn,active?.sourceId===id?'Capturando…':'Capturar tela atual');}
      if(active?.sourceId===id){setCard(id,'capturing',active.text||`Lendo a tela atual de ${def.label}…`);continue;}
      const old=saved[id];if(old)setCard(id,old.coverage==='partial'?'partial':'complete',`Última captura salva${old.school?` · ${old.school}`:''}.`,old);
      else setCard(id,'pending','Abra esta fonte no Escola Total, deixe os dados carregarem e volte para capturar.');
    }
  }
  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(apply,80)}

  function startCapture(sourceId){
    const def=defs[sourceId];if(!def||active)return;
    const requestId=`manual-${sourceId}-${Date.now()}`;
    active={sourceId,requestId,data:null,text:`Lendo a tela atual de ${def.label}…`};
    setCard(sourceId,'capturing',active.text);
    post('DIAG_CAPTURE_CURRENT_VIEW',{requestId,sessionId:`manual-${Date.now()}`,sessionSource:sourceId,sourceLabel:def.label,mode:def.mode,manualCapture:true,year:2026});
  }
  function finalize(sourceId,data,coverage='complete'){
    const context=data?.context||{};
    const item={sourceId,label:defs[sourceId]?.label||sourceId,capturedAt:now(),rows:countRows(data),datasets:countSets(data),school:clean(context.school||context.currentSchool||''),ure:clean(context.ure||''),coverage:coverage||'complete'};
    saved[sourceId]=item;save();setCard(sourceId,item.coverage==='partial'?'partial':'complete',`Captura salva${item.school?` · ${item.school}`:''}.`,item);
    window.postMessage({source:EXT,type:'DF_DATA',requestId:`manual-save-${Date.now()}`,payload:data,__dfManualSaved:true},location.origin);
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    const sourceId=btn.dataset.sessionSource;
    if(sourceId&&defs[sourceId]){e.preventDefault();e.stopImmediatePropagation();startCapture(sourceId);return;}
    if(btn.dataset.sessionAction==='all'||btn.dataset.sessionAction==='new'){e.preventDefault();e.stopImmediatePropagation();return;}
  },true);

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!==EXT)return;
    if(d.type==='DF_READY'){schedule();return;}
    if(d.type==='DF_SESSION'){const next=!!d.session?.loggedIn;if(next!==loggedIn){loggedIn=next;schedule();}return;}
    if(!active||d.requestId!==active.requestId)return;
    if(d.type==='DF_SOURCE_SESSION_PROGRESS'){const next=clean(d.progress?.text||d.stage||'Captando a tela atual…');if(next!==active.text){active.text=next;setCard(active.sourceId,'capturing',active.text);}return;}
    if(d.type==='DF_SOURCE_SESSION_DATA'){active.data=d.payload?.data||d.data||d.payload||{};return;}
    if(d.type==='DF_SOURCE_SESSION_COMPLETE'){
      const sourceId=active.sourceId,data=d.payload?.data||d.data||active.data||{},coverage=clean(d.coverage||d.payload?.coverage||'complete');active=null;finalize(sourceId,data,coverage);schedule();return;
    }
    if(d.type==='DF_SOURCE_SESSION_UNAVAILABLE'){const id=active.sourceId;active=null;setCard(id,'error','A fonte não está disponível na tela atual. Abra-a manualmente no Escola Total e tente novamente.');schedule();return;}
    if(d.type==='DF_SOURCE_SESSION_ERROR'){const id=active.sourceId,msg=clean(d.error||d.payload?.error||d.payload?.reason||'Não foi possível ler a tela atual.');active=null;setCard(id,'error',msg);schedule();return;}
  },true);

  const app=document.getElementById('app')||document.documentElement;
  new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1)))schedule();}).observe(app,{childList:true,subtree:true});
  setTimeout(()=>{post('DIAG_REQUEST_PING');post('DIAG_REQUEST_SESSION');schedule();},250);
})();
