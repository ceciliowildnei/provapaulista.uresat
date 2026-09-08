(()=>{
  'use strict';
  if(window.__DF_PEDAGOGICAL_ANALYSIS_V2__)return;
  window.__DF_PEDAGOGICAL_ANALYSIS_V2__=true;

  const STORE='df-inteligencia-v2';
  const TAB='analisePedagogica';
  const STATE_KEY='df-pa-state-v3';
  const PP_KEYS=['pp1','pp2','pp3'];
  const DIAG_KEYS=['diagnostica1','diagnostica2','diagnostica3','diagnostica','diagnosticas'];
  const DISC={
    LP:{label:'Língua Portuguesa',aliases:['LP','LPT','PORT','PORTUGUES','PORTUGUÊS','LINGUA PORTUGUESA','LÍNGUA PORTUGUESA']},
    MAT:{label:'Matemática',aliases:['MAT','MT','MATEMATICA','MATEMÁTICA']},
    CIE:{label:'Ciências',aliases:['CIE','CIENCIAS','CIÊNCIAS','CIENCIAS DA NATUREZA','CIÊNCIAS DA NATUREZA','CNT']},
    HIS:{label:'História',aliases:['HIS','HISTORIA','HISTÓRIA']},
    GEO:{label:'Geografia',aliases:['GEO','GEOGRAFIA']},
    ING:{label:'Inglês',aliases:['ING','INGLES','INGLÊS','LINGUA INGLESA','LÍNGUA INGLESA']},
    ART:{label:'Arte',aliases:['ART','ARTE','ARTES']},
    EDF:{label:'Educação Física',aliases:['EDF','ED FISICA','ED FÍSICA','EDUCACAO FISICA','EDUCAÇÃO FÍSICA']},
    FIS:{label:'Física',aliases:['FIS','FISICA','FÍSICA']},
    QUI:{label:'Química',aliases:['QUI','QUIMICA','QUÍMICA']},
    BIO:{label:'Biologia',aliases:['BIO','BIOLOGIA']},
    FIL:{label:'Filosofia',aliases:['FIL','FILOSOFIA']},
    SOC:{label:'Sociologia',aliases:['SOC','SOCIOLOGIA']}
  };
  let timer=null;
  let ui={subtab:'visao',school:'',assessment:'latestPP',discipline:'TODAS',level:'TODOS',search:''};
  try{ui={...ui,...(JSON.parse(sessionStorage.getItem(STATE_KEY)||'{}')||{})}}catch{}

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const fold=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const key=v=>fold(v).replace(/[^a-z0-9]/g,'');
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const avg=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((t,n)=>t+n,0)/x.length:null;};
  const fmt=n=>Number.isFinite(n)?`${n.toFixed(1).replace('.',',')}%`:'—';
  const delta=n=>Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(1).replace('.',',')} p.p.`:'—';
  const pct=v=>{const s=clean(v);if(!s)return null;let n=Number(s.replace('%','').replace(',','.').replace(/[^0-9.-]/g,''));if(!Number.isFinite(n))return null;if(!s.includes('%')&&Math.abs(n)<=1)n*=100;if(n>100&&n<=1000)n/=10;return Math.max(0,Math.min(100,n));};
  const saveUi=()=>sessionStorage.setItem(STATE_KEY,JSON.stringify(ui));

  function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')?.biSummary||{};}catch{return{};}}
  function rows(summary,k){return summary?.datasets?.[k]?.rows||[];}
  function datasets(summary){return summary?.datasets||{};}
  function val(r,names){
    const entries=Object.entries(r||{}).filter(([k])=>!k.startsWith('__'));
    for(const n of names){const f=fold(n);const h=entries.find(([k])=>fold(k)===f);if(h)return h[1];}
    for(const n of names){const f=fold(n);const h=entries.find(([k])=>fold(k).includes(f));if(h)return h[1];}
    return'';
  }
  function exactVal(r,names){
    const map=new Map(Object.entries(r||{}).filter(([k])=>!k.startsWith('__')).map(([k,v])=>[key(k),v]));
    for(const n of names){const k=key(n);if(map.has(k))return map.get(k);}
    return'';
  }
  function school(r){return clean(val(r,['Escola','Unidade Escolar','Nome da Escola']))||'Escola não identificada';}
  function turma(r){return clean(val(r,['Turma','Classe','Sala','Turma atual','NM_TURMA']))||'Turma não identificada';}
  function student(r){return clean(val(r,['Nome do Aluno','Nome do Estudante','Estudante','Aluno','Nome','Aluno(a)','NM_ALUNO','NM_ESTUDANTE']));}
  function ra(r){return clean(val(r,['NR RA','RA','Registro do Aluno','Matrícula','Matricula','Código do Aluno','Codigo do Aluno','CD_ALUNO','ID'])).replace(/\D/g,'');}
  function subject(r){return clean(val(r,['Componente Curricular','Componente','Disciplina','Matéria','Materia']));}
  function yearSeries(v){
    const s=fold(v).toUpperCase();
    let m=s.match(/\b([6-9])\s*(ANO|º|°|A|B|C|D|E)?\b/);if(m)return `${m[1]}º Ano`;
    m=s.match(/\b([1-3])\s*(SERIE|ª|A|B|C|D|E|EM)?\b/);if(m)return `${m[1]}ª Série EM`;
    return'Sem Ano/Série';
  }
  function rowId(r){return ra(r)||`${fold(school(r))}|${fold(turma(r))}|${fold(student(r))}`;}
  function invalidStudent(r){const n=fold(student(r));return !n&&!ra(r)||['filtros aplicados','componente','geral lp','geral lp + mat','lingua portuguesa','lp','mat','matematica','sem dado','total','totais'].includes(n);}

  function normLevel(v,score=null){
    const t=fold(v);
    if(t.includes('abaixo')||t.includes('insuficiente')||t.includes('muito baixo')||t.includes('inicial'))return'Abaixo do Básico';
    if(t.includes('basico')||t.includes('básico'))return'Básico';
    if(t.includes('proficiente')||t.includes('avancado')||t.includes('avançado')||t.includes('adequado')||t.includes('dominio'))return'Proficiente';
    if(Number.isFinite(score)){if(score<50)return'Abaixo do Básico';if(score<70)return'Básico';return'Proficiente';}
    return'SEM DADO';
  }
  const levelRank=l=>({'Abaixo do Básico':1,'Básico':2,'Proficiente':3}[l]||0);
  function movement(from,to,fromScore=null,toScore=null){
    const a=levelRank(from),b=levelRank(to);
    if(a&&b)return b>a?'AVANÇOU':b<a?'REGREDIU':'MANTEVE';
    if(Number.isFinite(fromScore)&&Number.isFinite(toScore)){const d=toScore-fromScore;return d>=5?'AVANÇOU':d<=-5?'REGREDIU':'MANTEVE';}
    return'SEM DADO';
  }

  function genericScore(r){return pct(val(r,['Percentual','Desempenho','Aproveitamento','Resultado','Nota','% Acertos','Acertos']));}
  function genericLevel(r,score=genericScore(r)){return normLevel(val(r,['Nível de Proficiência','Nivel de Proficiencia','Proficiência','Proficiencia','Nível','Nivel','Status','Nível PP','Nivel PP']),score);}
  function attendance(r){return pct(val(r,['Frequência Anual','Frequencia Anual','% Presença Anual','Presença Anual','Frequência','Frequencia','Presença','Percentual de Presença']));}
  function planning(r){return pct(val(r,['Percentual de Planejamento','Planejamento','PDA','Plano de Ação','Execução','Realização','Concluído','Concluido']));}

  function identifyDisc(name){
    const f=fold(name);
    for(const [id,d] of Object.entries(DISC))if(d.aliases.some(a=>{const x=fold(a);return f===x||f.includes(x);}))return id;
    return'';
  }
  function wideDiscData(r,id){
    const d=DISC[id];const valueNames=[],levelNames=[];
    for(const a of d.aliases){
      valueNames.push(a,`${a} %`,`% ${a}`,`ACERTOS ${a}`,`QTD ACERTOS ${a}`,`PERCENTUAL ${a}`,`NOTA ${a}`,`RESULTADO ${a}`,`DESEMPENHO ${a}`);
      levelNames.push(`STATUS ${a}`,`${a} STATUS`,`NIVEL ${a}`,`NÍVEL ${a}`,`${a} NIVEL`,`${a} NÍVEL`,`PROFICIENCIA ${a}`,`PROFICIÊNCIA ${a}`);
    }
    const raw=exactVal(r,valueNames),score=pct(raw),lv=exactVal(r,levelNames);
    if(raw===''&&lv==='')return null;
    return{score,level:normLevel(lv,score)};
  }
  function disciplineRecords(summary,datasetKey,schoolName){
    const out=[];
    for(const r of rows(summary,datasetKey).filter(x=>school(x)===schoolName&&!invalidStudent(x))){
      const sid=identifyDisc(subject(r));
      if(sid){const score=genericScore(r),level=genericLevel(r,score);out.push({datasetKey,school:school(r),year:yearSeries(turma(r)),turma:turma(r),student:student(r),ra:ra(r),discipline:DISC[sid].label,discId:sid,score,level,row:r});continue;}
      let found=false;
      for(const id of Object.keys(DISC)){const d=wideDiscData(r,id);if(!d)continue;found=true;out.push({datasetKey,school:school(r),year:yearSeries(turma(r)),turma:turma(r),student:student(r),ra:ra(r),discipline:DISC[id].label,discId:id,score:d.score,level:d.level,row:r});}
      if(!found){const score=genericScore(r),level=genericLevel(r,score);if(score!==null||level!=='SEM DADO')out.push({datasetKey,school:school(r),year:yearSeries(turma(r)),turma:turma(r),student:student(r),ra:ra(r),discipline:clean(subject(r))||'Geral',discId:'GERAL',score,level,row:r});}
    }
    return out;
  }

  function allSchools(summary){return uniq(Object.values(datasets(summary)).flatMap(d=>d?.rows||[]).map(school)).filter(x=>fold(x)!=='escola nao identificada').sort((a,b)=>a.localeCompare(b,'pt-BR'));}
  function latestPP(summary){return rows(summary,'pp3').length?'pp3':rows(summary,'pp2').length?'pp2':rows(summary,'pp1').length?'pp1':null;}
  function previousPP(summary,k){return k==='pp3'?(rows(summary,'pp2').length?'pp2':'pp1'):k==='pp2'?'pp1':null;}
  function latestDiag(summary){return [...DIAG_KEYS].reverse().find(k=>rows(summary,k).length)||null;}
  const dsLabel=k=>({pp1:'Prova Paulista 1',pp2:'Prova Paulista 2',pp3:'Prova Paulista 3',saresp:'SARESP',diagnostica1:'Diagnóstica 1',diagnostica2:'Diagnóstica 2',diagnostica3:'Diagnóstica 3',diagnostica:'Diagnóstica',diagnosticas:'Diagnóstica'}[k]||k);

  function compareRecords(a,b,labelA,labelB){
    const map=new Map();
    for(const r of a){const id=`${r.ra||fold(r.student)}|${fold(r.turma)}|${fold(r.discipline)}`;if(!map.has(id))map.set(id,{id,year:r.year,turma:r.turma,student:r.student,ra:r.ra,discipline:r.discipline,from:null,to:null});map.get(id).from=r;}
    for(const r of b){const id=`${r.ra||fold(r.student)}|${fold(r.turma)}|${fold(r.discipline)}`;if(!map.has(id))map.set(id,{id,year:r.year,turma:r.turma,student:r.student,ra:r.ra,discipline:r.discipline,from:null,to:null});map.get(id).to=r;}
    return[...map.values()].map(x=>{const f=x.from,t=x.to;return{...x,labelA,labelB,fromLevel:f?.level||'SEM DADO',toLevel:t?.level||'SEM DADO',fromScore:f?.score??null,toScore:t?.score??null,status:f&&t?movement(f.level,t.level,f.score,t.score):'SEM DADO'};});
  }

  function comparisonSets(summary,schoolName){
    const latest=latestPP(summary),prev=previousPP(summary,latest),diag=latestDiag(summary);
    const latestRec=latest?disciplineRecords(summary,latest,schoolName):[];
    const prevRec=prev?disciplineRecords(summary,prev,schoolName):[];
    const pp=latest&&prev?compareRecords(prevRec,latestRec,dsLabel(prev),dsLabel(latest)):[];
    const spp=rows(summary,'saresp').length&&latest?compareRecords(disciplineRecords(summary,'saresp',schoolName),latestRec,'SARESP',dsLabel(latest)):[];
    let three=[];
    if(rows(summary,'saresp').length&&diag&&latest){
      const sar=disciplineRecords(summary,'saresp',schoolName),dg=disciplineRecords(summary,diag,schoolName);
      const by=new Map();
      for(const rec of sar){const id=`${rec.ra||fold(rec.student)}|${fold(rec.turma)}|${fold(rec.discipline)}`;by.set(id,{id,year:rec.year,turma:rec.turma,student:rec.student,ra:rec.ra,discipline:rec.discipline,saresp:rec,diag:null,pp:null});}
      for(const rec of dg){const id=`${rec.ra||fold(rec.student)}|${fold(rec.turma)}|${fold(rec.discipline)}`;const x=by.get(id)||{id,year:rec.year,turma:rec.turma,student:rec.student,ra:rec.ra,discipline:rec.discipline,saresp:null,diag:null,pp:null};x.diag=rec;by.set(id,x);}
      for(const rec of latestRec){const id=`${rec.ra||fold(rec.student)}|${fold(rec.turma)}|${fold(rec.discipline)}`;const x=by.get(id)||{id,year:rec.year,turma:rec.turma,student:rec.student,ra:rec.ra,discipline:rec.discipline,saresp:null,diag:null,pp:null};x.pp=rec;by.set(id,x);}
      three=[...by.values()].map(x=>{const comparable=[x.saresp,x.diag,x.pp].filter(Boolean).filter(r=>levelRank(r.level));let status='SEM DADO';if(comparable.length>=2){const first=comparable[0],last=comparable[comparable.length-1];status=movement(first.level,last.level,null,null);}return{...x,status,sarDiag:x.saresp&&x.diag?movement(x.saresp.level,x.diag.level,null,null):'SEM DADO',diagPP:x.diag&&x.pp?movement(x.diag.level,x.pp.level,null,null):'SEM DADO',sarPP:x.saresp&&x.pp?movement(x.saresp.level,x.pp.level,null,null):'SEM DADO'};});
    }
    return{latest,prev,diag,latestRec,prevRec,pp,spp,three};
  }

  function transitionStats(list){const valid=list.filter(x=>x.status!=='SEM DADO'),av=valid.filter(x=>x.status==='AVANÇOU'),ma=valid.filter(x=>x.status==='MANTEVE'),re=valid.filter(x=>x.status==='REGREDIU');return{valid,av,ma,re,sem:list.length-valid.length,total:list.length};}
  function rankTurmas(comparison,latestRecords){
    const map=new Map();
    for(const x of comparison){const t=x.turma||'SEM TURMA';if(!map.has(t))map.set(t,{turma:t,total:0,avancou:0,manteve:0,regrediu:0,semdado:0,abaixo:0,basico:0,proficiente:0});const o=map.get(t);o.total++;if(x.status==='AVANÇOU')o.avancou++;else if(x.status==='MANTEVE')o.manteve++;else if(x.status==='REGREDIU')o.regrediu++;else o.semdado++;}
    for(const r of latestRecords){const t=r.turma||'SEM TURMA';if(!map.has(t))map.set(t,{turma:t,total:0,avancou:0,manteve:0,regrediu:0,semdado:0,abaixo:0,basico:0,proficiente:0});const o=map.get(t);if(r.level==='Abaixo do Básico')o.abaixo++;else if(r.level==='Básico')o.basico++;else if(r.level==='Proficiente')o.proficiente++;}
    return[...map.values()].map(o=>({...o,pctEvol:o.total?100*o.avancou/o.total:0,pctAbaixo:(o.abaixo+o.basico+o.proficiente)?100*o.abaixo/(o.abaixo+o.basico+o.proficiente):0,pctProf:(o.abaixo+o.basico+o.proficiente)?100*o.proficiente/(o.abaixo+o.basico+o.proficiente):0,indice:o.total?100*(o.avancou-o.regrediu)/o.total:0})).sort((a,b)=>b.indice-a.indice);
  }

  function contextMetrics(summary,schoolName,turmaName=''){
    const filter=r=>school(r)===schoolName&&(!turmaName||turma(r)===turmaName);
    const freq=avg(rows(summary,'presenca').filter(filter).map(attendance));
    const pda=avg([...rows(summary,'pda'),...rows(summary,'planejamento')].filter(filter).map(planning));
    const tutor=[...rows(summary,'professorTutor'),...rows(summary,'tutoriaLp'),...rows(summary,'tutoriaMat')].filter(filter).length;
    const recompo=[...rows(summary,'recomposicaoGeral'),...rows(summary,'eletivaFundamentosLp'),...rows(summary,'eletivaFundamentosMat')].filter(filter).length;
    return{freq,pda,tutor,recompo};
  }

  function analysis(summary,schoolName){
    const c=comparisonSets(summary,schoolName),stats=transitionStats(c.pp),rank=rankTurmas(c.pp,c.latestRec),context=contextMetrics(summary,schoolName);
    const levels={below:c.latestRec.filter(r=>r.level==='Abaixo do Básico'),basic:c.latestRec.filter(r=>r.level==='Básico'),prof:c.latestRec.filter(r=>r.level==='Proficiente'),sem:c.latestRec.filter(r=>r.level==='SEM DADO')};
    const latestScores=c.latestRec.map(r=>r.score).filter(Number.isFinite),perf=avg(latestScores);
    const classNames=uniq(Object.values(datasets(summary)).flatMap(d=>d?.rows||[]).filter(r=>school(r)===schoolName).map(turma)).filter(x=>fold(x)!=='turma nao identificada').sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const classDetails=classNames.map(name=>{
      const rr=rank.find(x=>x.turma===name)||{turma:name,total:0,avancou:0,manteve:0,regrediu:0,semdado:0,pctEvol:0,pctAbaixo:0,pctProf:0,indice:0};
      const cx=contextMetrics(summary,schoolName,name);const rec=c.latestRec.filter(r=>r.turma===name);const p=avg(rec.map(r=>r.score));return{...rr,perf:p,...cx,students:uniq(rec.map(r=>r.ra||r.student)).length};
    });
    return{...c,stats,rank,levels,perf,context,classDetails,schoolName};
  }

  function explainResults(a){
    const totalLevels=a.levels.below.length+a.levels.basic.length+a.levels.prof.length;
    const belowPct=totalLevels?100*a.levels.below.length/totalLevels:null,basicPct=totalLevels?100*a.levels.basic.length/totalLevels:null,profPct=totalLevels?100*a.levels.prof.length/totalLevels:null;
    const lines=[];
    if(a.latest){
      lines.push(`<b>Resultado atual.</b> A avaliação mais recente capturada é ${esc(dsLabel(a.latest))}. ${Number.isFinite(a.perf)?`A média dos resultados numéricos reconhecidos é ${fmt(a.perf)}. `:''}${totalLevels?`Na distribuição por proficiência, ${fmt(belowPct)} estão em Abaixo do Básico, ${fmt(basicPct)} em Básico e ${fmt(profPct)} em Proficiente.`:'A captura ainda não trouxe níveis de proficiência suficientes para calcular a distribuição.'}`);
    }
    if(a.stats.valid.length){
      const avp=100*a.stats.av.length/a.stats.valid.length,rep=100*a.stats.re.length/a.stats.valid.length,map=100*a.stats.ma.length/a.stats.valid.length;
      lines.push(`<b>Evolução.</b> Entre ${esc(dsLabel(a.prev))} e ${esc(dsLabel(a.latest))}, ${a.stats.valid.length} registros são comparáveis: ${fmt(avp)} avançaram, ${fmt(map)} mantiveram e ${fmt(rep)} regrediram. ${rep>avp?'O movimento de regressão supera o de avanço e exige leitura nominal dos estudantes e das habilidades envolvidas.':avp>rep?'O saldo é positivo, mas os estudantes que mantiveram ou regrediram ainda precisam de acompanhamento focalizado.':'Avanços e regressões estão equilibrados; a análise por turma e disciplina passa a ser decisiva.'}`);
    }else if(a.latest&&a.prev){lines.push(`<b>Evolução.</b> Existem duas Provas Paulistas capturadas, mas os registros ainda não apresentam chave/escala suficiente para comparação nominal confiável.`);}
    if(Number.isFinite(a.context.freq)){
      lines.push(`<b>Frequência.</b> A frequência média disponível é ${fmt(a.context.freq)}. ${a.context.freq<75?'Esse resultado está abaixo do mínimo de 75% e deve ser tratado como prioridade imediata de permanência e busca ativa.':a.context.freq<90?'A frequência supera o mínimo legal, porém ainda está abaixo da meta URE de 90%; vale investigar se as turmas de menor frequência também concentram os piores resultados.':'A escola está na faixa da meta URE de frequência. Isso é um fator favorável, mas não prova, isoladamente, a causa do desempenho.'}`);
    }
    if(a.rank.length){const best=a.rank[0],worst=[...a.rank].sort((x,y)=>x.indice-y.indice)[0],below=[...a.rank].sort((x,y)=>y.pctAbaixo-x.pctAbaixo)[0];lines.push(`<b>Turmas.</b> O melhor índice de evolução aparece em ${esc(best.turma)} (${best.indice.toFixed(1).replace('.',',')}), enquanto ${esc(worst.turma)} apresenta o menor índice (${worst.indice.toFixed(1).replace('.',',')}). ${below?.pctAbaixo?`${esc(below.turma)} concentra a maior proporção de Abaixo do Básico (${fmt(below.pctAbaixo)}).`:''}`);}
    if(a.spp.some(x=>x.status!=='SEM DADO')){const st=transitionStats(a.spp);lines.push(`<b>SARESP × Prova Paulista.</b> O sistema recuperou o comparativo direto do modelo anterior: ${st.av.length} avanço(s), ${st.ma.length} manutenção(ões), ${st.re.length} regressão(ões) e ${st.sem} registro(s) sem dado comparável.`);}
    if(a.three.some(x=>x.status!=='SEM DADO'))lines.push(`<b>Três avaliações.</b> Também foi recuperada a leitura SARESP → Diagnóstica → Prova Paulista, porém somente por níveis de proficiência normalizados. A Diagnóstica não é somada diretamente à média percentual da Prova Paulista porque utiliza uma régua própria.`);
    return lines;
  }

  function positives(a){const out=[];if(a.stats.av.length)out.push(`${a.stats.av.length} registro(s) avançaram entre as duas Provas Paulistas comparáveis.`);if(a.rank[0]?.avancou)out.push(`${a.rank[0].turma} apresenta o melhor saldo de evolução, com ${a.rank[0].avancou} avanço(s).`);if(a.levels.prof.length)out.push(`${a.levels.prof.length} registro(s) estão no nível Proficiente na avaliação mais recente.`);if(Number.isFinite(a.context.freq)&&a.context.freq>=90)out.push(`Frequência média de ${fmt(a.context.freq)}, dentro da meta URE.`);return out.length?out:['Ainda não há destaque positivo calculável com segurança na base atual.'];}
  function alerts(a){const out=[];if(a.levels.below.length)out.push(`${a.levels.below.length} registro(s) em Abaixo do Básico na avaliação mais recente.`);if(a.stats.re.length)out.push(`${a.stats.re.length} registro(s) regrediram entre as avaliações comparáveis.`);const low=a.classDetails.filter(x=>Number.isFinite(x.freq)&&x.freq<75);if(low.length)out.push(`${low.length} turma(s) estão com frequência abaixo de 75%: ${low.slice(0,5).map(x=>x.turma).join(', ')}.`);const att=a.classDetails.filter(x=>Number.isFinite(x.freq)&&x.freq>=75&&x.freq<90);if(att.length)out.push(`${att.length} turma(s) estão entre 75% e 89,9% de frequência e ainda não atingem a meta URE.`);return out.length?out:['Nenhum alerta crítico foi identificado nos campos atualmente disponíveis.'];}
  function recommendations(a){
    const out=[];
    if(a.levels.below.length)out.push(`Professor Tutor: revisar nominalmente os estudantes em Abaixo do Básico por componente, priorizando atendimento de recomposição conforme a organização da escola.`);
    if(a.levels.basic.length)out.push(`Eletivas de Fundamentos: encaminhar estudantes em nível Básico para o componente correspondente, quando compatível com a realidade da unidade.`);
    if(a.levels.prof.length)out.push(`Aprofundamento: manter estudantes Proficientes em propostas de aprofundamento/Super Eletivas, evitando retirá-los de experiências mais desafiadoras.`);
    if(a.stats.re.length)out.push(`Regressão: abrir a lista nominal dos que regrediram e verificar disciplina, turma e habilidades recorrentes antes do próximo planejamento.`);
    const pri=a.classDetails.filter(x=>Number.isFinite(x.perf)||x.regrediu||x.pctAbaixo).sort((x,y)=>((x.perf??100)+x.pctAbaixo*.3+x.regrediu*2)-((y.perf??100)+y.pctAbaixo*.3+y.regrediu*2)).slice(0,3);if(pri.length)out.push(`Acompanhamento de turma: priorizar ${pri.map(x=>x.turma).join(', ')} nas próximas devolutivas, observações e replanejamentos.`);
    if(Number.isFinite(a.context.freq)&&a.context.freq<90)out.push(`Frequência: articular busca ativa e acompanhamento semanal, com atenção especial às turmas abaixo de 90%.`);
    if(a.context.recompo||a.context.tutor)out.push(`Recomposição: cruzar a participação em Professor Tutor/Recomposição com a trajetória de PP para verificar quem está sendo atendido e quem continua sem avanço.`);
    return out.length?out:['Complete as capturas por turma e por avaliação para gerar encaminhamentos mais específicos.'];
  }

  function assessmentOptions(summary){
    const opts=[];for(const k of PP_KEYS)if(rows(summary,k).length)opts.push([k,dsLabel(k)]);if(rows(summary,'saresp').length)opts.push(['saresp','SARESP']);for(const k of DIAG_KEYS)if(rows(summary,k).length)opts.push([k,dsLabel(k)]);return opts;
  }
  function assessmentRecords(summary,schoolName,k){return disciplineRecords(summary,k,schoolName);}
  function levelGroups(records){return{below:records.filter(r=>r.level==='Abaixo do Básico'),basic:records.filter(r=>r.level==='Básico'),prof:records.filter(r=>r.level==='Proficiente'),sem:records.filter(r=>r.level==='SEM DADO')};}

  function ensureCss(){
    if(document.getElementById('df-pedagogical-analysis-css'))return;
    const st=document.createElement('style');st.id='df-pedagogical-analysis-css';st.textContent=`
