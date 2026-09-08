  function ensurePpSlots(){
    const card=parentCard('pp1');if(!card)return;
    const old=card.querySelector('[data-session-source="provaPaulista"]');if(old)old.style.display='none';
    let box=card.querySelector('.df-pp-subcards');if(!box){box=document.createElement('div');box.className='df-pp-subcards';card.appendChild(box);}
    const html=['pp1','pp2','pp3'].map(id=>`<div class="df-pp-slot" data-pp-slot="${id}"><div class="df-pp-row"><b>${esc(defs[id].label)}</b><span class="df-manual-status" data-slot-status>○ Pendente</span></div><div data-slot-message style="margin-top:4px;color:#718397;font-size:7.2px">Abra ${esc(defs[id].label)} no Escola Total e capture a tela atual.</div><div class="df-manual-actions"><button data-manual-capture="${id}">Capturar tela atual</button></div>${guideHtml(id)}<div data-slot-extra></div></div>`).join('');
    if(box.dataset.ready!=='1'){box.innerHTML=html;box.dataset.ready='1';}
  }

  function ensureCards(){
    for(const id of ['superbi','alunoPresente','recomposicao','pda','professorTutor']){
      const card=cardBySlot(id);if(!card)continue;const d=defs[id];
      setText(card.querySelector('.dfso-title b'),d.label);
      const old=card.querySelector(`[data-session-source="${d.cardId}"]`);if(old){old.dataset.manualCapture=id;old.disabled=false;setText(old,'Capturar tela atual');}
      if(!card.querySelector('.df-manual-guide'))card.insertAdjacentHTML('beforeend',guideHtml(id));
      if(id==='professorTutor'&&!card.querySelector('[data-manual-na]')){const wrap=document.createElement('div');wrap.className='df-manual-actions';wrap.innerHTML='<button class="danger" data-manual-na="professorTutor">Esta escola não possui Professor Tutor</button>';card.appendChild(wrap);}
      if(!card.querySelector('[data-slot-extra]')){const ex=document.createElement('div');ex.dataset.slotExtra='1';card.appendChild(ex);}
    }
    ensurePpSlots();
  }

  function statusFor(id){
    if(active?.sourceId===id)return {kind:'capturing',label:'🔄 Captando',message:active.text||'Lendo a tela atual...'};
    if(errors.has(id))return {kind:'error',label:'⚠️ Erro',message:errors.get(id).message};
    const m=latest[id];
    if(m?.status==='unavailable')return {kind:'unavailable',label:'○ Não se aplica',message:'Esta escola foi marcada como sem Professor Tutor.'};
    if(m?.status==='saved')return {kind:m.coverage==='partial'?'partial':'complete',label:m.coverage==='partial'?'🟡 Parcial':'✅ Salvo',message:`Captura salva${m.school&&m.school!=='Não identificada'?` · ${m.school}`:''}.`};
    return {kind:'pending',label:'○ Pendente',message:'Abra esta fonte no Escola Total, aguarde os dados e volte para capturar.'};
  }

  function paintSlot(id){
    const st=statusFor(id),slot=cardBySlot(id);if(!slot)return;
    if(defs[id].pp){
      setText(slot.querySelector('[data-slot-status]'),st.label);setText(slot.querySelector('[data-slot-message]'),st.message);const btn=slot.querySelector('[data-manual-capture]');if(btn){btn.disabled=st.kind==='capturing';setText(btn,st.kind==='capturing'?'Capturando…':errors.has(id)?'Tentar novamente':'Capturar tela atual');}renderExtra(id,slot.querySelector('[data-slot-extra]'));return;
    }
    const card=slot;['pending','capturing','complete','partial','error','unavailable'].forEach(c=>card.classList.toggle(c,c===st.kind));setText(card.querySelector('.dfso-state'),st.label);setText(card.querySelector('p'),st.message);
    const btn=card.querySelector(`[data-manual-capture="${id}"]`);if(btn){btn.disabled=st.kind==='capturing';setText(btn,st.kind==='capturing'?'Capturando…':errors.has(id)?'Tentar captura novamente':'Capturar tela atual');}
    const meta=latest[id];if(meta?.status==='saved'){const html=`<span>${Number(meta.records||0).toLocaleString('pt-BR')} registros</span><span>${Number(meta.datasets||0)} conjunto(s)</span><span>${fmt(meta.timestamp)}</span>${meta.school?`<span>${esc(meta.school)}</span>`:''}`;const el=card.querySelector('.dfso-meta');setHtml(el,html);}
    renderExtra(id,card.querySelector('[data-slot-extra]'));
  }

  function renderExtra(id,host){
    if(!host)return;const err=errors.get(id),meta=latest[id];let html='';
    if(err){html+=`<div class="df-manual-error"><strong>Não foi possível validar esta captura.</strong><br>${esc(err.message)}<br><br><b>O que fazer:</b> volte ao Escola Total, confirme que a fonte e a tabela estão carregadas, volte aqui e tente novamente.${err.technical?`<details class="df-manual-tech"><summary>Detalhes técnicos</summary><pre style="white-space:pre-wrap;font-size:6.8px">${esc(err.technical)}</pre></details>`:''}</div>`;}
    if(meta?.status==='saved'&&(!meta.school||meta.school==='Não identificada'))html+=`<div style="margin-top:6px;color:#8a6517;font-size:7.2px">⚠️ Escola não identificada automaticamente.<br><button class="df-school-fix" data-school-fix="${id}">Informar escola</button></div>`;
    setHtml(host,html);
  }

  function renderOverview(){
    const host=document.querySelector('#df-session-center .dfso-overview');if(!host)return;
    const available=topIds.filter(id=>latest[id]?.status!=='unavailable');const savedIds=available.filter(id=>latest[id]?.status==='saved');const rows=savedIds.reduce((n,id)=>n+Number(latest[id]?.records||0),0);const schools=[...new Set(savedIds.map(id=>latest[id]?.school).filter(x=>x&&x!=='Não identificada'))];
    host.innerHTML=`<h3>Visão Geral Consolidada</h3><div class="dfso-kpis"><div><span>FONTES SALVAS</span><b>${savedIds.length}/${available.length}</b></div><div><span>REGISTROS</span><b>${rows.toLocaleString('pt-BR')}</b></div><div><span>ESCOLA</span><b style="font-size:9px">${esc(schools[0]||'—')}</b></div><div><span>PP1</span><b>${latest.pp1?.status==='saved'?'✓':'—'}</b></div><div><span>PP2</span><b>${latest.pp2?.status==='saved'?'✓':'—'}</b></div><div><span>PP3</span><b>${latest.pp3?.status==='saved'?'✓':'—'}</b></div></div><div style="margin-top:10px">${topIds.map(id=>{const st=statusFor(id),m=latest[id];return `<div class="df-overview-source"><b>${esc(defs[id].label)}</b><span>${st.label}</span><span>${m?.status==='saved'?`${Number(m.records||0).toLocaleString('pt-BR')} registros`:st.kind==='unavailable'?'Não se aplica':'—'}</span></div>`}).join('')}</div><button class="df-overview-generate" data-generate-overview>Gerar visão geral</button><div id="df-overview-analysis" class="dfso-summary" style="margin-top:9px">Somente capturas realmente salvas entram nesta visão.</div>`;
  }

  function generateOverview(){
    const savedIds=topIds.filter(id=>latest[id]?.status==='saved');const rows=savedIds.reduce((n,id)=>n+Number(latest[id]?.records||0),0);const parts=[];
    if(latest.alunoPresente?.status==='saved')parts.push(`Aluno Presente: ${Number(latest.alunoPresente.records||0).toLocaleString('pt-BR')} registros`);
