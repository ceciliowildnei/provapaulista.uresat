const PP_DISCIPLINES={
  LP:['LP','LPT','PORT','PORTUGUES','PORTUGUÊS','LINGUAPORTUGUESA','LINGUA PORTUGUESA'],
  MAT:['MAT','MT','MATEMATICA','MATEMÁTICA'],
  CIE:['CIE','CIENCIAS','CIÊNCIAS','CNT','CIENCIASNATUREZA'],
  HIS:['HIS','HISTORIA','HISTÓRIA'],
  GEO:['GEO','GEOGRAFIA'],
  ING:['ING','INGLES','INGLÊS','LINGUAINGLESA'],
  ART:['ART','ARTE','ARTES'],
  EDF:['EDF','ED FISICA','EDUCAÇÃO FÍSICA','EDUCACAO FISICA','EDUCACAOFISICA'],
  FIS:['FIS','FISICA','FÍSICA'],
  QUI:['QUI','QUIMICA','QUÍMICA'],
  BIO:['BIO','BIOLOGIA'],
  FIL:['FIL','FILOSOFIA'],
  SOC:['SOC','SOCIOLOGIA']
};
const PP_DISC_LABELS={LP:'Língua Portuguesa',MAT:'Matemática',CIE:'Ciências',HIS:'História',GEO:'Geografia',ING:'Inglês',ART:'Arte',EDF:'Educação Física',FIS:'Física',QUI:'Química',BIO:'Biologia',FIL:'Filosofia',SOC:'Sociologia'};
function ppDiscKey(alias){return k(alias)}
function getDiscValue(row,disc){
  const aliases=PP_DISCIPLINES[disc]||[disc];
  const statusNames=[];const valueNames=[];
  aliases.forEach(a=>{valueNames.push(a,a+' %','% '+a,'ACERTOS '+a,'QTD ACERTOS '+a,'PERCENTUAL '+a,'NOTA '+a);statusNames.push('STATUS '+a,a+' STATUS','NIVEL '+a,'NÍVEL '+a,a+' NIVEL',a+' NÍVEL')});
  const val=firstNum(row,valueNames);
  const st=get(row,statusNames);
  return {valor:val??'—',status:cleanStatus(st,val)};
}
const oldCalcPP=calcPP;
calcPP=function(row){
  const base=oldCalcPP(row);
  Object.keys(PP_DISCIPLINES).forEach(d=>{
    const r=getDiscValue(row,d);
    base[PP_DISC_LABELS[d]+' Prova Paulista']=r.valor;
    base[PP_DISC_LABELS[d]+' Status Prova Paulista']=r.status;
  });
  return base;
};
function ppAllDiscRows(){
  const rows=(window.state&&state.dados&&state.dados.pp)||[];
  const out=[];
  rows.forEach(r=>{
    Object.keys(PP_DISCIPLINES).forEach(d=>{
      const label=PP_DISC_LABELS[d];
      const status=r[label+' Status Prova Paulista']||'SEM DADO';
      const valor=r[label+' Prova Paulista']||'—';
      if(status!=='SEM DADO'||valor!=='—')out.push({Turma:r.Turma,Estudante:r.Estudante,RA:r.RA,Disciplina:label,Valor:valor,Nivel:status,Arquivo:r.Arquivo});
    });
  });
  return out;
}
function renderPPAllDisciplines(){
  const host=document.getElementById('ppDisciplinasContent');
  if(!host)return;
  const rows=ppAllDiscRows();
  if(!rows.length){host.innerHTML='<p>Após analisar um arquivo da Prova Paulista, aparecerá aqui a separação por todas as disciplinas encontradas.</p>';return;}
  const groups={};rows.forEach(r=>{const key=r.Disciplina+'|'+r.Turma;if(!groups[key])groups[key]=[];groups[key].push(r)});
  host.innerHTML=Object.entries(groups).map(([key,list])=>{const [disc,turma]=key.split('|');const abaixo=list.filter(r=>r.Nivel==='Abaixo do Básico').length;const basico=list.filter(r=>r.Nivel==='Básico').length;const prof=list.filter(r=>r.Nivel==='Proficiente').length;return '<div class="analysis-card"><h3>'+disc+' — '+turma+'</h3><p><b>Abaixo:</b> '+abaixo+' | <b>Básico:</b> '+basico+' | <b>Proficiente:</b> '+prof+'</p><table class="analysis-table"><thead><tr><th>Estudante</th><th>RA</th><th>Valor</th><th>Nível</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+esc(r.Estudante)+'</td><td>'+esc(r.RA)+'</td><td>'+esc(r.Valor)+'</td><td><b>'+esc(r.Nivel)+'</b></td></tr>').join('')+'</tbody></table></div>'}).join('');
}
const oldRender=render;
render=function(){oldRender();setTimeout(renderPPAllDisciplines,0)};
const oldExportExcel=exportExcel;
exportExcel=async function(){
  if(!state.comparativo.length)await analyze();
  const XLSX=await loadXLSX();
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{Titulo:'PAINEL CONSOLIDADO DA UNIDADE'},{Status:'AVANÇOU',Geral:counts('Status Final Geral 1º Bimestre')[0]},{Status:'MANTEVE',Geral:counts('Status Final Geral 1º Bimestre')[1]},{Status:'REGREDIU',Geral:counts('Status Final Geral 1º Bimestre')[2]},{Status:'SEM DADO',Geral:counts('Status Final Geral 1º Bimestre')[3]}]),'Painel');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.comparativo),'Comparativo Geral');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ppAllDiscRows()),'PP Todas Disciplinas');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.saresp),'Dados SARESP');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.diag),'Dados Diagnóstica');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.dados.pp),'Dados Prova Paulista');
  if(typeof profRowsForExport==='function')XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(profRowsForExport()),'Níveis Proficiência');
  XLSX.writeFile(wb,'Consolidacao_Educacional_Oficial.xlsx');
  msg('Excel gerado com Prova Paulista de todas as disciplinas.','success');
};
document.addEventListener('DOMContentLoaded',()=>setInterval(renderPPAllDisciplines,1500));