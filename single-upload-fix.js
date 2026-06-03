window.state=state;
function classifyRowBetter(row){
  const file=k(row.Arquivo||'');
  const sheet=k(row.Aba||'');
  const headers=Object.keys(row||{}).map(k).join(' ');
  const all=file+' '+sheet+' '+headers;
  if(all.includes('DIAGNOST')||all.includes('APRENDEQUIV')||all.includes('APRENDIZAGEMEQUIVALENTE')||all.includes('PUBLICOALVO'))return 'diag';
  if(all.includes('PROVAPAULISTA')||all.includes('PROVAPAULIST')||all.includes('ACERTOS')||all.includes('PARTICIPACAO')&&all.includes('PORT'))return 'pp';
  if(all.includes('SARESP')||all.includes('REDEORIGEM')||all.includes('NOTAMEDIA')||all.includes('LPT'))return 'saresp';
  if(all.includes('PORT')&&all.includes('MAT')&&all.includes('RA'))return 'pp';
  if(all.includes('CODIGO')&&all.includes('APREND'))return 'diag';
  return 'pp';
}
tipoLinha=function(row){return classifyRowBetter(row)};
readSingleFiles=async function(){
  state.dados={saresp:[],diag:[],pp:[]};
  state.auditoria=[];
  let totalRows=0;
  for(const f of state.files){
    const rows=await readFile(f);
    totalRows+=rows.length;
    rows.forEach(r=>{
      const tipo=classifyRowBetter(r);
      if(tipo==='saresp')state.dados.saresp.push(calcSaresp(r));
      else if(tipo==='diag')state.dados.diag.push(calcDiag(r));
      else state.dados.pp.push(calcPP(r));
    });
  }
  if(!totalRows){state.auditoria.push({Aba:'Leitura',Contexto:'Campo único',Tipo:'SEM_LINHAS',Detalhe:'Nenhuma linha lida nos arquivos enviados'});}
  window.state=state;
};
const oldAnalyze=analyze;
analyze=async function(){
  try{
    msg('Lendo campo único, separando bases e gerando análise...');
    await readSingleFiles();
    consolidate();
    render();
    const resumo='Análise concluída: '+state.comparativo.length+' estudante(s). SARESP: '+state.dados.saresp.length+', Diagnóstica: '+state.dados.diag.length+', Prova Paulista: '+state.dados.pp.length+'.';
    msg(resumo,state.comparativo.length?'success':'error');
    if(typeof renderProficiency==='function')renderProficiency();
  }catch(e){console.error(e);msg('Erro ao analisar: '+e.message,'error');}
};
const oldHandleInput=handleInput;
handleInput=function(input){
  state.files=Array.from(input.files||[]);
  state.saresp=[];state.diag=[];state.pp=[];
  state.comparativo=[];
  state.dados={saresp:[],diag:[],pp:[]};
  window.state=state;
  destroyCharts();
  render();
  msg(state.files.length+' arquivo(s) carregado(s) no campo único. Clique em Analisar.');
};