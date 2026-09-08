(()=>{
  'use strict';
  if(window.__DF_PEDAGOGICAL_ANALYSIS_V2__)return;
  window.__DF_PEDAGOGICAL_ANALYSIS_V2__=true;

  const STORE='df-inteligencia-v2';
  const TAB='analisePedagogica';
  let timer=null;

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>{const s=clean(v);if(!s)return null;let n=Number(s.replace('%','').replace(',','.').replace(/[^0-9.-]/g,''));if(!Number.isFinite(n))return null;if(!s.includes('%')&&Math.abs(n)<=1)n*=100;return Math.max(0,Math.min(100,n));};
  const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((t,n)=>t+n,0)/x.length:null;};
  const fmt=n=>Number.isFinite(n)?`${n.toFixed(1).replace('.',',')}%`:'—';
  const delta=n=>Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(1).replace('.',',')} p.p.`:'—';
  const uniq=a=>[...new Set(a.filter(Boolean))];

  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')?.biSummary||{};}catch{return{};}}
  function rows(summary,key){return summary?.datasets?.[key]?.rows||[];}
  function val(r,names){const entries=Object.entries(r||{}).filter(([k])=>!k.startsWith('__'));for(const name of names){const hit=entries.find(([k])=>fold(k)===fold(name));if(hit)return hit[1];}for(const name of names){const hit=entries.find(([k])=>fold(k).includes(fold(name)));if(hit)return hit[1];}return'';}
  function school(r){return clean(val(r,['Escola','Unidade Escolar','Nome da Escola']))||'Escola não identificada';}
  function turma(r){return clean(val(r,['Turma','Classe','Sala','Turma atual']))||'Turma não identificada';}
  function student(r){return clean(val(r,['Nome','Nome do Aluno','Aluno','Estudante','Aluno(a)']));}
  function ra(r){return clean(val(r,['RA','NR RA','Registro do Aluno','Matrícula','Matricula','Id'])).replace(/\D/g,'');}
  function subject(r){return fold(val(r,['Componente','Disciplina','Componente Curricular']));}
  function prof(r){return clean(val(r,['Nível de Proficiência','Nivel de Proficiencia','Proficiência','Proficiencia','Nível','Nivel']));}
  function ppScore(r,sub){
    const aliases=sub==='lp'?['PORT','Português','Língua Portuguesa','LP','Desempenho LP','Percentual LP','Nota LP']:['MAT','Matemática','Desempenho MAT','Percentual MAT','Nota MAT'];
    let n=null;
    for(const a of aliases){n=pct(val(r,[a]));if(Number.isFinite(n))return n;}
    const s=subject(r);
    if((sub==='lp'&&(s.includes('portug')||s==='lp'))||(sub==='mat'&&s.includes('matem')))return pct(val(r,['Percentual','Desempenho','Aproveitamento','Nota','Resultado']));
    return null;
  }
  function attendance(r){return pct(val(r,['Frequência Anual','Frequencia Anual','% Presença Anual','Presença Anual','Frequência','Frequencia','Presença']));}
  function planning(r){return pct(val(r,['Percentual de Planejamento','Planejamento','PDA','Plano de Ação','Execução','Realização']));}

  function rowId(r){return ra(r)||`${fold(school(r))}|${fold(turma(r))}|${fold(student(r))}`;}
  function latestPP(summary){return rows(summary,'pp3').length?'pp3':rows(summary,'pp2').length?'pp2':rows(summary,'pp1').length?'pp1':null;}
  function prevPP(summary,k){return k==='pp3'?(rows(summary,'pp2').length?'pp2':'pp1'):k==='pp2'?'pp1':null;}

  function schools(summary){return uniq(Object.values(summary.datasets||{}).flatMap(d=>d?.rows||[]).map(school)).filter(x=>fold(x)!=='escola nao identificada').sort((a,b)=>a.localeCompare(b,'pt-BR'));}

  function classMetric(summary,schoolName,className){
    const latest=latestPP(summary),prev=prevPP(summary,latest);
    const f=(key)=>rows(summary,key).filter(r=>school(r)===schoolName&&turma(r)===className);
    const cur=latest?f(latest):[],before=prev?f(prev):[];
    const curPerf=avg([avg(cur.map(r=>ppScore(r,'lp'))),avg(cur.map(r=>ppScore(r,'mat')))]);
    const prevPerf=avg([avg(before.map(r=>ppScore(r,'lp'))),avg(before.map(r=>ppScore(r,'mat')))]);
    const freq=avg(f('presenca').map(attendance));
    const pda=avg([...f('pda'),...f('planejamento')].map(planning));
    const students=uniq([...cur,...before,...f('presenca')].map(rowId)).filter(Boolean).length;
    return{className,perf:curPerf,delta:Number.isFinite(curPerf)&&Number.isFinite(prevPerf)?curPerf-prevPerf:null,freq,pda,students};
  }

  function studentTransitions(summary,schoolName){
    const latest=latestPP(summary),prev=prevPP(summary,latest);if(!latest||!prev)return[];
    const map=new Map();
    for(const r of rows(summary,prev).filter(x=>school(x)===schoolName)){
      const id=rowId(r);if(!id)continue;const x=map.get(id)||{id,name:student(r)||`RA ${ra(r)}`,ra:ra(r),turma:turma(r),from:[],to:[]};x.from.push(ppScore(r,'lp'),ppScore(r,'mat'));map.set(id,x);
    }
    for(const r of rows(summary,latest).filter(x=>school(x)===schoolName)){
      const id=rowId(r);if(!id)continue;const x=map.get(id)||{id,name:student(r)||`RA ${ra(r)}`,ra:ra(r),turma:turma(r),from:[],to:[]};x.to.push(ppScore(r,'lp'),ppScore(r,'mat'));map.set(id,x);
    }
    return[...map.values()].map(x=>{const a=avg(x.from),b=avg(x.to);return{...x,fromAvg:a,toAvg:b,delta:Number.isFinite(a)&&Number.isFinite(b)?b-a:null};}).filter(x=>Number.isFinite(x.delta));
  }

  function proficiencyRouting(summary,schoolName){
    const all=Object.entries(summary.datasets||{}).flatMap(([k,d])=>(d?.rows||[]).map(r=>({...r,__dataset:k}))).filter(r=>school(r)===schoolName);
    const out={below:0,basic:0,proficient:0,total:0};
    const seen=new Set();
    for(const r of all){const p=fold(prof(r));if(!p)continue;const id=`${rowId(r)}|${p}`;if(seen.has(id))continue;seen.add(id);out.total++;if(/abaixo|insuficiente|muito baixo/.test(p))out.below++;else if(/basico|básico/.test(p))out.basic++;else if(/proficiente|avancado|avançado/.test(p))out.proficient++;}
    return out;
  }

  function analyze(summary,schoolName){
    const all=Object.values(summary.datasets||{}).flatMap(d=>d?.rows||[]).filter(r=>school(r)===schoolName);
    const classes=uniq(all.map(turma)).filter(x=>fold(x)!=='turma nao identificada');
    const cm=classes.map(c=>classMetric(summary,schoolName,c));
    const perf=avg(cm.map(x=>x.perf)),evolution=avg(cm.map(x=>x.delta)),freq=avg(cm.map(x=>x.freq)),pda=avg(cm.map(x=>x.pda));
    const transitions=studentTransitions(summary,schoolName);
    const advanced=transitions.filter(x=>x.delta>=5),maintained=transitions.filter(x=>x.delta>-5&&x.delta<5),regressed=transitions.filter(x=>x.delta<=-5);
    const route=proficiencyRouting(summary,schoolName);
    const priority=cm.filter(x=>Number.isFinite(x.perf)||Number.isFinite(x.freq)).sort((a,b)=>{
      const sa=(Number.isFinite(a.perf)?a.perf:100)+(Number.isFinite(a.freq)?a.freq:100)*.35;
      const sb=(Number.isFinite(b.perf)?b.perf:100)+(Number.isFinite(b.freq)?b.freq:100)*.35;
      return sa-sb;
    });
    const best=cm.filter(x=>Number.isFinite(x.delta)).sort((a,b)=>b.delta-a.delta);
    const criticalFreq=cm.filter(x=>Number.isFinite(x.freq)&&x.freq<75);
    const attentionFreq=cm.filter(x=>Number.isFinite(x.freq)&&x.freq>=75&&x.freq<90);
    const metaFreq=cm.filter(x=>Number.isFinite(x.freq)&&x.freq>=90);
    return{schoolName,classes:cm,perf,evolution,freq,pda,transitions,advanced,maintained,regressed,route,priority,best,criticalFreq,attentionFreq,metaFreq};
  }

  function recommendation(a){
    const rec=[];
    if(a.criticalFreq.length)rec.push(`Ação imediata de busca ativa e acompanhamento de frequência em ${a.criticalFreq.slice(0,4).map(x=>x.className).join(', ')}, pois estão abaixo de 75%.`);
    if(a.attentionFreq.length)rec.push(`Plano de prevenção de infrequência em ${a.attentionFreq.slice(0,4).map(x=>x.className).join(', ')}, buscando elevar as turmas para a meta URE de 90% ou mais.`);
    if(a.regressed.length)rec.push(`Revisar nominalmente os ${a.regressed.length} estudante(s) que regrediram 5 p.p. ou mais entre as provas comparáveis e verificar habilidades recorrentes.`);
    if(a.priority.length)rec.push(`Priorizar acompanhamento pedagógico das turmas ${a.priority.slice(0,3).map(x=>x.className).join(', ')} na próxima rotina de observação e planejamento.`);
    if(a.route.below)rec.push(`${a.route.below} classificação(ões) em Abaixo do Básico: direcionar/confirmar atendimento pelo Professor Tutor no componente correspondente.`);
    if(a.route.basic)rec.push(`${a.route.basic} classificação(ões) em Básico: direcionar para Eletivas de Fundamentos no componente correspondente.`);
    if(a.route.proficient)rec.push(`${a.route.proficient} classificação(ões) Proficiente/Avançado: preservar aprofundamento e Super Eletivas quando compatível com a organização da escola.`);
    if(!rec.length)rec.push('A base atual ainda não permite um encaminhamento específico. Complete as capturas por turma para ampliar a precisão da análise.');
    return rec;
  }

  function narrative(a){
    const bits=[];
    if(Number.isFinite(a.perf))bits.push(`O desempenho médio mais recente disponível é ${fmt(a.perf)}.`);
    if(Number.isFinite(a.evolution))bits.push(`Na comparação com a avaliação anterior, a variação média é ${delta(a.evolution)}.`);
    if(Number.isFinite(a.freq))bits.push(`A frequência média das turmas com dado disponível é ${fmt(a.freq)}.`);
    if(a.transitions.length)bits.push(`Há ${a.transitions.length} estudante(s) comparáveis: ${a.advanced.length} avançaram, ${a.maintained.length} mantiveram desempenho e ${a.regressed.length} regrediram pelo critério de ±5 p.p.`);
    if(a.best[0]?.delta>=5)bits.push(`O maior avanço entre as turmas aparece em ${a.best[0].className}, com ${delta(a.best[0].delta)}.`);
    if(a.priority[0])bits.push(`A turma que merece a primeira leitura pedagógica é ${a.priority[0].className}${Number.isFinite(a.priority[0].perf)?`, com desempenho ${fmt(a.priority[0].perf)}`:''}${Number.isFinite(a.priority[0].freq)?` e frequência ${fmt(a.priority[0].freq)}`:''}.`);
    return bits.join(' ')||'A base capturada ainda não possui indicadores comparáveis suficientes para uma síntese automática.';
  }

  function ensureCss(){
    if(document.getElementById('df-pedagogical-analysis-css'))return;
    const st=document.createElement('style');st.id='df-pedagogical-analysis-css';st.textContent=`
