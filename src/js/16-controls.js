/* ============================== CONTROLS ============================== */
plainBtn.addEventListener("click", function () {
  AU.blip(1400, 0.03, 0.05);
  S.plain = !S.plain;
  plainBtn.setAttribute("aria-pressed", S.plain ? "true" : "false");
  render(true);
});
$("arrangeBtn").addEventListener("click", function () {
  AU.blip(1400, 0.03, 0.05);
  delete memLayouts[layoutKey()]; /* O1: there is no stored layout to remove */
  render(false);
});
sndBtn.addEventListener("click", function () {
  AU.ensure();
  AU.resume();
  AU.setSnd(!S.snd);
  AU.blip(1900, 0.03, 0.05);
});
ejectBtn.addEventListener("click", function () {
  if (S.detailId) closeDetail();
  else eject();
});
dtClose.addEventListener("click", function () {
  AU.blip(1400, 0.03, 0.05);
  closeDetail();
});
