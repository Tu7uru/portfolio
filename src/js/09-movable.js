/* ============================== MOVABLE DISKS (P3) ============================== */
/* the screen area is a grid of cells (desktop 5x3, phone 2x4). Disks sit on
cells, drag (or Shift+Arrow) moves them, occupied cells swap, and the
arrangement is remembered per folder in IN-SESSION MEMORY only (O1):
every load starts from the defaults, as if ARRANGE had just been pressed. */
var CELL=null;                 /* {cols,rows,pitch,disk,left,top} — stage px, relative to the tray */
var dragS=null, suppressClick=false;
/* abort a drag and snap the disk back to its cell. Runs on window blur,
resize, pointercancel, or a release that happened off-screen. */
function cancelDrag(){
if(!dragS) return;
var d=dragS; dragS=null;
if(d.dragging&&d.wrap&&d.wrap.isConnected){
d.wrap.classList.remove("dragging");
var p=cellXY(+d.wrap.dataset.cell);
d.wrap.style.left=p.x+"px"; d.wrap.style.top=p.y+"px";
}
}
function nextFree(used,start){
var n=CELL.cols*CELL.rows;
for(var k=0;k<n;k++){ var c=(start+k)%n; if(!used[c]) return c; }
return 0;
}
/* default arrangement (v6 E, O2 + #5): every row is a group of disks whose
CENTRE is the tray's centre — left/right margins are equal by construction
(<0.5 px), all disks in a row share one top y, and multi-row groups sit
centred vertically. No Math.round row/col offsets: a lone last disk lands
dead-centre (it may sit between two cells — the nearest cell is book-
keeping for drag swaps only). */
function defaultPos(n){
var g=CELL, cols=g.cols, out=[], needed=Math.ceil(n/cols);
var grpTop=Math.max(4,(g.trayH-(needed-1)*g.pitchY-g.disk)/2);
for(var i=0;i<n;i++){
var r=Math.floor(i/cols), inRow=Math.min(cols,n-r*cols), c=i%cols;
var x0=Math.max(4,g.trayW/2-(inRow-1)/2*g.pitchX-g.disk/2);
out.push({x:Math.min(x0+c*g.pitchX,g.trayW-g.disk-4), y:grpTop+r*g.pitchY});
}
return out;
}
/* nearest grid cell to a pixel position — only for the drag-swap bookkeeping */
function nearestCell(p){
var g=CELL;
var c=Math.round((p.x-g.left)/g.pitchX), r=Math.round((p.y-g.top)/g.pitchY);
c=Math.max(0,Math.min(g.cols-1,c)); r=Math.max(0,Math.min(g.rows-1,r));
return r*g.cols+c;
}
function gridGeom(){
var tray=arcBody.querySelector(".tray");
if(!tray) return null;
var g=S.phone?{cols:2,rows:4,pitchX:142,pitchY:142,disk:128}:{cols:5,rows:3,pitchX:248,pitchY:192,disk:200};
/* v6 E: the 3-row grid (584 px) must fit the tray (594 px) — 208 px used
to clamp g.top to 4 and leave the cell rows 15 px off the centred defaults */
var gw=(g.cols-1)*g.pitchX+g.disk, gh=(g.rows-1)*g.pitchY+g.disk;
g.left=Math.max(4,(tray.clientWidth-gw)/2);
g.top=Math.max(4,(tray.clientHeight-gh)/2);
g.trayW=tray.clientWidth; g.trayH=tray.clientHeight;   /* v6 E (O2): exact centreing */
return g;
}
function cellXYWith(g,cell){
var c=cell%g.cols, r=(cell/g.cols)|0;
return {x:g.left+c*g.pitchX, y:g.top+r*g.pitchY};
}
function cellXY(cell){ return cellXYWith(CELL,cell); }
function wrapId(w){
var o=w.querySelector(".obj");
return o&&(o.getAttribute("data-cat")||o.getAttribute("data-folder")||o.getAttribute("data-item"));
}
var memLayouts={}; /* source of truth per folder — IN-SESSION MEMORY ONLY (O1) */
function layoutKey(){
var g=S.phone?"2x4":"5x3";   /* phone and desktop arrangements never collide */
return "archive5.layout."+g+"."+(S.path.length?S.path.join("/"):"root");
}
/* O1 (v6 E): the page is fresh on EVERY load — layouts are never restored,
the disks sit in their defaults as if ARRANGE had just been pressed.
Old archive5.layout.* keys are cleared on boot. */
function purgeStoredLayouts(){
try{
var drop=[];
for(var i=0;i<localStorage.length;i++){
var k=localStorage.key(i);
if(k&&k.indexOf("archive5.layout.")===0) drop.push(k);
}
drop.forEach(function(k){ localStorage.removeItem(k); });
}catch(e){}
}
function loadLayout(){
/* in-session memory only — never localStorage */
return memLayouts[layoutKey()]||null;
}
function saveLayout(){
var m={};
arcBody.querySelectorAll(".tray .obj-wrap").forEach(function(w){
var id=wrapId(w); if(id) m[id]=+w.dataset.cell;
});
/* O1: memory only — positions are forgotten on the next load */
memLayouts[layoutKey()]=m;
}
function applyLayout(){
if(S.plain) return;
CELL=gridGeom();
if(!CELL) return;
var wraps=Array.prototype.slice.call(arcBody.querySelectorAll(".tray .obj-wrap"));
if(!wraps.length) return;
var saved=loadLayout(), used={}, defs=defaultPos(wraps.length);
wraps.forEach(function(w,i){
var id=wrapId(w), c, p;
/* a disk the user dragged this session keeps its (in-memory) cell;
everything else sits in the exact default position (O2) */
var sv=saved?saved[id]:null;
if(typeof sv==="number"&&sv>=0&&sv<CELL.cols*CELL.rows&&!used[sv|0]){
c=sv|0; p=cellXY(c);
}else{
c=nearestCell(defs[i]);
if(used[c]) c=nextFree(used,c);
p=defs[i];
}
if(used[c]) c=nextFree(used,c);
used[c]=1; w.dataset.cell=c;
w.style.left=p.x+"px"; w.style.top=p.y+"px";
});
/* QA / test hook: grid + scale + tray screen origin */
window.__stage={
scale:S.scale, zoom:!!S.zoom, grid:CELL,
trayRect:function(){ var t=arcBody.querySelector(".tray"), r=t.getBoundingClientRect(); return {left:r.left,top:r.top}; }
};
}
/* put `wrap` on `cell`; if occupied, the two disks swap */
function placeSwap(wrap,cell){
var prev=+wrap.dataset.cell;
if(prev===cell) return;
var occ=null;
arcBody.querySelectorAll(".tray .obj-wrap").forEach(function(w){ if(+w.dataset.cell===cell) occ=w; });
if(occ){
occ.dataset.cell=prev;
var p2=cellXY(prev);
occ.style.left=p2.x+"px"; occ.style.top=p2.y+"px";
}
wrap.dataset.cell=cell;
var p=cellXY(cell);
wrap.style.left=p.x+"px"; wrap.style.top=p.y+"px";
}
function dragInit(){
/* any fresh press clears a stale drag (e.g. a pointerup we never saw) */
document.addEventListener("pointerdown",function(){ cancelDrag(); },true);
arcBody.addEventListener("pointerdown",function(e){
if(S.plain||S.navBusy||S.offing) return;
if(e.pointerType==="mouse"&&e.button!==0) return;
var o=e.target.closest ? e.target.closest(".tray .obj") : null;
if(!o) return;
dragS={wrap:o.parentElement, x0:e.clientX, y0:e.clientY, dragging:false, id:e.pointerId, g:CELL};
});
arcBody.addEventListener("pointermove",function(e){
if(!dragS||e.pointerId!==dragS.id) return;
if(e.buttons===0){ cancelDrag(); return; }   /* button released off-screen: snap back, never strand */
var g=dragS.g||CELL;
if(!dragS.dragging){
/* 6 px threshold — a click/tap still opens */
if(Math.sqrt(Math.pow(e.clientX-dragS.x0,2)+Math.pow(e.clientY-dragS.y0,2))<=6) return;
dragS.dragging=true;
dragS.wrap.classList.add("dragging");
/* capture from here on: up/cancel are delivered to us however far the pointer flies */
try{ arcBody.setPointerCapture(e.pointerId); }catch(err){}
if(S.cardId||(cardEl&&!cardEl.hidden)) closeCard();
}
var tray=arcBody.querySelector(".tray"), r=tray.getBoundingClientRect();
var x=(e.clientX-r.left)/S.scale-g.disk/2;
var y=(e.clientY-r.top)/S.scale-g.disk/2;
x=Math.max(-24,Math.min(g.left+(g.cols-1)*g.pitchX+24,x));
y=Math.max(-24,Math.min(g.top+(g.rows-1)*g.pitchY+24,y));
dragS.wrap.style.left=x+"px"; dragS.wrap.style.top=y+"px";
});
function up(e){
if(!dragS||e.pointerId!==dragS.id) return;
var d=dragS; dragS=null;
try{ arcBody.releasePointerCapture(e.pointerId); }catch(err){}
if(!d.dragging) return;
var g=d.g||CELL;
d.wrap.classList.remove("dragging");
/* drop computed from the cell geometry captured at drag start */
var cx=parseFloat(d.wrap.style.left)+g.disk/2, cy=parseFloat(d.wrap.style.top)+g.disk/2;
var best=0, bd=Infinity;
for(var i=0;i<g.cols*g.rows;i++){
var p=cellXYWith(g,i), dx=p.x+g.disk/2-cx, dy=p.y+g.disk/2-cy, dd=dx*dx+dy*dy;
if(dd<bd){ bd=dd; best=i; }
}
placeSwap(d.wrap,best);
saveLayout();
suppressClick=true; setTimeout(function(){ suppressClick=false; },0);
}
arcBody.addEventListener("pointerup",up);
arcBody.addEventListener("pointercancel",cancelDrag);
window.addEventListener("blur",cancelDrag);
}
