function normalizeHeaderCell(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function headerScore(row){
  const text=row.map(normalizeHeaderCell).join(' ').toUpperCase();
  let score=0;
  ['RA','ALUNO','ESTUDANTE','NOME','TURMA','CLASSE','SERIE','LPT','PORT','LP','MAT','MATEMATICA','SARESP','DIAGNOSTICA','PROVA','PAULISTA','ACERTOS','APRENDIZAGEM','EQUIVALENTE','PARTICIPACAO'].forEach(w=>{if(text.includes(w))score++});
  return score;
}
function makeUniqueHeaders(headers){
  const seen={};
  return headers.map((h,i)=>{
    let name=normalizeHeaderCell(h)||('Coluna '+(i+1));
    if(seen[name]){seen[name]++;name=name+' '+seen[name]}else seen[name]=1;
    return name;
  });
}
readWorkbook=async function(buf,name){
  const XLSX=await loadXLSX();
  const wb=XLSX.read(buf,{type:'array'});
  let rows=[];
  wb.SheetNames.forEach(sh=>{
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sh],{header:1,defval:'',raw:false});
    if(!aoa.length)return;
    let headerIndex=0,best=-1;
    aoa.slice(0,20).forEach((row,i)=>{const s=headerScore(row);if(s>best){best=s;headerIndex=i}});
    const headers=makeUniqueHeaders(aoa[headerIndex]||[]);
    for(let i=headerIndex+1;i<aoa.length;i++){
      const line=aoa[i]||[];
      if(!line.some(v=>String(v??'').trim()))continue;
      const obj={};
      headers.forEach((h,j)=>obj[h]=line[j]??'');
      obj.Arquivo=name;
      obj.Aba=sh;
      obj.__headerRow=headerIndex+1;
      rows.push(obj);
    }
  });
  return rows;
};
const oldParseCsv=parseCsv;
parseCsv=function(txt){
  const sep=txt.includes(';')?';':',';
  const lines=txt.split(/\r?\n/).filter(x=>x.trim());
  const split=lines.map(l=>l.split(sep));
  let headerIndex=0,best=-1;
  split.slice(0,20).forEach((row,i)=>{const s=headerScore(row);if(s>best){best=s;headerIndex=i}});
  const headers=makeUniqueHeaders(split[headerIndex]||[]);
  return split.slice(headerIndex+1).map(line=>Object.fromEntries(headers.map((h,i)=>[h,(line[i]||'').trim()])));
};