/* ============================== POWER / BOOT ============================== */
var typeTimer = null;
var dubT = null;
function dubClock() {
  if (dubT) {
    clearTimeout(dubT);
    dubT = null;
  }
  var el = document.getElementById("dubClock");
  if (!el || S.phase !== "archive" || document.hidden) return;
  try {
    el.textContent =
      " \u00b7 " +
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
        new Date()
      );
  } catch (e) {
    el.textContent = "";
    return;
  }
  var st = document.querySelector(".arc-status");
  el.style.display = !(st && st.scrollWidth > st.clientWidth + 1) ? "" : "none";
  var n = new Date();
  dubT = setTimeout(dubClock, 60000 - (n.getSeconds() * 1000 + n.getMilliseconds()) + 500);
}
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) dubClock();
});
/* v7 N9d: the fit check (does the status line still wrap?) re-runs on
resize / orientation change too, not only once a minute */
var dubFitRaf = null;
document.addEventListener("resize", function () {
  if (dubFitRaf) return;
  dubFitRaf = requestAnimationFrame(function () {
    dubFitRaf = null;
    dubClock();
  });
});
window.addEventListener("orientationchange", function () {
  if (dubFitRaf) return;
  dubFitRaf = requestAnimationFrame(function () {
    dubFitRaf = null;
    dubClock();
  });
});
function setPhase(p) {
  S.phase = p;
  document.body.classList.remove("phase-off", "phase-boot", "phase-archive");
  document.body.classList.add("phase-" + p);
  document.getElementById("powerHint").classList.remove("away"); /* I3 */
  bootView.classList.toggle("live", p === "boot");
  arcView.classList.toggle("live", p === "archive");
  document.getElementById("powerBtn").classList.toggle("on", p !== "off");
  if (dubT) {
    clearTimeout(dubT);
    dubT = null;
  }
  if (p === "archive") dubClock();
  else {
    var dc = document.getElementById("dubClock");
    if (dc) dc.textContent = "";
  }
}
function powerOn(opts) {
  if (S.phase !== "off" || S.warming) return;
  offfadeEl.getAnimations().forEach(function (a) {
    a.cancel();
  }); /* v7 N2: the off-colour overlay is off the instant power is pressed */
  opts = opts || {};
  document
    .getElementById("powerHint")
    .classList.add("away"); /* I3: the hint is gone the instant power is pressed */
  document.body.classList.remove("poff-hide"); /* I4: the views may show again — next boot */
  led.classList.add("on");
  caption.innerHTML = "<b>HARALAMBOS VARSAMIS</b> · TU7URU · ARCHIVE.SYS";
  if (RM || opts.instant) {
    glass.classList.add("on");
    spillSet(true);
    startArchive(true);
    return;
  }
  S.warming = true;
  /* 2026-10-21: a power-off while the font gate is still pending must cancel
     this power-on; every powerOff() bumps the generation */
  var gen = (S.powerGen = (S.powerGen || 0) + 1);
  /* v7 G1 (item 3): wait for the self-hosted fonts before the boot types —
capped at 1.5 s so a missing file can never hold the boot open-ended */
  fontsGate().then(function () {
    if (gen !== S.powerGen) return;
    AU.thock();
    runWarm();
    /* K-B timeline (was 1000/1320/1450): the 520 ms CSS warm, the BIOS
   crossfades in UNDER the still-lit raster (no black frame), the warm
   hands off 100 ms after the raster settles, over 160 ms. */
    bootTimers.push(
      setTimeout(function () {
        glass.classList.add("on");
        startBios(opts);
        bootTimers.push(
          setTimeout(function () {
            spillSet(true);
          }, 220)
        ); /* K-B: the spill comes up as the raster fills */
      }, 520)
    );
    bootTimers.push(
      setTimeout(function () {
        warm.classList.add("out");
        bootTimers.push(
          setTimeout(function () {
            warmReset();
          }, 200)
        );
      }, 620)
    );
    bootTimers.push(
      setTimeout(function () {
        S.warming = false;
      }, 700)
    );
  });
}
function startBios(opts) {
  opts = opts || {};
  setPhase("boot");
  if (opts.full) {
    setBiosText(fullBiosText());
    if (biosLogo) {
      biosLogo.innerHTML = logoHTML();
      biosLogo.classList.add("show");
    }
    return; // held, no auto-load (test hash)
  }
  bios.innerHTML = "";
  S.typing = true;
  runBoot();
}
function powerOff() {
  if (S.offing) return;
  S.powerGen = (S.powerGen || 0) + 1; /* cancels a power-on still waiting for its fonts */
  if (S.phase === "off") {
    if (!S.warming) return; /* already off */
    /* J: off during the WARM-UP — kill the warm chain, no collapse (the
   screen is still the dark off glass) */
    bootTimers.slice().forEach(clearTimeout);
    bootTimers.length = 0;
    warmReset();
    S.warming = false;
    led.classList.remove("on");
    document.getElementById("powerHint").classList.remove("away");
    caption.innerHTML = "<b>HARALAMBOS VARSAMIS</b> · PRESS POWER OR ANY KEY";
    return;
  }
  S.offing = true;
  /* 2026-10-21: bootReset() below also kills powerOn's 700 ms "warming done"
     timer; switched off 520–700 ms after power-on, S.warming stayed true and
     every later power-on was ignored */
  S.warming = false;
  document.body.classList.add(
    "poff-hide"
  ); /* I4: hide the views at collapse start — no re-show frame after */
  spillSet(false); /* v7 G2 (item 10): the light spill goes out with the collapse */
  bootReset();
  S.typing = false;
  /* J: cancel in-flight disk flies — their onfinish callbacks must not
   render a new view in the middle of the off-collapse */
  interruptEject();
  cancelDiskFly();
  var finish = function () {
    warmReset(); /* v7 L: clear the cool animation + child styles for the next power-on */
    setPhase("off");
    /* fix 2026-10-08: the N2 off-colour overlay (z 9) must not stay over #powerHint (z 7) once off — it matches the off glass, so dropping it is invisible except for the hint coming back */
    offfadeEl.getAnimations().forEach(function (a) {
      a.cancel();
    });
    S.path = [];
    S.cardId = null;
    if (cardEl) cardEl.hidden = true;
    if (typeof biosLogo !== "undefined" && biosLogo) biosLogo.classList.remove("show");
    glass.classList.remove("on");
    led.classList.remove("on");
    caption.innerHTML = "<b>HARALAMBOS VARSAMIS</b> · PRESS POWER OR ANY KEY";
    S.offing = false;
  };
  if (RM) {
    finish();
    return;
  }
  AU.thock();
  /* v7 L: raster→line→dot on the same warm element the power-on grows from
(240 ms squeeze + 200 ms shrink + 480 ms afterglow = 920 ms) */
  warm.classList.add("go", "cool");
  /* v7 N2: fade onto the OFF glass colour over the last 400 ms (520→920),
so the .on strip at finish() is invisible — no brightness jump */
  offfadeEl.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 400,
    delay: 520,
    easing: "ease-out",
    fill: "forwards"
  });
  bootTimers.push(setTimeout(finish, 920));
}
function skipBoot() {
  if (S.phase !== "boot" || S.offing) return; /* never skip into (and cancel) the off-collapse */
  bootReset();
  S.typing = false;
  setBiosText(fullBiosText());
  bootTimers.push(
    setTimeout(
      function () {
        if (S.phase === "boot") startArchive(true);
      },
      RM ? 120 : 400
    )
  );
}
function startArchive(fast) {
  setPhase("archive");
  if (biosLogo) biosLogo.classList.remove("show");
  S.dropIn = !fast && !RM;
  render(fast);
  /* soft click per disk as it drops into the tray */
  if (S.dropIn && !S.path.length) {
    var n = CATS.length;
    for (var i = 0; i < n; i++)
      (function (i) {
        bootTimers.push(
          setTimeout(
            function () {
              AU.blip(620, 0.028, 0.05, "triangle");
            },
            150 + i * 170
          )
        );
      })(i);
  }
  if (S.pending) {
    var p = S.pending;
    S.pending = null;
    openCat(p, null);
  }
}
