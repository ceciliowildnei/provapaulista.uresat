(()=>{
  'use strict';
  if(window.__DF_SESSION_ORCHESTRATOR_V2__)return;
  window.__DF_SESSION_ORCHESTRATOR_V2__=true;

  const SITE='diagnostico-facil', EXT='ure-sat-conector';
  const DB_NAME='diagnostico-facil-sessions', DB_VERSION=1, ACTIVE_KEY='df-session-active-v2';
  const YEAR=2026;
  const SOURCES=[
    {id:'superbi',label:'Super BI',icon:'📊',mode:'super-bi'},
    {id:'alunoPresente',label:'Aluno Presente',icon:'🧑‍🎓',mode:'aluno-presente'},
    {id:'recomposicao',label:'Recomposição',icon:'🧩',mode:'recomposicao'},
    {id:'provaPaulista',label:'Provas Paulistas',icon:'📝',mode:'prova-paulista'},
    {id:'multiplica',label:'Multiplica',icon:'✳️',mode:'multiplica'},
    {id:'pra',label:'PRA',icon:'🎯',mode:'pra'},
    {id:'professorTutor',label:'Professor Tutor',icon:'👩‍🏫',mode:'professor-tutor',conditional:true}
  ];
  const state={ext:'',loggedIn:false,ure:'',schools:[],school:'',sessions:[],sessionId:'',requests:new Map(),running:false,renderTimer:null,lastHtml:'',lastSessionSig:'',lastCatalogSig:''};
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const rid=(p='df')=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const now=()=>new Date().toISOString();
  const dt=v=>{try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return clean(v)}};
  const send=(type,extra={})=>window.postMessage({source:SITE,type,requestId:extra.requestId||rid('site'),timestamp:Date.now(),...extra},location.origin);

  let dbPromise=null;
  function db(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('sessions')){const s=d.createObjectStore('sessions',{keyPath:'id'});s.createIndex('school','school',{unique:false});s.createIndex('updatedAt','updatedAt',{unique:false});}};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return dbPromise;
  }
  async function load(){
    try{const d=await db();state.sessions=await new Promise((res,rej)=>{const q=d.transaction('sessions','readonly').objectStore('sessions').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});}
    catch{try{state.sessions=JSON.parse(localStorage.getItem(`${DB_NAME}-fallback`)||'[]')}catch{state.sessions=[]}}
    state.sessions.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    try{const a=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}');state.school=a.school||'';state.sessionId=a.sessionId||'';}catch{}
    if(state.sessionId&&!state.sessions.some(x=>x.id===state.sessionId))state.sessionId='';
    schedule(true);
  }
  async function save(session){
    session.updatedAt=now();
    const i=state.sessions.findIndex(x=>x.id===session.id);if(i>=0)state.sessions[i]=session;else state.sessions.unshift(session);
    try{const d=await db();await new Promise((res,rej)=>{const tx=d.transaction('sessions','readwrite');tx.objectStore('sessions').put(session);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
    catch{try{localStorage.setItem(`${DB_NAME}-fallback`,JSON.stringify(state.sessions.slice(0,10)))}catch{}}
    localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.school,sessionId:state.sessionId}));
    schedule();
  }
  const blankSources=()=>Object.fromEntries(SOURCES.map(x=>[x.id,{id:x.id,status:'pending',stage:'Aguardando captura',rows:0,datasets:0,data:null,capturedAt:'',error:'',requestId:''}]));
  function newSession(){
    if(!state.school)return null;
    const s={id:rid('school'),school:state.school,year:YEAR,createdAt:now(),updatedAt:now(),sources:blankSources(),completedAt:''};
    state.sessions.unshift(s);state.sessionId=s.id;save(s);return s;
  }
  function current(){return state.sessions.find(x=>x.id===state.sessionId&&(!state.school||x.school===state.school))||null;}
  function ensure(){return current()||newSession();}
  function schoolSessions(){return state.sessions.filter(x=>!state.school||x.school===state.school);}

  function datasets(data){return data?.datasets||data?.biSummary?.datasets||data?.payload?.datasets||{};}
  function rowCount(data){let n=0;for(const d of Object.values(datasets(data)))if(Array.isArray(d?.rows))n+=d.rows.length;if(Array.isArray(data?.dataset?.rows))n+=data.dataset.rows.length;return n;}
  function datasetCount(data){let n=Object.values(datasets(data)).filter(d=>Array.isArray(d?.rows)&&d.rows.length).length;if(Array.isArray(data?.dataset?.rows)&&data.dataset.rows.length)n++;return n;}
  function allRows(session){const out=[];for(const src of Object.values(session?.sources||{})){const d=src.data||{};for(const ds of Object.values(datasets(d)))if(Array.isArray(ds?.rows))out.push(...ds.rows);if(Array.isArray(d?.dataset?.rows))out.push(...d.dataset.rows);}return out;}
  function value(row,names){const e=Object.entries(row||{}).filter(([k])=>!k.startsWith('_'));for(const n of names){const h=e.find(([k])=>fold(k)===fold(n));if(h)return h[1];}for(const n of names){const h=e.find(([k])=>fold(k).includes(fold(n)));if(h)return h[1];}return'';}
  function pct(v){const x=clean(v);if(!x)return null;let n=Number(x.replace('%','').replace(',','.').replace(/[^0-9.-]/g,''));if(!Number.isFinite(n))return null;if(!x.includes('%')&&Math.abs(n)<=1)n*=100;return n;}
  function overview(s){
    const src=Object.values(s?.sources||{}),rows=allRows(s),students=new Set(),classes=new Set();let low=0,below=0;
    for(const r of rows){const ra=clean(value(r,['RA','NR RA','Registro do Aluno','Matrícula','Matricula'])).replace(/\D/g,''),name=clean(value(r,['Aluno','Estudante','Nome do Aluno','Nome']));if(ra||name)students.add(ra||fold(name));const t=clean(value(r,['Turma','Classe','Sala']));if(t)classes.add(t);const text=fold(Object.values(r||{}).join(' '));if(text.includes('abaixo do basico'))below++;const f=pct(value(r,['Frequência','Frequencia','Presença','Presenca','Presença Anual']));if(Number.isFinite(f)&&f<75)low++;}
    const pp=datasets(s?.sources?.provaPaulista?.data||{});
    return {done:src.filter(x=>['complete','partial'].includes(x.status)).length,total:src.length,rows:src.reduce((n,x)=>n+Number(x.rows||0),0),students:students.size,classes:classes.size,low,below,pp1:pp.pp1?.rows?.length||0,pp2:pp.pp2?.rows?.length||0,pp3:pp.pp3?.rows?.length||0};
  }
  function setSource(session,id,patch){if(!session?.sources?.[id])return;session.sources[id]={...session.sources[id],...patch};save(session);}
  function mirror(data,requestId){if(!data||(!Object.keys(datasets(data)).length&&!Array.isArray(data?.dataset?.rows)))return;window.postMessage({source:EXT,type:'DF_DATA',requestId:`session-mirror-${requestId||rid('data')}`,payload:data,__dfSessionMirror:true},location.origin);}

  function connect(){send('DIAG_REQUEST_PORTAL',{activate:true});setTimeout(()=>send('DIAG_REQUEST_SESSION'),400);setTimeout(()=>send('DIAG_REQUEST_PORTAL_CATALOG'),900);}
  function selectSchool(name){state.school=clean(name);state.sessionId=schoolSessions().find(x=>x.school===state.school)?.id||'';localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.school,sessionId:state.sessionId}));if(state.school)send('DIAG_SELECT_SCHOOL',{schoolName:state.school});schedule(true);}
  function capture(id,{force=false}={}){
    if(!state.loggedIn){connect();return Promise.reject(new Error('Aguardando sessão do Escola Total.'));}
    const def=SOURCES.find(x=>x.id===id);if(!def)return Promise.reject(new Error('Fonte desconhecida.'));
    const s=ensure();if(!s)return Promise.reject(new Error('Selecione uma escola.'));
    const cur=s.sources[id];if(cur.status==='capturing')return Promise.reject(new Error('Fonte já em captura.'));if(!force&&cur.status==='complete')return Promise.resolve({skipped:true});
    const requestId=rid(`src-${id}`);setSource(s,id,{status:'capturing',stage:`Abrindo ${def.label}…`,error:'',requestId,startedAt:now()});
    send('DIAG_REQUEST_SOURCE_SESSION',{requestId,sessionId:s.id,sessionSource:id,sourceLabel:def.label,mode:def.mode,schoolName:s.school,year:s.year});
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{state.requests.delete(requestId);setSource(s,id,{status:'error',stage:'Sem resposta',error:'A captura não retornou dados dentro do tempo de segurança.'});reject(new Error('Tempo excedido'));},210000);state.requests.set(requestId,{sessionId:s.id,sourceId:id,resolve,reject,timer});});
  }
  async function captureAll(){if(state.running)return;if(!state.school){schedule(true);return;}state.running=true;schedule(true);for(const def of SOURCES){const s=ensure(),src=s?.sources?.[def.id];if(src&&['complete','unavailable'].includes(src.status))continue;try{await capture(def.id)}catch{}}state.running=false;const s=current();if(s){s.completedAt=now();await save(s);}schedule(true);}
  function finish(id,result,error){const r=state.requests.get(id);if(!r)return;clearTimeout(r.timer);state.requests.delete(id);error?r.reject(error):r.resolve(result);}

  function status(src){return src.status==='complete'?['✅','Concluído']:src.status==='partial'?['🟡','Parcial']:src.status==='capturing'?['🔄','Captando']:src.status==='unavailable'?['○','Não se aplica']:src.status==='error'?['⚠️','Erro']:['○','Pendente'];}
  function makeHtml(){
    const s=current(),o=s?overview(s):{done:0,total:SOURCES.length,rows:0,students:0,classes:0,low:0,below:0,pp1:0,pp2:0,pp3:0},hist=schoolSessions();
    const schools=uniq([...state.schools,state.school]).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `<div class="dfso-head"><div><h2>Coleta por sessões</h2><p>Uma fonte por vez, sem perder o que já foi capturado. Os dados concluídos alimentam automaticamente a visão principal.</p></div><span class="dfso-badge ${state.loggedIn?'ok':''}">${state.loggedIn?'Escola Total conectado':'Aguardando conexão'}</span></div>
    <div class="dfso-controls"><label>ESCOLA<select data-session-school><option value="">Selecione a escola</option>${schools.map(x=>`<option value="${esc(x)}" ${x===state.school?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>SESSÃO<select data-session-id ${!hist.length?'disabled':''}>${hist.length?hist.map((x,i)=>`<option value="${esc(x.id)}" ${x.id===state.sessionId?'selected':''}>${dt(x.createdAt)}${i===0?' · mais recente':''}</option>`).join(''):'<option>Nenhuma sessão</option>'}</select></label><button data-session-action="connect">${state.loggedIn?'Atualizar conexão':'Conectar Escola Total'}</button><button data-session-action="new" ${!state.school?'disabled':''}>Nova sessão</button><button class="primary" data-session-action="all" ${!state.loggedIn||!state.school||state.running?'disabled':''}>${state.running?'Coletando…':'Iniciar coleta completa'}</button></div>
    <div class="dfso-source-grid">${SOURCES.map(def=>{const src=s?.sources?.[def.id]||blankSources()[def.id],st=status(src);return `<article class="dfso-card ${src.status}"><div class="dfso-title"><span>${def.icon}</span><b>${esc(def.label)}</b><span class="dfso-state">${st[0]} ${st[1]}</span></div><p>${esc(src.error||src.stage||'Aguardando captura')}</p><div class="dfso-meta"><span>${Number(src.rows||0).toLocaleString('pt-BR')} registros</span><span>${Number(src.datasets||0)} conjunto(s)</span>${src.capturedAt?`<span>${dt(src.capturedAt)}</span>`:''}</div><button data-session-source="${def.id}" ${!state.loggedIn||!s||src.status==='capturing'?'disabled':''}>${src.status==='complete'?'Recapturar':'Capturar esta fonte'}</button></article>`}).join('')}</div>
    <div class="dfso-overview"><h3>Visão Geral Consolidada</h3><div class="dfso-kpis"><div><span>FONTES</span><b>${o.done}/${o.total}</b></div><div><span>REGISTROS</span><b>${o.rows.toLocaleString('pt-BR')}</b></div><div><span>ESTUDANTES</span><b>${o.students.toLocaleString('pt-BR')}</b></div><div><span>TURMAS</span><b>${o.classes}</b></div><div><span>FREQ. &lt; 75%</span><b>${o.low}</b></div><div><span>ABAIXO DO BÁSICO</span><b>${o.below}</b></div></div><div class="dfso-summary">${s?`${o.done} fonte(s) integradas · PP1 ${o.pp1} · PP2 ${o.pp2} · PP3 ${o.pp3} · ${hist.length} sessão(ões) preservada(s).`:'Selecione uma escola e inicie uma sessão. Cada resultado válido fica salvo.'}</div></div>`;
  }
  function addCss(){if(document.getElementById('dfso-css'))return;const s=document.createElement('style');s.id='dfso-css';s.textContent=`#df-session-center{margin:0 0 12px;border:1px solid #cfdeee;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(20,48,84,.06);overflow:hidden;scroll-margin-top:80px}.dfso-head{display:flex;gap:14px;justify-content:space-between;padding:15px 16px;background:linear-gradient(135deg,#f4f8ff,#fff)}.dfso-head h2{margin:0 0 4px;font-size:15px;color:#183f68}.dfso-head p{margin:0;color:#687d91;font-size:9px}.dfso-badge{height:max-content;padding:6px 9px;border-radius:999px;background:#fff6df;color:#8a6517;font-size:8px;font-weight:800;white-space:nowrap}.dfso-badge.ok{background:#ecf8f4;color:#176a59}.dfso-controls{display:grid;grid-template-columns:1.5fr 1fr auto auto auto;gap:7px;padding:11px 15px;border-block:1px solid #e4ebf3}.dfso-controls label{display:grid;gap:4px;color:#6b7d92;font-size:7px;font-weight:850}.dfso-controls select,.dfso-controls button{height:35px;border:1px solid #cfdae7;border-radius:8px;background:#fff;color:#31536f;font-size:8px;font-weight:800;padding:0 9px}.dfso-controls .primary{border:0;background:#1859b7;color:#fff}.dfso-controls button:disabled{opacity:.5}.dfso-source-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:13px 15px}.dfso-card{padding:11px;border:1px solid #e1e8ef;border-radius:10px;background:#fbfcfe}.dfso-card.complete{background:#effaf6;border-color:#cbe8de}.dfso-card.partial{background:#fff9eb;border-color:#ead9a8}.dfso-card.capturing{background:#f2f7ff;border-color:#c9dcf3}.dfso-card.error{background:#fff3f4;border-color:#efcfd4}.dfso-card.unavailable{background:#f7f8fa}.dfso-title{display:flex;align-items:center;gap:6px}.dfso-title b{font-size:9px;color:#284963}.dfso-state{margin-left:auto;font-size:7px;font-weight:850}.dfso-card p{min-height:25px;margin:7px 0;color:#718397;font-size:7.6px;line-height:1.4}.dfso-meta{display:flex;gap:7px;flex-wrap:wrap;color:#7d8fa2;font-size:7px}.dfso-card button{margin-top:7px;height:28px;border:1px solid #d4deea;border-radius:7px;background:#fff;color:#31536f;font-size:7.5px;font-weight:800}.dfso-overview{padding:0 15px 15px}.dfso-overview h3{margin:2px 0 8px;font-size:12px;color:#183f68}.dfso-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.dfso-kpis>div{padding:8px;border:1px solid #e1e8ef;border-radius:8px}.dfso-kpis span{display:block;color:#7d8fa2;font-size:6.5px;font-weight:850}.dfso-kpis b{display:block;margin-top:3px;color:#234869;font-size:14px}.dfso-summary{margin-top:8px;padding:9px;border-left:4px solid #1859b7;border-radius:7px;background:#f5f9ff;color:#36536e;font-size:8px}.df-session-nav{margin-top:3px}@media(max-width:1050px){.dfso-controls{grid-template-columns:1fr 1fr}.dfso-source-grid{grid-template-columns:repeat(2,1fr)}.dfso-kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:620px){.dfso-head{display:block}.dfso-badge{display:inline-block;margin-top:8px}.dfso-controls,.dfso-source-grid,.dfso-kpis{grid-template-columns:1fr}}`;document.head.appendChild(s);}
  function suppressLegacy(){const main=document.querySelector('#app main');if(!main)return;for(const h of main.querySelectorAll('.empty h2'))if(/pronto para receber os dados do escola total/i.test(clean(h.textContent)))h.closest('.empty').style.display='none';const nav=document.querySelector('#app aside nav');if(nav&&!nav.querySelector('[data-session-nav]')){const b=document.createElement('button');b.dataset.sessionNav='1';b.className='df-session-nav';b.innerHTML='<span class="ic">🧩</span>Sessões de coleta';nav.appendChild(b);}}
  function render(){addCss();const main=document.querySelector('#app main'),filters=main?.querySelector('.filters');if(!main||!filters)return;let host=document.getElementById('df-session-center');if(!host){host=document.createElement('section');host.id='df-session-center';filters.insertAdjacentElement('afterend',host);state.lastHtml='';}const html=makeHtml();if(html!==state.lastHtml){host.innerHTML=html;state.lastHtml=html;}suppressLegacy();}
  function schedule(force=false){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(()=>{if(force)state.lastHtml='';render();},90);}

  function absorbSchools(list){const next=uniq([...(state.schools||[]),...(list||[]).map(clean)]).filter(x=>x&&!['todas','todas as escolas da ure'].includes(fold(x))).sort((a,b)=>a.localeCompare(b,'pt-BR'));const sig=JSON.stringify(next);if(sig===JSON.stringify(state.schools))return;state.schools=next;if(!state.school&&next.length===1)state.school=next[0];schedule(true);}

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!==EXT)return;const t=String(d.type||'');
    if(t==='DF_READY'){const v=d.version||d.extensionVersion||'';if(v!==state.ext){state.ext=v;schedule(true);}return;}
    if(t==='DF_SESSION'){const sess=d.session||{},sig=JSON.stringify({loggedIn:!!sess.loggedIn,ure:sess.currentUre||'',school:sess.currentSchool||'',schools:uniq([...(sess.schools||[]),...(sess.authorizedSchools||[]),...(sess.profile?.associatedSchools||[])])});if(sig===state.lastSessionSig)return;state.lastSessionSig=sig;state.loggedIn=!!sess.loggedIn;state.ure=sess.currentUre||state.ure;absorbSchools(JSON.parse(sig).schools);if(sess.currentSchool&&!state.school)state.school=sess.currentSchool;schedule(true);return;}
    if(t==='DF_CATALOG'){const c=d.catalog||{},schools=uniq([...(c.schools||[]),...(c.profile?.associatedSchools||[])]),sig=JSON.stringify({ure:c.selectedUre||'',school:c.selectedSchool||'',schools});if(sig===state.lastCatalogSig)return;state.lastCatalogSig=sig;state.ure=c.selectedUre||state.ure;absorbSchools(schools);if(c.selectedSchool&&!state.school)state.school=c.selectedSchool;schedule(true);return;}
    if(t==='DF_SCHOOL_SYNC'||t==='ESCOLA_TOTAL_SCHOOL_SELECTED'){const x=clean(d.selectedSchool||d.schoolName||d.session?.currentSchool||'');if(x){absorbSchools([x]);if(!state.school)state.school=x;schedule(true);}return;}
    if(!t.startsWith('DF_SOURCE_SESSION_'))return;
    const req=state.requests.get(d.requestId||''),session=state.sessions.find(x=>x.id===(d.sessionId||req?.sessionId)),sourceId=d.sessionSource||req?.sourceId;if(!session||!sourceId)return;
    if(t==='DF_SOURCE_SESSION_PROGRESS'){setSource(session,sourceId,{status:'capturing',stage:d.progress?.text||d.stage||'Captando dados…'});return;}
    if(t==='DF_SOURCE_SESSION_DATA'){const data=d.payload?.data||d.data||d.payload||{};setSource(session,sourceId,{status:'capturing',stage:'Dados recebidos; finalizando',data,rows:rowCount(data),datasets:datasetCount(data)});mirror(data,d.requestId);return;}
    if(t==='DF_SOURCE_SESSION_UNAVAILABLE'){setSource(session,sourceId,{status:'unavailable',stage:'Fonte não disponível para esta escola',error:'',capturedAt:now()});finish(d.requestId,{unavailable:true});return;}
    if(t==='DF_SOURCE_SESSION_COMPLETE'){const data=d.payload?.data||d.data||session.sources[sourceId].data||{},partial=/partial/i.test(clean(d.coverage||d.payload?.coverage||data?.coverage||''));setSource(session,sourceId,{status:partial?'partial':'complete',stage:partial?'Captura parcial concluída':'Captura concluída',data,rows:rowCount(data),datasets:datasetCount(data),capturedAt:now(),error:''});mirror(data,d.requestId);finish(d.requestId,{ok:true});return;}
    if(t==='DF_SOURCE_SESSION_ERROR'){const msg=clean(d.error||d.payload?.error||d.payload?.reason||'Falha na captura.'),unavailable=sourceId==='professorTutor'&&/nao disponivel|não disponível|nao encontrada|não encontrada|nao se aplica|não se aplica/i.test(msg);setSource(session,sourceId,{status:unavailable?'unavailable':'error',stage:unavailable?'Fonte não disponível para esta escola':'Falha na captura',error:unavailable?'':msg,capturedAt:unavailable?now():''});finish(d.requestId,unavailable?{unavailable:true}:null,unavailable?null:new Error(msg));}
  });

  document.addEventListener('change',e=>{const el=e.target;if(!(el instanceof HTMLSelectElement))return;if(el.matches('[data-session-school]')){selectSchool(el.value);return;}if(el.matches('[data-session-id]')){state.sessionId=el.value;localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.school,sessionId:state.sessionId}));schedule(true);return;}if(el.matches('#app [data-a="school"]')){const v=clean(el.value);if(v&&fold(v)!=='todas')selectSchool(v);}},true);
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.sessionNav){e.preventDefault();document.getElementById('df-session-center')?.scrollIntoView({behavior:'smooth',block:'start'});return;}if(b.dataset.sessionSource){e.preventDefault();capture(b.dataset.sessionSource,{force:true}).catch(()=>{});return;}const a=b.dataset.sessionAction;if(a){e.preventDefault();if(a==='connect')connect();else if(a==='new')newSession();else if(a==='all')captureAll();return;}if(b.matches('#app [data-a="connect"]')){e.preventDefault();e.stopImmediatePropagation();connect();return;}if(b.matches('#app [data-a="collect"]')){e.preventDefault();e.stopImmediatePropagation();captureAll();return;}if(b.dataset.cap){const k=b.dataset.cap,map={presenca:'alunoPresente',pp1:'provaPaulista',pp2:'provaPaulista',pp3:'provaPaulista',tarefas:'recomposicao',tutoriaLp:'professorTutor',tutoriaMat:'professorTutor'};if(map[k]){e.preventDefault();e.stopImmediatePropagation();capture(map[k],{force:true}).catch(()=>{});}}},true);

  const app=document.getElementById('app');if(app){new MutationObserver(()=>{if(!document.getElementById('df-session-center'))schedule(true);else suppressLegacy();}).observe(app,{childList:true});}
  load().finally(()=>{send('DIAG_REQUEST_PING');setTimeout(()=>send('DIAG_REQUEST_SESSION'),250);setTimeout(()=>send('DIAG_REQUEST_PORTAL_CATALOG'),700);schedule(true);});
})();