#df-pa-root{display:grid;gap:12px}.pa-hero{padding:20px 22px;border-radius:15px;background:linear-gradient(135deg,#0d3f83,#1859b7);color:#fff;box-shadow:0 12px 28px rgba(20,70,145,.16)}.pa-hero .ey{font-size:7.5px;color:#bcd8f7}.pa-hero h2{margin:5px 0 7px;font-size:21px;letter-spacing:-.02em}.pa-hero p{max-width:1100px;margin:0;color:#e2edfb;font-size:9.5px;line-height:1.65}.pa-toolbar{display:flex;gap:6px;flex-wrap:wrap;padding:9px;border:1px solid #dce5ef;border-radius:10px;background:#fff}.pa-toolbar button,.pa-toolbar select,.pa-toolbar input{height:31px;border:1px solid #d4deea;border-radius:7px;background:#fff;color:#31536f;font-size:7.5px}.pa-toolbar button{padding:0 9px;font-weight:850}.pa-toolbar button.on{background:#1859b7;border-color:#1859b7;color:#fff}.pa-toolbar select{padding:0 7px}.pa-toolbar input{padding:0 8px;min-width:190px}.pa-panel{padding:14px;border:1px solid #e0e7ef;border-radius:12px;background:#fff;box-shadow:0 6px 20px rgba(20,48,84,.05)}.pa-panel h3{margin:0 0 4px;color:#183f68;font-size:12px}.pa-panel>p{margin:0 0 10px;color:#6d8196;font-size:8px;line-height:1.55}.pa-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pa-k{padding:12px;border:1px solid #e0e7ef;border-radius:10px;background:#fff}.pa-k span{display:block;color:#75879b;font-size:6.4px;font-weight:900;letter-spacing:.08em}.pa-k b{display:block;margin-top:5px;color:#183f68;font-size:18px}.pa-k small{display:block;margin-top:3px;color:#8a98a8;font-size:6.8px}.pa-cols{display:grid;grid-template-columns:1.1fr .9fr;gap:10px}.pa-list{display:grid;gap:6px}.pa-item{padding:9px;border:1px solid #e5ebf2;border-radius:8px;background:#fbfcfe;color:#36536e;font-size:7.7px;line-height:1.5}.pa-item strong{font-size:8.5px;color:#294762}.pa-item span{float:right;font-size:8px;font-weight:850}.pa-item small{display:block;margin-top:3px;color:#7b8da0;font-size:7px}.pa-good{color:#14886f!important}.pa-warn{color:#a86c08!important}.pa-bad{color:#b94b55!important}.pa-explain{display:grid;gap:7px}.pa-explain>div{padding:10px 11px;border-left:4px solid #1859b7;border-radius:8px;background:#f6f9ff;color:#36536e;font-size:8.2px;line-height:1.6}.pa-actions{counter-reset:n;display:grid;gap:7px}.pa-action{position:relative;padding:10px 10px 10px 34px;border:1px solid #dce6f0;border-radius:9px;background:#f8fbff;color:#36536e;font-size:8px;line-height:1.5}.pa-action:before{counter-increment:n;content:counter(n);position:absolute;left:9px;top:9px;display:grid;place-items:center;width:18px;height:18px;border-radius:6px;background:#1859b7;color:#fff;font-size:7px;font-weight:900}.pa-table{overflow:auto;border:1px solid #e0e7ef;border-radius:9px}.pa-table table{width:100%;min-width:760px;border-collapse:collapse}.pa-table th{padding:8px;background:#eef3f8;color:#38526b;font-size:7px;text-align:left;white-space:nowrap}.pa-table td{padding:8px;border-top:1px solid #edf1f5;color:#334e68;font-size:7.5px;vertical-align:top}.pa-chipbox{display:flex;flex-wrap:wrap;gap:5px}.pa-chip{padding:5px 7px;border:1px solid #dce5ef;border-radius:999px;background:#fbfcfe;color:#38536d;font-size:7px}.pa-chip small{color:#8997a6}.pa-level-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pa-level{padding:10px;border:1px solid #e1e8ef;border-radius:9px;background:#fbfcfe}.pa-level h4{margin:0 0 6px;font-size:8.5px}.pa-level b{font-size:17px}.pa-muted{color:#7d8fa2;font-size:7px}.pa-school-tabs{display:flex;gap:5px;flex-wrap:wrap}.pa-school-tabs button{height:28px;padding:0 8px;border:1px solid #d5dfeb;border-radius:999px;background:#fff;color:#31536f;font-size:7px;font-weight:850}.pa-school-tabs button.on{background:#1859b7;border-color:#1859b7;color:#fff}.pa-note{padding:9px 10px;border:1px solid #eadfb8;border-radius:8px;background:#fff9e9;color:#73591c;font-size:7.6px;line-height:1.5}.pa-copy{float:right;height:28px!important;padding:0 8px!important;border:1px solid #d5dfeb!important;border-radius:7px!important;background:#fff!important;color:#31536f!important;font-size:7px!important;font-weight:850!important}@media(max-width:980px){.pa-grid{grid-template-columns:repeat(2,1fr)}.pa-cols{grid-template-columns:1fr}.pa-level-grid{grid-template-columns:1fr}}@media(max-width:560px){.pa-grid{grid-template-columns:1fr}.pa-toolbar{display:grid}.pa-toolbar input{min-width:0;width:100%}}
`;
    document.head.appendChild(st);
  }

  function addNav(){
    const nav=document.querySelector('#app aside nav');if(!nav||nav.querySelector(`[data-tab="${TAB}"]`))return;
    const btn=document.createElement('button');btn.dataset.tab=TAB;btn.innerHTML='<span class="ic">✦</span>Análise Pedagógica';
    const perguntas=nav.querySelector('[data-tab="perguntas"]');(perguntas||nav.lastElementChild)?.insertAdjacentElement('beforebegin',btn);
  }
  function selectedSchool(summary){const ss=allSchools(summary);if(ui.school&&ss.includes(ui.school))return ui.school;const sel=document.querySelector('#app select[data-a="school"]');const v=sel?.value;if(v&&v!=='Todas'&&ss.includes(v))return v;return ss[0]||'';}

  function toolbar(summary,schoolName){
    const ss=allSchools(summary);return`<div class="pa-toolbar"><select data-pa-school>${ss.map(s=>`<option value="${esc(s)}" ${s===schoolName?'selected':''}>${esc(s)}</option>`).join('')}</select>${[['visao','Visão explicada'],['comparativos','Comparativos'],['proficiencia','Proficiência'],['turmas','Turmas'],['estudantes','Estudantes'],['disciplinas','Disciplinas'],['encaminhamentos','Encaminhamentos']].map(([id,l])=>`<button data-pa-sub="${id}" class="${ui.subtab===id?'on':''}">${l}</button>`).join('')}</div>`;
  }

  function viewVisao(summary,a){
    const total=a.levels.below.length+a.levels.basic.length+a.levels.prof.length;
    const recs=recommendations(a),pos=positives(a),als=alerts(a),ex=explainResults(a);
    return`<section class="pa-hero"><span class="ey">ANÁLISE PEDAGÓGICA · LEITURA AUTOMÁTICA DOS RESULTADOS</span><h2>${esc(a.schoolName)}</h2><p>${esc(ex.map(x=>clean(x.replace(/<[^>]+>/g,''))).join(' '))}</p></section>
    <section class="pa-grid"><div class="pa-k"><span>AVALIAÇÃO MAIS RECENTE</span><b style="font-size:12px">${esc(a.latest?dsLabel(a.latest):'—')}</b><small>${a.latestRec.length} registro(s) reconhecidos</small></div><div class="pa-k"><span>DESEMPENHO NUMÉRICO</span><b>${fmt(a.perf)}</b><small>quando a base possui percentual comparável</small></div><div class="pa-k"><span>ABAIXO DO BÁSICO</span><b class="pa-bad">${a.levels.below.length}</b><small>${total?fmt(100*a.levels.below.length/total):'—'} da base com nível</small></div><div class="pa-k"><span>EVOLUÇÃO PP</span><b class="${a.stats.av.length>=a.stats.re.length?'pa-good':'pa-bad'}">${a.stats.valid.length?fmt(100*a.stats.av.length/a.stats.valid.length):'—'}</b><small>${a.stats.av.length} avançou · ${a.stats.re.length} regrediu</small></div></section>
    <section class="pa-panel"><button class="pa-copy" data-pa-copy>Copiar parecer</button><h3>O que os resultados estão dizendo</h3><p>Interpretação automática com base nos dados efetivamente capturados.</p><div class="pa-explain">${ex.map(x=>`<div>${x}</div>`).join('')}</div></section>
    <section class="pa-cols"><div class="pa-panel"><h3>Destaques positivos</h3><p>Aspectos que podem ser reconhecidos e preservados.</p><div class="pa-list">${pos.map(x=>`<div class="pa-item">✅ ${esc(x)}</div>`).join('')}</div></div><div class="pa-panel"><h3>Pontos de atenção</h3><p>Sinais que pedem investigação pedagógica.</p><div class="pa-list">${als.map(x=>`<div class="pa-item">⚠️ ${esc(x)}</div>`).join('')}</div></div></section>
    <section class="pa-panel"><h3>Prioridades e encaminhamentos</h3><p>O que fazer a partir da leitura dos resultados.</p><div class="pa-actions">${recs.map(x=>`<div class="pa-action">${esc(x)}</div>`).join('')}</div></section>
    <section class="pa-panel"><h3>Ranking das turmas</h3><p>Recupera a lógica do painel anterior: avançou, manteve, regrediu, sem dado, % de evolução, % abaixo do básico e % proficiente.</p><div class="pa-table"><table><thead><tr><th>Turma</th><th>Total comparável</th><th>Avançou</th><th>Manteve</th><th>Regrediu</th><th>Sem dado</th><th>Índice</th><th>% Abaixo PP</th><th>% Proficiente PP</th><th>Frequência</th></tr></thead><tbody>${a.classDetails.sort((x,y)=>y.indice-x.indice).map(x=>`<tr><td><strong>${esc(x.turma)}</strong></td><td>${x.total}</td><td class="pa-good">${x.avancou}</td><td>${x.manteve}</td><td class="pa-bad">${x.regrediu}</td><td>${x.semdado}</td><td class="${x.indice<0?'pa-bad':'pa-good'}">${x.indice.toFixed(1).replace('.',',')}%</td><td>${fmt(x.pctAbaixo)}</td><td>${fmt(x.pctProf)}</td><td>${fmt(x.freq)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function viewComparativos(summary,a){
    const ppStats=transitionStats(a.pp),spStats=transitionStats(a.spp),threeValid=a.three.filter(x=>x.status!=='SEM DADO');
    return`<section class="pa-panel"><h3>Comparativo entre Provas Paulistas</h3><p>Comparação principal por estudante e disciplina entre as duas PP mais recentes disponíveis.</p><div class="pa-grid"><div class="pa-k"><span>COMPARÁVEIS</span><b>${ppStats.valid.length}</b><small>${esc(a.prev?dsLabel(a.prev):'—')} → ${esc(a.latest?dsLabel(a.latest):'—')}</small></div><div class="pa-k"><span>AVANÇOU</span><b class="pa-good">${ppStats.av.length}</b><small>${ppStats.valid.length?fmt(100*ppStats.av.length/ppStats.valid.length):'—'}</small></div><div class="pa-k"><span>MANTEVE</span><b>${ppStats.ma.length}</b><small>${ppStats.valid.length?fmt(100*ppStats.ma.length/ppStats.valid.length):'—'}</small></div><div class="pa-k"><span>REGREDIU</span><b class="pa-bad">${ppStats.re.length}</b><small>${ppStats.valid.length?fmt(100*ppStats.re.length/ppStats.valid.length):'—'}</small></div></div><div class="pa-table" style="margin-top:10px"><table><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudante</th><th>RA</th><th>Disciplina</th><th>${esc(a.prev?dsLabel(a.prev):'Anterior')}</th><th>${esc(a.latest?dsLabel(a.latest):'Atual')}</th><th>Resultado</th></tr></thead><tbody>${a.pp.slice(0,800).map(x=>`<tr><td>${esc(x.year)}</td><td>${esc(x.turma)}</td><td>${esc(x.student)}</td><td>${esc(x.ra)}</td><td>${esc(x.discipline)}</td><td>${esc(x.fromLevel)}${Number.isFinite(x.fromScore)?` · ${fmt(x.fromScore)}`:''}</td><td>${esc(x.toLevel)}${Number.isFinite(x.toScore)?` · ${fmt(x.toScore)}`:''}</td><td class="${x.status==='AVANÇOU'?'pa-good':x.status==='REGREDIU'?'pa-bad':''}"><b>${x.status}</b></td></tr>`).join('')}</tbody></table></div></section>
    <section class="pa-panel"><h3>SARESP × Prova Paulista</h3><p>Comparativo direto recuperado do sistema anterior. A prioridade é a comparação de nível; registros sem equivalência ficam como SEM DADO.</p>${a.spp.length?`<div class="pa-grid"><div class="pa-k"><span>AVANÇOU</span><b class="pa-good">${spStats.av.length}</b></div><div class="pa-k"><span>MANTEVE</span><b>${spStats.ma.length}</b></div><div class="pa-k"><span>REGREDIU</span><b class="pa-bad">${spStats.re.length}</b></div><div class="pa-k"><span>SEM DADO</span><b>${spStats.sem}</b></div></div><div class="pa-table" style="margin-top:10px"><table><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudante</th><th>Disciplina</th><th>SARESP</th><th>${esc(a.latest?dsLabel(a.latest):'PP')}</th><th>Evolução</th></tr></thead><tbody>${a.spp.slice(0,800).map(x=>`<tr><td>${esc(x.year)}</td><td>${esc(x.turma)}</td><td>${esc(x.student)}</td><td>${esc(x.discipline)}</td><td>${esc(x.fromLevel)}</td><td>${esc(x.toLevel)}</td><td class="${x.status==='AVANÇOU'?'pa-good':x.status==='REGREDIU'?'pa-bad':''}"><b>${x.status}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="pa-note">Ainda não há SARESP e Prova Paulista comparáveis nesta escola.</div>'}</section>
    <section class="pa-panel"><h3>SARESP → Diagnóstica → Prova Paulista</h3><p>O recurso antigo foi recuperado com uma proteção nova: a Diagnóstica só entra neste comparativo quando existe nível de proficiência normalizado. A escala percentual da Diagnóstica não é tratada como equivalente à PP.</p>${a.three.length?`<div class="pa-note">${threeValid.length} registro(s) possuem trajetória comparável por níveis normalizados.</div><div class="pa-table" style="margin-top:9px"><table><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudante</th><th>Disciplina</th><th>SARESP</th><th>Diagnóstica</th><th>Prova Paulista</th><th>Resultado geral</th></tr></thead><tbody>${a.three.slice(0,800).map(x=>`<tr><td>${esc(x.year)}</td><td>${esc(x.turma)}</td><td>${esc(x.student)}</td><td>${esc(x.discipline)}</td><td>${esc(x.saresp?.level||'SEM DADO')}</td><td>${esc(x.diag?.level||'SEM DADO')}</td><td>${esc(x.pp?.level||'SEM DADO')}</td><td class="${x.status==='AVANÇOU'?'pa-good':x.status==='REGREDIU'?'pa-bad':''}"><b>${x.status}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="pa-note">O conjunto de três avaliações ainda não está disponível.</div>'}</section>`;
  }

  function viewProficiencia(summary,a){
    const opts=assessmentOptions(summary),selected=ui.assessment==='latestPP'?(a.latest||opts[0]?.[0]):ui.assessment;if(selected&&!opts.some(x=>x[0]===selected))ui.assessment=selected;
    const rec=selected?assessmentRecords(summary,a.schoolName,selected):[],filtered=rec.filter(r=>(ui.discipline==='TODAS'||r.discId===ui.discipline)&&(ui.level==='TODOS'||r.level===ui.level));const g=levelGroups(filtered);
    const byClass=new Map();for(const r of filtered){if(!byClass.has(r.turma))byClass.set(r.turma,[]);byClass.get(r.turma).push(r);}
    return`<section class="pa-panel"><h3>Proficiência por avaliação, turma e disciplina</h3><p>Recupera as listas nominais Abaixo do Básico, Básico, Proficiente e Sem Dado do sistema anterior.</p><div class="pa-toolbar"><select data-pa-assessment>${opts.map(([k,l])=>`<option value="${k}" ${k===selected?'selected':''}>${esc(l)}</option>`).join('')}</select><select data-pa-disc><option value="TODAS">Todas as disciplinas</option>${Object.entries(DISC).map(([id,d])=>`<option value="${id}" ${ui.discipline===id?'selected':''}>${esc(d.label)}</option>`).join('')}</select><select data-pa-level><option value="TODOS">Todos os níveis</option>${['Abaixo do Básico','Básico','Proficiente','SEM DADO'].map(l=>`<option ${ui.level===l?'selected':''}>${l}</option>`).join('')}</select></div><div class="pa-level-grid" style="margin-top:10px"><div class="pa-level"><h4 class="pa-bad">Abaixo do Básico</h4><b>${g.below.length}</b></div><div class="pa-level"><h4 class="pa-warn">Básico</h4><b>${g.basic.length}</b></div><div class="pa-level"><h4 class="pa-good">Proficiente</h4><b>${g.prof.length}</b></div></div></section>
    ${[...byClass.entries()].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([t,list])=>`<section class="pa-panel"><h3>${esc(yearSeries(t))} · ${esc(t)}</h3><p>${list.length} registro(s) no filtro atual.</p>${['Abaixo do Básico','Básico','Proficiente','SEM DADO'].map(l=>{const z=list.filter(x=>x.level===l);return z.length?`<h4 style="font-size:8px;margin:9px 0 5px" class="${l==='Abaixo do Básico'?'pa-bad':l==='Básico'?'pa-warn':l==='Proficiente'?'pa-good':''}">${l} · ${z.length}</h4><div class="pa-chipbox">${z.map(x=>`<span class="pa-chip">${esc(x.student||'Sem nome')} <small>${esc(x.ra)}</small> · ${esc(x.discipline)}</span>`).join('')}</div>`:'';}).join('')}</section>`).join('')||'<section class="pa-panel"><p>Nenhum registro de proficiência encontrado para o filtro.</p></section>'}`;
  }

  function viewTurmas(summary,a){
    return`<section class="pa-panel"><h3>Análise por Ano/Série e Turma</h3><p>Recupera o resumo anterior por turma e acrescenta frequência, desempenho e explicação do movimento.</p><div class="pa-table"><table><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudantes</th><th>Avançou</th><th>Manteve</th><th>Regrediu</th><th>Sem dado</th><th>Índice</th><th>Desempenho</th><th>Frequência</th><th>Leitura</th></tr></thead><tbody>${a.classDetails.sort((x,y)=>y.indice-x.indice).map(x=>{let read='Base ainda insuficiente';if(x.regrediu>x.avancou)read='Regressões superam avanços';else if(x.avancou>x.regrediu)read='Saldo de evolução positivo';else if(x.total)read='Movimento estável';if(Number.isFinite(x.freq)&&x.freq<75)read+=' · frequência crítica';else if(Number.isFinite(x.freq)&&x.freq<90)read+=' · frequência em atenção';return`<tr><td>${esc(yearSeries(x.turma))}</td><td><strong>${esc(x.turma)}</strong></td><td>${x.students}</td><td class="pa-good">${x.avancou}</td><td>${x.manteve}</td><td class="pa-bad">${x.regrediu}</td><td>${x.semdado}</td><td class="${x.indice<0?'pa-bad':'pa-good'}">${x.indice.toFixed(1).replace('.',',')}%</td><td>${fmt(x.perf)}</td><td>${fmt(x.freq)}</td><td>${esc(read)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
  }

  function viewEstudantes(summary,a){
    const all=[...a.pp].filter(x=>fold(`${x.student} ${x.ra} ${x.turma} ${x.discipline}`).includes(fold(ui.search)));
    const below=a.latestRec.filter(x=>x.level==='Abaixo do Básico'&&fold(`${x.student} ${x.ra} ${x.turma} ${x.discipline}`).includes(fold(ui.search)));
    return`<section class="pa-panel"><h3>Trajetória nominal dos estudantes</h3><p>Lista quem avançou, manteve, regrediu ou ficou sem dado, preservando turma e disciplina.</p><div class="pa-toolbar"><input data-pa-search value="${esc(ui.search)}" placeholder="Buscar nome, RA, turma ou disciplina"></div><div class="pa-table" style="margin-top:9px"><table><thead><tr><th>Turma</th><th>Estudante</th><th>RA</th><th>Disciplina</th><th>${esc(a.prev?dsLabel(a.prev):'Anterior')}</th><th>${esc(a.latest?dsLabel(a.latest):'Atual')}</th><th>Movimento</th></tr></thead><tbody>${all.slice(0,1200).map(x=>`<tr><td>${esc(x.turma)}</td><td><strong>${esc(x.student)}</strong></td><td>${esc(x.ra)}</td><td>${esc(x.discipline)}</td><td>${esc(x.fromLevel)}${Number.isFinite(x.fromScore)?` · ${fmt(x.fromScore)}`:''}</td><td>${esc(x.toLevel)}${Number.isFinite(x.toScore)?` · ${fmt(x.toScore)}`:''}</td><td class="${x.status==='AVANÇOU'?'pa-good':x.status==='REGREDIU'?'pa-bad':''}"><b>${x.status}</b></td></tr>`).join('')}</tbody></table></div></section>
    <section class="pa-panel"><h3>Todos os estudantes Abaixo do Básico · avaliação mais recente</h3><p>Lista nominal para planejamento de recomposição.</p><div class="pa-table"><table><thead><tr><th>Ano/Série</th><th>Turma</th><th>Estudante</th><th>RA</th><th>Disciplina</th><th>Valor</th></tr></thead><tbody>${below.slice(0,1200).map(x=>`<tr><td>${esc(x.year)}</td><td>${esc(x.turma)}</td><td><strong>${esc(x.student)}</strong></td><td>${esc(x.ra)}</td><td>${esc(x.discipline)}</td><td>${Number.isFinite(x.score)?fmt(x.score):'—'}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function viewDisciplinas(summary,a){
    const latest=a.latestRec;const map=new Map();for(const r of latest){const k=r.discipline;if(!map.has(k))map.set(k,{discipline:k,total:0,below:0,basic:0,prof:0,scores:[]});const o=map.get(k);o.total++;if(r.level==='Abaixo do Básico')o.below++;else if(r.level==='Básico')o.basic++;else if(r.level==='Proficiente')o.prof++;if(Number.isFinite(r.score))o.scores.push(r.score);}
    const list=[...map.values()].map(x=>({...x,avg:avg(x.scores),pctBelow:x.total?100*x.below/x.total:0,pctProf:x.total?100*x.prof/x.total:0})).sort((x,y)=>y.pctBelow-x.pctBelow);
    return`<section class="pa-panel"><h3>Prova Paulista por todas as disciplinas encontradas</h3><p>Recupera a leitura multidisciplinar do sistema anterior: LP, Matemática, Ciências, História, Geografia, Inglês, Arte, Educação Física, Física, Química, Biologia, Filosofia e Sociologia quando existirem na captura.</p><div class="pa-table"><table><thead><tr><th>Disciplina</th><th>Registros</th><th>Abaixo</th><th>Básico</th><th>Proficiente</th><th>% Abaixo</th><th>% Proficiente</th><th>Média</th><th>Leitura</th></tr></thead><tbody>${list.map(x=>{const msg=x.pctBelow>=40?'Alta concentração abaixo do básico':x.pctProf>=60?'Predomínio proficiente':'Distribuição intermediária';return`<tr><td><strong>${esc(x.discipline)}</strong></td><td>${x.total}</td><td class="pa-bad">${x.below}</td><td>${x.basic}</td><td class="pa-good">${x.prof}</td><td>${fmt(x.pctBelow)}</td><td>${fmt(x.pctProf)}</td><td>${fmt(x.avg)}</td><td>${esc(msg)}</td></tr>`;}).join('')}</tbody></table></div></section>
    ${list.map(x=>{const rec=latest.filter(r=>r.discipline===x.discipline&&r.level==='Abaixo do Básico');return rec.length?`<section class="pa-panel"><h3>${esc(x.discipline)} · Abaixo do Básico</h3><p>${rec.length} ocorrência(s) por turma.</p><div class="pa-chipbox">${rec.slice(0,300).map(r=>`<span class="pa-chip">${esc(r.turma)} · ${esc(r.student||'Sem nome')} <small>${esc(r.ra)}</small></span>`).join('')}</div></section>`:'';}).join('')}`;
  }

  function viewEncaminhamentos(summary,a){
    const recs=recommendations(a),byClass=a.classDetails.filter(x=>x.pctAbaixo||x.regrediu||Number.isFinite(x.freq)&&x.freq<90).sort((x,y)=>(y.pctAbaixo+y.regrediu*5)-(x.pctAbaixo+x.regrediu*5));
    return`<section class="pa-panel"><h3>Plano de ação sugerido</h3><p>Encaminhamentos produzidos a partir dos dados, sem substituir a análise da equipe escolar.</p><div class="pa-actions">${recs.map(x=>`<div class="pa-action">${esc(x)}</div>`).join('')}</div></section>
    <section class="pa-panel"><h3>Encaminhamento por proficiência</h3><p>Regra pedagógica aplicada quando o nível está presente na captura.</p><div class="pa-level-grid"><div class="pa-level"><h4 class="pa-bad">Abaixo do Básico</h4><b>${a.levels.below.length}</b><div class="pa-muted">Professor Tutor no componente correspondente.</div></div><div class="pa-level"><h4 class="pa-warn">Básico</h4><b>${a.levels.basic.length}</b><div class="pa-muted">Eletivas de Fundamentos no componente correspondente.</div></div><div class="pa-level"><h4 class="pa-good">Proficiente</h4><b>${a.levels.prof.length}</b><div class="pa-muted">Aprofundamento / Super Eletivas.</div></div></div></section>
    <section class="pa-panel"><h3>Turmas para acompanhamento</h3><p>Lista organizada pelos sinais de abaixo do básico, regressão e frequência.</p><div class="pa-table"><table><thead><tr><th>Prioridade</th><th>Turma</th><th>% Abaixo PP</th><th>Regrediu</th><th>Frequência</th><th>Encaminhamento</th></tr></thead><tbody>${byClass.map((x,i)=>{let e='Acompanhar planejamento e evolução';if(x.pctAbaixo>=30)e='Recomposição focalizada e lista nominal';if(Number.isFinite(x.freq)&&x.freq<75)e+=' + busca ativa imediata';else if(Number.isFinite(x.freq)&&x.freq<90)e+=' + prevenção de infrequência';return`<tr><td>${i+1}</td><td><strong>${esc(x.turma)}</strong></td><td>${fmt(x.pctAbaixo)}</td><td>${x.regrediu}</td><td>${fmt(x.freq)}</td><td>${esc(e)}</td></tr>`;}).join('')}</tbody></table></div></section>`;
  }

  function view(summary,a){
    if(ui.subtab==='comparativos')return viewComparativos(summary,a);
    if(ui.subtab==='proficiencia')return viewProficiencia(summary,a);
    if(ui.subtab==='turmas')return viewTurmas(summary,a);
    if(ui.subtab==='estudantes')return viewEstudantes(summary,a);
    if(ui.subtab==='disciplinas')return viewDisciplinas(summary,a);
    if(ui.subtab==='encaminhamentos')return viewEncaminhamentos(summary,a);
    return viewVisao(summary,a);
  }

  function renderAnalysis(){
    ensureCss();const summary=load(),ss=allSchools(summary),main=document.querySelector('#app main');if(!main)return;let root=document.getElementById('df-pa-root');if(!root){root=document.createElement('div');root.id='df-pa-root';main.appendChild(root);}let schoolName=selectedSchool(summary);if(!schoolName){root.innerHTML='<section class="empty"><div class="big">✦</div><h2>Análise Pedagógica</h2><p>Capture uma escola para gerar a análise explicada.</p></section>';return;}ui.school=schoolName;saveUi();const a=analysis(summary,schoolName);root.innerHTML=`${toolbar(summary,schoolName)}${view(summary,a)}`;
  }
  function enter(){const main=document.querySelector('#app main');if(!main)return;[...main.children].forEach(el=>{if(el.id!=='df-pa-root'){el.dataset.paHidden='1';el.style.display='none';}});renderAnalysis();}
  function leave(){document.querySelectorAll('#app main [data-pa-hidden="1"]').forEach(el=>{el.style.display='';delete el.dataset.paHidden;});document.getElementById('df-pa-root')?.remove();}
  function copyParecer(){const a=analysis(load(),ui.school);const text=[`ANÁLISE PEDAGÓGICA — ${a.schoolName}`,...explainResults(a).map(x=>clean(x.replace(/<[^>]+>/g,''))),'','DESTAQUES POSITIVOS:',...positives(a).map(x=>`- ${x}`),'','PONTOS DE ATENÇÃO:',...alerts(a).map(x=>`- ${x}`),'','ENCAMINHAMENTOS:',...recommendations(a).map(x=>`- ${x}`)].join('\n');navigator.clipboard?.writeText(text).catch(()=>{});}

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.tab===TAB){e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('#app aside nav button').forEach(x=>x.classList.toggle('on',x===b));enter();return;}
    if(b.dataset.tab&&b.dataset.tab!==TAB){leave();return;}
    if(b.dataset.paSub){ui.subtab=b.dataset.paSub;saveUi();renderAnalysis();return;}
    if(b.hasAttribute('data-pa-copy')){copyParecer();return;}
  },true);
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-pa-school]')){ui.school=e.target.value;saveUi();renderAnalysis();}
    if(e.target.matches('[data-pa-assessment]')){ui.assessment=e.target.value;saveUi();renderAnalysis();}
    if(e.target.matches('[data-pa-disc]')){ui.discipline=e.target.value;saveUi();renderAnalysis();}
    if(e.target.matches('[data-pa-level]')){ui.level=e.target.value;saveUi();renderAnalysis();}
  },true);
  document.addEventListener('input',e=>{if(e.target.matches('[data-pa-search]')){ui.search=e.target.value;saveUi();clearTimeout(timer);timer=setTimeout(renderAnalysis,180);}},true);

  function apply(){addNav();if(document.querySelector(`#app aside nav [data-tab="${TAB}"].on`))renderAnalysis();}
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length)){clearTimeout(timer);timer=setTimeout(apply,100);}}).observe(root,{childList:true,subtree:true});
  window.addEventListener('df-analysis-synced',()=>{if(document.querySelector(`#app aside nav [data-tab="${TAB}"].on`))renderAnalysis();});
  apply();
})();