#df-pa-root{display:grid;gap:12px}.pa-hero{padding:20px 22px;border-radius:15px;background:linear-gradient(135deg,#0d3f83,#1859b7);color:#fff;box-shadow:0 12px 28px rgba(20,70,145,.16)}.pa-hero .ey{font-size:7.5px;color:#bcd8f7}.pa-hero h2{margin:5px 0 7px;font-size:21px;letter-spacing:-.02em}.pa-hero p{max-width:1000px;margin:0;color:#e2edfb;font-size:9.5px;line-height:1.6}.pa-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pa-k{padding:12px;border:1px solid #e0e7ef;border-radius:10px;background:#fff}.pa-k span{display:block;color:#75879b;font-size:6.5px;font-weight:900;letter-spacing:.08em}.pa-k b{display:block;margin-top:5px;color:#183f68;font-size:18px}.pa-k small{display:block;margin-top:3px;color:#8a98a8;font-size:6.8px}.pa-panel{padding:14px;border:1px solid #e0e7ef;border-radius:12px;background:#fff;box-shadow:0 6px 20px rgba(20,48,84,.05)}.pa-panel h3{margin:0 0 4px;color:#183f68;font-size:12px}.pa-panel>p{margin:0 0 10px;color:#6d8196;font-size:8px;line-height:1.5}.pa-cols{display:grid;grid-template-columns:1.1fr .9fr;gap:10px}.pa-list{display:grid;gap:6px}.pa-item{padding:9px;border:1px solid #e5ebf2;border-radius:8px;background:#fbfcfe}.pa-item strong{font-size:8.5px;color:#294762}.pa-item span{float:right;font-size:8px;font-weight:850}.pa-item small{display:block;margin-top:3px;color:#7b8da0;font-size:7px}.pa-good{color:#14886f}.pa-warn{color:#a86c08}.pa-bad{color:#b94b55}.pa-actions{counter-reset:n;display:grid;gap:7px}.pa-action{position:relative;padding:10px 10px 10px 34px;border:1px solid #dce6f0;border-radius:9px;background:#f8fbff;color:#36536e;font-size:8px;line-height:1.5}.pa-action:before{counter-increment:n;content:counter(n);position:absolute;left:9px;top:9px;display:grid;place-items:center;width:18px;height:18px;border-radius:6px;background:#1859b7;color:#fff;font-size:7px;font-weight:900}.pa-route{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.pa-route>div{padding:9px;border:1px solid #e1e8ef;border-radius:8px;background:#fbfcfe}.pa-route span{display:block;color:#7d8fa2;font-size:6.5px;font-weight:900}.pa-route b{display:block;margin-top:4px;color:#244764;font-size:14px}.pa-route small{display:block;margin-top:2px;color:#8494a5;font-size:6.8px}.pa-table{overflow:auto;border:1px solid #e0e7ef;border-radius:9px}.pa-table table{width:100%;min-width:680px;border-collapse:collapse}.pa-table th{padding:8px;background:#eef3f8;color:#38526b;font-size:7px;text-align:left}.pa-table td{padding:8px;border-top:1px solid #edf1f5;color:#334e68;font-size:7.6px}.pa-school-tabs{display:flex;gap:5px;flex-wrap:wrap}.pa-school-tabs button{height:28px;padding:0 8px;border:1px solid #d5dfeb;border-radius:999px;background:#fff;color:#31536f;font-size:7px;font-weight:850}.pa-school-tabs button.on{background:#1859b7;border-color:#1859b7;color:#fff}@media(max-width:980px){.pa-grid{grid-template-columns:repeat(2,1fr)}.pa-cols{grid-template-columns:1fr}}@media(max-width:560px){.pa-grid,.pa-route{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
  }

  function addNav(){
    const nav=document.querySelector('#app aside nav');if(!nav||nav.querySelector(`[data-tab="${TAB}"]`))return;
    const btn=document.createElement('button');btn.dataset.tab=TAB;btn.innerHTML='<span class="ic">✦</span>Análise Pedagógica';
    const perguntas=nav.querySelector('[data-tab="perguntas"]');(perguntas||nav.lastElementChild)?.insertAdjacentElement('beforebegin',btn);
  }

  function selectedSchool(summary){
    const mainTitle=[...document.querySelectorAll('#app select[data-a="school"] option')].find(o=>o.selected)?.value||'';
    const ss=schools(summary);if(mainTitle&&mainTitle!=='Todas')return mainTitle;if(ss.length===1)return ss[0];return sessionStorage.getItem('df-pa-school')||ss[0]||'';
  }

  function renderAnalysis(){
    const summary=load(),ss=schools(summary);const main=document.querySelector('#app main');if(!main)return;
    ensureCss();
    let schoolName=selectedSchool(summary);if(!ss.includes(schoolName))schoolName=ss[0]||'';
    let root=document.getElementById('df-pa-root');
    if(!root){root=document.createElement('div');root.id='df-pa-root';main.appendChild(root);}
    if(!schoolName){root.innerHTML='<section class="empty"><div class="big">✦</div><h2>Análise Pedagógica</h2><p>Capture uma escola e suas turmas para gerar uma leitura automática.</p></section>';return;}
    const a=analyze(summary,schoolName),rec=recommendation(a),narr=narrative(a);
    const classRows=a.classes.slice().sort((x,y)=>(x.perf??999)-(y.perf??999));
    root.innerHTML=`
      <section class="pa-hero"><span class="ey">ANÁLISE PEDAGÓGICA AUTOMÁTICA</span><h2>${esc(schoolName)}</h2><p>${esc(narr)}</p></section>
      ${ss.length>1?`<section class="pa-panel"><div class="pa-school-tabs">${ss.map(s=>`<button data-pa-school="${esc(s)}" class="${s===schoolName?'on':''}">${esc(s)}</button>`).join('')}</div></section>`:''}
      <section class="pa-grid">
        <div class="pa-k"><span>DESEMPENHO ATUAL</span><b>${fmt(a.perf)}</b><small>média das turmas comparáveis</small></div>
        <div class="pa-k"><span>EVOLUÇÃO</span><b class="${(a.evolution??0)<0?'pa-bad':'pa-good'}">${delta(a.evolution)}</b><small>última comparação disponível</small></div>
        <div class="pa-k"><span>FREQUÊNCIA</span><b class="${Number.isFinite(a.freq)&&a.freq<75?'pa-bad':Number.isFinite(a.freq)&&a.freq<90?'pa-warn':'pa-good'}">${fmt(a.freq)}</b><small>meta URE: ≥90%</small></div>
        <div class="pa-k"><span>ESTUDANTES COMPARÁVEIS</span><b>${a.transitions.length}</b><small>${a.advanced.length} avançaram · ${a.regressed.length} regrediram</small></div>
      </section>
      <section class="pa-cols">
        <div class="pa-panel"><h3>Turmas prioritárias</h3><p>Ordenação pedagógica combinando resultado e frequência quando disponíveis.</p><div class="pa-list">${a.priority.slice(0,6).map((x,i)=>`<div class="pa-item"><strong>${i+1}. ${esc(x.className)}</strong><span class="${Number.isFinite(x.perf)&&x.perf<55?'pa-bad':''}">${fmt(x.perf)}</span><small>${Number.isFinite(x.delta)?`Variação ${delta(x.delta)} · `:''}${Number.isFinite(x.freq)?`Frequência ${fmt(x.freq)}`:'Frequência sem dado'} · ${x.students} estudante(s) identificados</small></div>`).join('')||'<div class="pa-item">Sem base suficiente por turma.</div>'}</div></div>
        <div class="pa-panel"><h3>Frequência e permanência</h3><p>Leitura pelas faixas usadas no acompanhamento.</p><div class="pa-list"><div class="pa-item"><strong>Crítica · abaixo de 75%</strong><span class="pa-bad">${a.criticalFreq.length}</span><small>${esc(a.criticalFreq.map(x=>x.className).join(', ')||'Nenhuma turma com dado nessa faixa')}</small></div><div class="pa-item"><strong>Atenção · 75% a 89,9%</strong><span class="pa-warn">${a.attentionFreq.length}</span><small>${esc(a.attentionFreq.map(x=>x.className).join(', ')||'Nenhuma turma com dado nessa faixa')}</small></div><div class="pa-item"><strong>Meta URE · 90% ou mais</strong><span class="pa-good">${a.metaFreq.length}</span><small>${esc(a.metaFreq.map(x=>x.className).join(', ')||'Nenhuma turma com dado nessa faixa')}</small></div></div></div>
      </section>
      <section class="pa-panel"><h3>Trajetória entre avaliações</h3><p>Critério operacional: avanço ≥5 p.p.; manutenção entre -5 e +5 p.p.; regressão ≤-5 p.p.</p><div class="pa-grid"><div class="pa-k"><span>AVANÇARAM</span><b class="pa-good">${a.advanced.length}</b><small>${a.transitions.length?fmt(100*a.advanced.length/a.transitions.length):'—'} dos comparáveis</small></div><div class="pa-k"><span>MANTIVERAM</span><b>${a.maintained.length}</b><small>${a.transitions.length?fmt(100*a.maintained.length/a.transitions.length):'—'} dos comparáveis</small></div><div class="pa-k"><span>REGREDIRAM</span><b class="pa-bad">${a.regressed.length}</b><small>${a.transitions.length?fmt(100*a.regressed.length/a.transitions.length):'—'} dos comparáveis</small></div><div class="pa-k"><span>MAIOR AVANÇO DE TURMA</span><b class="pa-good">${a.best[0]?delta(a.best[0].delta):'—'}</b><small>${esc(a.best[0]?.className||'Sem comparação')}</small></div></div></section>
      <section class="pa-panel"><h3>Encaminhamento pela proficiência</h3><p>Aplicado somente quando a captura contém nível de proficiência reconhecível.</p><div class="pa-route"><div><span>ABAIXO DO BÁSICO</span><b>${a.route.below}</b><small>Professor Tutor no componente correspondente</small></div><div><span>BÁSICO</span><b>${a.route.basic}</b><small>Eletivas de Fundamentos</small></div><div><span>PROFICIENTE / AVANÇADO</span><b>${a.route.proficient}</b><small>Aprofundamento / Super Eletivas</small></div></div></section>
      <section class="pa-panel"><h3>O que fazer agora</h3><p>Prioridades geradas a partir dos dados realmente disponíveis.</p><div class="pa-actions">${rec.map(r=>`<div class="pa-action">${esc(r)}</div>`).join('')}</div></section>
      <section class="pa-panel"><h3>Leitura completa por turma</h3><p>Use esta tabela para organizar acompanhamento, devolutiva e pauta de formação.</p><div class="pa-table"><table><thead><tr><th>Turma</th><th>Desempenho</th><th>Variação</th><th>Frequência</th><th>PDA</th><th>Estudantes</th></tr></thead><tbody>${classRows.map(x=>`<tr><td><strong>${esc(x.className)}</strong></td><td>${fmt(x.perf)}</td><td class="${(x.delta??0)<0?'pa-bad':'pa-good'}">${delta(x.delta)}</td><td class="${Number.isFinite(x.freq)&&x.freq<75?'pa-bad':Number.isFinite(x.freq)&&x.freq<90?'pa-warn':'pa-good'}">${fmt(x.freq)}</td><td>${fmt(x.pda)}</td><td>${x.students}</td></tr>`).join('')}</tbody></table></div></section>
    `;
  }

  function enter(){
    const main=document.querySelector('#app main');if(!main)return;
    [...main.children].forEach(el=>{if(el.id!=='df-pa-root')el.dataset.paHidden='1',el.style.display='none';});
    renderAnalysis();
  }
  function leave(){document.querySelectorAll('#app main [data-pa-hidden="1"]').forEach(el=>{el.style.display='';delete el.dataset.paHidden;});document.getElementById('df-pa-root')?.remove();}

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.tab===TAB){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('#app aside nav button').forEach(x=>x.classList.toggle('on',x===b));enter();return;}
    if(b.dataset.tab&&b.dataset.tab!==TAB){leave();return;}
    if(b.dataset.paSchool){sessionStorage.setItem('df-pa-school',b.dataset.paSchool);renderAnalysis();return;}
  },true);

  function apply(){addNav();const on=document.querySelector(`#app aside nav [data-tab="${TAB}"].on`);if(on)renderAnalysis();}
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length))schedule();}).observe(root,{childList:true,subtree:true});
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,120);}
  schedule();
})();
