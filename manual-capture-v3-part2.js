  function flattenRows(data){
    const out=[];
    for(const [datasetKey,dataset] of Object.entries(data?.datasets||{}))for(const row of dataset?.rows||[])out.push({...row,__dataset:datasetKey});
    if(Array.isArray(data?.dataset?.rows))for(const row of data.dataset.rows)out.push({...row,__dataset:data.dataset.key||'dataset'});
    return out;
  }
  function rowsCount(data){return flattenRows(data).length;}
  function datasetCount(data){return Object.values(data?.datasets||{}).filter(d=>Array.isArray(d?.rows)&&d.rows.length).length+(Array.isArray(data?.dataset?.rows)&&data.dataset.rows.length?1:0);}
  function headersFrom(rows){const set=new Set();for(const row of rows.slice(0,300))for(const key of Object.keys(row||{}))if(!key.startsWith('__'))set.add(key);return [...set];}
  function inferSchool(data){
    const context=data?.context||{};let school=clean(context.school||context.currentSchool||'');if(school)return school;
    for(const row of flattenRows(data).slice(0,500))for(const [k,v] of Object.entries(row||{}))if(/escola|unidade escolar|nome da escola/i.test(k)&&clean(v)){school=clean(v);break;}
    return school||'Não identificada';
  }
  function inferUre(data){return clean(data?.context?.ure||'')||'SANTO ANASTÁCIO';}
  function coverageOf(data,requested=''){const c=clean(data?.powerbi?.coverage||data?.coverage||requested||'complete');return /partial|visible|unclassified/i.test(c)?'partial':'complete';}
  function detectedKeys(data){return Object.keys(data?.datasets||{});}

  function cardBySlot(id){
    const def=defs[id];if(!def)return null;
    if(def.pp)return document.querySelector(`[data-pp-slot="${id}"]`);
    return document.querySelector(`[data-session-source="${def.cardId}"]`)?.closest('.dfso-card')||null;
  }
  function parentCard(id){const def=defs[id];return def?.pp?document.querySelector('[data-session-source="provaPaulista"]')?.closest('.dfso-card'):cardBySlot(id);}

  function guideHtml(id){
    const d=defs[id];return `<details class="df-manual-guide"><summary>Como capturar</summary><ol>${(d?.guide||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`;
  }

  function ensureStyle(){if(document.getElementById('df-manual-v3-css'))return;const st=document.createElement('style');st.id='df-manual-v3-css';st.textContent=`
#app .filters,#app .conn,#df-bootstrap-box{display:none!important}.dfso-controls label,[data-session-action="new"],[data-session-action="all"]{display:none!important}.dfso-controls{grid-template-columns:auto!important;justify-content:start}.df-manual-guide{margin-top:8px;border-top:1px dashed #d8e2ed;padding-top:6px}.df-manual-guide summary{cursor:pointer;color:#315d88;font-size:7.5px;font-weight:850}.df-manual-guide ol{margin:6px 0 0 17px;padding:0;color:#62788e;font-size:7.2px;line-height:1.55}.df-pp-subcards{display:grid;gap:6px;margin-top:8px}.df-pp-slot{padding:8px;border:1px solid #dfe7ef;border-radius:8px;background:#fff}.df-pp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.df-pp-row b{font-size:8px;color:#284963}.df-manual-status{font-size:7px;font-weight:850}.df-manual-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.df-manual-actions button,.df-pp-slot button{height:27px;padding:0 8px;border:1px solid #d4deea;border-radius:7px;background:#fff;color:#31536f;font-size:7.4px;font-weight:800}.df-manual-actions .danger{color:#7c5c15;background:#fff9e9}.df-manual-error{margin-top:7px;padding:7px;border-radius:7px;background:#fff0f1;color:#8e3f46;font-size:7.4px;line-height:1.45}.df-manual-tech{margin-top:5px}.df-manual-tech summary{cursor:pointer;font-weight:800}.df-overview-source{display:grid;grid-template-columns:1.4fr .7fr .8fr;gap:8px;padding:7px 0;border-bottom:1px solid #edf1f5;font-size:7.8px}.df-overview-source:last-child{border-bottom:0}.df-overview-source b{color:#294762}.df-overview-generate{margin-top:9px;height:31px;padding:0 10px;border:0;border-radius:7px;background:#1859b7;color:#fff;font-size:8px;font-weight:850}.df-school-fix{margin-top:5px;height:25px;padding:0 7px;border:1px solid #d4deea;border-radius:6px;background:#fff;color:#31536f;font-size:7px;font-weight:800}`;document.head.appendChild(st);}

  function ensureShell(){
    let host=document.getElementById('df-session-center');
    if(host)return host;
    const main=document.querySelector('#app main');if(!main)return null;
    const anchor=main.querySelector('.filters')||main.querySelector('.hero');
    host=document.createElement('section');host.id='df-session-center';
    host.innerHTML=`<div class="dfso-head"><div><h2>Captura manual guiada</h2><p>Você controla o Escola Total. O Diagnóstico somente lê e salva a tela que ficou aberta.</p></div><span class="dfso-badge">Aguardando conexão</span></div><div class="dfso-controls"><button data-session-action="connect">Conectar Escola Total</button></div><div class="dfso-source-grid">${[
      ['superbi','📊','Super BI'],['alunoPresente','🧑‍🎓','Aluno Presente'],['recomposicao','🧩','Recomposição'],['provaPaulista','📝','Provas Paulistas'],['multiplica','✳️','Multiplica'],['pra','🎯','PDA'],['professorTutor','👩‍🏫','Professor Tutor']
    ].map(([id,icon,label])=>`<article class="dfso-card pending"><div class="dfso-title"><span>${icon}</span><b>${label}</b><span class="dfso-state">○ Pendente</span></div><p>Abra esta fonte no Escola Total, aguarde os dados e volte para capturar.</p><div class="dfso-meta"><span>0 registros</span><span>0 conjunto(s)</span></div><button data-session-source="${id}">Capturar tela atual</button></article>`).join('')}</div><div class="dfso-overview"></div>`;
    if(anchor)anchor.insertAdjacentElement('afterend',host);else main.prepend(host);
    return host;
  }

  function ensureManualInfo(){
    const host=document.getElementById('df-session-center');if(!host)return;
    let info=document.getElementById('df-manual-info');
    if(!info){info=document.createElement('div');info.id='df-manual-info';info.style.cssText='margin:0 15px 12px;padding:11px 13px;border:1px solid #cfe0f1;border-radius:9px;background:#f7fbff;color:#315778;font-size:8.5px;line-height:1.55';const controls=host.querySelector('.dfso-controls');(controls||host.firstElementChild)?.insertAdjacentElement('afterend',info);}
    setHtml(info,`<strong>Modo manual de captura</strong><br><b>1.</b> Conecte ao Escola Total. <b>2.</b> Lá, escolha manualmente a escola, a fonte e os filtros. <b>3.</b> Aguarde os dados aparecerem. <b>4.</b> Volte aqui e clique em <b>Capturar tela atual</b>. O Diagnóstico não muda escola, fonte, filtro ou página sozinho.`);
  }
