/* ============================== CONTENT SCHEMA (v6 item 1) =====================
ONE documented shape for every entry (full guide: CONTENT-GUIDE.md).
category = { drive, items[] }
item     = { id, label, title, period, role, tags[], desc, detail[],
link, linkLabel, folder, items[], scene }
Required: category -> id (the DATA key), drive, items[]
item     -> id, label, title   (folders: items[] too)
Everything else is optional and gets a sensible default: scene falls
back to the parent's kit (work=desk figure, projects=gears,
education=cap, anything else=plain disk icon), the shell colour is
inherited from the parent category (.tray[data-color]), the grid cell
is the next free one, and the card buttons follow the data rules in
cardHTML (documented in CONTENT-GUIDE.md). */
var SCHEMA = {
category: {
id:    { req:true,  note:"key in DATA + entry in CATS, e.g. \"WORK\"" },
drive: { req:true,  note:"A-E are taken; the next free letter is F (shown at BIOS + on the disk)" },
items: { req:true,  note:"item[] (folder entries allowed)" }
},
item: {
id:        { req:true,  note:"unique across the whole tree" },
label:     { req:true,  note:"disk label, keep <= 13 chars (auto-shrink fits more, one line, never wraps)" },
title:     { req:true,  note:"card title (folders need only id + label)" },
period:    { req:false, note:"small meta under the label + card meta" },
role:      { req:false, note:"merged into the card meta line with period" },
tags:      { req:false, note:"strings; wrap to up to 2 rows on the card (nothing ellipsizes)" },
desc:      { req:false, note:"card text; clamped to 2 lines (VIEW MORE shows all)" },
detail:    { req:false, note:"lines[]; its presence enables VIEW MORE + detail view" },
link:      { req:false, note:"URL or file; \"resume.pdf\" = the CV. This IS the repo URL for projects — there is no REPOS map" },
linkLabel: { req:false, note:"contacts: \"OPEN\" -> \"OPEN ↗\". A linkLabel starting \"OPEN RESUME\" marks the item as the CV (resume-only card). Without linkLabel, linkText() falls back to \"REPO\" — so a contact WITHOUT linkLabel would wrongly read REPO ↗; always set \"OPEN\"" },
folder:    { req:false, note:"true (plus items[]) makes the item a subfolder" },
items:     { req:false, note:"item[] when folder:true" },
scene:     { req:false, note:"a licSVG id (see the SCENES set); default = parent kit" }
}
};
/* Layout note (O1): disk arrangements are NEVER persisted — every load
starts from the defaults; drags are remembered in session memory only. */
/* commented TEMPLATE entries — NOT rendered (separate object, not DATA).
Copy a block into DATA, fill it in, and add the category id to CATS. */
var DATA_TEMPLATES = {
/* -- new category (a disk at the root) --
A-E are taken by the five live categories; a sixth takes "F".
"EXAMPLE":{
drive:"F",
items:[ { id:"example-one", label:"EXAMPLE", title:"Example Title",
period:"PERIOD", role:"ROLE", tags:["a","b"],
desc:"One or two lines.", detail:["Full line one.","Full line two."] } ]
},
*/
/* -- new work / project item (inside a category) --
{ id:"example-two", label:"EXAMPLE", title:"Example", period:"2026",
role:"Role", tags:["a","b"], desc:"...", detail:["..."],
link:"https://github.com/Tu7uru/Example" },          // -> REPO ↗ on the card
*/
/* -- new subfolder (under PROJECTS): put its item entries inside items[] --
{ id:"example-folder", label:"EXAMPLE", folder:true, items:[] },
*/
/* -- new contact link (under CONTACT) --
linkLabel MUST be "OPEN" (rendered "OPEN ↗"): without it, linkText()
falls back to "REPO" and the contact would read REPO ↗. A linkLabel
starting "OPEN RESUME" (e.g. "OPEN RESUME ↗") marks the CV. --
{ id:"example-link", label:"EXAMPLE", title:"Example", period:"PROFILE",
tags:["Profile"], desc:"example.com/you",
link:"https://example.com/you", linkLabel:"OPEN" },  // card: OPEN ↗ only
*/
};
/* startup validation: console.warn on a missing required field, never crash */
function validateData(){
function need(o,f,where){
if(!o || o[f]===undefined || o[f]===null || o[f]===""){
console.warn("[ARCHIVE] "+where+": missing required field '"+f+"' (see CONTENT-GUIDE.md)");
return false;
} return true;
}
var ids={};
function chk(it,where,folder){
if(!it) return;
if(!need(it,"id",where)||!need(it,"label",where)) return;
if(!folder && !need(it,"title",where)) return;   /* folders open a view, no card */
if(ids[it.id]) console.warn("[ARCHIVE] duplicate id '"+it.id+"' (ids must be unique)");
ids[it.id]=1;
if(folder){
if(!Array.isArray(it.items)) console.warn("[ARCHIVE] "+where+": folder needs an items[] array");
else it.items.forEach(function(sub){ chk(sub,where+"."+(sub&&sub.id),false); });
}
}
Object.keys(DATA).forEach(function(c){
var cat=DATA[c];
if(!need(cat,"drive",c)||!need(cat,"items",c)) return;
if(!Array.isArray(cat.items)) return;
cat.items.forEach(function(it){ chk(it,c+"."+(it&&it.id),!!(it&&it.folder)); });
});
}
validateData();
/* boot frames — v3: memory counter, drive checks, TU7URU logo, progress bar */
var LOGO = (function(){
var L = {
T:["█████"," ██ "," ██ "," ██ "],
U:["██ ██","██ ██","██ ██"," ███ "],
"7":["█████","  ██ "," ██ "," ██ "],
R:["████ ","███ ","████ ","██ ██"]
}, word="TU7URU", rows=["","","",""];
for(var i=0;i<word.length;i++){
var g=L[word[i]];
for(var r=0;r<4;r++) rows[r]+= (i?" ":"") + g[r];
}
return rows;
})();
/* crisp small logo: one div per block cell, so shapes never distort */
function logoHTML(){
var h="";
LOGO.forEach(function(row){
h+='<div class="bl-row">';
for(var i=0;i<row.length;i++) h+='<i'+(row.charAt(i)==="█"?" class=\"f\"":"")+"></i>";
h+="</div>";
});
return h;
}
var BIOS_FRAMES=[
{t:"type",s:"ARCHIVE-84 BIOS  V1.0",ps:16,pause:140},
{t:"type",s:"(C) 1984-2026  TU7URU SYSTEMS",ps:13,pause:300},
{t:"type",s:""},
{t:"type",s:"MEMORY TEST ........ ",ps:14,pause:200},
{t:"set",s:"MEMORY TEST ........ 128K",pause:240},
{t:"set",s:"MEMORY TEST ........ 384K",pause:240},
{t:"set",s:"MEMORY TEST ........ 640K OK",pause:300},
{t:"type",s:""},
{t:"type",s:"DRIVE A: ABOUT.ME ...... OK",ps:9},
{t:"type",s:"DRIVE B: WORK .......... OK",ps:9},
{t:"type",s:"DRIVE C: EDUCATION ..... OK",ps:9},
{t:"type",s:"DRIVE D: PROJECTS ...... OK",ps:9},
{t:"type",s:"DRIVE E: CONTACT ....... OK",ps:9,pause:340},
{t:"type",s:""},
{t:"logo"},
{t:"type",s:"",pause:260},
{t:"bar",s:"LOADING ARCHIVE.SYS",n:5}
];
function fullBiosText(){
var frame=[];
BIOS_FRAMES.forEach(function(f){
if(f.t==="set"){ frame[frame.length-1]=f.s; }
else if(f.t==="bar"){ var b=""; for(var x=0;x<f.n;x++) b+="█"; frame[frame.length-1]=f.s+" "+b; }
else if(f.t==="logo"){ /* small corner signature, not part of the text column */ }
else frame.push(f.s);
});
return frame.join("\n");
}
var bootTimers=[];
function bootReset(){ bootTimers.forEach(clearTimeout); bootTimers=[]; }
/* ---- CRT warm-up, driven by requestAnimationFrame (no opacity strobing) ---- */
var warmRaf=null;
function runWarm(){
/* v7 K (item B): the CSS animation does it all — one element,
   transform/opacity only, no per-frame JS. 520 ms total. */
warm.classList.add("go");
}
/* v7 G2 (item 10): light spill under the stand — the gradient is STATIC;
only its opacity animates (400 ms, in after the raster / out on collapse).
No infinite animations, transform/opacity only, instant under reduced motion. */
var spillEl=document.querySelector(".monitor .spill");
function spillSet(on){
if(!spillEl) return;
var an=spillEl.getAnimations();
for(var i=0;i<an.length;i++) an[i].cancel();
if(RM){ spillEl.style.opacity=on?"1":"0"; return; }
spillEl.animate([{opacity:on?0:1},{opacity:on?1:0}],{duration:400,easing:"ease-in-out",fill:"forwards"});
}
function warmReset(){
if(warmRaf){ cancelAnimationFrame(warmRaf); warmRaf=null; }
warm.classList.remove("go","out","cool");
[".dot",".line",".raster"].forEach(function(k){ warm.querySelector(k).style.cssText=""; });
}
function setBiosText(txt){ bios.innerHTML=txt.replace(/</g,"&lt;")+"<span class='cur'></span>"; bootView.scrollTop=bootView.scrollHeight; }
function runBoot(){
var frame=[], i=0, ch=0;
function step(){
if(S.phase!=="boot") return;
if(i>=BIOS_FRAMES.length){
S.typing=false;
bootTimers.push(setTimeout(function(){ if(S.phase==="boot") startArchive(false); }, RM?350:520));
return;
}
var f=BIOS_FRAMES[i];
if(f.t==="set"){
frame[frame.length-1]=f.s; setBiosText(frame.join("\n"));
i++; ch=0; bootTimers.push(setTimeout(step, RM?50:(f.pause||200))); return;
}
if(f.t==="logo"){
if(biosLogo){ biosLogo.innerHTML=logoHTML(); biosLogo.classList.add("show"); }
i++; ch=0; bootTimers.push(setTimeout(step, RM?350:650)); return;
}
if(f.t==="bar"){
var k=0;
(function barStep(){
if(S.phase!=="boot") return;
var b=""; for(var x=0;x<f.n;x++) b+= x<k?"█":"▒";
frame[frame.length-1]=f.s+" "+b;
setBiosText(frame.join("\n"));
k++;
if(k<=f.n) bootTimers.push(setTimeout(barStep, RM?30:190));
else { i++; ch=0; bootTimers.push(setTimeout(step, RM?150:430)); }
})();
return;
}
/* type */
if(ch===0) frame.push("");
ch++;
frame[frame.length-1]=frame[frame.length-1]+f.s.charAt(ch-1);
setBiosText(frame.join("\n"));
if(ch>=f.s.length){ i++; ch=0; bootTimers.push(setTimeout(step, RM?40:(f.pause||90))); }
else bootTimers.push(setTimeout(step, RM?0:(f.ps||12)));
}
step();
}
/* input mode: auto-focus the first object only for keyboard users,
so the focus ring never sits stuck on an item for mouse users */
var kbMode=false;
document.addEventListener("keydown",function(){kbMode=true;},{capture:true});
document.addEventListener("pointerdown",function(){kbMode=false;},{capture:true});
