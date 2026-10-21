/* ============================== OBJECT CLICKS ============================== */
arcBody.addEventListener("click",function(e){
/* mid-transition or powering off — but a click during the SHORT eject fly
interrupts it (the new view is already up) and is processed */
if(S.navBusy||S.offing){ if(S.offing||!interruptEject()) return; }
if(suppressClick){ suppressClick=false; return; } /* the click after a drag */
var t=e.target.closest ? e.target.closest(".obj,.plain-row") : null;
if(!t) return;
AU.blip(1900,0.03,0.05);
if(t.dataset.cat){
openCat(t.dataset.cat,t);
}else if(t.dataset.folder){
openFolder(t.dataset.folder,t);
}else if(t.dataset.item){
showCard(t.dataset.item);
}
});
