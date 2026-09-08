(()=>{
  'use strict';
  if(window.__DF_TURMA_CARD_VIEW__)return;
  window.__DF_TURMA_CARD_VIEW__=true;

  const PREF='df-turma-view-v1';
  let mode=localStorage.getItem(PREF)||'cards';
  let timer=null;

  function ensureCss(){
    if(document.getElementById('df-turma-card-view-css'))return;
    const st=document.createElement('style');
    st.id='df-turma-card-view-css';
    st.textContent=`
#df-turma-capture-panel .tc-viewbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 9px}
#df-turma-capture-panel .tc-viewbar h3{margin:0;color:#183f68;font-size:10px}
#df-turma-capture-panel .tc-viewbar p{margin:2px 0 0;color:#6c8195;font-size:7.2px}
#df-turma-capture-panel .tc-viewbuttons{display:flex;gap:5px;flex:none}
#df-turma-capture-panel .tc-viewbuttons button{height:27px;padding:0 8px;border:1px solid #d5dfeb;border-radius:7px;background:#fff;color:#31536f;font-size:7px;font-weight:850}
#df-turma-capture-panel .tc-viewbuttons button.on{border-color:#1859b7;background:#1859b7;color:#fff}
#df-turma-capture-panel .tc-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
#df-turma-capture-panel .tc-class-card{min-width:0;padding:10px;border:1px solid #dfe7ef;border-radius:10px;background:#fbfcfe;box-shadow:0 3px 10px rgba(20,48,84,.035)}
#df-turma-capture-panel .tc-class-card.saved{border-color:#c8e7dc;background:#effaf6}
#df-turma-capture-panel .tc-class-card.active{border-color:#bfd7f4;background:#f2f7ff;box-shadow:0 0 0 2px rgba(24,89,183,.07)}
#df-turma-capture-panel .tc-class-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}
#df-turma-capture-panel .tc-class-name{color:#183f68;font-size:10px;font-weight:900;line-height:1.25}
#df-turma-capture-panel .tc-class-status{font-size:6.8px;font-weight:900;white-space:nowrap;color:#718397}
#df-turma-capture-panel .tc-class-card.saved .tc-class-status{color:#14886f}
#df-turma-capture-panel .tc-class-card.active .tc-class-status{color:#1859b7}
#df-turma-capture-panel .tc-class-source{margin-top:5px;color:#6d8196;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#df-turma-capture-panel .tc-class-meta{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}
#df-turma-capture-panel .tc-class-meta div{padding:6px;border:1px solid #e6ecf2;border-radius:7px;background:#fff}
#df-turma-capture-panel .tc-class-meta span{display:block;color:#8a98a8;font-size:5.8px;font-weight:850}
#df-turma-capture-panel .tc-class-meta b{display:block;margin-top:2px;color:#36536e;font-size:7.4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#df-turma-capture-panel .tc-class-card button{width:100%;height:29px;margin-top:8px;border:1px solid #ccd9e7;border-radius:7px;background:#fff;color:#31536f;font-size:7px;font-weight:850}
#df-turma-capture-panel .tc-class-card.active button{border-color:#1859b7;background:#1859b7;color:#fff}
#df-turma-capture-panel .tc-card-empty{padding:15px;border:1px dashed #cad7e4;border-radius:9px;background:#fbfdff;color:#6b7d92;font-size:8px;text-align:center;margin-bottom:10px}
#df-turma-capture-panel[data-tc-view='cards'] .tc-table{display:none}
#df-turma-capture-panel[data-tc-view='table'] .tc-card-grid,#df-turma-capture-panel[data-tc-view='table'] .tc-card-empty{display:none}
@media(max-width:1200px){#df-turma-capture-panel .tc-card-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:850px){#df-turma-capture-panel .tc-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tc-viewbar{align-items:flex-start!important}}
@media(max-width:520px){#df-turma-capture-panel .tc-card-grid{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
  }

  function text(td){return (td?.textContent||'').replace(/\s+/g,' ').trim();}

  function build(){
    ensureCss();
    const panel=document.getElementById('df-turma-capture-panel');
    if(!panel)return;
    panel.dataset.tcView=mode;

    const table=panel.querySelector('.tc-table table');
    if(!table)return;
    const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelectorAll('td').length>=6);

    let viewbar=panel.querySelector('.tc-viewbar');
    if(!viewbar){
      viewbar=document.createElement('div');
      viewbar.className='tc-viewbar';
      const live=panel.querySelector('.tc-live');
      (live||panel.querySelector('.tc-controls'))?.insertAdjacentElement('afterend',viewbar);
    }
    viewbar.innerHTML=`<div><h3>Turmas da escola</h3><p>Escolha uma turma e vá capturando uma por uma. O status fica salvo por fonte.</p></div><div class="tc-viewbuttons"><button data-tc-view="cards" class="${mode==='cards'?'on':''}">Cards</button><button data-tc-view="table" class="${mode==='table'?'on':''}">Tabela</button></div>`;

    let grid=panel.querySelector('.tc-card-grid');
    let empty=panel.querySelector('.tc-card-empty');
    if(!grid){
      grid=document.createElement('div');grid.className='tc-card-grid';
      viewbar.insertAdjacentElement('afterend',grid);
    }
    if(!empty){
      empty=document.createElement('div');empty.className='tc-card-empty';
      viewbar.insertAdjacentElement('afterend',empty);
    }

    if(!rows.length){
      grid.innerHTML='';
      empty.textContent='Ainda não encontrei turmas para esta escola. Assim que uma captura trouxer a coluna Turma, elas aparecerão aqui automaticamente. Você também pode adicionar uma turma manualmente abaixo.';
      empty.style.display=mode==='cards'?'block':'none';
      return;
    }
    empty.style.display='none';

    const frag=document.createDocumentFragment();
    for(const row of rows){
      const tds=row.querySelectorAll('td');
      const turma=text(tds[0]),source=text(tds[1]),status=text(tds[2]),records=text(tds[3]),when=text(tds[4]);
      const original=row.querySelector('[data-tc-capture]');
      if(!turma||!original)continue;
      const card=document.createElement('article');
      const saved=/salvo/i.test(status),active=/captando/i.test(status);
      card.className=`tc-class-card${saved?' saved':''}${active?' active':''}`;
      const head=document.createElement('div');head.className='tc-class-head';
      const name=document.createElement('div');name.className='tc-class-name';name.textContent=turma;
      const state=document.createElement('div');state.className='tc-class-status';state.textContent=status;
      head.append(name,state);
      const src=document.createElement('div');src.className='tc-class-source';src.textContent=source;
      const meta=document.createElement('div');meta.className='tc-class-meta';
      const m1=document.createElement('div');m1.innerHTML='<span>REGISTROS</span>';const b1=document.createElement('b');b1.textContent=records;m1.appendChild(b1);
      const m2=document.createElement('div');m2.innerHTML='<span>ÚLTIMA CAPTURA</span>';const b2=document.createElement('b');b2.textContent=when;m2.appendChild(b2);
      meta.append(m1,m2);
      const btn=document.createElement('button');btn.dataset.tcCapture=original.dataset.tcCapture;btn.disabled=original.disabled;btn.textContent=active?'Capturando…':saved?'Recapturar turma':'Capturar turma';
      card.append(head,src,meta,btn);frag.appendChild(card);
    }
    grid.replaceChildren(frag);
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-tc-view]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    mode=b.dataset.tcView==='table'?'table':'cards';
    localStorage.setItem(PREF,mode);
    build();
  },true);

  function schedule(){clearTimeout(timer);timer=setTimeout(build,80);}
  const root=document.getElementById('app')||document.documentElement;
  new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))schedule();}).observe(root,{childList:true,subtree:true});
  setTimeout(build,250);
})();
