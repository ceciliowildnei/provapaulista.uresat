(()=>{
  'use strict';
  if(window.__DF_MANUAL_CAPTURE_MODE__)return;
  if(window.__DF_BOOTSTRAP_FIX_V1__)return;
  window.__DF_BOOTSTRAP_FIX_V1__=true;

  const SITE='diagnostico-facil', EXT='ure-sat-conector';
  let loggedIn=false,schools=[],busy=false,lastAttempt=0,lastError='',lastStatus='Aguardando conexão com o Escola Total';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const post=(type,extra={})=>window.postMessage({source:SITE,type,requestId:`bootstrap-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,...extra},location.origin);

  function schoolSelect(){return document.querySelector('[data-session-school]');}
  function discovered(){const sel=schoolSelect();return schools.length||((sel?.options?.length||0)>1);}
  function requestBootstrap(force=false){
    if(!loggedIn)return;
    const now=Date.now();if(busy||(!force&&now-lastAttempt<45000)||discovered())return;
    lastAttempt=now;busy=true;lastError='';lastStatus='Localizando suas escolas no Aluno Presente…';render();
    post('DIAG_BOOTSTRAP_CATALOG');
    setTimeout(()=>{if(busy){busy=false;lastStatus='Aguardando resposta do catálogo';render();}},90000);
  }

  function suppressLegacy(){
    document.querySelectorAll('#app .conn').forEach(el=>el.style.display='none');
    document.querySelectorAll('#app .note.err').forEach(el=>{if(/tempo de resposta|cliente power bi|frame/i.test(clean(el.textContent)))el.style.display='none';});
    document.querySelectorAll('#app .empty').forEach(el=>{if(/pronto para receber os dados do escola total/i.test(clean(el.textContent)))el.style.display='none';});
  }

  function render(){
    suppressLegacy();
    const host=document.getElementById('df-session-center');if(!host)return;
    let box=document.getElementById('df-bootstrap-box');
    if(!box){
      box=document.createElement('div');box.id='df-bootstrap-box';box.style.cssText='margin:0 15px 12px;padding:10px 12px;border:1px solid #d7e4f1;border-radius:9px;background:#f7fbff;color:#315778;font-size:8.5px;display:flex;align-items:center;gap:10px;justify-content:space-between';
      const controls=host.querySelector('.dfso-controls');(controls||host.firstElementChild)?.insertAdjacentElement('afterend',box);
    }
    if(discovered()){
      box.innerHTML=`<div><strong>✓ Escolas localizadas</strong><br><span>${schools.length||Math.max(0,(schoolSelect()?.options?.length||1)-1)} escola(s) disponível(is) para iniciar as sessões.</span></div>`;
      box.style.background='#ecf8f4';box.style.borderColor='#cbe8de';box.style.color='#176a59';box.style.display='flex';
      return;
    }
    box.style.display='flex';box.style.background=lastError?'#fff3f4':'#f7fbff';box.style.borderColor=lastError?'#efcfd4':'#d7e4f1';box.style.color=lastError?'#8e3f46':'#315778';
    box.innerHTML=`<div><strong>${loggedIn?'Catálogo de escolas':'Escola Total'}</strong><br><span>${lastError||lastStatus}</span></div><button id="df-bootstrap-retry" style="height:30px;padding:0 10px;border:0;border-radius:7px;background:#1859b7;color:#fff;font-size:8px;font-weight:800" ${!loggedIn||busy?'disabled':''}>${busy?'Localizando…':'Localizar escolas'}</button>`;
    box.querySelector('#df-bootstrap-retry')?.addEventListener('click',()=>requestBootstrap(true),{once:true});
  }

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!==EXT)return;
    if(d.type==='DF_SESSION'){
      loggedIn=!!d.session?.loggedIn;
      const list=[...(d.session?.schools||[]),...(d.session?.authorizedSchools||[]),...(d.session?.profile?.associatedSchools||[])].map(clean).filter(Boolean);
      if(list.length)schools=[...new Set([...schools,...list])];
      lastStatus=loggedIn?'Sessão reconhecida. Preparando catálogo…':'Aguardando login oficial';render();
      if(loggedIn&&!discovered())setTimeout(()=>requestBootstrap(),350);
    }
    if(d.type==='DF_CATALOG'){
      const c=d.catalog||{},list=[...(c.schools||[]),...(c.profile?.associatedSchools||[])].map(clean).filter(Boolean);
      if(list.length){schools=[...new Set([...schools,...list])];busy=false;lastError='';lastStatus='Catálogo concluído';}
      else if(c.error){busy=false;lastError=clean(c.error);}
      else if(c.needsBootstrap&&loggedIn){setTimeout(()=>requestBootstrap(),250);}
      else if(busy){busy=false;lastStatus='O catálogo ainda não retornou escolas. Você pode tentar novamente.';}
      render();
    }
    if(d.type==='DF_READY'){render();post('DIAG_REQUEST_SESSION');}
  });

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.matches('#app [data-a="collect"]')&&!discovered()){
      e.preventDefault();e.stopImmediatePropagation();requestBootstrap(true);
    }
  },true);

  setTimeout(()=>{render();post('DIAG_REQUEST_SESSION');},300);
  setTimeout(()=>render(),1200);
})();
