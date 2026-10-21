/* ============================== STAGE (fixed size, uniform scale) ============== */
var DESK_W=1680,DESK_H=1000,PHONE_W=430,PHONE_H=900;
var stageEl=$("stage");
function fitStage(){
/* phone stage: narrow AND portrait; everything else gets the desktop stage */
var phone=innerWidth<600&&innerHeight>innerWidth;
document.body.classList.toggle("st-phone",phone);
var W=phone?PHONE_W:DESK_W;
/* v6 E (#1 / O3): scale from the REAL content height (monitor + stand +
caption), never the nominal stage alone — when the content was taller
than 1000 px the monitor got cropped at the top and the caption went
off-screen at 1920x1080 / 2560x1440 */
var gap=parseFloat(getComputedStyle(stageEl).rowGap)||16;
var mon=document.querySelector(".monitor"), cap=document.getElementById("caption");
var content=(mon?mon.offsetHeight:0)+gap+(cap?cap.offsetHeight:0);
var H=Math.max(phone?PHONE_H:DESK_H, content);
var s=Math.min(innerWidth/W,innerHeight/H)*0.98; /* small breathing margin */
S.scale=s; S.phone=phone;
/* J: the knob's hit area must stay ≥44 px on screen (phone) / ≥32 (desktop)
   while the stage is scaled — the pseudo's inset grows with 1/s */
stageEl.style.setProperty("--pw-hit",Math.max(2,( (phone?44:32)/s-(phone?40:32) )/2).toFixed(1)+"px");
/* sharpness: CSS `zoom` where supported (Chromium, Firefox >=126) lets the
browser rasterize text at the zoomed size — crisper than transform:scale.
Fallback: the transform path (e.g. Safari). Same scale law either way. */
var canZoom=("zoom" in stageEl.style);
S.zoom=canZoom;
if(canZoom){
/* the flex wrapper does the centring — never position the zoomed element */
stageEl.style.position="static";
stageEl.style.left=stageEl.style.top="";
stageEl.style.marginLeft=stageEl.style.marginTop="";
stageEl.style.transform="none";
stageEl.style.zoom=s;
}else{
stageEl.style.position="absolute";
stageEl.style.left="50%";stageEl.style.top="50%";
stageEl.style.marginLeft=stageEl.style.marginTop="";
stageEl.style.zoom="";
stageEl.style.transform="translate(-50%,-50%) scale("+s+")";
}
}
