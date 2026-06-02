const PP_LEVELS=['Desenv. Inicial','Desenv. Básico','Desenv. Adequado','Domínio Proficiente','Domínio Avançado'];
const NIVEL_COLORS={
  'Desenv. Inicial':'FEE2E2','Desenv. Básico':'FFEDD5','Desenv. Adequado':'FEF9C3','Domínio Proficiente':'DCFCE7','Domínio Avançado':'DBEAFE','—':'F1F5F9'
};
const state={pp1:[],pp2:[],pp3:[],detalhado:[],resumo:[],auditoria:[]};

function qs(s){return document.querySelector(s)}
function qsa(s){return Array.from(document.querySelectorAll(s))}
function showMessage(text,type='info'){const msg=qs('#msg');if(msg){msg.textContent=text;msg.dataset.type=type}}
function totalFiles(){return state.pp1.length+state.pp2.length+state.pp3.length}
function formatSize(bytes){if(!bytes)return '0 KB';return bytes<1048576?Math.round(bytes/1024)+' KB':(bytes/1048576).toFixed(1)+' MB'}
function normalizeText(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function keyText(v){return normalizeText(v).toUpperCase().replace(/[^A-Z0-9]/g,'')}
function parseNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace('%','').replace(',','.').trim());return Number.isFinite(n)?n:null}
function parsePercent(v){const n=parseNumber(v);return n===null?null:n}
function escapeHtml(value){return String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function detectTurma(name){const base=(name||'').replace(/\.[^.]+$/,'').toUpperCase();const m=base.match(/\b([1-9][A-Z]|[1-9]\s*[A-Z]|[1-3][A-Z]\s*(EM|PC|EF)?)\b/);return m?m[0].replace(/\s+/g,' '):''}
function getCell(row,names){const keys=Object.keys(row||{});const map=Object.fromEntries(keys.map(k=>[keyText(k),k]));for(const n of names){const found=map[keyText(n)];if(found)return row[found]}return ''}
function nivelPP(status,aprendizagemEquivalente){
  const st=normalizeText(status).toUpperCase();
  const ae=parseNumber(aprendizagemEquivalente);
  if(st.includes('ABAIXO'))return ae!==null&&ae<=-2?'Desenv. Inicial':'Desenv. Básico';
  if(st.includes('BASICO'))return ae!==null&&ae<0?'Desenv. Básico':'Desenv. Adequado';
  if(st.includes('ADEQUADO')||st.includes('PROFICIENTE'))return ae!==null&&ae>=1?'Domínio Proficiente':'Desenv. Adequado';
  if(st.includes('AVANCADO'))return 'Domínio Avançado';
  return '—';
}
function loadXLSX(){
  return new Promise((resolve,reject)=>{
    if(window.XLSX)return resolve(window.XLSX);
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=()=>resolve(window.XLSX);
    s.onerror=()=>reject(new Error('Não foi possível carregar a biblioteca XLSX.'));
    document.head.appendChild(s);
  });
}
async function readFileRows(file){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(ext==='zip')return [{Arquivo:file.name,Turma:detectTurma(file.name),Observacao:'Arquivo ZIP registrado. Extração automática ainda depende de biblioteca ZIP.'}];
  if(ext==='csv'){
    const txt=await file.text();
    const sep=txt.includes(';')?';':',';
    const lines=txt.split(/\r?\n/).filter(Boolean);
    const headers=(lines.shift()||'').split(sep).map(h=>h.trim());
    return lines.map(line=>Object.fromEntries(line.split(sep).map((v,i)=>[headers[i]||('Coluna '+(i+1)),v.trim()])));
  }
  const XLSX=await loadXLSX();
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data,{type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws,{defval:''});
}
async function buildDetalhado(){
  const grupos=['pp1','pp2','pp3'];
  const detalhado=[];
  for(const grupo of grupos){
    for(const file of state[grupo]){
      const rows=await readFileRows(file);
      rows.forEach((row,idx)=>{
        const turma=getCell(row,['Turma','Classe','Ano/Série','Ano Serie'])||detectTurma(file.name)||'—';
        const estudante=getCell(row,['Estudante','Aluno','Nome','Nome do Aluno'])||('Registro '+(idx+1));
        const ra=getCell(row,['RA','Código','Codigo','ID'])||'—';
        const lpStatus=getCell(row,['LP Status','Status LP','Status Língua Portuguesa','Status Lingua Portuguesa','LP Nível','LP Nivel']);
        const mtStatus=getCell(row,['MT Status','MAT Status','Status MT','Status MAT','Status Matemática','Status Matematica','MT Nível','MT Nivel']);
        const lpAE=getCell(row,['LP Aprend. Equiv','LP Aprendizagem Equivalente','LP AE','Língua Portuguesa Aprend. Equiv']);
        const mtAE=getCell(row,['MT Aprend. Equiv','MAT Aprend. Equiv','MT Aprendizagem Equivalente','MAT Aprendizagem Equivalente','MT AE','MAT AE']);
        const lpNivel=nivelPP(lpStatus,lpAE);
        const mtNivel=nivelPP(mtStatus,mtAE);
        detalhado.push({
          Avaliacao:grupo.toUpperCase(),Arquivo:file.name,Turma:turma,Estudante:estudante,RA:ra,
          'LP Status':lpStatus||'—','LP Aprend. Equiv':lpAE||'—','LP Nível PP':lpNivel,
          'MT Status':mtStatus||'—','MT Aprend. Equiv':mtAE||'—','MT Nível PP':mtNivel
        });
      });
    }
  }
  state.detalhado=detalhado;
  return detalhado;
}
function summarizeDetalhado(){
  const groups={};
  state.detalhado.forEach(r=>{const key=r.Avaliacao+'|'+r.Turma;if(!groups[key])groups[key]=[];groups[key].push(r)});
  const resumo=[];
  Object.entries(groups).forEach(([key,rows])=>{
    const [avaliacao,turma]=key.split('|');
    const out={Avaliacao:avaliacao,Turma:turma,Total:rows.length,'LP Aprend. Média':'—','MT Aprend. Média':'—'};
    ['LP','MT'].forEach(area=>{
      PP_LEVELS.forEach(level=>{
        const count=rows.filter(r=>r[area+' Nível PP']===level).length;
        out[area+' % '+level]=rows.length?Number(((count/rows.length)*100).toFixed(2)):0;
      });
      const vals=rows.map(r=>parseNumber(r[area+' Aprend. Equiv'])).filter(v=>v!==null);
      out[area+' Aprend. Média']=vals.length?Number((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)):'—';
    });
    resumo.push(out);
  });
  state.resumo=resumo;
  return resumo;
}
function gerarAuditoriaExport(){
  const aud=[];
  state.resumo.forEach(row=>{
    ['LP','MT'].forEach(area=>{
      const vals=PP_LEVELS.map(level=>parsePercent(row[area+' % '+level]));
      vals.forEach((v,i)=>{if(v===null)aud.push({Aba:'Resumo',Contexto:row.Avaliacao+' '+row.Turma,Disciplina:area,Tipo:'COLUNA_VAZIA_OU_AUSENTE',Detalhe:PP_LEVELS[i],Valor:'—'})});
      if(vals.every(v=>v!==null)){
        const sum=vals.reduce((a,b)=>a+b,0);
        if(Math.abs(sum-100)>1)aud.push({Aba:'Resumo',Contexto:row.Avaliacao+' '+row.Turma,Disciplina:area,Tipo:'SOMA_5_FAIXAS_DIFERENTE_DE_100',Detalhe:'Total',Valor:sum.toFixed(2)+'%'});
      }
    });
  });
  state.detalhado.forEach(row=>{
    ['LP','MT'].forEach(area=>{const n=row[area+' Nível PP'];if(!PP_LEVELS.includes(n)&&n!=='—')aud.push({Aba:'Detalhado',Contexto:row.Arquivo+' - '+row.Estudante,Disciplina:area,Tipo:'NIVEL_FORA_DAS_5_FAIXAS',Detalhe:n,Valor:n})});
    if(row['LP Nível PP']==='—')aud.push({Aba:'Detalhado',Contexto:row.Arquivo+' - '+row.Estudante,Disciplina:'LP',Tipo:'NIVEL_GRAVADO_COMO_TRACO',Detalhe:'LP Nível PP',Valor:'—'});
    if(row['MT Nível PP']==='—')aud.push({Aba:'Detalhado',Contexto:row.Arquivo+' - '+row.Estudante,Disciplina:'MT',Tipo:'NIVEL_GRAVADO_COMO_TRACO',Detalhe:'MT Nível PP',Valor:'—'});
  });
  if(!aud.length)aud.push({Aba:'Auditoria_Export',Contexto:'Exportação',Disciplina:'LP/MT',Tipo:'SEM_DIVERGENCIAS',Detalhe:'5 faixas conferidas',Valor:'OK'});
  state.auditoria=aud;
  return aud;
}
function updateButtons(){const total=totalFiles();qsa('button').forEach(btn=>{const txt=(btn.textContent||'').toLowerCase();if(txt.includes('analisar')){btn.disabled=total===0;btn.textContent='Analisar ('+total+')'}if(txt.includes('excel'))btn.disabled=total===0})}
function updateCards(){['pp1','pp2','pp3'].forEach((key,index)=>{const card=qsa('.upload-card')[index];if(!card)return;const count=state[key].length;const span=card.querySelector('.card-head span');if(span)span.textContent=count+' arquivo'+(count===1?'':'s');let list=card.querySelector('.file-list');if(!list){list=document.createElement('div');list.className='file-list';card.appendChild(list)}list.innerHTML=count?state[key].map(file=>'<div class="file-row"><span>'+escapeHtml(file.name)+'</span><small>'+formatSize(file.size)+'</small></div>').join(''):''})}
function updateMetrics(){const cards=qsa('.dashboard-preview article strong');if(cards[0])cards[0].textContent=state.detalhado.length||totalFiles();if(cards[1])cards[1].textContent=new Set(state.detalhado.map(r=>r.Turma).filter(Boolean)).size||new Set([...state.pp1,...state.pp2,...state.pp3].map(f=>detectTurma(f.name)).filter(Boolean)).size;if(cards[2])cards[2].textContent=state.detalhado.length?'OK':(totalFiles()?'Pronto':'0');if(cards[3])cards[3].textContent=state.auditoria.length}
function updateAll(){updateCards();updateButtons();updateMetrics()}
function handleInput(input,index){const key=['pp1','pp2','pp3'][index];state[key]=Array.from(input.files||[]);updateAll();if(state[key].length)showMessage(state[key].length+' arquivo(s) carregado(s) em '+key.toUpperCase()+'.','success')}
async function analyze(){try{if(!totalFiles()){showMessage('Envie pelo menos um arquivo antes de analisar.','error');return}showMessage('Lendo arquivos e calculando Nível PP...');await buildDetalhado();summarizeDetalhado();gerarAuditoriaExport();updateAll();showMessage('Análise concluída: '+state.detalhado.length+' registro(s), '+state.resumo.length+' resumo(s), '+state.auditoria.length+' auditoria(s).','success')}catch(e){console.error(e);showMessage('Erro ao analisar: '+e.message,'error')}}
function applyWorksheetWidths(ws,widths){ws['!cols']=widths.map(w=>({wch:w}))}
function makeSheet(XLSX,rows,headers){return XLSX.utils.json_to_sheet(rows,{header:headers})}
function workbookAppend(XLSX,wb,ws,name){XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31))}
async function exportSummary(){
  try{
    if(!totalFiles()){showMessage('Não há dados para exportar.','error');return}
    if(!state.detalhado.length){await buildDetalhado();summarizeDetalhado();gerarAuditoriaExport()}
    const XLSX=await loadXLSX();
    const wb=XLSX.utils.book_new();
    const detalheHeaders=['Avaliacao','Arquivo','Turma','Estudante','RA','LP Status','LP Aprend. Equiv','LP Nível PP','MT Status','MT Aprend. Equiv','MT Nível PP'];
    const resumoHeaders=['Avaliacao','Turma','Total','LP Aprend. Média',...PP_LEVELS.map(l=>'LP % '+l),'MT Aprend. Média',...PP_LEVELS.map(l=>'MT % '+l)];
    const audHeaders=['Aba','Contexto','Disciplina','Tipo','Detalhe','Valor'];
    const wsDetalhe=makeSheet(XLSX,state.detalhado,detalheHeaders);applyWorksheetWidths(wsDetalhe,[12,32,12,28,14,18,18,20,18,18,20]);
    const wsResumo=makeSheet(XLSX,state.resumo,resumoHeaders);applyWorksheetWidths(wsResumo,[12,14,10,18,18,18,18,22,20,18,18,18,18,22,20]);
    const wsAud=makeSheet(XLSX,state.auditoria,audHeaders);applyWorksheetWidths(wsAud,[18,42,12,34,30,18]);
    workbookAppend(XLSX,wb,wsDetalhe,'Detalhado');workbookAppend(XLSX,wb,wsResumo,'Resumo');workbookAppend(XLSX,wb,wsAud,'Auditoria_Export');
    XLSX.writeFile(wb,'Prova_Paulista_Consolidada_Auditoria.xlsx');
    showMessage('Excel exportado com Detalhado, Resumo, Nível PP e Auditoria_Export.','success');
  }catch(e){console.error(e);showMessage('Erro ao exportar Excel: '+e.message,'error')}
}
function wireDropzones(){qsa('.upload-card input[type="file"]').forEach((input,index)=>{input.addEventListener('change',()=>handleInput(input,index));const dz=input.closest('.dropzone');if(!dz)return;dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover')});dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragover');input.files=e.dataTransfer.files;handleInput(input,index)})})}
function wireButtons(){qsa('button').forEach(btn=>{const txt=(btn.textContent||'').toLowerCase();if(txt.includes('analisar'))btn.addEventListener('click',analyze);if(txt.includes('excel')||txt.includes('exportar'))btn.addEventListener('click',exportSummary)})}
document.addEventListener('DOMContentLoaded',()=>{wireDropzones();wireButtons();updateAll();showMessage('Sistema carregado. Envie arquivos .xlsx, .xls, .csv ou .zip para gerar Excel com Nível PP e Auditoria_Export.')});
