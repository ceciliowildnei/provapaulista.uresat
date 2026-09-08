(()=>{
  'use strict';
  if(window.__DF_MANUAL_CAPTURE_MODE_V3__)return;
  window.__DF_MANUAL_CAPTURE_MODE__=true;
  window.__DF_MANUAL_CAPTURE_MODE_V3__=true;

  const SITE='diagnostico-facil';
  const EXT='ure-sat-conector';
  const META_STORE='df-manual-capture-meta-v3';
  const DB_NAME='df-manual-captures-v3';
  const DB_VERSION=1;
  const YEAR=2026;

  const defs={
    superbi:{label:'Super BI',mode:'super-bi',cardId:'superbi',guide:['Abra o Escola Total.','Entre no Super BI.','Escolha manualmente a escola e os filtros.','Aguarde os dados aparecerem.','Volte ao Diagnóstico e clique em Capturar tela atual.']},
    alunoPresente:{label:'Aluno Presente',mode:'aluno-presente',cardId:'alunoPresente',guide:['Abra o Escola Total.','Entre em Aluno Presente.','Selecione manualmente a escola e a visão desejada.','Aguarde a tabela carregar.','Volte e capture a tela atual.']},
    recomposicao:{label:'Recomposição',mode:'recomposicao',cardId:'recomposicao',guide:['Abra o Escola Total.','Abra Recomposição.','Escolha manualmente a escola.','Deixe a tabela ou visual desejado carregado.','Volte e capture. Tabelas genéricas serão preservadas como Recomposição Geral.']},
    pp1:{label:'Prova Paulista 1',mode:'prova-paulista',cardId:'provaPaulista',pp:true,guide:['Abra a Prova Paulista correspondente à PP1.','Escolha manualmente a escola e filtros.','Aguarde os resultados.','Volte e capture PP1.']},
    pp2:{label:'Prova Paulista 2',mode:'prova-paulista',cardId:'provaPaulista',pp:true,guide:['Abra a Prova Paulista correspondente à PP2.','Escolha manualmente a escola e filtros.','Aguarde os resultados.','Volte e capture PP2.']},
    pp3:{label:'Prova Paulista 3',mode:'prova-paulista',cardId:'provaPaulista',pp:true,guide:['Abra a Prova Paulista correspondente à PP3.','Escolha manualmente a escola e filtros.','Aguarde os resultados.','Volte e capture PP3.']},
    pda:{label:'PDA',mode:'pda',cardId:'pra',guide:['Abra o Escola Total.','Abra PDA / Plano de Ação / Planejamento.','Escolha manualmente a escola.','Aguarde o painel carregar.','Volte e capture.']},
    professorTutor:{label:'Professor Tutor',mode:'professor-tutor',cardId:'professorTutor',conditional:true,guide:['Se a escola possui Professor Tutor, abra essa fonte no Escola Total.','Selecione manualmente a escola/filtros.','Aguarde a tabela carregar.','Volte e capture.','Se a escola não possui o projeto, use o botão Não se aplica.']}
  };
  const topIds=['superbi','alunoPresente','recomposicao','pp1','pp2','pp3','pda','professorTutor'];
  let latest={};try{latest=JSON.parse(localStorage.getItem(META_STORE)||'{}')||{}}catch{latest={}}
  if(latest.multiplica){delete latest.multiplica;try{localStorage.setItem(META_STORE,JSON.stringify(latest));}catch{}}
  const errors=new Map();
  let active=null,loggedIn=false,renderTimer=null,dbPromise=null;

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now=()=>new Date().toISOString();
  const fmt=v=>{try{return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}catch{return clean(v)}};
  const rid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const post=(type,extra={})=>window.postMessage({source:SITE,type,requestId:extra.requestId||rid('manual'),manualCapture:true,...extra},location.origin);
  const setText=(el,v)=>{if(el&&el.textContent!==v)el.textContent=v;};
  const setHtml=(el,v)=>{if(el&&el.innerHTML!==v)el.innerHTML=v;};

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('captures')){const s=db.createObjectStore('captures',{keyPath:'captureId'});s.createIndex('sourceId','sourceId',{unique:false});s.createIndex('timestamp','timestamp',{unique:false});s.createIndex('school','school',{unique:false});}};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Falha ao abrir armazenamento local.'));
    });
    return dbPromise;
  }
  function saveMeta(){localStorage.setItem(META_STORE,JSON.stringify(latest));}
  async function persistCapture(capture){
    const db=await openDb();
    await new Promise((resolve,reject)=>{const tx=db.transaction('captures','readwrite');tx.objectStore('captures').put(capture);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Falha ao salvar captura.'));});
    latest[capture.sourceId]={captureId:capture.captureId,sourceId:capture.sourceId,label:capture.sourceLabel,school:capture.school,ure:capture.ure,timestamp:capture.timestamp,coverage:capture.coverage,records:capture.records,datasets:Object.keys(capture.datasets||{}).length,status:'saved'};
    saveMeta();
  }
