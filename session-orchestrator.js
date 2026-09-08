(()=>{
  'use strict';
  if(window.__DF_SESSION_ORCHESTRATOR_V1__) return;
  window.__DF_SESSION_ORCHESTRATOR_V1__=true;

  const SITE_SOURCE='diagnostico-facil';
  const STORE_NAME='diagnostico-facil-sessions';
  const STORE_VERSION=1;
  const ACTIVE_KEY='df-session-orchestrator-active-v1';
  const YEAR=2026;
  const SOURCE_DEFS=[
    {id:'superbi',label:'Super BI',icon:'📊',mode:'super-bi',essential:true},
    {id:'alunoPresente',label:'Aluno Presente',icon:'🧑‍🎓',mode:'aluno-presente',essential:true},
    {id:'recomposicao',label:'Recomposição',icon:'🧩',mode:'recomposicao',essential:true},
    {id:'provaPaulista',label:'Provas Paulistas',icon:'📝',mode:'prova-paulista',essential:true},
    {id:'multiplica',label:'Multiplica',icon:'✳️',mode:'multiplica',essential:true},
    {id:'pra',label:'PRA',icon:'🎯',mode:'pra',essential:true},
    {id:'professorTutor',label:'Professor Tutor',icon:'👩‍🏫',mode:'professor-tutor',essential:false,conditional:true}
  ];

  const state={
    extVersion:'', loggedIn:false, uidDetected:false, ure:'', catalogSchools:[], activeSchool:'',
    sessions:[], activeSessionId:'', requests:new Map(), runningAll:false, booted:false, renderTimer:null
  };

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=(p='sess')=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const nowIso=()=>new Date().toISOString();
  const fmtDate=v=>{try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return clean(v)}};
  const unique=a=>[...new Set((a||[]).filter(Boolean))];

  let dbPromise=null;
  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB indisponível'));return;}
      const req=indexedDB.open(STORE_NAME,STORE_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('sessions')){
          const store=db.createObjectStore('sessions',{keyPath:'id'});
          store.createIndex('school','school',{unique:false});
          store.createIndex('updatedAt','updatedAt',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Falha ao abrir banco local'));
    });
    return dbPromise;
  }
  async function loadSessions(){
    try{
      const db=await openDb();
      const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readonly');const req=tx.objectStore('sessions').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
      state.sessions=rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    }catch{
      try{state.sessions=JSON.parse(localStorage.getItem(`${STORE_NAME}-fallback`)||'[]')}catch{state.sessions=[]}
    }
    const active=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}');
    if(active.school)state.activeSchool=active.school;
    if(active.sessionId)state.activeSessionId=active.sessionId;
    if(state.activeSessionId&&!state.sessions.some(x=>x.id===state.activeSessionId))state.activeSessionId='';
    scheduleRender();
  }
  async function persistSession(session){
    session.updatedAt=nowIso();
    const i=state.sessions.findIndex(x=>x.id===session.id);
    if(i>=0)state.sessions[i]=session;else state.sessions.unshift(session);
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(session);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    }catch{
      try{localStorage.setItem(`${STORE_NAME}-fallback`,JSON.stringify(state.sessions.slice(0,12)))}catch{}
    }
    localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.activeSchool,sessionId:state.activeSessionId}));
    scheduleRender();
  }

  function blankSources(){
    return Object.fromEntries(SOURCE_DEFS.map(d=>[d.id,{id:d.id,status:'pending',stage:'Aguardando captura',rows:0,datasets:0,capturedAt:'',error:'',data:null,requestId:''}]));
  }
  function createSession(school){
    const session={id:uid('school'),school,year:YEAR,createdAt:nowIso(),updatedAt:nowIso(),completedAt:'',sources:blankSources(),overview:{}};
    state.sessions.unshift(session);state.activeSessionId=session.id;state.activeSchool=school;
    persistSession(session);return session;
  }
  function currentSession(){
    let s=state.sessions.find(x=>x.id===state.activeSessionId)||null;
    if(s&&state.activeSchool&&s.school!==state.activeSchool)s=null;
    return s;
  }
  function ensureSession(){
    if(!state.activeSchool)return null;
    return currentSession()||createSession(state.activeSchool);
  }
  function sessionsForSchool(){return state.sessions.filter(x=>!state.activeSchool||x.school===state.activeSchool)}

  function datasetsOf(data){return data?.datasets||data?.biSummary?.datasets||data?.payload?.datasets||{};}
  function rowsInData(data){
    const ds=datasetsOf(data);let n=0;
    for(const d of Object.values(ds))if(Array.isArray(d?.rows))n+=d.rows.length;
    if(Array.isArray(data?.dataset?.rows))n+=data.dataset.rows.length;
    return n;
  }
  function datasetCount(data){return Object.values(datasetsOf(data)).filter(d=>Array.isArray(d?.rows)&&d.rows.length).length+(Array.isArray(data?.dataset?.rows)&&data.dataset.rows.length?1:0)}
  function allRows(session){
    const out=[];
    for(const src of Object.values(session?.sources||{})){
      const data=src.data||{};for(const d of Object.values(datasetsOf(data)))if(Array.isArray(d?.rows))out.push(...d.rows);
      if(Array.isArray(data?.dataset?.rows))out.push(...data.dataset.rows);
    }
    return out;
  }
  function rowVal(row,names){
    const entries=Object.entries(row||{}).filter(([k])=>!k.startsWith('__')&&!k.startsWith('_'));
    for(const name of names){const hit=entries.find(([k])=>fold(k)===fold(name));if(hit)return hit[1];}
    for(const name of names){const hit=entries.find(([k])=>fold(k).includes(fold(name)));if(hit)return hit[1];}
    return '';
  }
  function pct(v){const x=clean(v);if(!x)return null;let n=Number(x.replace('%','').replace(',','.').replace(/[^0-9.-]/g,''));if(!Number.isFinite(n))return null;if(!x.includes('%')&&Math.abs(n)<=1)n*=100;return n;}
  function overviewFor(session){
    const sources=Object.values(session?.sources||{});
    const completed=sources.filter(s=>['complete','partial'].includes(s.status)).length;
    const unavailable=sources.filter(s=>s.status==='unavailable').length;
    const totalRows=sources.reduce((n,s)=>n+Number(s.rows||0),0);
    const rows=allRows(session);const students=new Set(),turmas=new Set();
    let below=0,basic=0,proficient=0,lowAttendance=0;
    for(const r of rows){
      const ra=clean(rowVal(r,['RA','NR RA','Registro do Aluno','Matrícula','Matricula','ID Aluno'])).replace(/\D/g,'');
      const name=clean(rowVal(r,['Aluno','Estudante','Nome do Aluno','Nome']));if(ra||name)students.add(ra||fold(name));
      const turma=clean(rowVal(r,['Turma','Classe','Sala']));if(turma)turmas.add(turma);
      const joined=fold(Object.values(r||{}).join(' '));
      if(joined.includes('abaixo do basico'))below++;else if(joined.includes('proficiente'))proficient++;else if(/(^|\s)basico(\s|$)/.test(joined))basic++;
      const f=pct(rowVal(r,['Frequência','Frequencia','Presença','Presenca','% Presença Anual','Presença Anual']));if(Number.isFinite(f)&&f<75)lowAttendance++;
    }
    const ppData=session?.sources?.provaPaulista?.data;const ppds=datasetsOf(ppData);
    const pp={pp1:Number(ppds.pp1?.rows?.length||0),pp2:Number(ppds.pp2?.rows?.length||0),pp3:Number(ppds.pp3?.rows?.length||0)};
    return {completed,unavailable,totalSources:sources.length,totalRows,students:students.size,turmas:turmas.size,below,basic,proficient,lowAttendance,pp,updatedAt:nowIso()};
  }

  function send(type,extra={}){window.postMessage({source:SITE_SOURCE,type,requestId:extra.requestId||uid('site'),timestamp:Date.now(),...extra},location.origin);}

  function updateSource(session,sourceId,patch){
    if(!session?.sources?.[sourceId])return;
    session.sources[sourceId]={...session.sources[sourceId],...patch};
    session.overview=overviewFor(session);
    persistSession(session);
  }

  function captureSource(sourceId,{force=false}={}){
    const def=SOURCE_DEFS.find(x=>x.id===sourceId);if(!def)return Promise.reject(new Error('Fonte desconhecida'));
    const session=ensureSession();if(!session)return Promise.reject(new Error('Selecione uma escola antes de iniciar a coleta.'));
    const current=session.sources[sourceId];if(current.status==='capturing')return Promise.reject(new Error('Esta fonte já está em captura.'));
    if(!force&&current.status==='complete')return Promise.resolve({skipped:true});
    const requestId=uid(`src-${sourceId}`);
    updateSource(session,sourceId,{status:'capturing',stage:'Preparando sessão de coleta',error:'',requestId,startedAt:nowIso()});
    send('DIAG_REQUEST_SOURCE_SESSION',{requestId,sessionId:session.id,sessionSource:sourceId,sourceLabel:def.label,mode:def.mode,schoolName:session.school,year:session.year});
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        state.requests.delete(requestId);
        updateSource(session,sourceId,{status:'error',stage:'Tempo excedido',error:'A fonte não respondeu dentro do tempo de segurança.'});
        reject(new Error('Tempo excedido'));
      },240000);
      state.requests.set(requestId,{sessionId:session.id,sourceId,resolve,reject,timer});
    });
  }

  async function captureAll(){
    if(state.runningAll)return;
    const session=ensureSession();if(!session)return;
    state.runningAll=true;scheduleRender();
    for(const def of SOURCE_DEFS){
      const src=session.sources[def.id];
      if(src.status==='complete'||src.status==='unavailable')continue;
      try{await captureSource(def.id)}catch{}
    }
    state.runningAll=false;
    const done=Object.values(session.sources).every(x=>['complete','partial','unavailable','error'].includes(x.status));
    if(done)session.completedAt=nowIso();session.overview=overviewFor(session);await persistSession(session);scheduleRender();
  }

  function statusLabel(s){
    return s.status==='complete'?'Concluído':s.status==='partial'?'Parcial':s.status==='capturing'?'Captando':s.status==='unavailable'?'Não se aplica':s.status==='error'?'Erro':'Pendente';
  }
  function statusIcon(s){return s.status==='complete'?'✅':s.status==='partial'?'🟡':s.status==='capturing'?'🔄':s.status==='unavailable'?'○':s.status==='error'?'⚠️':'○'}

  function css(){
    if(document.getElementById('df-session-css'))return;
    const st=document.createElement('style');st.id='df-session-css';st.textContent=`
#df-session-center{margin:0 0 12px;border:1px solid #cfdeee;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(20,48,84,.06);overflow:hidden}
.dfso-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:16px 17px;background:linear-gradient(135deg,#f4f8ff,#fff)}
.dfso-head h2{margin:0 0 4px;font-size:15px;color:#183f68}.dfso-head p{margin:0;color:#687d91;font-size:9px;line-height:1.45}.dfso-badge{white-space:nowrap;padding:6px 9px;border-radius:999px;background:#edf5ff;color:#285d98;font-size:8px;font-weight:800}
.dfso-controls{display:grid;grid-template-columns:1.5fr 1fr auto auto;gap:8px;padding:12px 16px;border-top:1px solid #e4ebf3;border-bottom:1px solid #e4ebf3}.dfso-controls label{display:grid;gap:4px;color:#6b7d92;font-size:7px;font-weight:850}.dfso-controls select,.dfso-controls button{height:35px;border-radius:8px;font-size:8.5px;font-weight:780}.dfso-controls select{padding:0 9px;border:1px solid #cfdae7;background:#fbfdff;color:#294762}.dfso-controls button{align-self:end;padding:0 11px;border:1px solid #cfdbe7;background:#fff;color:#31536f}.dfso-controls .primary{border:0;background:#1859b7;color:#fff}.dfso-controls .primary:disabled{opacity:.5}
.dfso-source-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:14px 16px}.dfso-card{min-width:0;padding:12px;border:1px solid #e1e8ef;border-radius:11px;background:#fbfcfe}.dfso-card.complete{background:#effaf6;border-color:#cbe8de}.dfso-card.partial{background:#fff9eb;border-color:#ead9a8}.dfso-card.capturing{background:#f2f7ff;border-color:#c9dcf3}.dfso-card.error{background:#fff3f4;border-color:#efcfd4}.dfso-card.unavailable{background:#f7f8fa;color:#8291a1}.dfso-title{display:flex;gap:7px;align-items:center}.dfso-title b{font-size:9px;color:#284963}.dfso-state{margin-left:auto;font-size:7px;font-weight:850}.dfso-card p{min-height:25px;margin:7px 0 6px;color:#718397;font-size:7.7px;line-height:1.4}.dfso-meta{display:flex;gap:8px;flex-wrap:wrap;color:#7d8fa2;font-size:7px}.dfso-card button{margin-top:8px;height:28px;padding:0 8px;border:1px solid #d4deea;border-radius:7px;background:#fff;color:#31536f;font-size:7.5px;font-weight:800}.dfso-card button:disabled{opacity:.55}
.dfso-overview{padding:0 16px 16px}.dfso-overview h3{margin:3px 0 9px;font-size:12px;color:#183f68}.dfso-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.dfso-kpi{padding:9px;border:1px solid #e1e8ef;border-radius:9px;background:#fff}.dfso-kpi span{display:block;color:#7d8fa2;font-size:6.5px;font-weight:850}.dfso-kpi b{display:block;margin-top:4px;color:#234869;font-size:14px}.dfso-summary{margin-top:9px;padding:10px;border-left:4px solid #1859b7;border-radius:8px;background:#f5f9ff;color:#36536e;font-size:8.2px;line-height:1.55}.dfso-history{margin-top:10px;color:#7b8da1;font-size:7.5px}
nav button[data-session-nav]{margin-top:3px}
@media(max-width:1050px){.dfso-source-grid{grid-template-columns:repeat(2,1fr)}.dfso-kpis{grid-template-columns:repeat(3,1fr)}.dfso-controls{grid-template-columns:1fr 1fr}}
@media(max-width:620px){.dfso-source-grid,.dfso-kpis,.dfso-controls{grid-template-columns:1fr}.dfso-head{display:block}.dfso-badge{display:inline-block;margin-top:8px}}
`;
    document.head.appendChild(st);
  }

  function summaryText(session,o){
    if(!session)return 'Selecione uma escola para iniciar uma sessão de análise.';
    const parts=[];
    parts.push(`${o.completed} de ${o.totalSources} fontes com dados concluídos/parciais`);
    if(o.students)parts.push(`${o.students.toLocaleString('pt-BR')} estudantes identificados`);
    if(o.turmas)parts.push(`${o.turmas} turmas`);
    if(o.lowAttendance)parts.push(`${o.lowAttendance} registros com frequência abaixo de 75%`);
    if(o.below)parts.push(`${o.below} ocorrências de “Abaixo do Básico”`);
    if(o.pp.pp1||o.pp.pp2||o.pp.pp3)parts.push(`PP: ${o.pp.pp1}/${o.pp.pp2}/${o.pp.pp3} registros em PP1/PP2/PP3`);
    return parts.join(' · ')||'Aguardando a primeira fonte de dados.';
  }

  function renderPanel(){
    css();
    const app=document.querySelector('#app');const main=app?.querySelector('main');const filters=main?.querySelector('.filters');if(!main||!filters)return;
    let host=document.getElementById('df-session-center');if(!host){host=document.createElement('section');host.id='df-session-center';filters.insertAdjacentElement('afterend',host);}
    const schoolOptions=unique([...state.catalogSchools,state.activeSchool]).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const session=currentSession();const overview=session?overviewFor(session):{completed:0,totalSources:SOURCE_DEFS.length,totalRows:0,students:0,turmas:0,lowAttendance:0,below:0,pp:{pp1:0,pp2:0,pp3:0}};
    const hist=sessionsForSchool();
    host.innerHTML=`
      <div class="dfso-head"><div><h2>Sessões de Coleta da Escola</h2><p>Cada fonte é capturada de forma independente. O que já foi concluído fica salvo no navegador e compõe a visão geral da escola.</p></div><span class="dfso-badge">${state.loggedIn?'Escola Total conectado':'Aguardando Escola Total'}</span></div>
      <div class="dfso-controls">
        <label>ESCOLA<select data-session-school><option value="">Selecione a escola</option>${schoolOptions.map(x=>`<option value="${esc(x)}" ${x===state.activeSchool?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
        <label>SESSÃO<select data-session-id ${!hist.length?'disabled':''}>${hist.length?hist.map((x,i)=>`<option value="${esc(x.id)}" ${x.id===state.activeSessionId?'selected':''}>${fmtDate(x.createdAt)}${i===0?' · mais recente':''}</option>`).join(''):'<option>Nenhuma sessão</option>'}</select></label>
        <button data-session-action="new" ${!state.activeSchool?'disabled':''}>Nova sessão</button>
        <button class="primary" data-session-action="all" ${!state.activeSchool||state.runningAll?'disabled':''}>${state.runningAll?'Coletando…':'Iniciar coleta completa'}</button>
      </div>
      <div class="dfso-source-grid">${SOURCE_DEFS.map(def=>{const src=session?.sources?.[def.id]||blankSources()[def.id];return `<article class="dfso-card ${src.status}"><div class="dfso-title"><span>${def.icon}</span><b>${esc(def.label)}</b><span class="dfso-state">${statusIcon(src)} ${statusLabel(src)}</span></div><p>${esc(src.error||src.stage||'Aguardando captura')}</p><div class="dfso-meta"><span>${Number(src.rows||0).toLocaleString('pt-BR')} registros</span><span>${Number(src.datasets||0)} conjunto(s)</span>${src.capturedAt?`<span>${fmtDate(src.capturedAt)}</span>`:''}</div><button data-session-source="${def.id}" ${!session||src.status==='capturing'?'disabled':''}>${src.status==='complete'?'Recapturar':'Capturar esta fonte'}</button></article>`}).join('')}</div>
      <div class="dfso-overview"><h3>Visão Geral Consolidada</h3><div class="dfso-kpis"><div class="dfso-kpi"><span>FONTES</span><b>${overview.completed}/${overview.totalSources}</b></div><div class="dfso-kpi"><span>REGISTROS</span><b>${Number(overview.totalRows||0).toLocaleString('pt-BR')}</b></div><div class="dfso-kpi"><span>ESTUDANTES</span><b>${Number(overview.students||0).toLocaleString('pt-BR')}</b></div><div class="dfso-kpi"><span>TURMAS</span><b>${Number(overview.turmas||0)}</b></div><div class="dfso-kpi"><span>FREQUÊNCIA &lt; 75%</span><b>${Number(overview.lowAttendance||0)}</b></div><div class="dfso-kpi"><span>ABAIXO DO BÁSICO</span><b>${Number(overview.below||0)}</b></div></div><div class="dfso-summary">${esc(summaryText(session,overview))}</div><div class="dfso-history">${hist.length?`${hist.length} sessão(ões) preservada(s) para ${esc(state.activeSchool)}.`:'A visão geral será atualizada à medida que cada fonte for capturada.'}</div></div>`;

    const nav=app.querySelector('aside nav');if(nav&&!nav.querySelector('[data-session-nav]')){const b=document.createElement('button');b.dataset.sessionNav='1';b.innerHTML='<span class="ic">🧩</span>Sessões de coleta';nav.appendChild(b);}
  }
  function scheduleRender(){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(renderPanel,40)}

  function absorbSchools(list){
    const valid=(list||[]).map(clean).filter(x=>x&&fold(x)!=='todas as escolas da ure'&&fold(x)!=='todas');
    state.catalogSchools=unique([...state.catalogSchools,...valid]).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(!state.activeSchool&&state.catalogSchools.length===1)state.activeSchool=state.catalogSchools[0];
    scheduleRender();
  }

  function finishRequest(requestId,result,error){
    const req=state.requests.get(requestId);if(!req)return;
    clearTimeout(req.timer);state.requests.delete(requestId);
    error?req.reject(error):req.resolve(result);
  }

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!=='ure-sat-conector')return;
    const t=String(d.type||'');
    if(t==='DF_READY'){state.extVersion=d.version||d.extensionVersion||state.extVersion;scheduleRender();return;}
    if(t==='DF_SESSION'){state.loggedIn=!!d.session?.loggedIn;state.uidDetected=!!d.session?.uidDetected;state.ure=d.session?.currentUre||state.ure;absorbSchools(d.session?.schools||d.session?.authorizedSchools||d.session?.profile?.associatedSchools||[]);return;}
    if(t==='DF_CATALOG'){state.ure=d.catalog?.selectedUre||state.ure;absorbSchools(d.catalog?.schools||d.catalog?.profile?.associatedSchools||[]);return;}
    if(t==='DF_SCHOOL_SYNC'||t==='ESCOLA_TOTAL_SCHOOL_SELECTED'){const school=clean(d.selectedSchool||d.schoolName||d.session?.currentSchool);if(school){absorbSchools([school]);if(!state.activeSchool)state.activeSchool=school;}scheduleRender();return;}
    if(!t.startsWith('DF_SOURCE_SESSION_'))return;
    const requestId=d.requestId||'';const req=state.requests.get(requestId);const session=state.sessions.find(x=>x.id===(d.sessionId||req?.sessionId));const sourceId=d.sessionSource||req?.sourceId;if(!session||!sourceId)return;
    if(t==='DF_SOURCE_SESSION_PROGRESS'){updateSource(session,sourceId,{status:'capturing',stage:d.progress?.text||d.stage||'Captando dados…'});return;}
    if(t==='DF_SOURCE_SESSION_DATA'){
      const data=d.payload?.data||d.data||d.payload||{};updateSource(session,sourceId,{status:'capturing',stage:'Dados recebidos; finalizando fonte',data,rows:rowsInData(data),datasets:datasetCount(data)});return;
    }
    if(t==='DF_SOURCE_SESSION_UNAVAILABLE'){
      updateSource(session,sourceId,{status:'unavailable',stage:'Fonte não disponível para esta escola',error:'',capturedAt:nowIso()});finishRequest(requestId,{unavailable:true});return;
    }
    if(t==='DF_SOURCE_SESSION_COMPLETE'){
      const data=d.payload?.data||d.data||session.sources[sourceId].data||{};const coverage=clean(d.coverage||data?.coverage||d.payload?.coverage||'complete');
      updateSource(session,sourceId,{status:/partial/i.test(coverage)?'partial':'complete',stage:/partial/i.test(coverage)?'Captura parcial concluída':'Captura concluída',data,rows:rowsInData(data),datasets:datasetCount(data),capturedAt:nowIso(),error:''});finishRequest(requestId,{ok:true});return;
    }
    if(t==='DF_SOURCE_SESSION_ERROR'){
      const msg=clean(d.error||d.payload?.error||d.payload?.reason||'Falha na captura da fonte.');
      const unavailable=/nao disponivel|não disponível|nao encontrada|não encontrada|nao se aplica|não se aplica/i.test(msg)&&sourceId==='professorTutor';
      updateSource(session,sourceId,{status:unavailable?'unavailable':'error',stage:unavailable?'Fonte não disponível para esta escola':'Falha na captura',error:unavailable?'':msg,capturedAt:unavailable?nowIso():''});finishRequest(requestId,unavailable?{unavailable:true}:null,unavailable?null:new Error(msg));return;
    }
  });

  document.addEventListener('change',e=>{
    const el=e.target;if(!(el instanceof HTMLSelectElement))return;
    if(el.matches('[data-session-school]')){
      state.activeSchool=clean(el.value);state.activeSessionId='';const recent=state.sessions.find(x=>x.school===state.activeSchool);if(recent)state.activeSessionId=recent.id;
      localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.activeSchool,sessionId:state.activeSessionId}));
      if(state.activeSchool)send('DIAG_SELECT_SCHOOL',{schoolName:state.activeSchool});scheduleRender();
    }
    if(el.matches('[data-session-id]')){state.activeSessionId=el.value;localStorage.setItem(ACTIVE_KEY,JSON.stringify({school:state.activeSchool,sessionId:state.activeSessionId}));scheduleRender();}
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    if(btn.dataset.sessionNav){document.getElementById('df-session-center')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const sourceId=btn.dataset.sessionSource;if(sourceId){captureSource(sourceId,{force:true}).catch(()=>{});return;}
    const action=btn.dataset.sessionAction;
    if(action==='new'&&state.activeSchool){createSession(state.activeSchool);scheduleRender();return;}
    if(action==='all'){captureAll();return;}
  });

  const observer=new MutationObserver(()=>scheduleRender());observer.observe(document.documentElement,{childList:true,subtree:true});
  loadSessions().finally(()=>{state.booted=true;send('DIAG_REQUEST_SESSION');send('DIAG_REQUEST_PORTAL_CATALOG');scheduleRender();});
})();
