/* ============================== POWER WIRING ============================== */
/* J: robust power toggle. The button is small (32/40 px) and sits inside
#glass, whose own click handler powers things ON — on real phones a stray
hit or a double toggle read "off" as "off→on→off". So: toggle on
pointerup (primary, pointer still over the knob), the synthetic click is
swallowed, a second toggle <600 ms later is ignored, and nothing in the
same gesture may reach the glass. #debugpower logs every power event. */
var pwLast = 0,
  pwLogEl = null;
function pwLog(msg) {
  if (!pwLogEl) return;
  pwLogEl.textContent += msg + "\n";
  pwLogEl.scrollTop = pwLogEl.scrollHeight;
}
if (location.hash.indexOf("debugpower") >= 0) {
  pwLogEl = document.createElement("div");
  pwLogEl.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:9999;max-width:46vw;max-height:34vh;overflow:auto;" +
    "background:rgba(0,0,0,.78);color:#7df2a2;font:11px/1.5 ui-monospace,Menlo,monospace;" +
    "padding:6px 9px;white-space:pre;pointer-events:none;border:1px solid rgba(125,242,162,.4)";
  document.body.appendChild(pwLogEl);
  pwLog("power debug — each line: event, source, phase before→after");
}
function pwToggle(src) {
  var now = Date.now();
  if (now - pwLast < 600) return; /* debounce: a double toggle inside 600 ms is one press */
  pwLast = now;
  var before = S.phase;
  if (S.phase === "off") powerOn({});
  else powerOff();
  pwLog(
    "toggle " +
      (before === "off" ? "ON" : "off") +
      " [" +
      src +
      "] " +
      (before === "off" ? "off" : "archive|boot") +
      "→" +
      S.phase
  );
}
var pwBtn = $("powerBtn");
pwBtn.addEventListener("pointerup", function (e) {
  if (e.pointerType === "mouse" && e.button !== 0) return; /* primary only */
  var t = document.elementFromPoint(e.clientX, e.clientY); /* ::before counts as the knob */
  if (t && !pwBtn.contains(t)) return; /* the pointer left the knob before release */
  e.stopPropagation(); /* the glass must not see this gesture */
  pwToggle(e.pointerType || "mouse");
});
pwBtn.addEventListener("click", function (e) {
  e.stopPropagation(); /* ALWAYS: the glass's power-on/skip must never see a knob click */
  if (Date.now() - pwLast < 600) return; /* the synthetic click after a handled pointerup */
  pwToggle("click");
});
glass.addEventListener("click", function () {
  if (S.phase === "off") {
    if (S.warming) {
      jumpWarm();
    } else {
      powerOn({});
    }
  } else if (S.phase === "boot" && !S.offing) skipBoot(); /* J: never skip into the off-collapse */
});
/* skip the dot->line->raster warm-up and go straight to BIOS */
function jumpWarm() {
  bootReset(); /* kill powerOn's pending timers (startBios @520ms, warm.out @620ms) — else two BIOS chains */
  S.warming = false;
  warm.classList.add("out");
  bootTimers.push(
    setTimeout(function () {
      warmReset();
    }, 200)
  );
  glass.classList.add("on");
  spillSet(true); /* v7 G2 (item 10): the raster was jumped — the spill comes up now */
  startBios({});
}
