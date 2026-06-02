const state={pp1:[],pp2:[],pp3:[]};

function qs(s){return document.querySelector(s)}
function qsa(s){return Array.from(document.querySelectorAll(s))}
function setText(el,text){if(el)el.textContent=text}
function showMessage(text,type='info'){
  const msg=qs('#msg');
  if(!msg)return;
  msg.textContent=text;
  msg.dataset.type=type;
}
function totalFiles(){return state.pp1.length+state.pp2.length+state.pp3.length}
function formatSize(bytes){
  if(!bytes)return '0 KB';
  if(bytes<1024*1024)return Math.round(bytes/1024)+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
}
function updateButtons(){
  const total=totalFiles();
  qsa('button').forEach(btn=>{
    const txt=(btn.textContent||'').toLowerCase();
    if(txt.includes('analisar')){btn.disabled=total===0;btn.textContent='Analisar ('+total+')'}
    if(txt.includes('excel')){btn.disabled=total===0}
  });
}
function updateCards(){
  ['pp1','pp2','pp3'].forEach((key,index)=>{
    const card=qsa('.upload-card')[index];
    if(!card)return;
    const count=state[key].length;
    const span=card.querySelector('.card-head span');
    setText(span,count+' arquivo'+(count===1?'':'s'));
    let list=card.querySelector('.file-list');
    if(!list){
      list=document.createElement('div');
      list.className='file-list';
      card.appendChild(list);
    }
    if(count===0){list.innerHTML='';return;}
    list.innerHTML=state[key].map(file=>'<div class="file-row"><span>'+file.name+'</span><small>'+formatSize(file.size)+'</small></div>').join('');
  });
}
function updateMetrics(){
  const cards=qsa('.dashboard-preview article strong');
  if(cards[0])cards[0].textContent=totalFiles();
  if(cards[1])cards[1].textContent=new Set([...state.pp1,...state.pp2,...state.pp3].map(f=>detectTurma(f.name)).filter(Boolean)).size;
  if(cards[2])cards[2].textContent=state.pp1.length+state.pp2.length+state.pp3.length>0?'Pronto':'0';
  if(cards[3])cards[3].textContent='0';
}
function detectTurma(name){
  const base=(name||'').replace(/\.[^.]+$/,'').toUpperCase();
  const m=base.match(/\b([1-9][A-Z]|[1-9]\s*[A-Z]|[1-3][A-Z]\s*(EM|PC|EF)?)\b/);
  return m?m[0].replace(/\s+/g,' '):'';
}
function detectGroup(file){
  const name=(file.name||'').toUpperCase();
  if(name.includes('PP1'))return 'pp1';
  if(name.includes('PP2'))return 'pp2';
  if(name.includes('PP3'))return 'pp3';
  return null;
}
function handleInput(input,index){
  const key=['pp1','pp2','pp3'][index];
  const files=Array.from(input.files||[]);
  state[key]=files;
  updateAll();
  if(files.length){showMessage(files.length+' arquivo(s) carregado(s) em '+key.toUpperCase()+'.','success')}
}
function updateAll(){updateCards();updateButtons();updateMetrics()}
function analyze(){
  const total=totalFiles();
  if(!total){showMessage('Envie pelo menos um arquivo antes de analisar.','error');return}
  const wrong=[];
  [...state.pp1,...state.pp2,...state.pp3].forEach(file=>{
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['zip','xlsx','xls','csv'].includes(ext))wrong.push(file.name);
  });
  if(wrong.length){showMessage('Arquivo(s) com formato não reconhecido: '+wrong.join(', '),'error');return}
  showMessage('Arquivos recebidos. Pré-análise concluída: '+total+' arquivo(s) pronto(s) para consolidação.','success');
}
function exportSummary(){
  const total=totalFiles();
  if(!total){showMessage('Não há dados para exportar.','error');return}
  const rows=[['Grupo','Arquivo','Tamanho','Turma detectada']];
  ['pp1','pp2','pp3'].forEach(key=>state[key].forEach(file=>rows.push([key.toUpperCase(),file.name,formatSize(file.size),detectTurma(file.name)])));
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='resumo_arquivos_prova_paulista.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showMessage('Resumo exportado em CSV.','success');
}
function wireDropzones(){
  qsa('.upload-card input[type="file"]').forEach((input,index)=>{
    input.addEventListener('change',()=>handleInput(input,index));
    const dz=input.closest('.dropzone');
    if(!dz)return;
    dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragover')});
    dz.addEventListener('dragleave',()=>dz.classList.remove('dragover'));
    dz.addEventListener('drop',e=>{
      e.preventDefault();dz.classList.remove('dragover');
      input.files=e.dataTransfer.files;
      handleInput(input,index);
    });
  });
}
function wireButtons(){
  qsa('button').forEach(btn=>{
    const txt=(btn.textContent||'').toLowerCase();
    if(txt.includes('analisar'))btn.addEventListener('click',analyze);
    if(txt.includes('excel')||txt.includes('exportar'))btn.addEventListener('click',exportSummary);
  });
}
document.addEventListener('DOMContentLoaded',()=>{
  wireDropzones();
  wireButtons();
  updateAll();
  showMessage('Sistema carregado. Envie arquivos .zip, .xlsx, .xls ou .csv em PP1, PP2 e PP3.');
});
