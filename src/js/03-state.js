/* ============================== STATE ============================== */
/* v7 G1 (item 3): boot/drop wait for the self-hosted fonts, capped at 1.5 s.
   review #8: fonts.ready alone misses Caveat (first used on a label) — load()
   it explicitly, or labels sit blank 40–60 ms on slow links. */
function fontsGate() {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  var loads = Promise.resolve();
  try {
    loads = Promise.all([document.fonts.load("600 20px Caveat"), document.fonts.load("20px VT323")]);
  } catch (e) {}
  return Promise.race([
    Promise.all([document.fonts.ready, loads]),
    new Promise(function (r) {
      setTimeout(r, 1500);
    })
  ]);
}
var S = {
  phase: "off", // off | boot | archive
  warming: false, // mid warm-up (dot->line->raster)
  dropIn: false, // animate disks dropping in after boot
  path: [], // array of keys, e.g. ["PROJECTS","ACADEMIC"]
  navBusy: false, // true during the 750ms disk-fly / eject pop: nav input ignored
  pending: null, // category to open once archive is live (shelf shortcut)
  skin: "floppy", // floppy | cart | drawer
  plain: false,
  snd: false,
  cardId: null,
  detailId: null,
  typing: false,
  scale: 1 /* current uniform stage scale: screen px per stage px */,
  phone: false /* phone stage in use */
};
try {
  S.snd = localStorage.getItem("archive_snd") === "1";
} catch (e) {}
