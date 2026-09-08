(()=>{
  'use strict';
  if(window.__DF_MANUAL_LAYOUT_FIX__)return;
  window.__DF_MANUAL_LAYOUT_FIX__=true;

  const css=`
#df-session-center{
  margin:0 0 14px!important;
  border:1px solid #d9e3ee!important;
  border-radius:14px!important;
  background:#fff!important;
  box-shadow:0 8px 24px rgba(20,48,84,.06)!important;
  overflow:hidden!important;
  font-size:13px!important;
}
#df-session-center .dfso-head{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:16px!important;
  padding:16px 18px 13px!important;
  background:linear-gradient(135deg,#f6f9fd,#fff)!important;
  border-bottom:1px solid #e5ebf2!important;
}
#df-session-center .dfso-head h2{
  margin:0 0 4px!important;
  font-size:17px!important;
  line-height:1.2!important;
  letter-spacing:-.015em!important;
  color:#173f68!important;
}
#df-session-center .dfso-head p{
  margin:0!important;
  max-width:760px!important;
  font-size:9px!important;
  line-height:1.45!important;
  color:#6b7d92!important;
}
#df-session-center .dfso-badge{
  flex:none!important;
  display:inline-flex!important;
  align-items:center!important;
  min-height:27px!important;
  padding:0 10px!important;
  border:1px solid #e3d9b6!important;
  border-radius:999px!important;
  background:#fff8e8!important;
  color:#84641a!important;
  font-size:7.5px!important;
  font-weight:850!important;
  white-space:nowrap!important;
}
#df-session-center .dfso-badge.ok{
  border-color:#cbe8de!important;
  background:#ecf8f4!important;
  color:#176a59!important;
}
#df-session-center .dfso-controls{display:none!important}
#df-manual-info{
  margin:12px 16px 0!important;
  padding:10px 12px!important;
  border:1px solid #d7e4f1!important;
  border-radius:9px!important;
  background:#f7fbff!important;
  color:#315778!important;
  font-size:8px!important;
  line-height:1.55!important;
}
#df-manual-info strong{
  display:inline-block!important;
  margin-bottom:2px!important;
  color:#183f68!important;
  font-size:8.5px!important;
}
#df-session-center .dfso-source-grid{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:9px!important;
  padding:14px 16px 15px!important;
  align-items:stretch!important;
}
#df-session-center .dfso-card{
  min-width:0!important;
  min-height:182px!important;
  display:flex!important;
  flex-direction:column!important;
  padding:12px!important;
  border:1px solid #dfe7ef!important;
  border-radius:11px!important;
  background:#fbfcfe!important;
  box-shadow:none!important;
  color:#294762!important;
}
#df-session-center .dfso-card.complete{
  border-color:#c8e7dc!important;
  background:#effaf6!important;
}
#df-session-center .dfso-card.partial{
  border-color:#ead9a8!important;
  background:#fff9eb!important;
}
#df-session-center .dfso-card.capturing{
  border-color:#c9dcf3!important;
  background:#f2f7ff!important;
}
#df-session-center .dfso-card.error{
  border-color:#efcfd4!important;
  background:#fff7f7!important;
}
#df-session-center .dfso-card.unavailable{
  border-color:#dfe4ea!important;
  background:#f7f8fa!important;
}
#df-session-center .dfso-title{
  display:flex!important;
  align-items:center!important;
  gap:7px!important;
  min-height:22px!important;
}
#df-session-center .dfso-title>span:first-child{
  font-size:17px!important;
  line-height:1!important;
}
#df-session-center .dfso-title b{
  font-size:10px!important;
  line-height:1.2!important;
  color:#244764!important;
}
#df-session-center .dfso-state{
  margin-left:auto!important;
  flex:none!important;
  font-size:7px!important;
  font-weight:850!important;
  white-space:nowrap!important;
  color:#61748a!important;
}
#df-session-center .dfso-card.complete .dfso-state{color:#176a59!important}
#df-session-center .dfso-card.partial .dfso-state{color:#8a6517!important}
#df-session-center .dfso-card.error .dfso-state{color:#9b444d!important}
#df-session-center .dfso-card>p{
  margin:8px 0 7px!important;
  min-height:37px!important;
  font-size:7.6px!important;
  line-height:1.48!important;
  color:#718397!important;
}
#df-session-center .dfso-meta{
  display:flex!important;
  gap:7px!important;
  flex-wrap:wrap!important;
  min-height:16px!important;
  margin-top:auto!important;
  color:#8090a2!important;
  font-size:6.8px!important;
}
#df-session-center .dfso-meta span{
  display:inline-flex!important;
  align-items:center!important;
}
#df-session-center [data-manual-capture],
#df-session-center [data-session-source]{
  width:max-content!important;
  max-width:100%!important;
  min-height:29px!important;
  margin-top:9px!important;
  padding:0 9px!important;
  border:1px solid #cfdae7!important;
  border-radius:7px!important;
  background:#fff!important;
  color:#31536f!important;
  font-size:7.5px!important;
  font-weight:850!important;
}
#df-session-center [data-manual-capture]:hover,
#df-session-center [data-session-source]:hover{
  border-color:#aebfd2!important;
  background:#f8fbff!important;
}
#df-session-center .df-manual-guide{
  margin-top:8px!important;
  padding-top:6px!important;
  border-top:1px dashed #d8e2ed!important;
}
#df-session-center .df-manual-guide summary{
  list-style:none!important;
  cursor:pointer!important;
  color:#315d88!important;
  font-size:7px!important;
  font-weight:850!important;
}
#df-session-center .df-manual-guide summary::-webkit-details-marker{display:none!important}
#df-session-center .df-manual-guide summary:before{content:'› ';font-size:10px!important}
#df-session-center .df-manual-guide[open] summary:before{content:'⌄ '!important;font-size:8px!important}
#df-session-center .df-manual-guide ol{
  margin:6px 0 0 17px!important;
  padding:0!important;
  color:#62788e!important;
  font-size:7px!important;
  line-height:1.5!important;
}
#df-session-center .df-manual-error{
  margin-top:8px!important;
  padding:8px 9px!important;
  border:1px solid #f0d1d5!important;
  border-radius:8px!important;
  background:#fff0f1!important;
  color:#8e3f46!important;
  font-size:7px!important;
  line-height:1.5!important;
}
#df-session-center .df-manual-error strong{
  display:block!important;
  margin-bottom:3px!important;
  font-size:7.5px!important;
}
#df-session-center .df-manual-tech{
  margin-top:5px!important;
  padding-top:4px!important;
  border-top:1px solid #f0dadd!important;
}
#df-session-center .df-manual-tech summary{
  cursor:pointer!important;
  font-size:6.8px!important;
  font-weight:850!important;
}
#df-session-center .df-pp-subcards{
  display:grid!important;
  gap:6px!important;
  margin-top:8px!important;
}
#df-session-center .df-pp-slot{
  padding:8px!important;
  border:1px solid #dfe7ef!important;
  border-radius:8px!important;
  background:#fff!important;
}
#df-session-center .df-pp-row{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:7px!important;
}
#df-session-center .df-pp-row b{
  font-size:7.6px!important;
  color:#294762!important;
}
#df-session-center .df-manual-status{
  font-size:6.7px!important;
  font-weight:850!important;
  white-space:nowrap!important;
}
#df-session-center .df-manual-actions{
  display:flex!important;
  gap:5px!important;
  flex-wrap:wrap!important;
  margin-top:7px!important;
}
#df-session-center .df-manual-actions button,
#df-session-center .df-pp-slot button{
  min-height:27px!important;
  padding:0 8px!important;
  border:1px solid #d4deea!important;
  border-radius:7px!important;
  background:#fff!important;
  color:#31536f!important;
  font-size:7px!important;
  font-weight:800!important;
}
#df-session-center .df-manual-actions .danger{
  border-color:#eadfb8!important;
  background:#fff9e9!important;
  color:#7c5c15!important;
}
#df-session-center .dfso-overview{
  margin:0 16px 16px!important;
  padding:14px!important;
  border:1px solid #e0e7ef!important;
  border-radius:11px!important;
  background:#fff!important;
}
#df-session-center .dfso-overview h3{
  margin:0 0 9px!important;
  color:#183f68!important;
  font-size:12px!important;
}
#df-session-center .dfso-kpis{
  display:grid!important;
  grid-template-columns:repeat(6,minmax(0,1fr))!important;
  gap:7px!important;
}
#df-session-center .dfso-kpis>div{
  min-width:0!important;
  padding:9px!important;
  border:1px solid #e1e8ef!important;
  border-radius:8px!important;
  background:#fbfcfe!important;
}
#df-session-center .dfso-kpis span{
  display:block!important;
  color:#7d8fa2!important;
  font-size:6.3px!important;
  font-weight:850!important;
}
#df-session-center .dfso-kpis b{
  display:block!important;
  margin-top:3px!important;
  color:#234869!important;
  font-size:13px!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
#df-session-center .df-overview-source{
  display:grid!important;
  grid-template-columns:1.4fr .8fr .8fr!important;
  gap:8px!important;
  padding:7px 0!important;
  border-bottom:1px solid #edf1f5!important;
  font-size:7.4px!important;
}
#df-session-center .df-overview-source:last-child{border-bottom:0!important}
#df-session-center .df-overview-source b{color:#294762!important}
#df-session-center .df-overview-generate{
  margin-top:10px!important;
  min-height:31px!important;
  padding:0 10px!important;
  border:0!important;
  border-radius:7px!important;
  background:#1859b7!important;
  color:#fff!important;
  font-size:7.8px!important;
  font-weight:850!important;
}
#df-session-center .dfso-summary{
  margin-top:9px!important;
  padding:9px 10px!important;
  border-left:4px solid #1859b7!important;
  border-radius:7px!important;
  background:#f5f9ff!important;
  color:#36536e!important;
  font-size:7.6px!important;
  line-height:1.5!important;
}
@media(max-width:1180px){
  #df-session-center .dfso-source-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  #df-session-center .dfso-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}
}
@media(max-width:880px){
  #df-session-center .dfso-source-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #df-session-center .dfso-head{display:block!important}
  #df-session-center .dfso-badge{margin-top:8px!important}
}
@media(max-width:560px){
  #df-session-center .dfso-source-grid,#df-session-center .dfso-kpis{grid-template-columns:1fr!important}
  #df-session-center{border-radius:10px!important}
}
`;
  let style=document.getElementById('df-manual-layout-fix-css');
  if(!style){style=document.createElement('style');style.id='df-manual-layout-fix-css';document.head.appendChild(style);}
  style.textContent=css;

  function cleanStructure(){
    const host=document.getElementById('df-session-center');
    if(!host)return;
    const controls=host.querySelector('.dfso-controls');if(controls)controls.style.display='none';
    const badge=host.querySelector('.dfso-badge');
    if(badge&&/conectado/i.test(badge.textContent||''))badge.classList.add('ok');
  }
  const app=document.getElementById('app')||document.documentElement;
  new MutationObserver(()=>cleanStructure()).observe(app,{childList:true,subtree:true});
  cleanStructure();
})();
