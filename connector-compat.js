(()=>{
  'use strict';

  if (window.__DF_CONNECTOR_COMPAT__) return;
  window.__DF_CONNECTOR_COMPAT__ = true;

  const PAGE_SOURCE = 'diagnostico-facil';
  const APP_SOURCE = 'ure-sat-conector';

  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const send = (type, extra = {}) => window.postMessage({
    source: PAGE_SOURCE,
    type,
    event: type,
    requestId: extra.requestId || id('compat'),
    timestamp: Date.now(),
    ...extra
  }, location.origin);

  const forward = (type, original, extra = {}) => window.postMessage({
    source: APP_SOURCE,
    type,
    requestId: original?.requestId || original?.context?.requestId || '',
    timestamp: original?.timestamp || Date.now(),
    __dfCompat: true,
    ...extra
  }, location.origin);

  const payload = d => d?.payload ?? d?.data ?? {};
  const context = d => d?.context ?? payload(d)?.context ?? {};
  const version = d => d?.version || d?.extensionVersion || d?.manifest?.version || payload(d)?.version || payload(d)?.extensionVersion || '';

  function pingLegacy(){
    const requestId = id('ping');
    send('PING_EXTENSION', { requestId });
  }

  function checkLegacySession(){
    const requestId = id('session');
    send('CHECK_SESSION', { requestId });
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || typeof d !== 'object' || d.__dfCompat) return;

    const evt = String(d.type || d.event || '').trim().toUpperCase();
    if (!evt) return;

    if (evt === 'EXTENSION_READY') {
      forward('EXTRACTOR_READY', d, {
        version: version(d) || 'legado',
        protocol: d.protocol || payload(d)?.protocol || 'legacy-compatible'
      });
      setTimeout(checkLegacySession, 100);
      return;
    }

    if (evt === 'SESSION_READY') {
      const p = payload(d);
      const c = context(d);
      const session = d.session || p.session || {
        loggedIn: true,
        currentUre: c.ure || c.region || '',
        currentSchool: c.school || '',
        currentTurma: c.turma || c.className || '',
        path: c.path || p.path || ''
      };
      forward('ESCOLA_TOTAL_SESSION', d, { session: { ...session, loggedIn: session.loggedIn !== false } });
      return;
    }

    if (evt === 'SESSION_REQUIRED') {
      forward('ESCOLA_TOTAL_LOGIN_REQUIRED', d, {});
      return;
    }

    if (evt === 'SESSION_ERROR') {
      forward('ESCOLA_TOTAL_ERROR', d, { error: d.error || payload(d)?.error || 'Não foi possível verificar a sessão do Escola Total.' });
      return;
    }

    if (evt === 'CAPTURE_DATA' || evt === 'CAPTURE_PARTIAL') {
      forward('ESCOLA_TOTAL_CAPTURE_DATA', d, { payload: payload(d) });
      return;
    }

    if (evt === 'CAPTURE_PROGRESS' || evt === 'CAPTURE_STARTED') {
      forward('ESCOLA_TOTAL_FULL_CAPTURE_PROGRESS', d, {
        progress: d.progress || payload(d)?.progress || { text: d.message || 'Captando dados...' },
        context: context(d)
      });
      return;
    }

    if (evt === 'CAPTURE_COMPLETE') {
      forward('ESCOLA_TOTAL_FULL_CAPTURE_COMPLETE', d, {
        payload: payload(d),
        progress: d.progress || payload(d)?.progress
      });
      return;
    }

    if (evt === 'CAPTURE_ERROR') {
      forward('ESCOLA_TOTAL_ERROR', d, { error: d.error || payload(d)?.error || d.message || 'Falha na captura.' });
      return;
    }

    if (evt === 'CONTEXT_CHANGED') {
      const c = context(d);
      if (c.ure || c.school) {
        forward('ESCOLA_TOTAL_SESSION', d, {
          session: {
            loggedIn: true,
            currentUre: c.ure || '',
            currentSchool: c.school || '',
            currentTurma: c.turma || c.className || ''
          }
        });
      }
    }
  });

  pingLegacy();
  setTimeout(pingLegacy, 400);
  setTimeout(pingLegacy, 1200);
  setTimeout(checkLegacySession, 1800);
  setInterval(pingLegacy, 8000);
})();
