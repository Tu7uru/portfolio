/* ============================== BOOT STRAP ============================== */
purgeStoredLayouts(); /* O1: fresh on every load — drop any old archive5.layout.* keys */
fitStage();
window.addEventListener("load",function(){ fitStage(); });
buildCardEl();
if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(function(){ if(S.phase==="archive"){ fitLabels(); applyLayout(); } }); }
if(hashes.skip||hashes.path||hashes.open){
led.classList.add("on");
caption.innerHTML="<b>HARALAMBOS VARSAMIS</b> · TU7URU · ARCHIVE.SYS";
glass.classList.add("on");
spillSet(true); /* v7 G2 (item 10): hash boot skips the raster — the spill fades in straight away */
startArchive(true);
/* validate + set a (possibly nested) path, e.g. #path=PROJECTS/ACADEMIC.
v7 G3 (item 12): an unknown segment = "Not ready reading drive N:" in
the status bar for 3 s, then the shelf lands on the root.
review #2: the error always clears — after 3 s the shelf lands on root,
whether or not the user has already moved (only if the message is
still the one shown). Declared BEFORE the path block: a path-less hash
(#skip&open=nope) must be able to use it too. */
var driveErr=function(dr){
var msg="Not ready reading drive "+dr+":";
setTimeout(function(){ statLeft.textContent=msg; },80);
setTimeout(function(){
if(S.phase==="archive"&&statLeft.textContent===msg){ S.path=[]; render(true); }
},3000);
};
if(hashes.path){
var p=[], node=null, badDrive=null;
for(var pi=0;pi<hashes.path.length;pi++){
var seg=hashes.path[pi];
if(pi===0){
if(DATA[seg]){ p.push(seg); node=DATA[seg]; }
else { badDrive="A"; break; }
}
else{
var nx=null;
for(var pj=0;node&&pj<node.items.length;pj++) if(node.items[pj].id.toUpperCase()===seg){nx=node.items[pj];break;}
if(nx){ p.push(nx.id); node=nx; }
else { badDrive=(p.length&&DATA[p[0]]&&DATA[p[0]].drive)||"A"; break; }
}
}
S.path=p;
if(badDrive) driveErr(badDrive);
}
render(true);
if(hashes.open){
var found=findEverywhere(hashes.open);
if(found){
S.path=found.path.slice(0,-1);
render(true);
(function(fid){ setTimeout(function(){ showCard(fid); },60); })(found.path[found.path.length-1]);
}
/* review #2: an unknown &open item says so, the same way a bad drive does */
else driveErr("A");
}
}else if(hashes.hold){
led.classList.add("on");
caption.innerHTML="<b>HARALAMBOS VARSAMIS</b> · TU7URU · ARCHIVE.SYS";
glass.classList.add("on");
spillSet(true); /* v7 G2 (item 10): the held BIOS still lights the tube */
setTimeout(function(){ startBios({full:true}); },650);
}else{
/* stay off; wait for power */
}
/* v6 test hook (QA c01/c02): push a dummy item into a category and
re-render — a new entry must get a cell, default scene, colour and
card buttons with zero hand-wiring. Test-only; not part of the page. */
window.__addTestData = function(catId, item){
var cat = DATA[catId];
if(!cat) return false;
cat.items.push(item);
render(true);
return true;
};
window.__archive = { DATA:DATA, CATS:CATS, SCHEMA:SCHEMA, SCENES:SCENES };
})();
