(()=>{
  'use strict';

  if (window.__DF_CONNECTOR_COMPAT__) return;
  window.__DF_CONNECTOR_COMPAT__ = true;

  const PAGE_SOURCE = 'diagnostico-facil';
  const APP_SOURCE = 'ure-sat-conector';
  const PORTAL = 'https://escolatotal.educacao.sp.gov.br/';
  const RELOAD_KEY = 'df-context-recovery-v1';

  let modernReady = false;
  let legacyReady = false;
  let sessionReady = false;
  let portalKnown = false;
  let portalOpenRequested = false;
  let lastSessionProbe = 0;

  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const post = message => window.postMessage(message, location.origin);
  const payload = d => d?.payload ?? d?.data ?? {};
  const context = d => d?.context ?? payload(d)?.context ?? {};
  const version = d => d?.version || d?.extensionVersion || d?.manifest?.version || payload(d)?.version || payload(d)?.extensionVersion || '';
  const eventName = d => String(d?.type || d?.event || '').trim().toUpperCase();
  const errorText = d => String(d?.error || payload(d)?.error || payload(d)?.reason || d?.message || '');

  function modern(type, extra={}) {
    post({source:PAGE_SOURCE,type,requestId:extra.requestId||id('modern'),timestamp:Date.now(),__dfCompatRequest:true,...extra});
  }

  function legacy(event, extra={}) {
    post({source:PAGE_SOURCE,type:event,event,requestId:extra.requestId||id('legacy'),timestamp:Date.now(),context:extra.context||{},payload:extra.payload||{},__dfCompatRequest:true});
  }

  function forward(type, original, extra={}) {
    post({source:APP_SOURCE,type,requestId:original?.requestId||original?.context?.requestId||'',timestamp:original?.timestamp||Date.now(),__dfCompat:true,...extra});
  }

  function rowsToObjects(p) {
    const headers = Array.isArray(p?.headers) ? p.headers : [];
    const rows = Array.isArray(p?.rows) ? p.rows : [];
    return rows.map(row => {
      if (row && !Array.isArray(row) && typeof row === 'object') return {...row};
      const out = {};
      headers.forEach((h,i) => { out[String(h || `col_${i+1}`)] = row?.[i] ?? ''; });
      if (p?.school && !out.Escola) out.Escola = p.school;
      if (p?.turma && !out.Turma) out.Turma = p.turma;
      if (p?.period && !out.Periodo) out.Periodo = p.period;
      return out;
    });
  }

  function wrappedDataset(d) {
    const p = payload(d);
    return {
      dataset: {
        key: 'presenca',
        label: 'Frequencia / Aluno Presente',
        rows: rowsToObjects(p),
        coverage: p.coverage || (eventName(d)==='CAPTURE_COMPLETE' ? 'complete' : 'partial'),
        capturedAt: p.capturedAt || new Date().toISOString()
      },
      legacy: true,
      context: {
        ure: p.ure || '',
        school: p.school || '',
        turma: p.turma || '',
        period: p.period || ''
      }
    };
  }

  function recoverInvalidContext(d) {
    if (!/extension context invalidated/i.test(errorText(d))) return false;
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return true;
    sessionStorage.setItem(RELOAD_KEY,'1');
    setTimeout(()=>location.reload(),350);
    return true;
  }

  function requestPortal() {
    if (portalOpenRequested) return;
    portalOpenRequested = true;
    modern('DIAG_REQUEST_PORTAL',{activate:false,auto:true});
    legacy('CHECK_PORTAL');
    setTimeout(()=>{
      if (!portalKnown) legacy('OPEN_PORTAL',{payload:{url:PORTAL,activate:false}});
    },900);
  }

  function requestSession(force=false) {
    const now = Date.now();
    if (!force && now-lastSessionProbe < 2200) return;
    lastSessionProbe = now;
    modern('DIAG_REQUEST_SESSION',{includeSchools:true,auto:true});
    modern('DIAG_REQUEST_PORTAL_CATALOG',{auto:true});
    legacy('CHECK_SESSION');
  }

  function health() {
    modern('DIAG_REQUEST_PING',{auto:true});
    modern('DIAG_REQUEST_HEALTH_CHECK',{mode:'aluno-presente',auto:true});
    legacy('PING');
    legacy('CHECK_EXTENSION');
    if (!portalKnown) legacy('CHECK_PORTAL');
    if (!sessionReady) requestSession();
  }

  function afterReady() {
    requestPortal();
    requestSession(true);
    setTimeout(()=>{
      modern('DIAG_REQUEST_HEALTH_CHECK',{mode:'aluno-presente',auto:true});
      legacy('CHECK_SOURCE',{payload:{expectedSource:'aluno-presente'}});
    },650);
  }

  function sanitizeUi() {
    document.querySelectorAll('[data-a="demo"]').forEach(el=>el.remove());
  }

  const uiObserver = new MutationObserver(sanitizeUi);
  if (document.documentElement) uiObserver.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || typeof d !== 'object' || d.__dfCompat) return;

    const evt = eventName(d);
    if (!evt) return;

    if (recoverInvalidContext(d)) return;

    const isPageRequest = d.source === PAGE_SOURCE && !d.__dfCompatRequest;
    if (isPageRequest && !modernReady) {
      if (evt === 'DIAG_REQUEST_PING') legacy('PING',{requestId:d.requestId});
      if (evt === 'DIAG_REQUEST_SESSION') legacy('CHECK_SESSION',{requestId:d.requestId});
      if (evt === 'DIAG_REQUEST_PORTAL_CATALOG') legacy('CHECK_PORTAL',{requestId:d.requestId});
      if (evt === 'DIAG_REQUEST_PORTAL') legacy(d.activate ? 'OPEN_PORTAL' : 'CHECK_PORTAL',{requestId:d.requestId});
      if (evt === 'DIAG_REQUEST_HEALTH_CHECK') {
        legacy('PING',{requestId:d.requestId});
        legacy('CHECK_PORTAL');
        legacy('CHECK_SESSION');
        legacy('CHECK_SOURCE',{payload:{expectedSource:'aluno-presente'}});
      }
    }

    if (evt === 'DF_READY') {
      modernReady = true;
      sessionStorage.removeItem(RELOAD_KEY);
      afterReady();
      return;
    }

    if (evt === 'DF_SESSION' || evt === 'ESCOLA_TOTAL_SESSION') {
      modernReady = true;
      const sess = d.session || payload(d)?.session || {};
      if (sess.loggedIn === true) {
        sessionReady = true;
        portalKnown = true;
        sessionStorage.removeItem(RELOAD_KEY);
        modern('DIAG_REQUEST_PORTAL_CATALOG',{auto:true});
        modern('DIAG_REQUEST_HEALTH_CHECK',{mode:'aluno-presente',auto:true});
      }
      return;
    }

    if (evt === 'DF_CATALOG') {
      modernReady = true;
      if (!sessionReady) requestSession();
      return;
    }

    if (evt === 'EXTENSION_READY') {
      legacyReady = true;
      sessionStorage.removeItem(RELOAD_KEY);
      forward('EXTRACTOR_READY',d,{version:version(d)||'legado',protocol:d.protocol||payload(d)?.protocol||'legacy-compatible'});
      afterReady();
      return;
    }

    if (evt === 'PORTAL_FOUND') {
      portalKnown = true;
      requestSession(true);
      return;
    }

    if (evt === 'PORTAL_NOT_FOUND') {
      portalKnown = false;
      if (!portalOpenRequested) requestPortal();
      else legacy('OPEN_PORTAL',{payload:{url:PORTAL,activate:false}});
      return;
    }

    if (evt === 'SESSION_READY') {
      legacyReady = true;
      sessionReady = true;
      portalKnown = true;
      const p = payload(d);
      const c = context(d);
      const sess = d.session || p.session || {
        loggedIn:true,
        currentUre:c.ure || p.ure || '',
        currentSchool:c.school || p.school || '',
        currentTurma:c.turma || p.turma || '',
        path:c.path || p.path || '',
        portalUrl:p.url || ''
      };
      forward('ESCOLA_TOTAL_SESSION',d,{session:{...sess,loggedIn:true}});
      legacy('CHECK_SOURCE',{payload:{expectedSource:'aluno-presente'}});
      return;
    }

    if (evt === 'SESSION_REQUIRED') {
      sessionReady = false;
      portalKnown = !/aba escola total nao encontrada/i.test(errorText(d));
      forward('ESCOLA_TOTAL_LOGIN_REQUIRED',d,{});
      if (!portalKnown) requestPortal();
      setTimeout(()=>requestSession(true),2600);
      return;
    }

    if (evt === 'SESSION_ERROR') {
      sessionReady = false;
      setTimeout(()=>requestSession(true),2600);
      return;
    }

    if (evt === 'SOURCE_DETECTED') {
      const p = payload(d);
      forward('ESCOLA_TOTAL_DIAGNOSTIC',d,{diagnostic:{stages:[{status:'ok',label:`Fonte detectada: ${p.source||'aluno-presente'}`,detail:`Confianca ${p.confidence??'-'}%`} ]}});
      return;
    }

    if (evt === 'CONTEXT_CHANGED') {
      const p = payload(d);
      const c = {...context(d),...p};
      if (c.ure || c.school || c.turma) {
        forward('ESCOLA_TOTAL_SESSION',d,{session:{loggedIn:true,currentUre:c.ure||'',currentSchool:c.school||'',currentTurma:c.turma||''}});
      }
      return;
    }

    if (evt === 'CAPTURE_DATA' || evt === 'CAPTURE_PARTIAL') {
      const wrapped = wrappedDataset(d);
      forward('ESCOLA_TOTAL_CAPTURE_DATA',d,{payload:wrapped});
      return;
    }

    if (evt === 'CAPTURE_PROGRESS' || evt === 'CAPTURE_STARTED') {
      forward('ESCOLA_TOTAL_FULL_CAPTURE_PROGRESS',d,{progress:d.progress||payload(d)?.progress||{text:d.message||'Captando dados...'},context:context(d)});
      return;
    }

    if (evt === 'CAPTURE_COMPLETE') {
      const wrapped = wrappedDataset(d);
      if (wrapped.dataset.rows.length) forward('ESCOLA_TOTAL_CAPTURE_DATA',d,{payload:wrapped});
      forward('ESCOLA_TOTAL_FULL_CAPTURE_COMPLETE',d,{payload:wrapped,progress:d.progress||payload(d)?.progress});
      return;
    }

    if (evt === 'CAPTURE_ERROR') {
      if (/session|login|aba escola total/i.test(errorText(d))) {
        sessionReady = false;
        requestSession(true);
      }
      return;
    }
  });

  sanitizeUi();
  health();
  setTimeout(health,500);
  setTimeout(health,1400);
  setInterval(()=>{
    modern('DIAG_REQUEST_PING',{auto:true});
    legacy('PING');
    if (!sessionReady) {
      requestPortal();
      requestSession();
    }
  },4000);
})();
