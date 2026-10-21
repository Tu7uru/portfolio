/* ===== P10 shared figure kit (one body grammar for ALL humans) =====
Every human figure is built from these constants so the set reads as
one family: identical head circle, one limb stroke (inherited from the
svg's 1.6), round caps, joints only at 0/45/90, arms >= 60% of the
torso, and a small hand at the end of each arm. Grid angles (SVG
y-down): 0=right, 45=down-right, 90=down, 135=down-left, 180=left,
225=up-left, 270=up, 315=up-right. */
var FK={r:2.3, torso:6.0, leg:5.0, arm:4.0, sh:0.9, hand:0.62};
function _uv(deg,len){var a=deg*Math.PI/180;return[Math.cos(a)*len,Math.sin(a)*len];}
function _limb(x,y,deg,len){var v=_uv(deg,len);return'<line x1="'+x.toFixed(2)+'" y1="'+y.toFixed(2)+'" x2="'+(x+v[0]).toFixed(2)+'" y2="'+(y+v[1]).toFixed(2)+'"/>';}
function _head(x,y){return'<circle class="fh" cx="'+x+'" cy="'+y+'" r="'+FK.r+'"/>';}
function _torso(x,y){return'<line x1="'+x+'" y1="'+(y+FK.r)+'" x2="'+x+'" y2="'+(y+FK.r+FK.torso)+'"/>';}
function _hand(x,y){return'<circle class="hand" cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="'+FK.hand+'" fill="currentColor" stroke="none"/>';}
/* 1-bit label icons: one big readable themed scene per disk. P10 — every
scene is centred, fills ~80% of the box, one human figure uses the
shared kit, one unmistakable prop, one 0.9-1.6s loop with a clearly
visible amplitude that ends where it begins; the static frame is the
key pose. */
function licSVG(kind){
var S='<svg data-scene="'+kind+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
/* about — figure waving an open hand; pivot beside the head, arm
swings 20°–60° from vertical so the hand never crosses the face */
if(kind==="about"){var hx=10.5,hy=6.0,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
var px=12.8,py=sh; // shoulder pivot, outside the head circle
var ax=px+4*Math.cos(310*Math.PI/180),ay=py+4*Math.sin(310*Math.PI/180); // forearm drawn at 310° (mid-swing)
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)
+_limb(hx,sh,0,2.3)
+'<g class="li-wave" style="transform-origin:'+px+'px '+py+'px">'+_limb(px,py,310,4.0)
+'<circle cx="'+ax.toFixed(2)+'" cy="'+ay.toFixed(2)+'" r="0.9" fill="currentColor" stroke="none"/>'
+_limb(ax,ay,250,1.2)+_limb(ax,ay,285,1.2)+_limb(ax,ay,320,1.2)+'</g></g></svg>';}
/* me — figure holding a steaming mug; key pose = mug held */
if(kind==="me"){var hx=8.5,hy=6.6,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,0,FK.arm)+_hand(hx+FK.arm,sh)
+_limb(hx,sh,45,FK.arm*0.9)+_hand(hx+2.55,sh+2.55)+'</g>'
+'<path class="li-steam1" d="M14 8.8c.7-.9-.7-1.7 0-2.7" opacity=".55"/>'
+'<path class="li-steam2" d="M15.7 8.8c.7-.9-.7-1.7 0-2.7" opacity=".55"/>'
+'<path d="M13 9.6h4l-.5 4.2h-3z"/>'
+'<path d="M17 10.4a1.5 1.5 0 0 1 0 2.6"/></svg>';}
/* work — typist SEATED on a chair at a desk (the chair is the cue) */
if(kind==="work"){
return S
/* chair */
+'<line x1="5.2" y1="8.6" x2="5.2" y2="13.9"/>'
+'<line x1="5.2" y1="13.9" x2="10.8" y2="13.9"/>'
+'<line x1="5.8" y1="13.9" x2="5.8" y2="18.4"/><line x1="10.2" y1="13.9" x2="10.2" y2="18.4"/>'
/* seated figure */
+'<g class="fig">'+_head(7.6,6.0)
+'<line x1="7.6" y1="8.3" x2="8.0" y2="13.5"/>'
+_limb(8.0,13.5,0,3.2)+_limb(11.2,13.5,90,4.1)+_limb(11.2,17.6,0,1.2)
+'<g class="li-type">'+_limb(7.6,9.6,0,3.3)+_hand(10.9,9.6)
+_limb(7.6,9.6,45,3.6)+_hand(10.15,12.15)+'</g></g>'
/* desk + monitor */
+'<line x1="10.8" y1="12.6" x2="21" y2="12.6"/>'
+'<rect x="14.6" y="5.6" width="5.8" height="5.8" rx=".5"/>'
+'<line x1="17.5" y1="11.4" x2="17.5" y2="12.6"/><line x1="15.9" y1="12.6" x2="19.1" y2="12.6"/></svg>';}
/* deloitte — standing presenter pointing at a rising 3-bar chart */
if(kind==="deloitte"){var hx=6.8,hy=6.4,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)
+'<g class="li-point" style="transform-origin:'+hx+'px '+sh+'px">'+_limb(hx,sh,0,4.4)+_hand(hx+4.4,sh)+'</g></g>'
+'<line x1="12" y1="17" x2="21" y2="17"/>'
+'<rect class="li-bar1" style="transform-origin:13.5px 17px" x="12.4" y="13" width="2.2" height="4"/>'
+'<rect class="li-bar2" style="transform-origin:16.7px 17px" x="15.6" y="11" width="2.2" height="6"/>'
+'<rect class="li-bar3" style="transform-origin:19.9px 17px" x="18.8" y="9" width="2.2" height="8"/></svg>';}
/* intermedia — figure at a code monitor (</> on screen) */
if(kind==="intermedia"){var hx=6.8,hy=6.4,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,0,FK.arm)+_hand(hx+FK.arm,sh)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)+'</g>'
+'<rect x="12" y="4.8" width="9" height="8.4" rx=".6"/>'
+'<polyline class="li-br1" points="14.4,7.4 12.9,8.9 14.4,10.4"/>'
+'<line class="li-br1" x1="16.2" y1="7.2" x2="17.4" y2="10.6"/>'
+'<polyline class="li-br2" points="19.2,7.4 20.7,8.9 19.2,10.4"/>'
+'<line class="li-b1" x1="13.4" y1="11.6" x2="16" y2="11.6"/>'
+'<line class="li-b2" x1="13.4" y1="12.4" x2="17.4" y2="12.4"/>'
+'<line x1="16.5" y1="13.2" x2="16.5" y2="15"/><line x1="14.5" y1="15.2" x2="18.5" y2="15.2"/></svg>';}
/* army — access-control pictogram (owner: approved/blocked, privileges,
clearance): a shield that reads as "clearance" at a glance, with a BLOCKED
mark inside; on hover the ✕ spins out and the APPROVED ✓ spins in, then
back — the loop ends where it began. Prop-only (no figure, like the other
non-human scenes); currentColor, same 24×24 box and 1.6 stroke. */
if(kind==="army"){
return S
+'<path d="M12 2.9l7 2.5v6c0 4.5-2.9 7.7-7 9.4-4.1-1.7-7-4.9-7-9.4v-6z"/>'
+'<g class="li-cross" style="transform-origin:12px 11.2px">'
+'<line x1="9.4" y1="8.6" x2="14.6" y2="13.8"/>'
+'<line x1="14.6" y1="8.6" x2="9.4" y2="13.8"/></g>'
+'<g class="li-tick" style="transform-origin:12px 11.2px" opacity="0">'
+'<polyline points="8.7,11.6 11.1,14 15.3,8.7"/></g></svg>';}
/* edu — student, mortarboard; key pose = cap on head */
if(kind==="edu"){var hx=12,hy=7.0,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)
+_limb(hx,sh,45,FK.arm)+_hand(hx+2.83,sh+2.83)+'</g>'
+'<g class="li-cap" style="transform-origin:12px 4.7px"><polygon points="12,2.6 16.6,4.7 12,6.8 7.4,4.7"/><line x1="16.6" y1="4.7" x2="17.2" y2="7.4"/><circle cx="17.2" cy="7.7" r=".5" fill="currentColor" stroke="none"/></g></svg>';}
/* univ — student reading an open book; key pose = book held */
if(kind==="univ"){var hx=7.5,hy=6.4,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,0,FK.arm)+_hand(hx+FK.arm,sh)
+_limb(hx,sh,45,FK.arm*0.9)+'</g>'
+'<path d="M10.6 14.6c1.9-.9 3.4-.9 4.9 0v4.6c-1.5-.9-3-.9-4.9 0z"/>'
+'<line x1="15.5" y1="14.6" x2="15.5" y2="19.2"/>'
+'<path class="li-page" style="transform-origin:15.5px 14.6px" d="M15.5 14.6c1.5-.9 3-.9 4.9 0v4.6c-1.9-.9-3.4-.9-4.9 0z"/></svg>';}
/* mb500 — certificate with a seal that presses down */
if(kind==="mb500") return S+'<rect x="4" y="4" width="16" height="14" rx="1"/><line x1="6.6" y1="7.6" x2="17.4" y2="7.6"/><line x1="6.6" y1="10.4" x2="14.6" y2="10.4"/><line x1="6.6" y1="13" x2="12" y2="13"/><g class="li-stamp"><circle cx="16.4" cy="14.4" r="2.4"/><circle cx="16.4" cy="14.4" r=".9" fill="currentColor" stroke="none"/></g><line x1="4" y1="20" x2="20" y2="20"/></svg>';
/* PROJECTS — two gears */
if(kind==="gears") return S+'<g class="li-gear1" style="transform-origin:9px 10px"><circle cx="9" cy="10" r="4"/><circle cx="9" cy="10" r="1.3" fill="currentColor" stroke="none"/><line x1="9" y1="5.4" x2="9" y2="3.6"/><line x1="9" y1="14.6" x2="9" y2="16.4"/><line x1="4.4" y1="10" x2="2.6" y2="10"/><line x1="13.6" y1="10" x2="15.4" y2="10"/><line x1="5.7" y1="6.7" x2="4.4" y2="5.4"/><line x1="12.3" y1="13.3" x2="13.6" y2="14.6"/><line x1="12.3" y1="6.7" x2="13.6" y2="5.4"/><line x1="5.7" y1="13.3" x2="4.4" y2="14.6"/></g><g class="li-gear2" style="transform-origin:17.5px 17px"><circle cx="17.5" cy="17" r="2.8"/><circle cx="17.5" cy="17" r="1" fill="currentColor" stroke="none"/><line x1="17.5" y1="13.4" x2="17.5" y2="11.8"/><line x1="17.5" y1="20.6" x2="17.5" y2="22.2"/><line x1="13.9" y1="17" x2="12.3" y2="17"/><line x1="21.1" y1="17" x2="22.7" y2="17"/><line x1="14.9" y1="14.4" x2="13.8" y2="13.3"/><line x1="20.1" y1="19.6" x2="21.2" y2="20.7"/></g></svg>';
/* academic — orbiting atom */
if(kind==="atom") return S+'<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><g class="li-orbit" style="transform-origin:12px 12px"><ellipse cx="12" cy="12" rx="8.8" ry="3.5"/><ellipse cx="12" cy="12" rx="8.8" ry="3.5" transform="rotate(62 12 12)"/><circle cx="20.8" cy="12" r="1" fill="currentColor" stroke="none"/></g></svg>';
/* personal — rocket */
if(kind==="rocket") return S+'<g class="li-rocket"><path d="M12 2.6c2.9 2.2 3.8 5.4 3.8 8l-3.8 4-3.8-4c0-2.6.9-5.8 3.8-8z"/><circle cx="12" cy="9.2" r="1.6"/><path d="M8.2 11.6l-2.6 3.2 3.2.6M15.8 11.6l2.6 3.2-3.2.6"/><line class="li-flame" style="transform-origin:12px 15px" x1="12" y1="15" x2="12" y2="20"/></g></svg>';
/* alpha — compiler, left→right with clear gaps: {} drops into a
small funnel, arrow into a clean box with ONE gear, "0 1" slides out */
if(kind==="alpha"){
return S
+'<g class="li-tok"><path d="M3.9 4.3c-1.1 1.1-1.1 2.3 0 3.4"/><path d="M5.9 4.3c1.1 1.1 1.1 2.3 0 3.4"/></g>'
+'<line x1="2.4" y1="9.4" x2="7.4" y2="9.4"/><line x1="2.4" y1="9.4" x2="4.1" y2="12.4"/><line x1="7.4" y1="9.4" x2="5.7" y2="12.4"/><line x1="4.9" y1="12.4" x2="4.9" y2="13.9"/>'
+'<line x1="5.7" y1="13.9" x2="8.6" y2="13.9"/><polyline points="8.0,13.3 8.6,13.9 8.0,14.5"/>'
+'<rect x="9.4" y="10.6" width="6.6" height="6.6" rx=".6"/>'
+'<g class="li-gearS" style="transform-origin:12.7px 13.9px"><circle cx="12.7" cy="13.9" r="1.9"/><line x1="12.7" y1="12.0" x2="12.7" y2="11.4"/><line x1="12.7" y1="15.8" x2="12.7" y2="16.4"/><line x1="10.8" y1="13.9" x2="10.2" y2="13.9"/><line x1="14.6" y1="13.9" x2="15.2" y2="13.9"/><circle cx="12.7" cy="13.9" r=".55" fill="currentColor" stroke="none"/></g>'
+'<g class="li-bits"><circle cx="18.2" cy="13.9" r="1.3"/><line x1="21" y1="12.6" x2="21" y2="15.2"/><line x1="20.3" y1="13.2" x2="21" y2="12.6"/></g></svg>';}
/* themis — librarian shelving a book (book moves into the shelf) */
if(kind==="themis"){var hx=16.5,hy=6.6,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S
+'<line x1="3" y1="15.5" x2="12" y2="15.5"/>'
+'<rect x="4" y="10.9" width="1.6" height="4.6"/><rect x="6.2" y="9.7" width="1.6" height="5.8"/><rect x="8.4" y="11.7" width="1.6" height="3.8"/>'
+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,45,FK.arm)+_hand(hx+2.83,sh+2.83)
+'<g class="li-shelve" style="transform-origin:'+hx+'px '+sh+'px">'+_limb(hx,sh,180,FK.arm)+_hand(hx-FK.arm,sh)+'<rect x="'+(hx-FK.arm-1.9)+'" y="'+(sh-1.6)+'" width="1.9" height="4.8"/></g></g></svg>';}
/* fraud — cop (peaked cap) sweeping a magnifier; found dot */
if(kind==="fraud"){var hx=8,hy=6.6,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S
+'<line x1="'+(hx-1.5)+'" y1="4.2" x2="'+(hx+1.5)+'" y2="4.2"/>'
+'<line x1="'+(hx-2.2)+'" y1="5.0" x2="'+(hx+2.4)+'" y2="5.0"/>'
+'<circle class="li-found" cx="20" cy="15" r="1.1" fill="currentColor" stroke="none"/>'
+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)
+'<g class="li-mag" style="transform-origin:'+hx+'px '+sh+'px">'+_limb(hx,sh,0,FK.arm)+_hand(hx+FK.arm,sh)+'<circle cx="15.5" cy="10" r="3.6"/><line x1="17.9" y1="12.4" x2="20.3" y2="14.8"/></g></g></svg>';}
/* icu — doctor (cross) + nurse (cap) over a heartbeat */
if(kind==="icu"){
var dsh=5.6+FK.r+FK.sh, nsh=5.6+FK.r+FK.sh;
return S
+'<g class="fig">'+_head(8,5.6)+'<line x1="8" y1="'+(5.6+FK.r)+'" x2="8" y2="'+(5.6+FK.r+4.9)+'"/>'
+_limb(8,dsh,135,FK.arm)+_hand(8-2.83,dsh+2.83)+_limb(8,dsh,45,FK.arm*0.9)+_hand(8+2.2,dsh+2.2)
+'<line x1="6.8" y1="3.3" x2="9.2" y2="3.3"/><line x1="8" y1="2.1" x2="8" y2="4.5"/></g>'
+'<g class="fig">'+_head(16,5.6)+'<line x1="16" y1="'+(5.6+FK.r)+'" x2="16" y2="'+(5.6+FK.r+4.9)+'"/>'
+_limb(16,nsh,135,FK.arm*0.9)+_hand(16-2.2,nsh+2.2)+_limb(16,nsh,45,FK.arm)+_hand(16+2.83,nsh+2.83)
+'<rect x="14.8" y="2.7" width="2.4" height="1.4" rx=".3"/></g>'
+'<polyline class="li-beat" pathLength="100" stroke-dasharray="100" points="3,17 7,17 9,13.5 11.5,20.5 13.5,17 16,17 18,14 20,17 21,17"/></svg>';}
/* greek — vertical papyrus, big ΑΩ + meander, bottom roll unrolls down */
if(kind==="greek") return S
/* top roll */
+'<rect x="7.5" y="3" width="9" height="2.4" rx="1.2"/>'
+'<path d="M8.2 4.2h4.2" stroke-width="1"/>'
/* papyrus body (scaleY from the top) */
+'<g class="li-papyrus" style="transform-origin:12px 5.4px">'
+'<line x1="8.6" y1="5.4" x2="8.6" y2="19.2"/><line x1="15.4" y1="5.4" x2="15.4" y2="19.2"/>'
+'<line x1="8.6" y1="19.2" x2="15.4" y2="19.2"/>'
+'<path d="M9.4 6.2v1.2h.9M11.2 6.2v1.2h.9M13 6.2v1.2h.9M14.8 6.2v1.2h.9" stroke-width="1"/>'
+'</g>'
/* Greek letters Α Ω (revealed as it unrolls) */
+'<g class="li-letters" stroke-width="1.5" opacity="1">'
+'<line x1="10.6" y1="14" x2="12.2" y2="9.8"/><line x1="12.2" y1="9.8" x2="13.8" y2="14"/><line x1="11" y1="12.2" x2="13.4" y2="12.2"/>'
+'<path d="M15.6 13.6a2 2 0 1 1 2.4 0" /><line x1="15.6" y1="13.6" x2="15" y2="14.6"/><line x1="18" y1="13.6" x2="18.6" y2="14.6"/>'
+'</g>'
/* bottom roll (slides down, following the sheet bottom) */
+'<g class="li-roll" style="transform-origin:12px 19.2px"><rect x="7.5" y="18" width="9" height="2.4" rx="1.2"/><path d="M9.8 19.2h4.2" stroke-width="1"/></g></svg>';
/* archivesys — CRT: screen fills with scanlines + cursor, then blinks */
if(kind==="archivesys") return S
+'<rect x="5" y="4.5" width="14" height="10.5" rx="1.2"/>'
+'<line x1="12" y1="15" x2="12" y2="17.5"/><line x1="8.5" y1="17.7" x2="15.5" y2="17.7"/>'
+'<g class="li-crt">'
+'<rect x="6.6" y="6.1" width="10.8" height="7.3" fill="currentColor" fill-opacity=".28" stroke="none"/>'
+'<line x1="7.6" y1="7.7" x2="16.4" y2="7.7" stroke-width="1.3"/>'
+'<line x1="7.6" y1="9.3" x2="16.4" y2="9.3" stroke-width="1.3"/>'
+'<line x1="7.6" y1="10.9" x2="13" y2="10.9" stroke-width="1.3"/>'
+'</g>'
+'<rect class="li-cur" x="8" y="11.9" width="1.8" height="1.8" fill="currentColor" stroke="none"/></svg>';
/* github — git graph: main line, 3 commits, branch merges at 3;
dots are light open rings (same stroke as the lines) */
if(kind==="github") return S
+'<line x1="9" y1="4" x2="9" y2="20"/>'
+'<line x1="9" y1="5.5" x2="15.2" y2="12"/><line x1="15.2" y1="12" x2="9" y2="18.5"/>'
+'<circle cx="9" cy="5.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="18.5" r="2"/>'
+'<circle cx="15.2" cy="12" r="2"/>'
+'<circle class="li-branch" cx="9" cy="5.5" r="1.0" fill="currentColor" stroke="none" opacity="0"/></svg>';
/* linkedin — handshake: clasped hands pump up ±3 (2–3 quick shakes,
then hold); near-vertical forearms keep the elbow joints covered */
if(kind==="linkedin"){var hy=6,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S
+'<g class="fig">'+_head(7,hy)+_torso(7,hy)
+_limb(7,hip,135,FK.leg)+_limb(7,hip,45,FK.leg)+_limb(7,sh,135,FK.arm)+_hand(7-2.83,sh+2.83)+'</g>'
+'<g class="fig">'+_head(17,hy)+_torso(17,hy)
+_limb(17,hip,135,FK.leg)+_limb(17,hip,45,FK.leg)+_limb(17,sh,45,FK.arm)+_hand(17+2.83,sh+2.83)+'</g>'
+'<line x1="7" y1="'+sh.toFixed(2)+'" x2="11" y2="14.5"/>'
+'<line x1="17" y1="'+sh.toFixed(2)+'" x2="13" y2="14.5"/>'
+'<g class="li-pump"><line x1="11" y1="14.5" x2="12" y2="10.5"/><line x1="13" y1="14.5" x2="12" y2="10.5"/><circle cx="12" cy="10.5" r="1.3" fill="currentColor" stroke="none"/></g></svg>';}
/* cv — a sheet comes out of the printer */
if(kind==="cv") return S+'<g class="li-sheetC"><rect x="7.2" y="11.2" width="9.6" height="7.2" fill="currentColor" fill-opacity=".16"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="16.4" x2="13.2" y2="16.4"/></g><rect x="4.8" y="9" width="14.4" height="6.2" rx="1"/><line x1="4.8" y1="12" x2="19.2" y2="12"/></svg>';
/* ai-d365 — developer at a screen of code; an AI sparkle twinkles on it */
if(kind==="ai-d365"){var hx=6.8,hy=6.4,sh=hy+FK.r+FK.sh,hip=hy+FK.r+FK.torso;
return S+'<g class="fig">'+_head(hx,hy)+_torso(hx,hy)
+_limb(hx,hip,135,FK.leg)+_limb(hx,hip,45,FK.leg)
+_limb(hx,sh,0,FK.arm)+_hand(hx+FK.arm,sh)
+_limb(hx,sh,135,FK.arm)+_hand(hx-2.83,sh+2.83)+'</g>'
+'<rect x="12" y="4.8" width="9" height="8.4" rx=".6"/>'
+'<path class="li-spark" style="transform-origin:16.5px 8px" d="M16.5 5.9l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="currentColor" stroke-width="1"/>'
+'<line x1="13.6" y1="11.4" x2="19.4" y2="11.4" stroke-width="1.2"/>'
+'<line x1="16.5" y1="13.2" x2="16.5" y2="15"/><line x1="14.5" y1="15.2" x2="18.5" y2="15.2"/></svg>';}
/* agent-memory — a record drops into a database cylinder */
if(kind==="agent-memory") return S
+'<rect class="li-rec" x="10" y="1.6" width="4" height="2.6" rx=".4" fill="currentColor" stroke="none"/>'
+'<ellipse cx="12" cy="7.6" rx="6.2" ry="2.2"/>'
+'<path d="M5.8 7.6v11.2a6.2 2.2 0 0 0 12.4 0V7.6"/>'
+'<path d="M5.8 11.4a6.2 2.2 0 0 0 12.4 0M5.8 15.1a6.2 2.2 0 0 0 12.4 0"/></svg>';
/* llm-eval — A/B balance: the beam tips one way, then the other */
if(kind==="llm-eval") return S
+'<line x1="12" y1="6" x2="12" y2="19.4"/><line x1="8" y1="19.6" x2="16" y2="19.6"/>'
+'<g class="li-tilt" style="transform-origin:12px 6px">'
+'<line x1="3.6" y1="6" x2="20.4" y2="6"/>'
+'<path d="M5 6l-2.2 5.4M5 6l2.2 5.4M19 6l-2.2 5.4M19 6l2.2 5.4" stroke-width="1"/>'
+'<path d="M2.4 11.4h5.2a2.6 2.6 0 0 1-5.2 0zM16.4 11.4h5.2a2.6 2.6 0 0 1-5.2 0z"/></g>'
+'<circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/></svg>';
/* infra-tools — server rack, the three status lights blink in turn */
if(kind==="infra-tools") return S
+'<rect x="5.5" y="3.4" width="13" height="16" rx="1"/>'
+'<line x1="5.5" y1="8.7" x2="18.5" y2="8.7"/><line x1="5.5" y1="14.1" x2="18.5" y2="14.1"/>'
+'<line x1="11.4" y1="6" x2="16.2" y2="6"/><line x1="11.4" y1="11.4" x2="16.2" y2="11.4"/><line x1="11.4" y1="16.8" x2="16.2" y2="16.8"/>'
+'<circle class="li-led1" cx="8.3" cy="6" r=".9" fill="currentColor" stroke="none"/>'
+'<circle class="li-led2" cx="8.3" cy="11.4" r=".9" fill="currentColor" stroke="none"/>'
+'<circle class="li-led3" cx="8.3" cy="16.8" r=".9" fill="currentColor" stroke="none"/>'
+'<line x1="7.4" y1="19.4" x2="7.4" y2="21"/><line x1="16.6" y1="19.4" x2="16.6" y2="21"/></svg>';
/* rapids — accelerated computing: a GPU chip, its lightning bolt flashes */
if(kind==="rapids") return S
+'<rect x="6.5" y="6.5" width="11" height="11" rx="1"/>'
+'<path d="M4.2 9.5h2.3M4.2 12h2.3M4.2 14.5h2.3M17.5 9.5h2.3M17.5 12h2.3M17.5 14.5h2.3M9.5 4.2v2.3M12 4.2v2.3M14.5 4.2v2.3M9.5 17.5v2.3M12 17.5v2.3M14.5 17.5v2.3"/>'
+'<polygon class="li-bolt" style="transform-origin:12px 12px" points="13,8.4 9.6,12.6 11.9,12.6 11,15.6 14.4,11.4 12.1,11.4" fill="currentColor" stroke-width="1"/></svg>';
/* deeplearning — 3-2-1 neural net, a signal lights each layer in turn */
if(kind==="deeplearning"){var L=[[[5,6.5],[5,12],[5,17.5]],[[12,9],[12,15]],[[19,12]]],o='';
for(var a=0;a<2;a++)L[a].forEach(function(p){L[a+1].forEach(function(q){var dx=q[0]-p[0],dy=q[1]-p[1],n=Math.sqrt(dx*dx+dy*dy),k=1.8/n;
o+='<line x1="'+(p[0]+dx*k).toFixed(2)+'" y1="'+(p[1]+dy*k).toFixed(2)+'" x2="'+(q[0]-dx*k).toFixed(2)+'" y2="'+(q[1]-dy*k).toFixed(2)+'" stroke-width="1"/>';});});
L.forEach(function(l,i){l.forEach(function(p){o+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.8"/><circle class="li-n'+(i+1)+'" cx="'+p[0]+'" cy="'+p[1]+'" r=".9" fill="currentColor" stroke="none"/>';});});
return S+o+'</svg>';}
/* disk — plain 3.5" silhouette: the default scene for unknown ids */
if(kind==="disk") return S+'<rect x="4.5" y="4.5" width="15" height="15" rx="1.2"/><rect x="8.2" y="4.5" width="7.6" height="5"/><path d="M13.2 4.5v5"/><rect x="7.5" y="12.5" width="9" height="5" rx=".5"/></svg>';
/* env — envelope, flap lifts to reveal a letter */
return S+'<rect x="4.2" y="7.4" width="15.6" height="11"/><g class="li-flap" style="transform-origin:12px 7.4px"><polygon points="4.2,7.4 12,13.2 19.8,7.4" fill="currentColor" fill-opacity=".16"/></g><rect class="li-letter" opacity="0" x="7.6" y="8.6" width="8.8" height="8.8"/><line x1="4.2" y1="18.4" x2="10" y2="13.2"/><line x1="19.8" y1="18.4" x2="14" y2="13.2"/></svg>';
}
function rootIcon(cat){
return {"ABOUT.ME":"about",WORK:"work",EDUCATION:"edu",PROJECTS:"gears",CONTACT:"env"}[cat]||"disk";
}
/* every id licSVG can draw — used to decide the scene fallback (v6 item 1) */
var SCENES={about:1,me:1,work:1,deloitte:1,intermedia:1,army:1,edu:1,univ:1,mb500:1,
gears:1,atom:1,rocket:1,alpha:1,themis:1,fraud:1,icu:1,greek:1,archivesys:1,
github:1,linkedin:1,cv:1,env:1,disk:1,"ai-d365":1,"agent-memory":1,"llm-eval":1,
"infra-tools":1,rapids:1,deeplearning:1};
function iconFor(parent,item){
if(item&&item.folder){
if(item.id==="academic") return "atom";   /* v4 special, kept */
if(item.id==="personal") return "rocket"; /* v4 special, kept */
}
/* v6 defaults: explicit scene > own id's scene > parent kit:
WORK -> desk figure, PROJECTS -> gears, EDUCATION -> cap,
anything else -> plain disk icon. Never hand-wired per item. */
if(item&&item.scene&&SCENES[item.scene]) return item.scene;
if(item&&item.id&&SCENES[item.id]) return item.id;
if(parent==="WORK") return "work";
if(parent==="PROJECTS") return "gears";
if(parent==="EDUCATION") return "edu";
return "disk";
}
function liSpan(kind){ return '<span class="lic">'+licSVG(kind)+'</span>'; }
function hashStr(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
function rotFor(s){return 0;} /* v6 E (O2): resting tilt removed — 0 for every disk */
function floppyObj(name,sub,small,data,aria,icon,cls){
cls=cls||"";
var bc=small?"obj floppy obj-item":"obj floppy obj-cat";
if(cls) bc+=" "+cls;
return '<div class="obj-wrap"><button class="'+bc+'" '+(data||('data-cat="'+name+'"'))+' aria-label="'+(aria||name+(sub?" — "+sub:"")+", open folder")+'">'
+'<span class="f-disc" aria-hidden="true"></span>'
+'<span class="f-shutter"></span>'
+'<span class="f-sweep" aria-hidden="true"></span>'
+'<span class="f-hd" aria-hidden="true"></span>'
+'<span class="f-wp'+(cls.indexOf("wp-open")>=0?" open":"")+'" aria-hidden="true"></span>'
+'<span class="f-stk" aria-hidden="true"></span>'
+'<span class="f-label">'+liSpan(icon||"about")+'<span class="f-txt"><span class="f-name">'+name+'</span>'+(sub?'<span class="f-sub">'+sub+'</span>':"")+'</span></span>'
+'</button></div>';
}
function objFor(name,sub,small,data,aria,icon,cls){
return floppyObj(name,sub,small,data,aria,icon,cls);
}
function renderRoot(){
var cells=CATS.map(function(c){
var its=DATA[c].items;
var allf=its.length&&its.every(function(x){return x.folder;});
var sub=its.length+" "+(allf?"FOLDER":"FILE")+(its.length===1?"":"S");
var cls={"ABOUT.ME":"sp-doodle",PROJECTS:"sp-disc"}[c]||"";
return objFor(c,"DRIVE "+DATA[c].drive,false,'data-cat="'+c+'"',c+", "+sub+", open folder",rootIcon(c),cls);
}).join("");
var wrap={floppy:"tray",cart:"rack",drawer:"cabinet"}[S.skin];
return '<div class="'+wrap+'">'+cells+'</div>';
}
function renderItems(){
var node=curNode();
if(!node) return "";
var last=S.path[S.path.length-1];
var WIP={}; /* item ids that get a hand-written "WIP" sticker (none: MB-500 passed, ARCHIVE.SYS is live) */
var cells=node.items.map(function(it){
var cls="";
if(WIP[it.id]) cls="sp-wip";
else if(last==="academic"||it.id==="academic") cls="sp-disc wp-open";
else if(last==="personal"||it.id==="personal") cls="sp-holo";
if(it.folder){
var n=it.items.length;
return objFor(it.label,"",true,'data-folder="'+it.id+'"',it.label+", "+n+" files, open folder",iconFor(S.path[0],it),cls);
}
return objFor(it.label,it.period||"",true,'data-item="'+it.id+'"',it.title+", show details",iconFor(S.path[0],it),cls);
}).join("");
return '<div class="tray" data-color="'+S.path[0]+'" data-node="'+last+'">'+cells+'</div>';
}
function renderPlain(){
var h='<h3>C:\\TU7URU'+(S.path.length?"\\"+S.path.join("\\"):"")+'</h3>';
if(!S.path.length){
h+=CATS.map(function(c){
var its=DATA[c].items;
var allf=its.length&&its.every(function(x){return x.folder;});
return '<button class="plain-row" data-cat="'+c+'" aria-label="'+c+'">'+
'<span class="pr-arrow">▸</span><span class="pr-name">'+c+'</span>'+
'<span class="pr-leader" aria-hidden="true"></span>'+
'<span class="pr-meta">'+its.length+" "+(its.length===1?(allf?"folder":"file"):(allf?"folders":"files"))+'</span></button>';
}).join("");
}else{
var node=curNode();
h+=node.items.map(function(it){
if(it.folder){
return '<button class="plain-row" data-folder="'+it.id+'" aria-label="'+it.label+'">'+
'<span class="pr-arrow">▸</span><span class="pr-name">'+it.label+'</span>'+
'<span class="pr-leader" aria-hidden="true"></span>'+
'<span class="pr-meta">'+it.items.length+(it.items.length===1?" file":" files")+'</span></button>';
}
return '<button class="plain-row" data-item="'+it.id+'" aria-label="'+it.title+'">'+
'<span class="pr-arrow">·</span><span class="pr-name">'+it.title+'</span>'+
'<span class="pr-leader" aria-hidden="true"></span>'+
'<span class="pr-meta">'+(it.period||"")+'</span></button>';
}).join("");
}
return '<div class="plain">'+h+'</div>';   /* v6 E (#12): the WP-tab legend is meaningless in plain mode — removed */
}
