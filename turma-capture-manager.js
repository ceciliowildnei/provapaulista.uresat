(()=>{
  'use strict';
  if(window.__DF_TURMA_CAPTURE_MANAGER__)return;
  window.__DF_TURMA_CAPTURE_MANAGER__=true;

  const EXT='ure-sat-conector';
  const SITE='diagnostico-facil';
  const DB='df-turma-captures-v1';
  const DB_VERSION=1;
  const MANUAL_DB='df-manual-captures-v3';
  const MANUAL_META='df-manual-capture-meta-v3';
  const ANALYSIS_STORE='df-inteligencia-v2';
  const UI_STORE='df-turma-capture-ui-v1';
  const SOURCE_DEFS={
    avd:{label:'AvD · Diagnóstico',mode:'recomposicao',sessionSource:'recomposicao'},
    alunoPresente:{label:'Aluno Presente',mode:'aluno-presente',sessionSource:'alunoPresente'},
    pp1:{label:'Prova Paulista · 1º bi',mode:'prova-paulista',sessionSource:'pp1'},
    pp2:{label:'Prova Paulista · 2º bi',mode:'prova-paulista',sessionSource:'pp2'},
    pp3:{label:'Prova Paulista · 3º bi',mode:'prova-paulista',sessionSource:'pp3'},
    saresp:{label:'SARESP',mode:'saresp',sessionSource:'saresp'}
  };

  let ui={school:'',sourceId:'avd',queue:false,currentTurma:'',customTurmas:[],collapsed:false};
  try{ui={...ui,...(JSON.parse(localStorage.getItem(UI_STORE)||'{}')||{})}}catch{}
  let active=null;
  let currentData=null;
  let lastError='';
  let renderTimer=null;
  let liveContext={connected:false,school:'',turma:'',ure:''};

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const now=()=>new Date().toISOString();
  const post=(type,extra={})=>window.postMessage({source:SITE,type,requestId:extra.requestId||rid('turma'),manualCapture:true,...extra},location.origin);
  const saveUi=()=>localStorage.setItem(UI_STORE,JSON.stringify(ui));
  const normTurma=v=>fold(v).replace(/\s+/g,' ').trim();

  function openDb(name=DB,version=DB_VERSION){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(name,version);
      req.onupgradeneeded=()=>{
        if(name===DB){
          const db=req.result;
          if(!db.objectStoreNames.contains('captures')){
            const s=db.createObjectStore('captures',{keyPath:'captureId'});
            s.createIndex('school','school',{unique:false});
            s.createIndex('turma','turma',{unique:false});
            s.createIndex('sourceId','sourceId',{unique:false});
            s.createIndex('timestamp','timestamp',{unique:false});
          }
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Falha ao abrir armazenamento de turmas.'));
    });
  }

  async function getAll(name=DB){
    try{
      const db=await openDb(name,1);
      if(!db.objectStoreNames.contains('captures'))return[];
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction('captures','readonly');
        const r=tx.objectStore('captures').getAll();
        r.onsuccess=()=>resolve(Array.isArray(r.result)?r.result:[]);
        r.onerror=()=>reject(r.error);
      });
    }catch{return[];}
  }

  async function putCapture(capture){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('captures','readwrite');
      tx.objectStore('captures').put(capture);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar captura da turma.'));
    });
  }

  async function clearDb(name){
    try{
      const db=await openDb(name,1);
      if(!db.objectStoreNames.contains('captures'))return;
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('captures','readwrite');
        tx.objectStore('captures').clear();
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
    }catch{}
  }

  function rowValue(row,patterns){
    for(const [k,v] of Object.entries(row||{})){
      const fk=fold(k);
      if(patterns.some(p=>p.test(fk))&&clean(v))return clean(v);
    }
    return'';
  }
  const rowTurma=row=>rowValue(row,[/^turma$/,/^classe$/,/^sala$/,/turma atual/]);
  const rowSchool=row=>rowValue(row,[/^escola$/,/unidade escolar/,/nome da escola/]);

  function flatten(data){
    const out=[];
    for(const [key,d] of Object.entries(data?.datasets||{}))for(const row of d?.rows||[])out.push({...row,__dataset:key});
    if(Array.isArray(data?.dataset?.rows))for(const row of data.dataset.rows)out.push({...row,__dataset:data.dataset.key||'dataset'});
    return out;
  }

  function filterDataByTurma(data,target){
    const tnorm=normTurma(target);
    if(!tnorm)return data;
    const clone={...data,datasets:{}};
    for(const [key,d] of Object.entries(data?.datasets||{})){
      const rows=Array.isArray(d?.rows)?d.rows:[];
      const tagged=rows.filter(r=>rowTurma(r));
      const filtered=tagged.length?rows.filter(r=>normTurma(rowTurma(r))===tnorm):rows;
      clone.datasets[key]={...d,rows:filtered};
    }
    if(data?.dataset){
      const rows=Array.isArray(data.dataset.rows)?data.dataset.rows:[];
      const tagged=rows.filter(r=>rowTurma(r));
      clone.dataset={...data.dataset,rows:tagged.length?rows.filter(r=>normTurma(rowTurma(r))===tnorm):rows};
    }
    return clone;
  }

  function inferTurmasFromRows(rows){
    return [...new Set(rows.map(rowTurma).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }
  function inferSchoolsFromRows(rows){
    return [...new Set(rows.map(rowSchool).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }

  async function discoverContext(){
    const [manual,turmaCaps]=await Promise.all([getAll(MANUAL_DB),getAll(DB)]);
    let analysis={};try{analysis=JSON.parse(localStorage.getItem(ANALYSIS_STORE)||'{}')?.biSummary||{};}catch{}
    const rows=[
      ...manual.flatMap(c=>Array.isArray(c?.normalizedRows)?c.normalizedRows:Array.isArray(c?.rawRows)?c.rawRows:[]),
      ...turmaCaps.flatMap(c=>Array.isArray(c?.normalizedRows)?c.normalizedRows:Array.isArray(c?.rawRows)?c.rawRows:[]),
      ...Object.values(analysis.datasets||{}).flatMap(d=>d?.rows||[])
    ];
    const schools=[...new Set([
      clean(liveContext.school),
      clean(ui.school),
      ...manual.map(c=>clean(c.school)).filter(x=>x&&fold(x)!=='nao identificada'),
      ...turmaCaps.map(c=>clean(c.school)).filter(Boolean),
      ...inferSchoolsFromRows(rows)
    ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(liveContext.school&&fold(ui.school)!==fold(liveContext.school)){ui.school=liveContext.school;saveUi();}
    if(!ui.school&&schools.length===1){ui.school=schools[0];saveUi();}
    const schoolRows=ui.school?rows.filter(r=>!rowSchool(r)||fold(rowSchool(r))===fold(ui.school)):rows;
    const liveTurma=clean(liveContext.turma);
    const turmas=[...new Set([...inferTurmasFromRows(schoolRows),...(ui.customTurmas||[]),liveTurma].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if(liveTurma&&!ui.customTurmas.some(x=>normTurma(x)===normTurma(liveTurma))){
      ui.customTurmas=[...ui.customTurmas,liveTurma];
      ui.currentTurma=liveTurma;
      saveUi();
    }
    return{schools,turmas,turmaCaps};
  }

  function latestCapture(caps,school,turma,sourceId){
    return caps.filter(c=>fold(c.school)===fold(school)&&normTurma(c.turma)===normTurma(turma)&&c.sourceId===sourceId)
      .sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0))[0]||null;
  }

  function ensureCss(){
    if(document.getElementById('df-turma-capture-css'))return;
    const st=document.createElement('style');st.id='df-turma-capture-css';st.textContent=`
#df-turma-capture-panel{position:fixed;right:22px;bottom:22px;z-index:2147483000;width:min(440px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 44px));overflow:auto;padding:14px;border:1px solid #d4e3f1;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(8,51,105,.28);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#173b64}
#df-turma-capture-panel.tc-collapsed{width:auto;max-height:none;padding:0;border:0;background:transparent;box-shadow:none;overflow:visible}
#df-turma-capture-panel .tc-fab{width:68px;height:68px;border:0;border-radius:50%;background:linear-gradient(135deg,#0b69da,#073f91);color:#fff;box-shadow:0 14px 32px rgba(7,63,145,.35);font-size:13px;font-weight:950;letter-spacing:.04em}
#df-turma-capture-panel .tc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #e3edf6}
#df-turma-capture-panel h2{margin:0 0 3px;font-size:16px}.tc-sub{margin:0;color:#6b7d92;font-size:9px;line-height:1.45}
.tc-head-actions{display:flex;gap:5px}.tc-icon{width:31px;height:31px;border:1px solid #d7e3ef;border-radius:9px;background:#f8fbff;color:#31536f;font-weight:900}.tc-reset{height:31px;padding:0 9px;border:1px solid #efcfd4;border-radius:8px;background:#fff7f7;color:#9a4048;font-size:8px;font-weight:850}
.tc-connection{display:flex;align-items:center;gap:7px;margin-bottom:9px;padding:8px 10px;border-radius:9px;background:#f1f7ff;color:#315778;font-size:8.5px}.tc-connection .dot{width:8px;height:8px;border-radius:50%;background:#d59d30}.tc-connection.ok .dot{background:#1aa584}.tc-connection b{font-size:8.5px}
.tc-controls{display:grid;grid-template-columns:1.15fr 1fr;gap:7px;align-items:end;margin-bottom:10px;padding:9px;border:1px solid #e1e8f0;border-radius:10px;background:#f9fbfd}
.tc-field{display:grid;gap:4px}.tc-field span{font-size:7px;color:#6d8196;font-weight:850}.tc-field select,.tc-field input{height:34px;padding:0 8px;border:1px solid #d2dde8;border-radius:8px;background:#fff;color:#294762;font-size:8.5px}
.tc-actions{display:flex;gap:6px;grid-column:1/-1}.tc-btn{height:33px;padding:0 10px;border:1px solid #cdd9e7;border-radius:8px;background:#fff;color:#31536f;font-size:8px;font-weight:850}.tc-btn.primary{border-color:#1859b7;background:#1859b7;color:#fff}.tc-btn:disabled{opacity:.5}
.tc-live{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;padding:10px 11px;border:1px solid #d3e2f2;border-left:4px solid #1859b7;border-radius:9px;background:#f4f8ff}.tc-live strong{display:block;color:#183f68;font-size:10.5px}.tc-live span{display:block;margin-top:2px;color:#61778e;font-size:8px}.tc-live .dot{width:9px;height:9px;border-radius:50%;background:#1aa584;box-shadow:0 0 0 5px rgba(26,165,132,.12)}
.tc-progress{margin-bottom:9px;color:#49627a;font-size:8px}.tc-table{overflow:auto;max-height:280px;border:1px solid #e1e8ef;border-radius:9px}.tc-table table{width:100%;border-collapse:collapse;min-width:650px}.tc-table th{position:sticky;top:0;padding:8px;background:#eef3f8;color:#38526b;font-size:7px;text-align:left}.tc-table td{padding:8px;border-top:1px solid #edf1f5;color:#334e68;font-size:7.8px}.tc-status{font-weight:850}.tc-status.ok{color:#14886f}.tc-status.active{color:#1859b7}.tc-status.err{color:#bf4d57}.tc-row-btn{height:27px;padding:0 8px;border:1px solid #d4deea;border-radius:6px;background:#fff;color:#31536f;font-size:7.2px;font-weight:800}.tc-error{margin-top:8px;padding:8px 9px;border:1px solid #efd0d4;border-radius:8px;background:#fff0f1;color:#8e3f46;font-size:7.7px}.tc-add{display:flex;gap:5px;margin-top:8px}.tc-add input{height:30px;min-width:0;flex:1;padding:0 8px;border:1px solid #d4deea;border-radius:7px;font-size:8px}.tc-add button{height:30px;padding:0 8px;border:1px solid #d4deea;border-radius:7px;background:#fff;color:#31536f;font-size:7.5px;font-weight:800}
@media(max-width:600px){#df-turma-capture-panel{right:10px;bottom:10px;width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.tc-controls{grid-template-columns:1fr}.tc-actions{grid-column:auto}.tc-head{display:block}.tc-head-actions{margin-top:8px}}
`;
    document.head.appendChild(st);
  }

  async function render(){
    ensureCss();
    let host=document.getElementById('df-turma-capture-panel');
    if(!host){host=document.createElement('section');host.id='df-turma-capture-panel';document.body.appendChild(host);}
    if(ui.collapsed){
      host.className='tc-collapsed';
      host.innerHTML='<button class="tc-fab" data-tc-toggle title="Abrir captura flutuante">SDF</button>';
      return;
    }
    host.className='';
    const {schools,turmas,turmaCaps}=await discoverContext();
    const selectedSchool=ui.school||schools[0]||liveContext.school||'';
    const selectedSource=SOURCE_DEFS[ui.sourceId]?ui.sourceId:'avd';
    const completed=turmas.filter(t=>latestCapture(turmaCaps,selectedSchool,t,selectedSource)).length;
    const current=active?.turma||liveContext.turma||ui.currentTurma||turmas.find(t=>!latestCapture(turmaCaps,selectedSchool,t,selectedSource))||turmas[0]||'';
    if(current&&normTurma(ui.currentTurma)!==normTurma(current)){ui.currentTurma=current;saveUi();}
    const schoolOptions=schools.length?schools.map(s=>`<option value="${esc(s)}" ${fold(s)===fold(selectedSchool)?'selected':''}>${esc(s)}</option>`).join(''):'<option value="">Escola não identificada</option>';
    const sourceOptions=Object.entries(SOURCE_DEFS).map(([id,d])=>`<option value="${id}" ${id===selectedSource?'selected':''}>${esc(d.label)}</option>`).join('');
    const rowsHtml=turmas.map(t=>{
      const cap=latestCapture(turmaCaps,selectedSchool,t,selectedSource),isActive=active&&normTurma(active.turma)===normTurma(t),status=isActive?'🔄 Captando':cap?'✅ Salvo':'○ Pendente',cls=isActive?'active':cap?'ok':'';
      return`<tr><td><strong>${esc(t)}</strong></td><td>${esc(SOURCE_DEFS[selectedSource].label)}</td><td class="tc-status ${cls}">${status}</td><td>${cap?Number(cap.records||0).toLocaleString('pt-BR'):'—'}</td><td>${cap?new Date(cap.timestamp).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—'}</td><td><button class="tc-row-btn" data-tc-capture="${esc(t)}" ${active?'disabled':''}>${cap?'Recapturar':'Capturar'}</button></td></tr>`;
    }).join('');
    const liveText=active?`Captando ${active.turma} · ${SOURCE_DEFS[active.sourceId]?.label||active.sourceId}`:current?`Turma atual: ${current}`:'Selecione ou adicione uma turma';
    const liveSub=active?(active.text||'Lendo a tela atual do Escola Total...'):(liveContext.turma?`Turma detectada no Escola Total: ${liveContext.turma}`:'No Escola Total, filtre uma turma, aguarde carregar e capture.');
    host.innerHTML=`
      <div class="tc-head"><div><h2>Captura turma a turma</h2><p class="tc-sub">Expansão flutuante do Diagnóstico Fácil · escola + turma + fonte, sem misturar dados.</p></div><div class="tc-head-actions"><button class="tc-icon" data-tc-toggle title="Minimizar">—</button><button class="tc-reset" data-tc-reset>Resetar</button></div></div>
      <div class="tc-connection ${liveContext.connected?'ok':''}"><span class="dot"></span><b>${liveContext.connected?'Escola Total conectado':'Aguardando Escola Total'}</b><span>${esc(liveContext.school||selectedSchool||'')}${liveContext.turma?' · '+esc(liveContext.turma):''}</span></div>
      <div class="tc-controls">
        <label class="tc-field"><span>ESCOLA</span><select data-tc-school>${schoolOptions}</select></label>
        <label class="tc-field"><span>FONTE</span><select data-tc-source>${sourceOptions}</select></label>
        <div class="tc-actions"><button class="tc-btn primary" data-tc-current ${!current||active?'disabled':''}>Capturar turma atual</button><button class="tc-btn" data-tc-sequence>${ui.queue?'Encerrar sequência':'Modo sequência'}</button><button class="tc-btn" data-tc-open>Qual é a próxima?</button></div>
      </div>
      <div class="tc-live"><div><strong>${esc(liveText)}</strong><span>${esc(liveSub)}</span></div><div class="dot"></div></div>
      <div class="tc-progress">${turmas.length?`${completed} de ${turmas.length} turma(s) salvas para ${esc(SOURCE_DEFS[selectedSource].label)}.`:'Nenhuma turma registrada ainda.'}</div>
      <div class="tc-table"><table><thead><tr><th>Turma</th><th>Fonte</th><th>Status</th><th>Registros</th><th>Última captura</th><th>Ação</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="6">Filtre uma turma no Escola Total ou adicione-a abaixo.</td></tr>'}</tbody></table></div>
      <div class="tc-add"><input placeholder="Adicionar turma, ex.: 8º A" data-tc-new><button data-tc-add>Adicionar</button></div>
      ${lastError?`<div class="tc-error">${esc(lastError)}</div>`:''}
    `;
  }

  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>render(),80);}

  async function startTurmaCapture(turma){
    if(active)return;
    const sourceId=ui.sourceId;const def=SOURCE_DEFS[sourceId];if(!def)return;
    ui.currentTurma=turma;saveUi();lastError='';
    const requestId=rid(`turma-${sourceId}`);
    active={requestId,sourceId,turma,school:ui.school,text:'Lendo a aba do Escola Total...'};
    currentData=null;schedule();
    post('DIAG_CAPTURE_CURRENT_VIEW',{requestId,sessionId:rid('turma-session'),sessionSource:def.sessionSource||sourceId,sourceLabel:`${def.label} · ${turma}`,mode:def.mode,year:2026,manualCapture:true,turmaCapture:true,targetTurma:turma,targetSchool:ui.school});
  }

  async function finalize(){
    if(!active)return;
    const selected={...active};
    const filtered=filterDataByTurma(currentData||{},selected.turma);
    const rows=flatten(filtered);
    if(!rows.length){lastError=`Não encontrei registros para ${selected.turma}. Confirme que esta turma está filtrada e carregada no Escola Total.`;active=null;currentData=null;schedule();return;}
    const detectedTurmas=inferTurmasFromRows(flatten(currentData||{}));
    if(detectedTurmas.length===1&&normTurma(detectedTurmas[0])!==normTurma(selected.turma)){
      lastError=`A tela atual parece ser ${detectedTurmas[0]}, mas você pediu ${selected.turma}. Nada foi salvo. Ajuste a turma no Escola Total e tente novamente.`;active=null;currentData=null;schedule();return;
    }
    const detectedSchools=inferSchoolsFromRows(rows);
    const school=selected.school||detectedSchools[0]||'Não identificada';
    const scopeId=`turma:${fold(school).replace(/[^a-z0-9]+/g,'-')}:${normTurma(selected.turma).replace(/[^a-z0-9]+/g,'-')}:${selected.sourceId}`;
    const capture={captureId:scopeId,sourceId:selected.sourceId,sourceLabel:SOURCE_DEFS[selected.sourceId].label,school,turma:selected.turma,timestamp:now(),records:rows.length,datasets:filtered.datasets||{},rawRows:rows.slice(0,3000),normalizedRows:rows.slice(0,5000),coverage:'complete',turmaCapture:true};
    try{
      await putCapture(capture);
      active=null;currentData=null;lastError='';
      window.dispatchEvent(new CustomEvent('df-turma-capture-saved',{detail:{sourceId:capture.sourceId,school:capture.school,turma:capture.turma,records:capture.records,timestamp:capture.timestamp}}));
      const {turmas,turmaCaps}=await discoverContext();
      if(ui.queue){
        const next=turmas.find(t=>!latestCapture([...turmaCaps,capture],school,t,ui.sourceId));
        ui.currentTurma=next||'';
        if(!next)ui.queue=false;
      }
      saveUi();schedule();
    }catch(error){lastError=`Os dados foram lidos, mas não consegui salvar ${selected.turma}: ${clean(error?.message||error)}`;active=null;currentData=null;schedule();}
  }

  async function resetAll(){
    if(!window.confirm('Resetar todos os dados capturados e todas as análises salvas? A extensão continuará instalada e conectada.'))return;
    await Promise.all([clearDb(MANUAL_DB),clearDb(DB)]);
    localStorage.removeItem(MANUAL_META);
    localStorage.removeItem(ANALYSIS_STORE);
    localStorage.removeItem(UI_STORE);
    ui={school:'',sourceId:'avd',queue:false,currentTurma:'',customTurmas:[],collapsed:false};active=null;currentData=null;lastError='';
    location.reload();
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-tc-toggle')){e.preventDefault();e.stopImmediatePropagation();ui.collapsed=!ui.collapsed;saveUi();schedule();return;}
    if(b.hasAttribute('data-tc-reset')){e.preventDefault();e.stopImmediatePropagation();resetAll();return;}
    if(b.hasAttribute('data-tc-current')){e.preventDefault();e.stopImmediatePropagation();const t=liveContext.turma||ui.currentTurma;if(t)startTurmaCapture(t);return;}
    if(b.dataset.tcCapture){e.preventDefault();e.stopImmediatePropagation();startTurmaCapture(b.dataset.tcCapture);return;}
    if(b.hasAttribute('data-tc-sequence')){e.preventDefault();e.stopImmediatePropagation();ui.queue=!ui.queue;saveUi();schedule();return;}
    if(b.hasAttribute('data-tc-open')){e.preventDefault();e.stopImmediatePropagation();const t=ui.currentTurma;if(t)lastError=`Próxima turma: ${t}. No Escola Total, filtre ${t}, aguarde o carregamento e volte para capturar.`;schedule();return;}
    if(b.hasAttribute('data-tc-add')){e.preventDefault();e.stopImmediatePropagation();const input=document.querySelector('[data-tc-new]');const t=clean(input?.value);if(t&&!ui.customTurmas.some(x=>normTurma(x)===normTurma(t))){ui.customTurmas=[...ui.customTurmas,t];ui.currentTurma=ui.currentTurma||t;saveUi();}schedule();return;}
  },true);

  document.addEventListener('change',e=>{
    if(e.target.matches('[data-tc-school]')){ui.school=e.target.value;ui.currentTurma='';saveUi();schedule();}
    if(e.target.matches('[data-tc-source]')){ui.sourceId=e.target.value;ui.currentTurma='';saveUi();schedule();}
  },true);

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||d.source!==EXT)return;
    if(d.type==='DF_READY'||d.type==='EXTRACTOR_READY'){liveContext.connected=true;schedule();return;}
    if(d.type==='DF_SESSION'||d.type==='ESCOLA_TOTAL_SESSION'){
      const sess=d.session||d.payload?.session||{};
      liveContext={connected:!!sess.loggedIn,school:clean(sess.currentSchool||sess.school||liveContext.school),turma:clean(sess.currentTurma||sess.turma||liveContext.turma),ure:clean(sess.currentUre||sess.ure||liveContext.ure)};
      if(liveContext.school)ui.school=liveContext.school;
      if(liveContext.turma){ui.currentTurma=liveContext.turma;if(!ui.customTurmas.some(x=>normTurma(x)===normTurma(liveContext.turma)))ui.customTurmas=[...ui.customTurmas,liveContext.turma];}
      saveUi();schedule();return;
    }
    if(d.type==='ESCOLA_TOTAL_LOGIN_REQUIRED'){liveContext.connected=false;schedule();return;}
    if(!active||d.requestId!==active.requestId)return;
    if(d.type==='DF_SOURCE_SESSION_PROGRESS'){active.text=clean(d.progress?.text||d.stage||'Captando a turma atual...');schedule();return;}
    if(d.type==='DF_SOURCE_SESSION_DATA'){currentData=d.payload?.data||d.data||d.payload||{};return;}
    if(d.type==='DF_SOURCE_SESSION_COMPLETE'){currentData=d.payload?.data||d.data||currentData||{};finalize();return;}
    if(d.type==='DF_SOURCE_SESSION_ERROR'||d.type==='DF_SOURCE_SESSION_UNAVAILABLE'){lastError=clean(d.error||d.payload?.error||d.payload?.reason||'Não foi possível capturar a turma atual.');active=null;currentData=null;schedule();}
  },true);

  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(()=>schedule()).observe(root,{childList:true,subtree:true});
  schedule();
})();
