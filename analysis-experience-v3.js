(()=>{
  'use strict';
  if(window.__DF_ANALYSIS_EXPERIENCE_V3__)return;
  window.__DF_ANALYSIS_EXPERIENCE_V3__=true;

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let timer=null;

  function ensureCss(){
    if(document.getElementById('df-analysis-experience-v3-css'))return;
    const st=document.createElement('style');
    st.id='df-analysis-experience-v3-css';
    st.textContent=`
#df-pa-root{--pa-navy:#102f57;--pa-blue:#1f5f9f;--pa-cyan:#5cb6d6;--pa-ink:#23384e;--pa-soft:#f4f8fb;--pa-line:#dce6ef;--pa-green:#15775f;--pa-amber:#a96f11;--pa-red:#ad4652;gap:14px!important}
#df-pa-root .pa-toolbar{position:sticky;top:72px;z-index:8;display:flex!important;align-items:center!important;gap:5px!important;padding:7px!important;border:1px solid #d8e4ed!important;border-radius:14px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 9px 28px rgba(30,61,95,.07)!important;backdrop-filter:blur(10px)}
#df-pa-root .pa-toolbar:before{content:'LEITURA';display:inline-flex;align-items:center;height:28px;padding:0 8px;border-radius:8px;background:#edf4fa;color:#49667f;font-size:6.5px;font-weight:950;letter-spacing:.14em}
#df-pa-root .pa-toolbar select{height:30px!important;min-width:190px!important;border-color:#d5e0e9!important;background:#f9fbfd!important;font-weight:800!important}
#df-pa-root .pa-toolbar button{height:30px!important;padding:0 9px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#58728a!important;font-size:7.2px!important}
#df-pa-root .pa-toolbar button:hover{background:#f0f5f9!important;color:#244d72!important}
#df-pa-root .pa-toolbar button.on{background:var(--pa-navy)!important;color:#fff!important;box-shadow:0 4px 12px rgba(16,47,87,.15)!important}
#df-pa-root .pa-hero{position:relative;overflow:hidden;padding:24px 26px 25px!important;border-radius:18px!important;background:linear-gradient(125deg,#102f57 0%,#174e7b 58%,#2f769d 100%)!important;box-shadow:0 16px 36px rgba(25,61,98,.17)!important}
#df-pa-root .pa-hero:after{content:'';position:absolute;right:-60px;top:-90px;width:250px;height:250px;border-radius:50%;border:46px solid rgba(255,255,255,.055)}
#df-pa-root .pa-hero .ey{position:relative;z-index:1;display:inline-flex!important;align-items:center;gap:6px;margin:0 0 8px!important;padding:5px 8px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.08);color:#d9eef8!important;font-size:6.8px!important;letter-spacing:.12em!important}
#df-pa-root .pa-hero h2{position:relative;z-index:1;margin:0 0 8px!important;font-size:23px!important;font-weight:850!important;letter-spacing:-.025em!important}
#df-pa-root .pa-hero p{position:relative;z-index:1;max-width:1050px!important;color:#e6f0f7!important;font-size:9.2px!important;line-height:1.72!important}
#df-pa-root .pa-v3-brief{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:-3px}
#df-pa-root .pa-v3-brief-card{min-height:110px;padding:12px 13px;border:1px solid var(--pa-line);border-radius:13px;background:#fff;box-shadow:0 7px 20px rgba(35,60,88,.045)}
#df-pa-root .pa-v3-brief-card .num{display:grid;place-items:center;width:24px;height:24px;margin-bottom:9px;border-radius:8px;background:#edf4fa;color:#305c80;font-size:8px;font-weight:950}
#df-pa-root .pa-v3-brief-card span{display:block;margin-bottom:4px;color:#75899b;font-size:6.4px;font-weight:950;letter-spacing:.1em}
#df-pa-root .pa-v3-brief-card strong{display:block;color:#1f3c58;font-size:9.3px;line-height:1.45}
#df-pa-root .pa-v3-brief-card small{display:block;margin-top:5px;color:#778a9d;font-size:7px;line-height:1.45}
#df-pa-root .pa-v3-section-title{display:flex;align-items:center;gap:8px;margin:2px 0 -4px;padding:0 2px;color:#24435f;font-size:8px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
#df-pa-root .pa-v3-section-title:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,#d6e3ed,transparent)}
#df-pa-root .pa-panel{border:1px solid var(--pa-line)!important;border-radius:14px!important;box-shadow:0 8px 22px rgba(30,55,82,.045)!important}
#df-pa-root .pa-panel h3{font-size:11.5px!important;font-weight:850!important;letter-spacing:-.01em!important}
#df-pa-root .pa-panel>p{max-width:980px;color:#72879a!important;font-size:7.7px!important;line-height:1.55!important}
#df-pa-root .pa-grid{gap:8px!important}
#df-pa-root .pa-k{position:relative;overflow:hidden;min-height:90px;border:1px solid #e0e8ef!important;border-radius:12px!important;background:linear-gradient(180deg,#fff,#fbfdff)!important}
#df-pa-root .pa-k:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:#dce9f2}
#df-pa-root .pa-k .pa-good,#df-pa-root .pa-k b.pa-good{color:var(--pa-green)!important}
#df-pa-root .pa-k .pa-bad,#df-pa-root .pa-k b.pa-bad{color:var(--pa-red)!important}
#df-pa-root .pa-k span{color:#7c8fa0!important;font-size:6.2px!important}
#df-pa-root .pa-k b{color:#173c5d!important;font-size:17px!important}
#df-pa-root .pa-explain{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
#df-pa-root .pa-explain>div{position:relative;padding:12px 12px 12px 15px!important;border:1px solid #dfe9f1!important;border-left:0!important;border-radius:10px!important;background:#f8fbfd!important;color:#334e66!important;font-size:8px!important;line-height:1.65!important}
#df-pa-root .pa-explain>div:before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:#4f91b8}
#df-pa-root .pa-cols{gap:10px!important}
#df-pa-root .pa-list{gap:7px!important}
#df-pa-root .pa-item{border:1px solid #e2eaf0!important;border-radius:10px!important;background:#fcfdfe!important;padding:10px!important;font-size:7.5px!important}
#df-pa-root .pa-actions{gap:8px!important}
#df-pa-root .pa-action{min-height:50px;padding:11px 12px 11px 38px!important;border:1px solid #dce7ef!important;border-radius:11px!important;background:linear-gradient(180deg,#fafdff,#f5f9fc)!important;color:#304b63!important;font-size:7.8px!important;line-height:1.55!important}
#df-pa-root .pa-action:before{left:10px!important;top:11px!important;width:20px!important;height:20px!important;border-radius:7px!important;background:#174e7b!important}
#df-pa-root .pa-table{border-radius:11px!important;border-color:#dfe7ee!important;box-shadow:inset 0 1px 0 #fff}
#df-pa-root .pa-table th{background:#edf3f7!important;color:#496278!important;font-size:6.7px!important;letter-spacing:.02em}
#df-pa-root .pa-table td{font-size:7.25px!important}
#df-pa-root .pa-level-grid{gap:9px!important}
#df-pa-root .pa-level{position:relative;overflow:hidden;border-radius:12px!important;background:linear-gradient(180deg,#fff,#fbfcfd)!important}
#df-pa-root .pa-level:after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:#dce6ef}
#df-pa-root .pa-level h4{font-size:8px!important}
#df-pa-root .pa-level b{color:#183c5b!important;font-size:18px!important}
#df-pa-root .pa-note{border-radius:10px!important;background:#fffaf0!important}
#df-pa-root .pa-v3-decision{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
#df-pa-root .pa-v3-decision>div{position:relative;padding:12px 12px 12px 36px;border:1px solid #dce6ee;border-radius:11px;background:#fff;color:#365169;font-size:7.7px;line-height:1.55}
#df-pa-root .pa-v3-decision>div:before{position:absolute;left:10px;top:11px;display:grid;place-items:center;width:18px;height:18px;border-radius:6px;background:#eaf2f7;color:#285775;font-size:9px;font-weight:900}
#df-pa-root .pa-v3-decision>div:nth-child(1):before{content:'1'}#df-pa-root .pa-v3-decision>div:nth-child(2):before{content:'2'}#df-pa-root .pa-v3-decision>div:nth-child(3):before{content:'3'}
#df-pa-root .pa-v3-footer-note{padding:9px 11px;border:1px dashed #ccdce8;border-radius:10px;background:#f9fbfd;color:#6a8093;font-size:6.9px;line-height:1.5}
@media(max-width:1050px){#df-pa-root .pa-v3-brief{grid-template-columns:repeat(2,1fr)}#df-pa-root .pa-explain{grid-template-columns:1fr!important}}
@media(max-width:720px){#df-pa-root .pa-toolbar{position:static;display:grid!important;grid-template-columns:1fr 1fr}#df-pa-root .pa-toolbar:before{display:none}#df-pa-root .pa-toolbar select{min-width:0!important;grid-column:1/-1}#df-pa-root .pa-v3-brief,#df-pa-root .pa-v3-decision{grid-template-columns:1fr}.pa-hero h2{font-size:19px!important}}
`;
    document.head.appendChild(st);
  }

  function insertTitle(before,text){
    if(!before||before.previousElementSibling?.classList?.contains('pa-v3-section-title'))return;
    const el=document.createElement('div');el.className='pa-v3-section-title';el.textContent=text;before.insertAdjacentElement('beforebegin',el);
  }

  function briefFromView(root){
    if(root.querySelector('.pa-v3-brief'))return;
    const hero=root.querySelector('.pa-hero');if(!hero)return;
    const explain=[...root.querySelectorAll('.pa-explain>div')].map(x=>clean(x.textContent)).filter(Boolean);
    const positive=[...root.querySelectorAll('.pa-cols .pa-panel:first-child .pa-item')].map(x=>clean(x.textContent)).filter(Boolean);
    const alert=[...root.querySelectorAll('.pa-cols .pa-panel:last-child .pa-item')].map(x=>clean(x.textContent)).filter(Boolean);
    const actions=[...root.querySelectorAll('.pa-actions .pa-action')].map(x=>clean(x.textContent)).filter(Boolean);
    if(!(explain.length||positive.length||alert.length||actions.length))return;

    const cards=[
      ['SITUAÇÃO ATUAL',explain[0]||'A leitura atual ainda está sendo consolidada.','O que os dados mais recentes mostram.'],
      ['MOVIMENTO',explain[1]||positive[0]||'Ainda não há comparação suficiente para explicar a evolução.','Como os resultados estão se deslocando.'],
      ['PONTO DE ATENÇÃO',alert[0]||explain[2]||'Nenhum alerta prioritário foi identificado na base atual.','Onde a equipe deve concentrar a leitura.'],
      ['PRÓXIMA DECISÃO',actions[0]||'Complete as capturas para receber um encaminhamento mais específico.','Ação pedagógica mais imediata sugerida.']
    ];
    const box=document.createElement('section');box.className='pa-v3-brief';
    box.innerHTML=cards.map((c,i)=>`<article class="pa-v3-brief-card"><div class="num">0${i+1}</div><span>${esc(c[0])}</span><strong>${esc(c[1])}</strong><small>${esc(c[2])}</small></article>`).join('');
    hero.insertAdjacentElement('afterend',box);
  }

  function decisionFlow(root){
    if(root.querySelector('.pa-v3-decision')||!root.querySelector('.pa-actions'))return;
    const acts=[...root.querySelectorAll('.pa-actions .pa-action')].map(x=>clean(x.textContent)).filter(Boolean);
    if(!acts.length)return;
    const panel=root.querySelector('.pa-actions')?.closest('.pa-panel');if(!panel)return;
    const box=document.createElement('div');box.className='pa-v3-decision';
    const items=[acts[0]||'Identificar a prioridade.',acts[1]||'Organizar a intervenção.',acts[2]||'Monitorar a próxima evidência.'];
    box.innerHTML=items.map(x=>`<div>${esc(x)}</div>`).join('');
    panel.insertAdjacentElement('afterend',box);
  }

  function labelSections(root){
    const panels=[...root.querySelectorAll(':scope > .pa-panel,:scope > .pa-cols,:scope > .pa-grid')];
    for(const el of panels){
      const h=clean(el.querySelector('h3')?.textContent||'');
      if(/O que os resultados/i.test(h))insertTitle(el,'Interpretação');
      else if(/Destaques positivos|Pontos de atenção/i.test(h))insertTitle(el,'Leitura qualitativa');
      else if(/Prioridades|encaminhamentos|Plano de ação/i.test(h))insertTitle(el,'Decisão pedagógica');
      else if(/Ranking|Turmas prioritárias|Análise por Ano/i.test(h))insertTitle(el,'Onde agir');
      else if(/Trajetória|Comparativo|SARESP/i.test(h))insertTitle(el,'Evolução');
      else if(/Proficiência/i.test(h))insertTitle(el,'Níveis de aprendizagem');
      else if(/Prova Paulista por todas as disciplinas/i.test(h))insertTitle(el,'Componentes curriculares');
    }
  }

  function addFooter(root){
    if(root.querySelector('.pa-v3-footer-note'))return;
    const n=document.createElement('div');n.className='pa-v3-footer-note';n.textContent='Leitura pedagógica gerada somente com os dados capturados. Relações entre frequência, desempenho, PDA, recomposição e tutoria são sinais para investigação e não devem ser interpretadas automaticamente como causa.';
    root.appendChild(n);
  }

  function adapt(){
    ensureCss();
    const root=document.getElementById('df-pa-root');if(!root)return;
    root.dataset.experience='v3';
    const hero=root.querySelector('.pa-hero');if(hero){const ey=hero.querySelector('.ey');if(ey)ey.textContent='CADERNO DE LEITURA PEDAGÓGICA · DIAGNÓSTICO FÁCIL';}
    briefFromView(root);
    decisionFlow(root);
    labelSections(root);
    addFooter(root);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(adapt,80);}
  const app=document.getElementById('app')||document.documentElement;
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule();}).observe(app,{childList:true,subtree:true});
  window.addEventListener('df-analysis-synced',schedule);
  setTimeout(adapt,180);
})();
