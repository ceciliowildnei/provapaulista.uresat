    const pp=['pp1','pp2','pp3'].filter(id=>latest[id]?.status==='saved').map(id=>defs[id].label);if(pp.length)parts.push(`Provas capturadas: ${pp.join(', ')}`);
    if(latest.recomposicao?.status==='saved')parts.push(`Recomposição: ${Number(latest.recomposicao.records||0).toLocaleString('pt-BR')} registros`);
    if(latest.professorTutor?.status==='unavailable')parts.push('Professor Tutor: não se aplica');
    const text=savedIds.length?`Cobertura atual: ${savedIds.length} fonte(s) salva(s), ${rows.toLocaleString('pt-BR')} registros. ${parts.join(' · ')}. O sistema só cruza fontes quando houver chaves compatíveis; nenhuma relação é inventada.`:'Ainda não há capturas válidas salvas.';
    setText(document.getElementById('df-overview-analysis'),text);
  }

  function syncTopStatus(){
    const pills=[...document.querySelectorAll('#app .top .status .pill')];
    const sessionPill=pills.find(el=>/Escola Total|Aguardando login/i.test(el.textContent||''));
    const hasSaved=topIds.some(id=>latest[id]?.status==='saved');
    if(sessionPill){
      sessionPill.classList.toggle('ok',loggedIn);
      const i=sessionPill.querySelector('i');
      sessionPill.innerHTML='';
      if(i)sessionPill.appendChild(i);else{const dot=document.createElement('i');sessionPill.appendChild(dot);}
      sessionPill.append(document.createTextNode(loggedIn?'Escola Total conectado':hasSaved?'Escola Total disponível':'Aguardando login'));
    }
    const topConnect=[...document.querySelectorAll('#app .top .status button[data-a="connect"]')][0];
    if(topConnect)setText(topConnect,loggedIn?'Abrir Escola Total':'Conectar Escola Total');
  }

  function apply(){ensureStyle();ensureShell();document.getElementById('df-bootstrap-box')?.remove();ensureManualInfo();ensureCards();for(const id of topIds)paintSlot(id);renderOverview();const connect=document.querySelector('#df-session-center [data-session-action="connect"]');if(connect){connect.style.display='inline-flex';setText(connect,loggedIn?'Escola Total conectado':'Conectar Escola Total');}const badge=document.querySelector('#df-session-center .dfso-badge');if(badge){badge.classList.toggle('ok',loggedIn);setText(badge,loggedIn?'Escola Total conectado':'Aguardando conexão');}syncTopStatus();}
  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(apply,80);}

  function technicalFrom(d){const t=d?.payload?.technicalDetails||{};const pieces=[];if(t.apiReason)pieces.push(`API: ${t.apiReason}`);if(t.detectedDatasets?.length)pieces.push(`Conjuntos detectados: ${t.detectedDatasets.join(', ')}`);if(t.domDiagnostics)pieces.push(`DOM: ${JSON.stringify(t.domDiagnostics)}`);if(t.errors?.length)pieces.push(`Erros: ${t.errors.slice(0,6).map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' | ')}`);return pieces.join('\n');}

  async function finalize(sourceId,data,coverage='complete'){
    const records=rowsCount(data);if(!records){errors.set(sourceId,{message:'Não encontrei uma tabela com dados na tela atual. O Power BI pode ainda estar carregando. Nenhum dado anterior foi alterado.',technical:''});active=null;schedule();return;}
    if(sourceId.startsWith('pp')){
      const keys=detectedKeys(data).filter(k=>/^pp[123]$/.test(k));if(keys.length&& !keys.includes(sourceId)){errors.set(sourceId,{message:`A tela parece ser ${keys.map(k=>defs[k]?.label||k).join(', ')}, não ${defs[sourceId].label}. Abra a avaliação correta e tente novamente.`,technical:`Conjuntos detectados: ${keys.join(', ')}`});active=null;schedule();return;}
    }
    const flat=flattenRows(data);const school=inferSchool(data),ure=inferUre(data),timestamp=now();
    const capture={captureId:data?.captureId||rid(`capture-${sourceId}`),sourceId,sourceLabel:defs[sourceId].label,school,ure,year:YEAR,timestamp,coverage:coverageOf(data,coverage),records,datasets:data?.datasets||{},rawHeaders:headersFrom(flat),rawRows:flat.slice(0,2000),rawRowsTruncated:flat.length>2000,normalizedRows:flat.slice(0,5000),normalizedRowsTruncated:flat.length>5000,diagnostics:data?.diagnostics||{},powerbi:data?.powerbi||{},sourceUrl:clean(data?.context?.sourceUrl||''),privacy:data?.privacy||{passwordsRead:false,cookiesRead:false,tokensRead:false,authStorageRead:false}};
    try{if(active&&active.sourceId===sourceId){active.text='Salvando captura...';paintSlot(sourceId);}await persistCapture(capture);loggedIn=true;errors.delete(sourceId);active=null;schedule();}
    catch(error){active=null;errors.set(sourceId,{message:'Os dados foram lidos, mas não consegui confirmar o salvamento local. A captura anterior foi preservada.',technical:String(error?.message||error)});schedule();}
  }

  function startCapture(sourceId){
    const def=defs[sourceId];if(!def||active)return;errors.delete(sourceId);const requestId=rid(`manual-${sourceId}`);active={sourceId,requestId,data:null,text:'Lendo a aba do Escola Total...'};paintSlot(sourceId);
    post('DIAG_CAPTURE_CURRENT_VIEW',{requestId,sessionId:rid('manual-session'),sessionSource:sourceId,sourceLabel:def.label,mode:def.mode,year:YEAR,manualCapture:true});
  }

  function markNotApplicable(){latest.professorTutor={sourceId:'professorTutor',label:defs.professorTutor.label,status:'unavailable',timestamp:now(),records:0,datasets:0,coverage:'unavailable',school:latest.alunoPresente?.school||latest.superbi?.school||''};errors.delete('professorTutor');saveMeta();schedule();}
  function fixSchool(id){const current=latest[id];if(!current)return;const value=clean(window.prompt('Informe o nome da escola desta captura:',current.school==='Não identificada'?'':current.school)||'');if(!value)return;current.school=value;saveMeta();schedule();}

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.matches('[data-session-action="connect"],#app [data-a="connect"]')){e.preventDefault();e.stopImmediatePropagation();post('DIAG_REQUEST_PORTAL',{activate:true,manualCapture:true});return;}
    const sourceId=b.dataset.manualCapture||(b.dataset.sessionSource&&defs[b.dataset.sessionSource]?b.dataset.sessionSource:'');if(sourceId&&defs[sourceId]){e.preventDefault();e.stopImmediatePropagation();startCapture(sourceId);return;}
    if(b.dataset.manualNa==='professorTutor'){e.preventDefault();e.stopImmediatePropagation();markNotApplicable();return;}
    if(b.dataset.schoolFix){e.preventDefault();e.stopImmediatePropagation();fixSchool(b.dataset.schoolFix);return;}
    if(b.hasAttribute('data-generate-overview')){e.preventDefault();e.stopImmediatePropagation();generateOverview();return;}
    if(b.matches('#app [data-a="collect"],[data-session-action="all"],[data-session-action="new"]')){e.preventDefault();e.stopImmediatePropagation();return;}
  },true);

  window.addEventListener('message',e=>{
    if(e.source!==window)return;const d=e.data;if(!d||typeof d!=='object'||d.source!==EXT)return;
    if(d.type==='DF_SESSION'){const next=!!d.session?.loggedIn;if(next!==loggedIn){loggedIn=next;schedule();}else syncTopStatus();return;}
    if(d.type==='DF_READY'){schedule();return;}
    if(!active||d.requestId!==active.requestId)return;
    const id=active.sourceId;
    if(d.type==='DF_SOURCE_SESSION_PROGRESS'){const next=clean(d.progress?.text||d.stage||'Captando a tela atual...');if(next&&next!==active.text){active.text=next;paintSlot(id);}return;}
    if(d.type==='DF_SOURCE_SESSION_DATA'){loggedIn=true;active.data=d.payload?.data||d.data||d.payload||{};syncTopStatus();return;}
    if(d.type==='DF_SOURCE_SESSION_COMPLETE'){const data=d.payload?.data||d.data||active.data||{},coverage=clean(d.coverage||d.payload?.coverage||'complete');finalize(id,data,coverage);return;}
    if(d.type==='DF_SOURCE_SESSION_UNAVAILABLE'){active=null;errors.set(id,{message:'Esta fonte não está disponível na tela atual. Abra a fonte correta no Escola Total e tente novamente.',technical:technicalFrom(d)});schedule();return;}
    if(d.type==='DF_SOURCE_SESSION_ERROR'){active=null;errors.set(id,{message:clean(d.error||d.payload?.error||d.payload?.reason||'Não consegui localizar uma tabela carregada nesta tela.'),technical:technicalFrom(d)});schedule();return;}
  },true);

  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1)))schedule();}).observe(root,{childList:true,subtree:true});
  setTimeout(()=>{post('DIAG_REQUEST_PING');post('DIAG_REQUEST_SESSION');schedule();},250);
})();
