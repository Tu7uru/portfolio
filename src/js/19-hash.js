/* ============================== HASH (test hooks) ============================== */
function parseHash(){
var h={skip:false,path:null,open:null,hold:false};
var raw=location.hash.replace(/^#\/?/,"");
if(!raw) return h;
if(raw.indexOf("skip")===0) h.skip=true;
raw.split("&").forEach(function(p){
var kv=p.split("="), k=kv[0], v=kv[1]||"";
if(k==="path") h.path=decodeURIComponent(v).toUpperCase().split("/");
else if(k==="open") h.open=decodeURIComponent(v);
else if(k==="hold") h.hold=true;
else if(k==="skip") h.skip=true;
else if(k==="off") h.off=true;
else if(k==="shade") h.shade=v;   /* v7 G1 (item 1): off-glass swatch 1|2|3 */
});
return h;
}
var hashes=parseHash();
/* v7 G1 (item 1): off-glass swatches — #off&shade=2|3 (1 is the default) */
if(hashes.shade==="2"||hashes.shade==="3") glass.classList.add("offshade-"+hashes.shade);
dragInit();
if(S.snd){ sndBtn.textContent="SND ON"; sndBtn.setAttribute("aria-pressed","true"); }
