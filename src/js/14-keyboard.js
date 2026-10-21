/* ============================== KEYBOARD ============================== */
document.addEventListener("keydown",function(e){
// power-on on any key
if(S.phase==="off"){
if(e.metaKey||e.ctrlKey||e.altKey) return;
if(S.warming){ jumpWarm(); } else { powerOn({}); }
return;
}
// skip BIOS
if(S.phase==="boot"&&!hashes.hold){
skipBoot();
if(e.key==="Enter") e.preventDefault();
return;
}
if(S.phase!=="archive") return;
if(S.offing) return;   /* power-off running: no input */
/* v7 G3 (item 15): while the shell is open it captures EVERY key —
arrows/Enter/Esc keep their normal meaning only while it is closed */
if(dosS.open){ dosKey(e); return; }
/* disk-fly running: nav input ignored — but the short eject fly is
interrupted by any nav key (the new view is already up) */
if(S.navBusy){ if(!interruptEject()) return; }
if(e.key==="/"&&!S.phone){ e.preventDefault(); openDos(); return; } /* v7 G3 (item 15) */
if(e.key==="Escape"){
e.preventDefault();
if(crumbMenu){ closeCrumbMenu(); return; }
if(S.detailId) closeDetail();
else if(!cardEl.hidden) closeCard();
else if(S.path.length) eject();
return;
}
if(e.key==="Backspace"){
e.preventDefault();
if(S.detailId) closeDetail();
else if(!cardEl.hidden) closeCard();
else if(S.path.length) eject();
return;
}
if(e.key==="Enter"||e.key===" "){
var f=document.activeElement;
if(f&&(f.classList.contains("obj")||f.classList.contains("plain-row"))){
// native button handles Enter/Space; avoid double for Space
if(e.key===" "){ e.preventDefault(); f.click(); }
return;
}
}
if(/^(ArrowRight|ArrowDown|ArrowLeft|ArrowUp)$/.test(e.key)){
e.preventDefault();
/* Shift+Arrow moves the FOCUSED disk one cell (swap if occupied) */
var f0=document.activeElement;
if(e.shiftKey&&!S.plain&&CELL&&f0&&f0.classList&&f0.classList.contains("obj")){
var step=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:e.key==="ArrowDown"?CELL.cols:-CELL.cols;
var cur=(+f0.parentElement.dataset.cell)+step;
if(cur>=0&&cur<CELL.cols*CELL.rows){
placeSwap(f0.parentElement,cur); saveLayout();
/* an open card must keep pointing at the disk that moved */
if(!cardEl.hidden&&f0.dataset.item&&f0.dataset.item===S.cardId){
var moved=f0;
setTimeout(function(){
if(!cardEl.hidden&&S.cardId===moved.dataset.item&&moved.isConnected) positionCard(moved);
},320); /* after the 260ms cell move settles */
}
}
return;
}
var list=Array.prototype.slice.call(arcBody.querySelectorAll(".obj,.plain-row"));
if(!list.length) return;
var idx=list.indexOf(document.activeElement);
var step=(e.key==="ArrowRight"||e.key==="ArrowDown")?1:-1;
var nxt=(idx<0)?(step>0?0:list.length-1):(idx+step+list.length)%list.length;
list[nxt].focus();
if(!cardEl.hidden&&list[nxt].dataset.item){
showCard(list[nxt].dataset.item);
}
}
});
