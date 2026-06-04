const ALL_DISCIPLINES_MAP={
  LP:['LP','LPT','PORT','PORTUGUES','PORTUGUÊS','LINGUA PORTUGUESA','LINGUAPORTUGUESA','LÍNGUA PORTUGUESA'],
  MAT:['MAT','MT','MATEMATICA','MATEMÁTICA'],
  CIE:['CIE','CIENCIAS','CIÊNCIAS','CIENCIAS DA NATUREZA','CIÊNCIAS DA NATUREZA'],
  BIO:['BIO','BIOLOGIA'],
  HIS:['HIS','HISTORIA','HISTÓRIA'],
  GEO:['GEO','GEOGRAFIA'],
  ING:['ING','INGLES','INGLÊS','LINGUA INGLESA','LÍNGUA INGLESA'],
  ART:['ART','ARTE','ARTES'],
  EDF:['EDF','ED FISICA','ED FÍSICA','EDUCACAO FISICA','EDUCAÇÃO FÍSICA'],
  FIS:['FIS','FISICA','FÍSICA'],
  QUI:['QUI','QUIMICA','QUÍMICA'],
  FIL:['FIL','FILOSOFIA'],
  SOC:['SOC','SOCIOLOGIA']
};
const ALL_DISC_LABELS={LP:'Língua Portuguesa',MAT:'Matemática',CIE:'Ciências',BIO:'Biologia',HIS:'História',GEO:'Geografia',ING:'Inglês',ART:'Arte',EDF:'Educação Física',FIS:'Física',QUI:'Química',FIL:'Filosofia',SOC:'Sociologia'};
function isInvalidStudentName(name){
  const t=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  if(!t)return true;
  return ['FILTROS APLICADOS','COMPONENTE','GERAL LP','GERAL LP + MAT','LINGUA PORTUGUESA','LÍNGUA PORTUGUESA','LP','MAT','MATEMATICA','MATEMÁTICA','SEM DADO','-','—','TOTAL','TOTAIS'].some(x=>t===x||t.startsWith(x+':'));
}
function isRealStudentRow(row){
  const name=row&&row.Estudante;const ra=row&&row.RA;
  if(isInvalidStudentName(name)&&(!ra||String(ra)==='—'))return false;
  return true;
}
function readDisciplineFromRaw(row,disc){
  const aliases=ALL_DISCIPLINES_MAP[disc]||[disc];
  const valueNames=[];const statusNames=[];
  aliases.forEach(a=>{
    valueNames.push(a,a+' %','% '+a,'ACERTOS '+a,'QTD ACERTOS '+a,'PERCENTUAL '+a,'NOTA '+a,'RESULTADO '+a);
    statusNames.push('STATUS '+a,a+' STATUS','NIVEL '+a,'NÍVEL '+a,a+' NIVEL',a+' NÍVEL','PROFICIENCIA '+a,'PROFICIÊNCIA '+a);
  });
  const valor=firstNum(row,valueNames);
  const statusTxt=get(row,statusNames);
  if(valor===null&&!statusTxt)return null;
  return {valor:valor??'—',status:cleanStatus(statusTxt,valor)};
}
function addAllDisciplinesToRow(base,row,suffix){
  Object.keys(ALL_DISCIPLINES_MAP).forEach(d=>{
    const found=readDisciplineFromRaw(row,d);if(!found)return;
    const label=ALL_DISC_LABELS[d];
    base[label+' '+suffix]=found.valor;
    base[label+' Status '+suffix]=found.status;
  });
  return base;
}
if(typeof calcPP==='function'){
  const __oldCalcPP=calcPP;
  calcPP=function(row){return addAllDisciplinesToRow(__oldCalcPP(row),row,'Prova Paulista')};
}
if(typeof calcSaresp==='function'){
  const __oldCalcSaresp=calcSaresp;
  calcSaresp=function(row){return addAllDisciplinesToRow(__oldCalcSaresp(row),row,'SARESP')};
}
function abaixoBasicoRows(base){
  const data=(window.state&&state.dados&&state.dados[base])||[];
  const suffix=base==='pp'?'Prova Paulista':base==='saresp'?'SARESP':'Diagnóstica';
  const discs=base==='diag'?['LP','MAT']:Object.keys(ALL_DISC_LABELS);
  const out=[];
  data.filter(isRealStudentRow).forEach(r=>{
    discs.forEach(d=>{
      const label=ALL_DISC_LABELS[d];
      let status=r[label+' Status '+suffix];
      let valor=r[label+' '+suffix];
      if(base==='diag'&&d==='LP'){status=r['LP Status Diagnóstica'];valor=r['LP Diagnóstica Aprend. Equiv']}
      if(base==='diag'&&d==='MAT'){status=r['MAT Status Diagnóstica'];valor=r['MAT Diagnóstica Aprend. Equiv']}
      if(status==='Abaixo do Básico')out.push({'Ano/Série':typeof extrairAnoSerie==='function'?extrairAnoSerie(r.Turma):'Sem Ano/Série',Turma:r.Turma||'SEM TURMA',Estudante:r.Estudante,RA:r.RA||'—',Disciplina:label,Valor:valor??'—',Status:status});
    });
  });
  return out;
}
function appendAbaixoBasicoSection(hostId,base){
  const host=document.getElementById(hostId);if(!host)return;
  let box=host.querySelector('.below-basic-box');
  if(!box){box=document.createElement('div');box.className='below-basic-box analysis-card';host.appendChild(box)}
  const rows=abaixoBasicoRows(base);
  if(!rows.length){box.innerHTML='<h3>Alunos Abaixo do Básico</h3><p class="muted">Nenhum estudante abaixo do básico encontrado nesta avaliação.</p>';return;}
  const groups={};rows.forEach(r=>{const key=r['Ano/Série']+'||'+r.Turma;if(!groups[key])groups[key]=[];groups[key].push(r)});
  box.innerHTML='<h3>Alunos Abaixo do Básico</h3><p class="muted">Lista nominal por ano/série, turma e disciplina.</p>'+Object.entries(groups).map(([key,list])=>{const [ano,turma]=key.split('||');return '<div class="level-section"><div class="level-title">'+esc(ano)+' — '+esc(turma)+' • '+list.length+' ocorrência(s)</div><div class="level-body"><table class="analysis-table"><thead><tr><th>Estudante</th><th>RA</th><th>Disciplina</th><th>Valor</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+esc(r.Estudante)+'</td><td>'+esc(r.RA)+'</td><td><b>'+esc(r.Disciplina)+'</b></td><td>'+esc(r.Valor)+'</td></tr>').join('')+'</tbody></table></div></div>'}).join('');
}
function renderAbaixoBasicoSections(){
  appendAbaixoBasicoSection('tabPPContent','pp');
  appendAbaixoBasicoSection('tabSarespContent','saresp');
  appendAbaixoBasicoSection('tabDiagContent','diag');
}
function abaixoBasicoForExport(){return ['pp','saresp','diag'].flatMap(base=>abaixoBasicoRows(base).map(r=>({...r,Avaliacao:base==='pp'?'Prova Paulista':base==='saresp'?'SARESP':'Diagnóstica'})))}
const __oldRenderBelow=typeof render==='function'?render:null;if(__oldRenderBelow){render=function(){__oldRenderBelow();setTimeout(renderAbaixoBasicoSections,0)}}
document.addEventListener('DOMContentLoaded',()=>setInterval(renderAbaixoBasicoSections,1600));