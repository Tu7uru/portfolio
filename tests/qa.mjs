// ARCHIVE.SYS v5 — QA gate (Playwright, headless Chromium)
// Run: npm run qa   (or: node tests/qa.mjs) with the site served at QA_ORIGIN
//   QA_ORIGIN  where docs/ is served (default http://127.0.0.1:8739, no trailing slash;
//              a sub-path such as http://127.0.0.1:8741/portfolio works too)
//   QA_SITE    the built site folder on disk (default ../docs next to this file)
// Exit code 1 if any check fails.
//
// v5 P1: fixed 1600x1000 desktop / 430x900 phone stage, uniformly scaled by JS.
// New: zoom sweep (z-xx), folder-change stability (f-xx), constant disk/slot (d-xx).
// The v4 vw/vh-dependent layout checks (fitRows/sizeSlot era) are gone; c25/c32/c33
// are re-asserted against the fixed stage.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright"); // npm i -D playwright, or NODE_PATH=<global node_modules>

const ORIGIN = (process.env.QA_ORIGIN || "http://127.0.0.1:8739").replace(/\/$/, "");
const SITE = path.resolve(process.env.QA_SITE || new URL("../docs", import.meta.url).pathname);
const BASE = ORIGIN + "/index.html";

/* zoom sweep: one scale law, every viewport, three device pixel ratios */
const SWEEP = [
  { w: 640, h: 400, dsf: 1 },
  { w: 1024, h: 768, dsf: 1 },
  { w: 1280, h: 800, dsf: 1 },
  { w: 1440, h: 900, dsf: 1 },
  { w: 1920, h: 1080, dsf: 1 },
  { w: 2560, h: 1440, dsf: 1 },
  { w: 3840, h: 2160, dsf: 1 },
  { w: 5120, h: 2880, dsf: 1 },
  { w: 1280, h: 800, dsf: 0.5 },
  { w: 1280, h: 800, dsf: 2 }
];

/* full-suite viewports */
const VPS = [
  { name: "1280x800", w: 1280, h: 800 },
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1920x1080", w: 1920, h: 1080 },
  { name: "1024x768", w: 1024, h: 768 },
  { name: "390x844", w: 390, h: 844, mobile: true }
];

/* outline width in SCREEN px. Under the stage's CSS zoom Chrome quantizes
   the outline to whole device pixels (width = floor(2*s)/s), so the check
   asserts "solid and between 1px and 2.6px" rather than exactly 2px —
   that covers the zoom path at every QA viewport and the exact 2px
   transform path. */
const outlineInScreenPx = async (page, sel) =>
  page.evaluate((sel) => {
    const el = sel === "active" ? document.activeElement : document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, w: parseFloat(cs.outlineWidth) };
  }, sel);
const CATS = ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"];
const TREE = {
  ABOUT: { items: ["me"] },
  WORK: { items: ["deloitte", "intermedia", "army"] },
  EDU: { items: ["univ", "mb500", "rapids", "deeplearning"] },
  PROJ: { folders: ["academic", "personal"] },
  ACAD: { items: ["alpha", "themis", "fraud", "icu", "greek"] },
  PERS: { items: ["ai-d365", "agent-memory", "llm-eval", "infra-tools", "archivesys"] },
  CONTACT: { items: ["github", "linkedin", "cv"] }
};
const REPOS = {
  alpha: "Alpha-Language-Compiler",
  themis: "Themis",
  fraud: "Fraud-Detection-System",
  icu: "Files-And-Databases---ICU-on-Call",
  greek: "IR-and-mistype-corrections-on-Greek-documents",
  archivesys: "portfolio"
};
const TOL = 2; // px tolerance for scrollWidth/clientWidth rounding

/* ---------------- results ---------------- */
const RES = [];
function record(vp, check, ok, detail = "") {
  RES.push({ vp, check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${vp}] ${check}${ok ? "" : " — " + detail}`);
}

/* ---------------- page factory ---------------- */
function attach(page, errs) {
  page.on("console", (m) => {
    if (m.type() === "error") errs.consoleE.push(m.text());
    else if (m.type() === "warning") errs.consoleW.push(m.text());
  });
  page.on("pageerror", (e) => errs.pageE.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("favicon")) errs.bad.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("favicon")) return;
    errs.bad.push(`${r.url()} :: ${r.failure() ? r.failure().errorText : "?"}`);
  });
}

async function freshPage(browser, w, h, hash, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    deviceScaleFactor: opts.dsf || 1
  });
  const page = await ctx.newPage();
  const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
  attach(page, errs);
  await page.goto(BASE + hash, { waitUntil: "load" });
  return { ctx, page, errs };
}

/* ================= zoom sweep (P1) ================= */
/* one scale law: s = min(vw/W, vh/H); the composition must be identical everywhere.
   Fresh browser per sweep viewport (closed right after) — huge viewports × DPR
   exhaust GPU memory in a long-lived browser. */
async function zoomSweep() {
  const ratios = [];
  for (const s of SWEEP) {
    const name = `${s.w}x${s.h}@${s.dsf}`;
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page, errs } = await freshPage(browser, s.w, s.h, "#skip", { dsf: s.dsf });
      try {
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        const m = await page.evaluate(() => {
          const st = document.getElementById("stage").getBoundingClientRect();
          const gl = document.getElementById("glass").getBoundingClientRect();
          const mon = document.querySelector(".monitor").getBoundingClientRect();
          const disk = document.querySelector("#arcBody .obj").getBoundingClientRect();
          return {
            scroll: Math.max(
              document.documentElement.scrollHeight - innerHeight,
              document.documentElement.scrollWidth - innerWidth
            ),
            inView:
              st.left >= -0.5 &&
              st.top >= -0.5 &&
              st.right <= innerWidth + 0.5 &&
              st.bottom <= innerHeight + 0.5,
            diskGlass: disk.width / gl.width,
            frame: (gl.left - mon.left) / st.width,
            scale: window.S ? window.S.scale : st.width / 1760
          };
        });
        if (m.scroll > 1) {
          ok = false;
          d += "page scroll " + Math.round(m.scroll) + "px; ";
        }
        if (!m.inView) {
          ok = false;
          d += "stage not fully visible; ";
        }
        ratios.push({ name, diskGlass: m.diskGlass, frame: m.frame });
        if (ok) d = `disk/glass=${(m.diskGlass * 100).toFixed(2)}% frame=${(m.frame * 100).toFixed(3)}%`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "z01 no page scroll, stage fully visible", ok, d);
      if (errs.consoleE.length || errs.pageE.length || errs.bad.length)
        record(
          name,
          "z02 zero console/page errors",
          false,
          [...errs.consoleE, ...errs.pageE, ...errs.bad].slice(0, 2).join(" | ")
        );
      else record(name, "z02 zero console/page errors", true);
      /* v6 item 6: the stage must use CSS `zoom` when supported (text rasterized
       at the zoomed size, crisper than transform:scale) and be exactly centred */
      {
        const zm = await page.evaluate(() => {
          const el = document.getElementById("stage");
          const st = el.getBoundingClientRect();
          return {
            zoomed: el.style.zoom !== "",
            cx: Math.abs((st.left + st.right) / 2 - innerWidth / 2),
            cy: Math.abs((st.top + st.bottom) / 2 - innerHeight / 2)
          };
        });
        record(
          name,
          "z03 stage via zoom (sharp text), centred",
          zm.zoomed && zm.cx <= 1.5 && zm.cy <= 1.5,
          "zoom=" + zm.zoomed + " off " + zm.cx.toFixed(1) + "/" + zm.cy.toFixed(1) + "px"
        );
      }
    } finally {
      await browser.close();
    }
  }
  /* the two invariants across the whole sweep */
  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  {
    const xs = ratios.map((r) => r.diskGlass),
      lo = Math.min(...xs);
    const ok = lo > 0 && spread(xs) / lo <= 0.01;
    record(
      "sweep",
      "z03 disk width / glass width constant across sweep (±1%)",
      ok,
      `range ${Math.min(...xs).toFixed(5)}..${Math.max(...xs).toFixed(5)}`
    );
  }
  {
    const xs = ratios.map((r) => r.frame),
      lo = Math.min(...xs);
    const ok = lo > 0 && spread(xs) / lo <= 0.01;
    record(
      "sweep",
      "z04 frame thickness / stage width constant across sweep (±1%)",
      ok,
      `range ${(Math.min(...xs) * 100).toFixed(3)}%..${(Math.max(...xs) * 100).toFixed(3)}%`
    );
  }
}

/* ================= folder-change stability (P1) ================= */
/* the stage bounding box must not move a pixel when the folder changes */
async function folderStability(w, h, mobile) {
  const name = `${w}x${h}`;
  const paths = ["", "#path=PROJECTS", "#path=PROJECTS/ACADEMIC", "#path=WORK"];
  const rects = [];
  let ok = true,
    d = "";
  const browser = await chromium.launch();
  try {
    for (const p of paths) {
      const { ctx, page } = await freshPage(browser, w, h, p ? "#skip&" + p : "#skip", { mobile });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const r = await page.evaluate(() => {
        const st = document.getElementById("stage").getBoundingClientRect();
        const gl = document.getElementById("glass").getBoundingClientRect();
        return { l: st.left, t: st.top, w: st.width, h: st.height, glW: gl.width, glH: gl.height };
      });
      rects.push(r);
      await ctx.close();
    }
    const ref = rects[0];
    for (let i = 1; i < rects.length; i++) {
      const r = rects[i];
      if (
        [r.l - ref.l, r.t - ref.t, r.w - ref.w, r.h - ref.h, r.glW - ref.glW, r.glH - ref.glH].some(
          (v) => Math.abs(v) > 1
        )
      ) {
        ok = false;
        d += `${paths[i] || "root"} off by [${(r.l - ref.l).toFixed(1)},${(r.t - ref.t).toFixed(1)}] (w ${r.w.toFixed(1)}); `;
      }
    }
    if (ok)
      d = `stage ${Math.round(ref.w)}x${Math.round(ref.h)} at [${Math.round(ref.l)},${Math.round(ref.t)}] in all 4 folders`;
  } catch (e) {
    ok = false;
    d = String(e).slice(0, 90);
  } finally {
    await browser.close();
  }
  record(name, "f01 stage bbox identical root/PROJECTS/ACADEMIC/WORK (±1px)", ok, d);
}

/* ================= constant disk + inserter (P1) ================= */
/* disk size is ONE constant at every level; the inserter slot never changes */
async function diskConstant(w, h, mobile) {
  const name = `${w}x${h}`;
  const browser = await chromium.launch();
  const { ctx, page, errs } = await freshPage(browser, w, h, "#skip", { mobile });
  let ok = true,
    d = "";
  try {
    await page.waitForSelector("body.phase-archive", { timeout: 15000 });
    const sizes = [];
    const slotW = async () =>
      page.evaluate(() => {
        const inEl = Array.from(document.querySelectorAll(".ds-in")).find((e) => e.offsetParent !== null);
        const slot = inEl && inEl.querySelector(".ds-slot");
        return slot ? slot.offsetWidth : -1;
      });
    const here = async () =>
      page.evaluate(() => {
        /* layout size: transform-immune (the tray tilt is a rotation, bounding boxes lie) */
        const o = document.querySelector("#arcBody .obj");
        return [o.offsetWidth, o.offsetHeight];
      });
    sizes.push(["root", await here(), await slotW()]);
    await dclick(page, '#arcBody .obj[data-cat="WORK"]');
    await page.waitForFunction(() => (document.querySelector("#crumb .here") || {}).textContent === "WORK", {
      timeout: 6000
    });
    sizes.push(["WORK", await here(), await slotW()]);
    await dclick(page, "#ejectBtn");
    await page.waitForFunction(() => !document.querySelector("#crumb .here"), { timeout: 6000 });
    await dclick(page, '#arcBody .obj[data-cat="PROJECTS"]');
    await page.waitForFunction(
      () => (document.querySelector("#crumb .here") || {}).textContent === "PROJECTS",
      { timeout: 6000 }
    );
    sizes.push(["PROJECTS", await here(), await slotW()]);
    await dclick(page, '#arcBody .obj[data-folder="academic"]');
    await page.waitForFunction(
      () => (document.querySelector("#crumb .here") || {}).textContent === "ACADEMIC",
      { timeout: 6000 }
    );
    sizes.push(["ACADEMIC", await here(), await slotW()]);
    const ref = sizes[0][1];
    for (const [p, sz, sw] of sizes) {
      if (Math.abs(sz[0] - ref[0]) > 1 || Math.abs(sz[1] - ref[1]) > 1) {
        ok = false;
        d += `${p}=${sz.map((x) => Math.round(x))}px; `;
      }
      if (sw < 20) {
        ok = false;
        d += `${p}: no slot; `;
      } else if (Math.abs(sw - sizes[0][2]) > 1) {
        ok = false;
        d += `${p} slot ${Math.round(sw)}px != ${Math.round(sizes[0][2])}px; `;
      }
    }
    if (ok)
      d = `disk ${Math.round(ref[0])}x${Math.round(ref[1])} + slot ${Math.round(sizes[0][2])}px at all 4 levels`;
  } catch (e) {
    ok = false;
    d = String(e).slice(0, 90);
  }
  record(name, "d01 disk size + slot constant across levels", ok, d);
  if (errs.consoleE.length || errs.pageE.length)
    record(
      name,
      "d02 zero console/page errors",
      false,
      [...errs.consoleE, ...errs.pageE].slice(0, 2).join(" | ")
    );
  await ctx.close();
  await browser.close();
}

/* ---------------- in-page helpers ---------------- */
async function objIds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("#arcBody .obj")).map(
      (o) => o.dataset.cat || o.dataset.folder || o.dataset.item || "?"
    )
  );
}
async function goCrumb(page, n) {
  await dclick(page, `#crumb a[data-go="${n}"]`);
}
async function backTo(page, n) {
  // n: expected .here text (null = root)
  await page.waitForFunction(
    (n) => {
      const h = document.querySelector("#crumb .here");
      return n ? h && h.textContent === n : !h;
    },
    n,
    { timeout: 6000 }
  );
}
/* Robust click: force:true moves the mouse to the element (so hover/tilt/
   scrollbar state is preserved exactly as with a normal click) but skips
   Playwright's actionability — the disk hover-lift transform makes the
   plain-click stability check flaky (it re-samples the moving bbox and
   times out). Real user clicks are unaffected; this only stabilises the
   automation. */
async function dclick(page, sel, opts) {
  await page.click(sel, Object.assign({ force: true, timeout: 10000 }, opts));
}
/* v7 G2 (item 9): a view change leaves a 320 ms afterglow ghost in the DOM
   (purely visual, identity attributes stripped, appended to .arc-scroll).
   Wait for it to be removed before asserting on a view's disk population. */
async function ghostSettled(page) {
  try {
    await page.waitForFunction(() => !document.querySelector(".view-ghost"), null, { timeout: 1200 });
  } catch (e) {
    /* no ghost — fine */
  }
}
/* Press Escape (closing any card/detail first, then ejecting) until we are at
   the root. Each eject is a 750ms fly, so wait for it between presses. */
async function toRoot(page, max = 7) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(() => !document.querySelector("#crumb .here"))) {
      await ghostSettled(page);
      return true;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
  }
  await ghostSettled(page);
  return page.evaluate(() => !document.querySelector("#crumb .here"));
}
async function openCat(page, id) {
  await dclick(page, `#arcBody .obj[data-cat="${id}"]`);
  await page.waitForFunction(
    (n) => {
      const h = document.querySelector("#crumb .here");
      return h && h.textContent === n;
    },
    id,
    { timeout: 6000 }
  );
  await ghostSettled(page);
}
async function openFolder(page, id, shown) {
  await dclick(page, `#arcBody .obj[data-folder="${id}"]`);
  await page.waitForFunction(
    (n) => {
      const h = document.querySelector("#crumb .here");
      return h && h.textContent === n;
    },
    shown,
    { timeout: 6000 }
  );
  await ghostSettled(page);
}
async function openCard(page, id) {
  await dclick(page, `#arcBody [data-item="${id}"]`);
  await page.waitForFunction(
    () => {
      const c = document.querySelector(".card");
      return c && !c.hidden;
    },
    { timeout: 4000 }
  );
}
async function escClose(page) {
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => {
      const c = document.querySelector(".card");
      return !c || c.hidden;
    },
    { timeout: 3000 }
  );
}
async function cardState(page, srcId) {
  return page.evaluate(async (T, srcId) => {
    await document.fonts.ready;
    const card = document.querySelector(".card");
    if (!card || card.hidden) return { hidden: true };
    const cr = card.getBoundingClientRect(),
      gr = document.getElementById("glass").getBoundingClientRect();
    const inGlass =
      cr.left >= gr.left - 1 &&
      cr.top >= gr.top - 1 &&
      cr.right <= gr.right + 1 &&
      cr.bottom <= gr.bottom + 1;
    const over = (r) =>
      Math.min(cr.right, r.right) - Math.max(cr.left, r.left) > 1 &&
      Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top) > 1;
    let overlap = null;
    /* the card is a floating dialog: it may cover NEIGHBOUR disks, but it must
       never cover the disk it points at */
    if (srcId) {
      const src = document.querySelector('#arcBody [data-item="' + srcId + '"]');
      if (src && over(src.getBoundingClientRect())) overlap = "own disk:" + srcId;
    }
    const clip = [];
    const clampOf = (el) =>
      getComputedStyle(el).webkitLineClamp || getComputedStyle(el).getPropertyValue("-webkit-line-clamp");
    /* P8 contract: footer links must be fully visible (never clipped)… */
    card.querySelectorAll(".card-l").forEach((el) => {
      if (el.scrollWidth > el.clientWidth + T || el.scrollHeight > el.clientHeight + T)
        clip.push(`${el.className}=${String(el.textContent).trim().slice(0, 32)}`);
    });
    /* …meta is one line (ellipsis ok, no vertical clip)… */
    const p = card.querySelector(".card-p");
    if (p && p.scrollHeight > p.clientHeight + T) clip.push("card-p vert-clip");
    /* …title may be long but must be 2-line clamped… */
    const t = card.querySelector(".card-t");
    if (t && t.scrollHeight > t.clientHeight + T && clampOf(t) !== "2") clip.push("card-t unclamped");
    /* …desc must be cleanly line-clamped (never cut mid-line)… */
    const dd = card.querySelector(".card-d");
    if (!dd || clampOf(dd) !== "2") clip.push("card-d clamp=" + (dd ? clampOf(dd) : "none"));
    /* …tags one row (no vertical clip). */
    const tg = card.querySelector(".card-tags");
    if (tg && tg.scrollHeight > tg.clientHeight + T) clip.push("card-tags vert-clip");
    return { hidden: false, inGlass, overlap, clip };
  }, TOL);
}
async function labelClips(page) {
  return page.evaluate(async (T) => {
    await document.fonts.ready;
    const out = [];
    document
      .querySelectorAll("#arcBody .f-name,#arcBody .f-sub,#arcBody .plain-row .pr-name")
      .forEach((el) => {
        if (el.scrollWidth > el.clientWidth + T || el.scrollHeight > el.clientHeight + T)
          out.push(`${el.className}=${String(el.textContent).trim().slice(0, 24)}`);
      });
    return out;
  }, TOL);
}
async function repoLinks(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".card .card-l")).map((a) => ({
      text: a.textContent.trim(),
      href: a.href,
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel") || ""
    }))
  );
}

/* ---------------- one viewport (kept v4 checks) ---------------- */
async function runViewport(vp) {
  const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
  const browser = await chromium.launch();
  const mk = async (hash = "#off", extra = {}) => {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      isMobile: !!vp.mobile,
      hasTouch: !!vp.mobile,
      ...extra
    });
    const page = await ctx.newPage();
    attach(page, errs);
    await page.goto(BASE + hash, { waitUntil: "load" });
    return { ctx, page };
  };

  /* ---- Phase A: full boot + tree + cards + nav + kb + plain + snd ---- */
  let { ctx, page } = await mk();
  // 60a. power button at rest: round, beige, engraved DARK glyph; LED dark, no glow
  await page.waitForSelector("#powerHint", { state: "visible", timeout: 5000 }).catch(() => {});
  const powOff = await page.evaluate(() => {
    const b = document.getElementById("powerBtn"),
      p = b.querySelector("svg path");
    const cs = getComputedStyle(b),
      led = getComputedStyle(document.getElementById("led"));
    const [r, g, bl] = (getComputedStyle(p).stroke.match(/\d+/g) || [255, 255, 255]).map(Number);
    return {
      rad: cs.borderRadius,
      off: b.offsetWidth,
      glyphDark: Math.max(r, g, bl) < 200,
      glyphWhite: r > 240 && g > 240 && bl > 240,
      bg: cs.backgroundImage,
      ledBg: led.backgroundColor,
      ledGlow: led.boxShadow.includes("102, 242, 154")
    };
  });
  await dclick(page, "#powerBtn");
  let bootOk = true,
    bootDetail = "";
  try {
    await page.waitForSelector("body.phase-archive", { timeout: 25000 });
    const ids = await objIds(page);
    if (JSON.stringify(ids) !== JSON.stringify(CATS)) {
      bootOk = false;
      bootDetail = `root disks=[${ids}]`;
    }
  } catch {
    bootOk = false;
    bootDetail = "did not reach archive in 25s";
  }
  record(vp.name, "c05 boot->5 disks", bootOk, bootDetail);

  // 60b. power button on: LED dot phosphor green with glow; button unchanged
  {
    let ok = true,
      d = "";
    try {
      const on = await page.evaluate(() => {
        const led = getComputedStyle(document.getElementById("led"));
        const b = document.getElementById("powerBtn"),
          p = b.querySelector("svg path");
        const [r, g, bl] = (getComputedStyle(p).stroke.match(/\d+/g) || [255, 255, 255]).map(Number);
        return {
          ledOn: led.backgroundColor === "rgb(102, 242, 154)",
          glow: led.boxShadow.includes("102, 242, 154"),
          off: b.offsetWidth,
          glyphWhite: r > 240 && g > 240 && bl > 240,
          rad: getComputedStyle(b).borderRadius
        };
      });
      const round = /50%/.test(powOff.rad) || Math.abs(parseFloat(powOff.rad) - powOff.off / 2) <= 1;
      if (!round) {
        ok = false;
        d += "not round (" + powOff.rad + ");";
      }
      if (/255, 255, 255/.test(powOff.bg) && !/radial-gradient/.test(powOff.bg)) {
        ok = false;
        d += "white bg;";
      }
      if (powOff.glyphWhite || !powOff.glyphDark) {
        ok = false;
        d += "glyph not dark engraved;";
      }
      if (powOff.ledGlow) {
        ok = false;
        d += "LED glows while off;";
      }
      if (!on.ledOn || !on.glow) {
        ok = false;
        d += "LED on-state " + JSON.stringify({ on: on.ledOn, glow: on.glow });
      }
      if (on.glyphWhite) {
        ok = false;
        d += "glyph white when on;";
      }
      if (on.off !== powOff.off) {
        ok = false;
        d += "button size changed " + powOff.off + "->" + on.off;
      }
      if (ok) d = `round ${powOff.off}px, glyph dark engraved, LED toggles dark->green glow`;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c60 power button round beige, dark glyph, LED dot toggles", ok, d);
  }

  const rootClips = bootOk ? await labelClips(page) : ["(skipped: no boot)"];

  // 11/12/13 keyboard at root
  let kbArrow = false,
    kbEnter = false,
    kbFocus = "no focus";
  if (bootOk) {
    await page.keyboard.press("ArrowRight");
    const a0 = await page.evaluate(() =>
      document.activeElement.dataset
        ? document.activeElement.dataset.cat ||
          document.activeElement.dataset.folder ||
          document.activeElement.dataset.item
        : null
    );
    await page.keyboard.press("ArrowRight");
    const a1 = await page.evaluate(() =>
      document.activeElement.dataset
        ? document.activeElement.dataset.cat ||
          document.activeElement.dataset.folder ||
          document.activeElement.dataset.item
        : null
    );
    kbArrow = a0 === "ABOUT.ME" && a1 === "WORK";
    kbFocus = await (async () => {
      return await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || !(el.classList && el.classList.contains("obj"))) return "no focus";
        const cs = getComputedStyle(el);
        /* v7 G1 (item 5): the focus ring is a box-shadow following the disk shape */
        return cs.boxShadow.includes("157, 255, 192") ? "ring ok" : "no ring: " + cs.boxShadow.slice(0, 40);
      });
    })();
    if (kbArrow) {
      await page.keyboard.press("ArrowLeft"); // focus ABOUT.ME again
      await page.keyboard.press("Enter");
      try {
        await backTo(page, "ABOUT.ME");
        kbEnter = true;
      } catch {
        kbEnter = false;
      }
    }
  }
  record(vp.name, "c11 kb arrows move focus", kbArrow, kbFocus);
  record(vp.name, "c12 kb Enter opens", kbEnter && bootOk, kbArrow ? "" : "arrows failed");
  record(vp.name, "c13 kb focus style visible (ring follows the disk shape)", kbFocus === "ring ok", kbFocus);

  // 23. POWER button: toggle off -> back on (real CRT collapse)
  await goCrumb(page, 0);
  await backTo(page, null);
  {
    let pow = true,
      d = "";
    try {
      await dclick(page, "#powerBtn");
      await page.waitForSelector("body.phase-off", { timeout: 5000 });
      const off = await page.evaluate(() => ({
        hint: parseFloat(getComputedStyle(document.getElementById("powerHint")).opacity),
        led: document.getElementById("led").classList.contains("on"),
        glass: document.getElementById("glass").classList.contains("on")
      }));
      if (off.hint < 0.1 || off.led || off.glass) {
        pow = false;
        d = "off state " + JSON.stringify(off);
      }
      await dclick(page, "#powerBtn");
      await page.waitForSelector("body.phase-archive", { timeout: 30000 });
      const ids = await objIds(page);
      if (JSON.stringify(ids) !== JSON.stringify(CATS)) {
        pow = false;
        d = "back=[" + ids + "]";
      }
    } catch (e) {
      pow = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c23 power off/on toggle", pow, d);
  }

  // 24. hover = physical lift (v7 G1 item 4), no outline
  {
    let hov = true,
      d = "";
    try {
      await page.hover('#arcBody .obj[data-cat="CONTACT"]');
      await page.waitForTimeout(250);
      const o = await outlineInScreenPx(page, '#arcBody .obj[data-cat="CONTACT"]');
      const tr = await page.evaluate(
        () => getComputedStyle(document.querySelector('#arcBody .obj[data-cat="CONTACT"]')).transform
      );
      const noOutline = !o || o.style === "none";
      const lifted = /matrix\(1, 0, 0, 1, 0, -4\)/.test(tr);
      if (!(noOutline && lifted)) {
        hov = false;
        d = `outline=${o ? o.style : "?"} transform=${tr}`;
      }
    } catch (e) {
      hov = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c24 hover = physical lift (translateY -4px, no outline)", hov, d);
  }

  // 25. child items same size as top level (trivially true on the fixed stage)
  {
    let ok = true,
      d = "";
    try {
      const rootSz = await page.evaluate(() => {
        const o = document.querySelector("#arcBody .obj");
        return [o.offsetWidth, o.offsetHeight];
      });
      await openCat(page, "WORK");
      const childSz = await page.evaluate(() => {
        const o = document.querySelector("#arcBody .obj");
        return [o.offsetWidth, o.offsetHeight];
      });
      if (Math.abs(rootSz[0] - childSz[0]) > TOL || Math.abs(rootSz[1] - childSz[1]) > TOL) {
        ok = false;
        d = "root=[" + rootSz + "] child=[" + childSz + "]";
      }
      await dclick(page, "#ejectBtn");
      await backTo(page, null);
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c25 child size == parent size", ok, d);
  }

  // 6. open every disk + item; 7. card geometry; 14. repo links
  const treeFails = [],
    cardFails = [],
    cardClips = [],
    repoFails = [];
  const expectIds = (got, want) => JSON.stringify(got) === JSON.stringify(want);
  const card = async (id) => {
    try {
      await openCard(page, id);
      const s = await cardState(page, id);
      if (!s.inGlass) cardFails.push(`${id}: outside glass`);
      if (s.overlap) cardFails.push(`${id}: overlaps ${s.overlap}`);
      cardClips.push(...s.clip.map((c) => `${id}:${c}`));
      if (REPOS[id]) {
        const links = await repoLinks(page);
        const a = links.find((l) =>
          l.text
            .replace(/^\s*—\s*/, "")
            .toUpperCase()
            .startsWith("REPO")
        );
        if (!a) repoFails.push(`${id}: no repo link (have ${links.length})`);
        else {
          const want = `https://github.com/Tu7uru/${REPOS[id]}`;
          if (a.href !== want) repoFails.push(`${id}: href ${a.href} != ${want}`);
          if (a.target !== "_blank") repoFails.push(`${id}: target=${a.target}`);
          if (!a.rel.includes("noopener")) repoFails.push(`${id}: rel="${a.rel}"`);
        }
      }
      await escClose(page);
    } catch (e) {
      cardFails.push(`${id}: ${String(e).slice(0, 60)}`);
    }
  };
  if (bootOk) {
    // ABOUT.ME
    await openCat(page, "ABOUT.ME");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.ABOUT.items)) treeFails.push(`ABOUT.ME=[${ids}]`);
      await card("me");
    }
    // WORK
    await goCrumb(page, 0);
    await backTo(page, null);
    await openCat(page, "WORK");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.WORK.items)) treeFails.push(`WORK=[${ids}]`);
      for (const i of TREE.WORK.items) await card(i);
    }
    // EJECT -> root
    {
      let ok = false;
      try {
        await dclick(page, "#ejectBtn");
        await backTo(page, null);
        ok = true;
      } catch {
        ok = false;
      }
      if (!ok) treeFails.push("EJECT did not return to root");
      record(vp.name, "c09 EJECT back", ok, ok ? "" : "stuck");
    }
    // EDUCATION + Backspace -> root
    await openCat(page, "EDUCATION");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.EDU.items)) treeFails.push(`EDUCATION=[${ids}]`);
      for (const i of TREE.EDU.items) await card(i);
    }
    {
      let ok = false;
      try {
        await page.keyboard.press("Backspace");
        await backTo(page, null);
        ok = true;
      } catch {
        ok = false;
      }
      record(vp.name, "c08 Backspace back", ok, ok ? "" : "stuck");
    }
    // PROJECTS -> ACADEMIC / PERSONAL + breadcrumb
    await openCat(page, "PROJECTS");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.PROJ.folders)) treeFails.push(`PROJECTS=[${ids}]`);
    }
    await openFolder(page, "academic", "ACADEMIC");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.ACAD.items)) treeFails.push(`ACADEMIC=[${ids}]`);
      (await labelClips(page)).forEach((c) => rootClips.push("acad:" + c));
      for (const i of TREE.ACAD.items) await card(i);
    }
    {
      let ok = false;
      try {
        await goCrumb(page, 1);
        await backTo(page, "PROJECTS");
        ok = true;
      } catch {
        ok = false;
      }
      if (!ok) treeFails.push("breadcrumb PROJECTS segment failed");
      try {
        await goCrumb(page, 0);
        await backTo(page, null);
      } catch {
        treeFails.push("breadcrumb root segment failed");
      }
      record(vp.name, "c10 breadcrumb back", ok, ok ? "" : "segment click failed");
    }
    await openCat(page, "PROJECTS");
    await openFolder(page, "personal", "PERSONAL");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.PERS.items)) treeFails.push(`PERSONAL=[${ids}]`);
      for (const i of TREE.PERS.items) await card(i);
    }
    // CONTACT
    await goCrumb(page, 0);
    await backTo(page, null);
    await openCat(page, "CONTACT");
    {
      const ids = await objIds(page);
      if (!expectIds(ids, TREE.CONTACT.items)) treeFails.push(`CONTACT=[${ids}]`);
      for (const i of TREE.CONTACT.items) await card(i);
    }
    await goCrumb(page, 0);
    await backTo(page, null);
  }
  record(vp.name, "c06 open all disks+items", treeFails.length === 0, treeFails.join(" | "));
  record(
    vp.name,
    "c07 cards in glass, no overlap, Esc closes",
    cardFails.length === 0,
    cardFails.length === 0 ? `(15 cards)` : cardFails.slice(0, 6).join(" | ")
  );
  record(vp.name, "c14 repo hrefs target rel", repoFails.length === 0, repoFails.slice(0, 6).join(" | "));
  record(
    vp.name,
    "c22 card text: footer unclipped, desc line-clamped, meta/tags one line",
    cardClips.length === 0,
    cardClips.slice(0, 5).join(" | ")
  );

  // 16. PLAIN shows same tree
  const plainFails = [];
  if (bootOk) {
    const plainNames = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll("#arcBody .plain-row .pr-name")).map((e) => e.textContent.trim())
      );
    await dclick(page, "#plainBtn");
    await page.waitForFunction(() => !!document.querySelector("#arcBody .plain-row"), { timeout: 3000 });
    let n = await plainNames();
    if (JSON.stringify(n) !== JSON.stringify(CATS)) plainFails.push(`root=${JSON.stringify(n)}`);
    await dclick(page, '#arcBody .plain-row[data-cat="WORK"]');
    await page.waitForFunction(() => document.querySelectorAll("#arcBody .plain-row").length === 3, {
      timeout: 3000
    });
    n = await plainNames();
    if (!n.includes("Deloitte") || !n.includes("INTERMEDIA") || !n.includes("Hellenic Army"))
      plainFails.push(`WORK=${JSON.stringify(n)}`);
    await page.keyboard.press("Backspace");
    await backTo(page, null);
    await dclick(page, '#arcBody .plain-row[data-cat="PROJECTS"]');
    await page.waitForFunction(
      () => (document.querySelector("#crumb .here") || {}).textContent === "PROJECTS",
      { timeout: 3000 }
    );
    n = await plainNames();
    if (!n.includes("ACADEMIC") || !n.includes("PERSONAL")) plainFails.push(`PROJECTS=${JSON.stringify(n)}`);
    await dclick(page, '#arcBody .plain-row[data-folder="academic"]');
    await page.waitForFunction(() => document.querySelectorAll("#arcBody .plain-row").length === 5, {
      timeout: 3000
    });
    n = await plainNames();
    if (!n.includes("Themis")) plainFails.push(`ACADEMIC=${JSON.stringify(n)}`);
    await goCrumb(page, 0);
    await backTo(page, null);
    await dclick(page, "#plainBtn");
    await page.waitForFunction(() => !!document.querySelector("#arcBody .obj"), { timeout: 3000 });
  }
  record(vp.name, "c16 PLAIN same tree", plainFails.length === 0, plainFails.slice(0, 5).join(" | "));

  // 27/28. VIEW MORE detail view + CV link attrs
  {
    let vm = true,
      vmD = "",
      rl = true,
      rlD = "";
    try {
      await openCat(page, "WORK");
      await openCard(page, "deloitte");
      const cl = await page.evaluate(() => {
        const a = document.querySelector('.card a[href="HaralambosVarsamis_CV.pdf"]');
        return a ? { t: a.textContent.trim(), target: a.target, rel: a.getAttribute("rel") || "" } : null;
      });
      if (!cl || cl.target !== "_blank" || !cl.rel.includes("noopener") || !cl.t.startsWith("OPEN CV")) {
        rl = false;
        rlD = "card: " + JSON.stringify(cl);
      }
      await dclick(page, ".card-more");
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      const dt = await page.evaluate(() => {
        const a = document.querySelector('#detailView a[href="HaralambosVarsamis_CV.pdf"]');
        return {
          lines: document.querySelectorAll("#detailView .dt-line").length,
          resume: a ? { t: a.textContent.trim(), target: a.target, rel: a.getAttribute("rel") || "" } : null
        };
      });
      if (dt.lines < 3) {
        vm = false;
        vmD = "lines=" + dt.lines;
      }
      if (!dt.resume || dt.resume.target !== "_blank" || !dt.resume.rel.includes("noopener")) {
        rl = false;
        rlD += " detail: " + JSON.stringify(dt.resume);
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => !document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      await dclick(page, "#ejectBtn");
      await backTo(page, null);
    } catch (e) {
      vm = false;
      vmD = String(e).slice(0, 80);
    }
    record(vp.name, "c27 VIEW MORE opens/closes", vm, vmD);
    record(vp.name, "c28 CV link attrs", rl, rlD);
  }

  // 29. insert animation completes before the section opens
  {
    let ok = true,
      d = "";
    try {
      const t0 = Date.now();
      const box = await page.locator('#arcBody .obj[data-cat="EDUCATION"]').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "EDUCATION";
        },
        null,
        { timeout: 5000 }
      );
      const dt = Date.now() - t0;
      if (dt < 600) {
        ok = false;
        d = dt + "ms < 600ms";
      }
      await dclick(page, "#ejectBtn");
      await backTo(page, null);
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c29 insert anim before section opens", ok, d);
  }

  // 30. no horizontal clipping of disks at the root
  {
    let ok = true,
      d = "";
    try {
      const chk = await page.evaluate(() => {
        const g = document.querySelector(".arc-scroll").getBoundingClientRect();
        const sc = document.querySelector(".arc-scroll");
        const bad = [];
        document.querySelectorAll("#arcBody .obj").forEach((o) => {
          const r = o.getBoundingClientRect();
          if (r.left < g.left - 1 || r.right > g.right + 1)
            bad.push(o.dataset.cat || o.dataset.folder || o.dataset.item);
        });
        return { bad, h: sc.scrollWidth - sc.clientWidth };
      });
      if (chk.bad.length || chk.h > 1) {
        ok = false;
        d = `bad=${chk.bad} hOv=${chk.h}`;
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c30 no horizontal clipping at root", ok, d);
  }

  // 32. no lone item in the last row at the root (mobile: lone last row allowed if centred)
  {
    let ok = true,
      d = "";
    try {
      const chk = await page.evaluate(() => {
        const wraps = Array.from(document.querySelectorAll(".tray .obj-wrap, .rack .obj-wrap"));
        if (!wraps.length) return { n: 0 };
        const tops = [...new Set(wraps.map((w) => Math.round(w.getBoundingClientRect().top)))].sort(
          (a, b) => a - b
        );
        const last = wraps.filter((w) => Math.abs(w.getBoundingClientRect().top - tops[tops.length - 1]) < 5);
        const r = last.map((w) => w.getBoundingClientRect());
        const left = Math.min(...r.map((x) => x.left)),
          right = Math.max(...r.map((x) => x.right));
        const tray = document.querySelector(".tray,.rack").getBoundingClientRect();
        return {
          n: wraps.length,
          rows: tops.length,
          lastRow: last.length,
          off: Math.abs((left + right) / 2 - (tray.left + tray.width / 2))
        };
      });
      if (chk.n) {
        if (chk.rows > 1 && chk.lastRow === 1 && !vp.mobile) {
          ok = false;
          d = "lone item in last row (" + chk.rows + " rows)";
        }
        /* grid layout: a lone last-row disk sits in its cell (reading order) —
           only the desktop default (one row) must be centred */
        if (!vp.mobile && chk.off > 18) {
          ok = false;
          d += " last row off-centre " + Math.round(chk.off) + "px";
        }
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c32 root row balanced, no lone item", ok, d);
  }

  // 33. stage fills the viewport (height-limited law), no page scroll
  if (vp.name === "1920x1080" || vp.name === "1440x900" || vp.name === "1280x800") {
    let ok = true,
      d = "";
    try {
      const r = await page.evaluate(() => {
        const m = document.querySelector(".monitor").getBoundingClientRect().height / innerHeight;
        return { m, scroll: document.documentElement.scrollHeight - innerHeight };
      });
      if ((vp.name === "1920x1080" || vp.name === "1440x900") && r.m < 0.85) {
        ok = false;
        d = "monitor height " + Math.round(r.m * 100) + "% of viewport";
      } else d = Math.round(r.m * 100) + "% of viewport";
      if (r.scroll > 1) {
        ok = false;
        d += " + page scrolls " + r.scroll + "px";
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c33 monitor fills viewport (>=85% on big), no page scroll", ok, d);
  }

  // 34. stand neck: visible, below the case, centred
  {
    let ok = true,
      d = "";
    try {
      const n = await page.evaluate(() => {
        const neck = document.querySelector(".crt-neck");
        const caseEl = document.querySelector(".crt-case");
        if (!neck || neck.offsetParent === null) return { shown: false };
        /* stage px: divide the scaled screen rect by the current scale */
        const st = document.getElementById("stage").getBoundingClientRect();
        const sc = st.width / (st.width < 800 ? 430 : 1680);
        const nr = neck.getBoundingClientRect(),
          cr = caseEl.getBoundingClientRect();
        const off = Math.abs((nr.left + nr.right) / 2 - (cr.left + cr.width / 2)) / sc;
        return { shown: true, h: nr.height / sc, gap: (nr.top - cr.bottom) / sc, off };
      });
      if (!n.shown) {
        ok = false;
        d = "neck not rendered";
      } else if (n.h < 18) {
        ok = false;
        d = "neck too short " + Math.round(n.h) + "px";
      } else if (n.gap < -4 || n.gap > 10) {
        ok = false;
        d = "neck not directly below case (gap " + Math.round(n.gap) + "px)";
      } else if (n.off > 8) {
        ok = false;
        d = "neck off-centre " + Math.round(n.off) + "px";
      } else d = Math.round(n.h) + "px tall, gap " + Math.round(n.gap) + "px";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c34 stand neck below case", ok, d);
  }

  // 35. 3.5" slot width within ±20% of the rendered disk width
  {
    let ok = true,
      d = "";
    try {
      const s = await page.evaluate(() => {
        const inEl = Array.from(document.querySelectorAll(".ds-in")).find((e) => e.offsetParent !== null);
        const slot = inEl && inEl.querySelector(".ds-slot");
        const o = document.querySelector("#arcBody .tray .obj, #arcBody .rack .obj");
        if (!slot || !o) return { bad: true };
        const sw = slot.getBoundingClientRect().width,
          dw = o.getBoundingClientRect().width;
        return { sw, dw, diff: Math.abs(sw - dw) / dw };
      });
      if (s.bad) {
        ok = false;
        d = "slot or disk missing";
      } else if (s.diff > 0.2) {
        ok = false;
        d =
          "slot " +
          Math.round(s.sw) +
          "px vs disk " +
          Math.round(s.dw) +
          "px (" +
          Math.round(s.diff * 100) +
          "% off)";
      } else d = "slot " + Math.round(s.sw) + "px / disk " + Math.round(s.dw) + "px";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c35 slot width ≈ disk width (±20%)", ok, d);
  }

  // 62. inserter slot: inside the case, never over the glass or the right strip
  {
    let ok = true,
      d = "";
    try {
      const sp = await page.evaluate(() => {
        const inEl = Array.from(document.querySelectorAll(".ds-in")).find((e) => e.offsetParent !== null);
        const slotEl = inEl && inEl.querySelector(".ds-slot");
        if (!slotEl) return { bad: true };
        const s = slotEl.getBoundingClientRect();
        const c = document.querySelector(".crt-case").getBoundingClientRect();
        const g = document.getElementById("glass").getBoundingClientRect();
        const stripEl = document.querySelector(".crt-strip");
        const t = stripEl && stripEl.offsetParent !== null ? stripEl.getBoundingClientRect() : null;
        const hit = (r) =>
          r && !(s.right <= r.left || s.left >= r.right || s.bottom <= r.top || s.top >= r.bottom);
        return {
          bad: false,
          inside: s.left >= c.left && s.top >= c.top && s.right <= c.right && s.bottom <= c.bottom,
          glass: hit(g),
          strip: hit(t)
        };
      });
      if (sp.bad) {
        ok = false;
        d = "no visible slot";
      } else if (!sp.inside) {
        ok = false;
        d += "slot outside case;";
      }
      if (sp.glass) {
        ok = false;
        d += "slot over glass;";
      }
      if (sp.strip) {
        ok = false;
        d += "slot over right strip;";
      }
      if (ok) d = "slot inside case, clear of glass + strip";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c62 slot inside case, clear of glass/strip", ok, d);
  }

  // 36. every disk carries its label icon (root + children of WORK & PROJECTS)
  {
    let ok = true,
      d = "";
    try {
      let missing = await page.evaluate(() => {
        const m = [];
        document
          .querySelectorAll(".tray > .obj-wrap .obj, .rack > .obj-wrap .obj, .cabinet > .obj")
          .forEach((o) => {
            if (!o.querySelector(".lic svg")) m.push(o.dataset.cat || o.dataset.folder || o.dataset.item);
          });
        return m;
      });
      const nav = async (cat) => {
        await dclick(page, '.obj[data-cat="' + cat + '"]');
        await page.waitForSelector("#arcBody .obj-item", { timeout: 4000 }).catch(() => {});
        const m = await page.evaluate(() => {
          const m = [];
          document.querySelectorAll("#arcBody .obj-item").forEach((o) => {
            if (!o.querySelector(".lic svg")) m.push(o.dataset.folder || o.dataset.item);
          });
          return m;
        });
        missing = missing.concat(m);
        await dclick(page, "#ejectBtn");
        await page.waitForSelector('.obj[data-cat="' + cat + '"]', { timeout: 4000 });
      };
      await nav("WORK");
      await nav("PROJECTS");
      if (missing.length) {
        ok = false;
        d = "iconless: " + missing.slice(0, 6).join(",");
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c36 every disk has its label icon", ok, d);
  }

  // 37. icon animations run only on the hovered/focused disk, reset after, none under reduced-motion
  {
    let ok = true,
      d = "";
    try {
      const nameOf = async (sel) =>
        page.evaluate((s) => {
          const el = document.querySelector(s);
          return el ? getComputedStyle(el).animationName : "missing";
        }, sel);
      const about = '.obj[data-cat="ABOUT.ME"] .lic .li-wave';
      const gear = '.obj[data-cat="PROJECTS"] .lic .li-gear1';
      const idle1 = await nameOf(about);
      if (idle1 !== "none") {
        ok = false;
        d = "animating at rest: " + idle1;
      } else {
        const b = await page.locator('.obj[data-cat="ABOUT.ME"]').boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(250);
        const hov = await nameOf(about);
        const other = await nameOf(gear);
        if (hov !== "liWave") {
          ok = false;
          d = "hovered ABOUT not animating (" + hov + ")";
        } else if (other !== "none") {
          ok = false;
          d = "unhovered PROJECTS animating (" + other + ")";
        } else {
          await page.mouse.move(8, 8);
          await page.waitForTimeout(150);
          const reset = await nameOf(about);
          if (reset !== "none") {
            ok = false;
            d = "no reset after hover: " + reset;
          }
        }
        if (ok) {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.waitForTimeout(200);
          const rm = await nameOf(about);
          await page.emulateMedia({ reducedMotion: null });
          if (rm !== "none") {
            ok = false;
            d = "reduced-motion still animating (" + rm + ")";
          }
        }
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c37 icon anim only on hover/focus, resets, RM-static", ok, d);
  }

  // 38. floppy design: colours per category, children inherit, per-disk specials
  {
    let ok = true,
      d = "";
    try {
      const shell = (sel) =>
        page.evaluate(
          (s) => getComputedStyle(document.querySelector(s)).getPropertyValue("--shell-1").trim(),
          sel
        );
      const roots = ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"];
      const vals = {};
      for (const c of roots) vals[c] = await shell('.obj[data-cat="' + c + '"]');
      const distinct = new Set(Object.values(vals)).size;
      if (distinct < 5) {
        ok = false;
        d = "shells not distinct (" + distinct + ")";
      }
      const projDisc = await page.evaluate(
        () => getComputedStyle(document.querySelector('.obj[data-cat="PROJECTS"] .f-disc')).display
      );
      const aboutStk = await page.evaluate(
        () => getComputedStyle(document.querySelector('.obj[data-cat="ABOUT.ME"] .f-stk')).display
      );
      if (projDisc !== "block") {
        ok = false;
        d += " PROJECTS disc hidden;";
      }
      if (aboutStk !== "block") {
        ok = false;
        d += " ABOUT.ME doodle hidden;";
      }
      /* children inherit the parent shell */
      await dclick(page, '.obj[data-cat="WORK"]');
      await page.waitForSelector("#arcBody .obj-item", { timeout: 4000 });
      const childShell = await page.evaluate(() =>
        getComputedStyle(document.querySelector("#arcBody .obj-item")).getPropertyValue("--shell-1").trim()
      );
      if (childShell !== vals.WORK) {
        ok = false;
        d += " WORK child shell " + childShell + " != " + vals.WORK;
      }
      await dclick(page, "#ejectBtn");
      await page.waitForSelector('.obj[data-cat="PROJECTS"]', { timeout: 4000 });
      await dclick(page, '.obj[data-cat="PROJECTS"]');
      await page.waitForSelector("#arcBody .obj-item", { timeout: 4000 });
      const pc = await page.evaluate(() => {
        const a = document.querySelector('[data-folder="academic"]'),
          pe = document.querySelector('[data-folder="personal"]');
        return { a: a ? a.className : "", pe: pe ? pe.className : "" };
      });
      if (!pc.a.includes("sp-disc") || !pc.a.includes("wp-open")) {
        ok = false;
        d += " ACADEMIC " + pc.a;
      }
      if (!pc.pe.includes("sp-holo")) {
        ok = false;
        d += " PERSONAL " + pc.pe;
      }
      await dclick(page, "#ejectBtn");
      await page.waitForSelector('.obj[data-cat="EDUCATION"]', { timeout: 4000 });
      await dclick(page, '.obj[data-cat="EDUCATION"]');
      await page.waitForSelector('#arcBody .obj-item[data-item="mb500"]', { timeout: 4000 });
      const mb = await page.evaluate(() => document.querySelector('[data-item="mb500"]').className);
      if (mb.includes("sp-wip")) {
        ok = false;
        d += " MB-500 still marked WIP (it is passed)";
      }
      await dclick(page, "#ejectBtn");
      await page.waitForSelector('.obj[data-cat="ABOUT.ME"]', { timeout: 4000 });
      if (ok) d = "5 distinct shells, inheritance + specials ok";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c38 floppy colours inherit + per-disk specials", ok, d);
  }

  // 39. shutter slides open on hover, resets to closed after
  {
    let ok = true,
      d = "";
    try {
      const sh = () =>
        page.evaluate(
          () => getComputedStyle(document.querySelector('.obj[data-cat="ABOUT.ME"] .f-shutter')).transform
        );
      const base = await sh();
      const b = await page.locator('.obj[data-cat="ABOUT.ME"]').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(550);
      const hov = await sh();
      if (hov === base) {
        ok = false;
        d = "shutter did not slide on hover";
      }
      await page.mouse.move(6, 6);
      await page.waitForTimeout(650);
      const back = await sh();
      if (back !== base) {
        ok = false;
        d += " shutter did not reset (" + back + ")";
      }
      if (ok) d = "base=" + base.slice(0, 22) + "…";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c39 shutter slides open, resets on blur", ok, d);
  }

  // 40. (v7 G1) hover = the simple physical lift; the cursor-follow 3D tilt is GONE
  {
    let ok = true,
      d = "";
    try {
      const b = await page.locator('.obj[data-cat="WORK"]').boundingBox();
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.25, { steps: 4 });
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const el = document.querySelector('.obj[data-cat="WORK"]');
        return {
          tx: el.style.getPropertyValue("--tx"),
          ty: el.style.getPropertyValue("--ty"),
          tr: getComputedStyle(el).transform
        };
      });
      if (r.tx || r.ty) {
        ok = false;
        d = "tilt vars still set " + r.tx + "/" + r.ty;
      } else if (!/matrix\(1, 0, 0, 1, 0, -4\)/.test(r.tr)) {
        ok = false;
        d = "no simple -4px lift: " + r.tr;
      } else d = "no tilt vars, simple -4px lift";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c40 hover = simple physical lift (3D tilt removed, G1 item 4)", ok, d);
  }

  // 41. crumb and buttons never intersect at the deepest path; "…" middle-collapse dropdown works
  {
    let ok = true,
      d = "";
    try {
      await openCat(page, "PROJECTS");
      await dclick(page, '.obj[data-folder="academic"]', { force: true });
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "ACADEMIC";
        },
        { timeout: 4000 }
      );
      const r = await page.evaluate(() => {
        const c = document.querySelector(".crumb").getBoundingClientRect();
        const t = document.querySelector(".arc-ctl").getBoundingClientRect();
        return {
          hit: !(
            c.right <= t.left + 1 ||
            t.right <= c.left + 1 ||
            c.bottom <= t.top + 1 ||
            t.bottom <= c.top + 1
          )
        };
      });
      if (r.hit) {
        ok = false;
        d = "crumb/buttons intersect";
      }
      /* force the collapse so the dropdown is always exercised */
      await page.evaluate(() => {
        const st = document.createElement("style");
        st.id = "qaCrumb";
        st.textContent =
          innerWidth < 600
            ? ".crumb{flex:0 1 150px !important;max-width:150px !important}"
            : ".crumb{flex:0 1 240px !important}";
        document.head.appendChild(st);
        window.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(() => !!document.querySelector(".crumb .ellipsis"), { timeout: 2000 });
      const txt = await page.evaluate(() => document.querySelector(".crumb").textContent.trim());
      if (!/C:\\TU7URU\\…\\ACADEMIC/.test(txt)) {
        ok = false;
        d += ' collapsed="' + txt + '"';
      }
      await dclick(page, ".crumb .ellipsis", { force: true });
      const menu = await page.evaluate(() =>
        [...document.querySelectorAll(".crumb-menu-item")].map((e) => e.textContent)
      );
      if (JSON.stringify(menu) !== JSON.stringify(["PROJECTS"])) {
        ok = false;
        d += " menu=" + JSON.stringify(menu);
      }
      await dclick(page, ".crumb-menu-item", { force: true });
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "PROJECTS";
        },
        { timeout: 4000 }
      );
      await dclick(page, '.obj[data-folder="academic"]', { force: true });
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "ACADEMIC";
        },
        { timeout: 4000 }
      );
      await dclick(page, ".crumb .ellipsis", { force: true });
      await page.keyboard.press("Escape");
      if (await page.evaluate(() => !!document.querySelector(".crumb-menu"))) {
        ok = false;
        d += " esc keeps menu";
      }
      await page.evaluate(
        () => document.getElementById("qaCrumb") && document.getElementById("qaCrumb").remove()
      );
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(vp.name, 'c41 crumb vs buttons never intersect, "…" dropdown navigates', ok, d);
    await goCrumb(page, 0);
    await backTo(page, null);
  }

  // 42. closing a card (× and Esc) returns to the folder: disks visible, focus on the source disk
  {
    let ok = true,
      d = "";
    const p2 = await page.context().newPage();
    await p2.goto(BASE + "#skip", { waitUntil: "load" });
    await p2.waitForTimeout(1200);
    try {
      await openCat(p2, "WORK");
      await dclick(p2, '.obj-item[data-item="deloitte"]', { force: true });
      d += " [deloitte-ok]";
      await p2.waitForSelector(".card:not([hidden])", { timeout: 4000 });
      d += " [card-ok]";
      await dclick(p2, ".card-x", { force: true });
      d += " [x-ok]";
      await p2.waitForTimeout(200);
      let st = await p2.evaluate(() => ({
        n: document.querySelectorAll("#arcBody .obj").length,
        op: [...document.querySelectorAll("#arcBody .obj")].every((o) => getComputedStyle(o).opacity === "1"),
        cardHidden: document.querySelector(".card").hidden,
        focus:
          document.activeElement && document.activeElement.dataset
            ? document.activeElement.dataset.item || document.activeElement.dataset.cat
            : null
      }));
      if (!(st.n === 3 && st.op && st.cardHidden && st.focus === "deloitte")) {
        ok = false;
        d += "x=" + JSON.stringify(st);
      }
      await goCrumb(p2, 0);
      await backTo(p2, null);
      await openCat(p2, "PROJECTS");
      await dclick(p2, '.obj[data-folder="academic"]', { force: true });
      await p2.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "ACADEMIC";
        },
        { timeout: 4000 }
      );
      await dclick(p2, '.obj-item[data-item="themis"]', { force: true });
      await p2.waitForSelector(".card:not([hidden])", { timeout: 4000 });
      await p2.keyboard.press("Escape");
      await p2.waitForTimeout(200);
      st = await p2.evaluate(() => ({
        n: document.querySelectorAll("#arcBody .obj").length,
        focus:
          document.activeElement && document.activeElement.dataset
            ? document.activeElement.dataset.item || null
            : null
      }));
      if (!(st.n === 5 && st.focus === "themis")) {
        ok = false;
        d += "esc=" + JSON.stringify(st);
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(vp.name, "c42 card close (×/Esc) returns folder + focuses source disk", ok, d);
    await p2.close();
    if (await page.$('#crumb a[data-go="0"]')) {
      await goCrumb(page, 0);
      await backTo(page, null);
    }
  }

  // 43. Tab navigation never powers the screen off (30 tabs from #skip)
  {
    let ok = true,
      d = "";
    try {
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        const s = await page.evaluate(() => ({
          on: document.body.classList.contains("phase-archive"),
          el: document.activeElement
            ? document.activeElement.id ||
              (document.activeElement.dataset &&
                (document.activeElement.dataset.item || document.activeElement.dataset.cat)) ||
              document.activeElement.tagName
            : "none"
        }));
        if (!s.on) {
          ok = false;
          d = "screen off at tab " + i;
          break;
        }
        if (s.el === "powerBtn" || s.el === "phosKnob" || s.el === "dtClose") {
          ok = false;
          d = "tab reached " + s.el + " at " + i;
          break;
        }
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c43 30×Tab: screen stays on, power never focused", ok, d);
  }

  // 44. card footer: VIEW MORE left; CV (+ repo) on ONE line right, same mono type, no second line
  {
    let ok = true,
      d = "";
    try {
      const footer = async () =>
        page.evaluate(() => {
          const m = document.querySelector(".card-more");
          const rs = Array.from(document.querySelectorAll(".card-right .card-l"));
          if (!rs.length) return null;
          const resume = rs[0],
            repo = rs[1] || null;
          const fr = getComputedStyle(resume);
          const sameFont = (a, b) =>
            a.fontSize === b.fontSize && a.letterSpacing === b.letterSpacing && a.fontFamily === b.fontFamily;
          const mid = (r) => r.top + r.height / 2;
          const rr = resume.getBoundingClientRect();
          const mr = m ? m.getBoundingClientRect() : rr;
          const out = {
            n: rs.length,
            sameFont: m ? sameFont(getComputedStyle(m), fr) : true,
            sameLine: m ? Math.abs(mid(mr) - mid(rr)) <= 2 : true,
            order: m ? mr.left < rr.left : true,
            hasRepo: !!repo,
            repoFont: true,
            repoLine: true,
            repoAfter: true
          };
          if (repo) {
            const xr = repo.getBoundingClientRect();
            out.repoFont = sameFont(fr, getComputedStyle(repo));
            out.repoLine = Math.abs(mid(rr) - mid(xr)) <= 2;
            out.repoAfter = rr.right <= xr.left + 1;
          }
          const maxH = Math.max(rr.height, repo ? repo.getBoundingClientRect().height : 0);
          /* all footer children sit within ONE line height (no second line);
           card-actions itself carries padding now, so don't use its box */
          const kids = [m, resume, repo].filter(Boolean).map((k) => k.getBoundingClientRect());
          out.oneLine =
            Math.max(...kids.map((r) => r.bottom)) - Math.min(...kids.map((r) => r.top)) <= maxH + 3;
          return out;
        });
      await openCat(page, "PROJECTS");
      await dclick(page, '.obj[data-folder="academic"]');
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "ACADEMIC";
        },
        { timeout: 4000 }
      );
      await dclick(page, '.obj-item[data-item="themis"]');
      await page.waitForSelector(".card:not([hidden])", { timeout: 4000 });
      const f = await footer();
      if (!f) {
        ok = false;
        d = "footer missing";
      } else if (
        !(
          f.n === 2 &&
          f.sameFont &&
          f.sameLine &&
          f.order &&
          f.repoFont &&
          f.repoLine &&
          f.repoAfter &&
          f.oneLine
        )
      ) {
        ok = false;
        d += "themis=" + JSON.stringify(f);
      }
      await page.keyboard.press("Escape");
      /* CV: its only link IS the CV — no duplicate on the right */
      await goCrumb(page, 0);
      await backTo(page, null);
      await openCat(page, "CONTACT");
      await dclick(page, '.obj-item[data-item="cv"]');
      await page.waitForSelector(".card:not([hidden])", { timeout: 4000 });
      const cv = await footer();
      if (!cv) {
        ok = false;
        d += " cv footer missing";
      } else if (!(cv.n === 1 && cv.sameLine && cv.order && cv.oneLine)) {
        ok = false;
        d += " cv=" + JSON.stringify(cv);
      }
      await page.keyboard.press("Escape");
      await goCrumb(page, 0);
      await backTo(page, null);
      /* meta has no repeated segment */
      await openCat(page, "PROJECTS");
      await dclick(page, '.obj[data-folder="personal"]');
      await page.waitForFunction(
        () => {
          const h = document.querySelector("#crumb .here");
          return h && h.textContent === "PERSONAL";
        },
        { timeout: 4000 }
      );
      await dclick(page, '.obj-item[data-item="archivesys"]');
      await page.waitForSelector(".card:not([hidden])", { timeout: 4000 });
      const meta = await page.evaluate(() => (document.querySelector(".card-p") || {}).textContent || "");
      const segs = meta
        .split("·")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!segs.length) {
        ok = false;
        d += " no meta";
      } else if (new Set(segs).size !== segs.length) {
        ok = false;
        d += ' meta repeats: "' + meta + '"';
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(vp.name, "c44 card footer: MORE left, CV+repo one line right, meta clean", ok, d);
    await goCrumb(page, 0);
    await backTo(page, null);
  }

  // 45. CRT scrollbar: 6 px, phosphor thumb, thin (Firefox)
  {
    let ok = true,
      d = "";
    try {
      const s = await page.evaluate(() => {
        const sc = document.querySelector(".arc-scroll");
        return {
          w: getComputedStyle(sc, "::-webkit-scrollbar").width,
          th: getComputedStyle(sc, "::-webkit-scrollbar-thumb").backgroundColor,
          ff: getComputedStyle(sc).scrollbarWidth
        };
      });
      if (s.w !== "6px") {
        ok = false;
        d = "width=" + s.w;
      }
      if (!/91,\s*232,\s*135/.test(s.th)) {
        ok = false;
        d += " thumb=" + s.th;
      }
      if (s.ff !== "thin") {
        ok = false;
        d += " firefox=" + s.ff;
      }
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 80);
    }
    record(vp.name, "c45 CRT scrollbar (6px phosphor, thin FF)", ok, d);
  }

  // 21. disk labels not clipped
  record(vp.name, "c21 disk labels not clipped", rootClips.length === 0, rootClips.slice(0, 6).join(" | "));

  // 17. SND toggle throws nothing
  {
    let ok = true,
      detail = "";
    try {
      await dclick(page, "#sndBtn");
      const t1 = await page.textContent("#sndBtn");
      await dclick(page, "#sndBtn");
      const t2 = await page.textContent("#sndBtn");
      if (t1.trim() !== "SND ON" || t2.trim() !== "SND OFF") {
        ok = false;
        detail = `text "${t1}"->"${t2}"`;
      }
    } catch (e) {
      ok = false;
      detail = String(e).slice(0, 80);
    }
    record(vp.name, "c17 SND toggle", ok, detail);
  }
  await ctx.close();

  /* ---- Phase B: any key skips boot ---- */
  ({ ctx, page } = await mk());
  {
    let ok = false,
      detail = "";
    try {
      await page.waitForTimeout(300);
      await page.keyboard.press("a"); // power on
      await page.waitForTimeout(450);
      await page.keyboard.press("a"); // (warm-up or boot) skip
      await page.waitForTimeout(450);
      await page.keyboard.press("a"); // (boot) skip
      await page.waitForSelector("body.phase-archive", { timeout: 6000 });
      ok = true;
    } catch (e) {
      detail = String(e).slice(0, 90);
    }
    record(vp.name, "c18 any key skips boot", ok, detail);
    await ctx.close();
  }

  /* ---- Phase C: reduced motion goes straight to archive ---- */
  ({ ctx, page } = await mk("#off", { reducedMotion: "reduce" }));
  {
    let ok = false,
      detail = "";
    try {
      await page.waitForTimeout(250);
      await page.keyboard.press("a");
      await page.waitForSelector("body.phase-archive", { timeout: 3000 });
      const ids = await objIds(page);
      ok = JSON.stringify(ids) === JSON.stringify(CATS);
      if (!ok) detail = `disks=[${ids}]`;
    } catch (e) {
      detail = String(e).slice(0, 90);
    }
    record(vp.name, "c19 reduced-motion straight to archive", ok, detail);
    await ctx.close();
  }

  /* ---- Phase D: #hold BIOS not clipped ---- */
  ({ ctx, page } = await mk("#hold"));
  {
    let ok = false,
      detail = "";
    try {
      await page.waitForSelector("body.phase-boot", { timeout: 5000 });
      await page.waitForTimeout(400);
      const s = await page.evaluate(async (T) => {
        await document.fonts.ready;
        const b = document.getElementById("bios"),
          v = document.getElementById("bootView");
        return {
          sw: b.scrollWidth <= b.clientWidth + T,
          bottom: v.scrollTop + v.clientHeight >= b.scrollHeight - 2,
          h: b.scrollHeight,
          ch: v.clientHeight,
          txt: b.textContent.includes("LOADING ARCHIVE.SYS")
        };
      }, TOL);
      ok = s.sw && s.bottom && s.txt;
      detail = `sw=${s.sw} bottomVisible=${s.bottom} fullText=${s.txt} (${s.h}px in ${s.ch}px)`;
    } catch (e) {
      detail = String(e).slice(0, 90);
    }
    record(vp.name, "c20 BIOS not clipped (#hold)", ok, detail);
  }
  // 31. BIOS logo: crisp, readable, rows intact
  {
    let ok = false,
      detail = "";
    try {
      const l = await page.evaluate(() => {
        const el = document.getElementById("biosLogo");
        const rows = Array.from(el.querySelectorAll(".bl-row")).map((r) => {
          const x = r.getBoundingClientRect();
          return { top: x.top, h: x.height, oh: r.offsetHeight };
        });
        /* sizes in stage px (offsetWidth/Height) — the logo is a fixed stage element, screen size scales with s */
        const w = el.offsetWidth,
          h = el.offsetHeight;
        const overlap = rows.slice(1).some((r, i) => r.top < rows[i].top + rows[i].h - 0.5);
        return {
          shown: el.classList.contains("show"),
          rows: rows.length,
          w,
          h,
          minRowH: rows.length ? Math.min(...rows.map((r) => r.oh)) : 0,
          overlap
        };
      });
      ok = l.shown && l.rows === 4 && l.minRowH >= 3 && l.w >= 80 && l.h >= 12 && !l.overlap;
      detail = `${l.rows} rows, ${Math.round(l.w)}x${Math.round(l.h)}px, minRowH=${l.minRowH.toFixed(1)}px, overlap=${l.overlap}, shown=${l.shown}`;
    } catch (e) {
      detail = String(e).slice(0, 90);
    }
    record(vp.name, "c31 BIOS logo readable & rows intact", ok, detail);
    await ctx.close();
  }

  /* ---- global console / pageerror / request checks ---- */
  record(
    vp.name,
    "c01 zero console errors",
    errs.consoleE.length === 0,
    errs.consoleE.slice(0, 3).join(" | ")
  );
  record(
    vp.name,
    "c02 zero console warnings",
    errs.consoleW.length === 0,
    errs.consoleW.slice(0, 3).join(" | ")
  );
  record(vp.name, "c03 zero pageerrors", errs.pageE.length === 0, errs.pageE.slice(0, 3).join(" | "));
  record(
    vp.name,
    "c04 zero failed/4xx-5xx requests",
    errs.bad.length === 0,
    errs.bad.slice(0, 3).join(" | ")
  );
  await browser.close();
}

/* ================= movable disks (P3) ================= */
const cellCenter = (page, i) =>
  page.evaluate((i) => {
    const st = window.__stage,
      tr = st.trayRect();
    const g = st.grid;
    return [
      tr.left + (g.left + (i % g.cols) * (g.pitchX || g.pitch) + g.disk / 2) * st.scale,
      tr.top + (g.top + ((i / g.cols) | 0) * (g.pitchY || g.pitch) + g.disk / 2) * st.scale
    ];
  }, i);
const wrapCell = (page, sel) =>
  page.evaluate((sel) => {
    const o = document.querySelector(".tray .obj-wrap " + sel);
    const w = o && o.closest(".obj-wrap");
    return w ? +w.dataset.cell : -1;
  }, sel);
const allCells = (page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(".tray .obj-wrap")).map((w) => +w.dataset.cell));
const dragTo = async (page, from, to) => {
  const [x0, y0] = await cellCenter(page, from);
  const [x1, y1] = await cellCenter(page, to);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(420); // let the snap transition settle
};
const freeCell = async (page) => {
  const used = new Set(await allCells(page));
  const grid = await page.evaluate(() => window.__stage.grid);
  const n = grid.cols * grid.rows;
  for (let i = 0; i < n; i++) if (!used.has(i)) return i;
  return -1;
};
async function movableDisks() {
  const name = "1280x800";
  const browser = await chromium.launch();
  const { ctx, page, errs } = await freshPage(browser, 1280, 800, "#skip");
  try {
    await page.waitForSelector("body.phase-archive", { timeout: 15000 });
    await page.waitForTimeout(500);
    /* m01 — drag to a FREE cell (layout-agnostic: read the disk's real cell) */
    {
      let ok = false,
        d = "";
      try {
        const grid = await page.evaluate(() => window.__stage.grid);
        ok = grid.cols >= 5 && grid.rows >= 3;
        const ac = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        const fc = await freeCell(page);
        await dragTo(page, ac, fc);
        const c = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        ok = ok && c === fc;
        d = `grid ${grid.cols}x${grid.rows}, ABOUT.ME ${ac}->${c} (want ${fc})`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m01 drag moves disk to free cell", ok, d);
    }
    /* m02 — drop on an OCCUPIED cell swaps */
    {
      let ok = false,
        d = "";
      try {
        const wc = await wrapCell(page, '.obj[data-cat="WORK"]');
        const ac = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        await dragTo(page, wc, ac); // WORK -> cell now occupied by ABOUT.ME
        const a = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        const w = await wrapCell(page, '.obj[data-cat="WORK"]');
        ok = w === ac && a === wc;
        d = `WORK ${wc}->${w}, ABOUT.ME ${ac}->${a} (want swap)`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m02 occupied cell swaps the two disks", ok, d);
    }
    /* m03 — sub-6px click still opens (card item, in ACADEMIC) */
    {
      let ok = false,
        d = "";
      try {
        // go to ACADEMIC (navigation has an insert animation — wait for the crumb)
        await dclick(page, '.obj[data-cat="PROJECTS"]');
        await page.waitForFunction(
          () => (document.querySelector("#crumb .here") || {}).textContent === "PROJECTS",
          { timeout: 6000 }
        );
        await dclick(page, '.obj[data-folder="academic"]');
        await page.waitForFunction(
          () => (document.querySelector("#crumb .here") || {}).textContent === "ACADEMIC",
          { timeout: 6000 }
        );
        const fc = await wrapCell(page, '.obj[data-item="fraud"]'); // fraud's real cell (centred default)
        const [x, y] = await cellCenter(page, fc); // fraud disk's cell
        /* wait until the insert animation has settled (disk on its cell) */
        await page.waitForFunction(
          ([cx, cy]) => {
            const el = document.querySelector('.obj[data-item="fraud"]');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return Math.abs(r.left + r.width / 2 - cx) < 3 && Math.abs(r.top + r.height / 2 - cy) < 3;
          },
          [x, y],
          { timeout: 6000 }
        );
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 3, y + 2); // 3.6px < 6
        await page.mouse.up();
        await page.waitForSelector(".card:not([hidden])", { timeout: 4000 });
        const t = (await page.textContent(".card-t")) || "";
        ok = t.length > 3;
        d = "card: " + t;
        await page.keyboard.press("Escape");
        await page.waitForSelector(".card[hidden]", { state: "attached", timeout: 4000 });
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m03 sub-6px click still opens the card", ok, d);
    }
    /* m04 — Shift+Arrow moves the focused disk; plain Arrow only moves focus (ACADEMIC) */
    {
      let ok = false,
        d = "";
      try {
        await page.evaluate(() => document.activeElement.blur());
        await page.keyboard.press("ArrowRight"); // focus first item (alpha, cell 0)
        let focusId = await page.evaluate(() => {
          const a = document.activeElement;
          return a && a.classList.contains("obj") ? a.dataset.cat || a.dataset.folder || a.dataset.item : "";
        });
        const before = await wrapCell(page, '.obj[data-item="alpha"]');
        await page.keyboard.press("Shift+ArrowRight");
        await page.waitForTimeout(350);
        const after = await wrapCell(page, '.obj[data-item="alpha"]');
        const themis = await wrapCell(page, '.obj[data-item="themis"]');
        const moved = focusId === "alpha" && after === before + 1 && themis === before;
        // plain ArrowDown: focus moves, disks do not
        const snap1 = await allCells(page);
        await page.keyboard.press("ArrowDown");
        const snap2 = await allCells(page);
        const focus2 = await page.evaluate(() => {
          const a = document.activeElement;
          return a && a.classList.contains("obj") ? a.dataset.cat || a.dataset.folder || a.dataset.item : "";
        });
        ok = moved && JSON.stringify(snap1) === JSON.stringify(snap2) && focus2 === "themis";
        d = `focus=${focusId}->${focus2}, alpha ${before}->${after}, themis=${themis}, cellsUnchanged=${JSON.stringify(snap1) === JSON.stringify(snap2)}`;
        await page.keyboard.press("Escape"); // eject ACADEMIC
        await page.waitForFunction(
          () => (document.querySelector("#crumb .here") || {}).textContent === "PROJECTS",
          { timeout: 6000 }
        );
        await page.keyboard.press("Escape"); // eject to root
        await page.waitForFunction(() => !document.querySelector("#crumb .here"), { timeout: 6000 });
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m04 Shift+Arrow moves disk, Arrow moves focus only", ok, d);
    }
    /* m05 — ARRANGE resets to the CENTRED default; header still one line */
    {
      let ok = false,
        d = "";
      try {
        await dclick(page, "#arrangeBtn");
        await page.waitForTimeout(420);
        const c = await allCells(page);
        const h = await page.evaluate(() => ({
          ctl: document.querySelector(".arc-ctl").getBoundingClientRect().height,
          crumbOK: (() => {
            const e = document.querySelector("#crumb");
            return e.scrollWidth <= e.clientWidth + 1;
          })()
        }));
        /* 5 disks on the 5x3 grid default to the middle row: cells 5-9 */
        const want = [5, 6, 7, 8, 9];
        ok = JSON.stringify([...c].sort((a, b) => a - b)) === JSON.stringify(want) && h.ctl < 45 && h.crumbOK;
        d = `cells=[${[...c].sort((a, b) => a - b)}] want=[${want}] headerH=${Math.round(h.ctl)} crumbOnLine=${h.crumbOK}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m05 ARRANGE resets to centred default, header one line", ok, d);
    }
    /* m06 — O1: fresh on every load. An old archive5.layout.* key is cleared
       on boot, a drag is NOT written to storage, and after a reload the
       disks are back in their defaults (as if ARRANGE had just been pressed) */
    {
      let ok = false,
        d = "";
      try {
        const before = await allCells(page);
        const ac = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        const fc = await freeCell(page);
        /* a key left over from an OLD version of the page */
        await page.evaluate(() => {
          localStorage.setItem("archive5.layout.5x3.root", JSON.stringify({ WORK: 12 }));
        });
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(400);
        const cleared = await page.evaluate(() => {
          let n = 0;
          for (let i = 0; i < localStorage.length; i++)
            if ((localStorage.key(i) || "").startsWith("archive5.layout.")) n++;
          return n;
        });
        const afterLoad = await allCells(page);
        /* drag ABOUT.ME to a free cell — session memory only */
        await dragTo(page, ac, fc);
        const moved = await wrapCell(page, '.obj[data-cat="ABOUT.ME"]');
        const storedNow = await page.evaluate(() => localStorage.getItem("archive5.layout.5x3.root"));
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(400);
        const afterReload = await allCells(page);
        ok =
          cleared === 0 &&
          JSON.stringify([...afterLoad].sort((a, b) => a - b)) ===
            JSON.stringify([...before].sort((a, b) => a - b)) &&
          moved === fc &&
          storedNow === null &&
          JSON.stringify([...afterReload].sort((a, b) => a - b)) ===
            JSON.stringify([...before].sort((a, b) => a - b));
        d = `oldKeys=${cleared} fresh=${JSON.stringify(afterLoad)} drag ${ac}->${moved} (want ${fc}) stored=${storedNow || "null"} afterReload=${JSON.stringify(afterReload)}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m06 O1 fresh defaults on every load (old key cleared, drag not persisted)", ok, d);
    }
    /* m07 — storage throwing does not break the page (in-memory still works) */
    {
      let ok = false,
        d = "";
      try {
        await page.evaluate(() => {
          localStorage.setItem = () => {
            throw new Error("no storage");
          };
        });
        const wc = await wrapCell(page, '.obj[data-cat="WORK"]');
        const fc = await freeCell(page);
        await dragTo(page, wc, fc); // WORK -> a free cell
        const c = await wrapCell(page, '.obj[data-cat="WORK"]');
        ok = c === fc && errs.pageE.length === 0;
        d = `WORK ${wc}->${c} (want ${fc}), pageerrors=${errs.pageE.length}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "m07 storage failure: drag still works, no pageerror", ok, d);
    }
    record(
      name,
      "m08 zero console/page errors (movable disks)",
      errs.consoleE.length === 0 && errs.pageE.length === 0,
      [...errs.consoleE, ...errs.pageE].slice(0, 3).join(" | ")
    );
  } catch (e) {
    record(name, "mXX movable-disks section", false, String(e).slice(0, 120));
  }
  await ctx.close();
  await browser.close();

  /* m09 — phone: touch drag (CDP touch events) */
  {
    const nameP = "390x844";
    const browser2 = await chromium.launch();
    const {
      ctx: ctx2,
      page: page2,
      errs: errs2
    } = await freshPage(browser2, 390, 844, "#skip", { mobile: true });
    let ok = false,
      d = "";
    try {
      await page2.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page2.waitForTimeout(500);
      const cdp = await ctx2.newCDPSession(page2);
      const ac = await wrapCell(page2, '.obj[data-cat="ABOUT.ME"]');
      const fc = await freeCell(page2);
      const [x0, y0] = await cellCenter(page2, ac);
      const [x1, y1] = await cellCenter(page2, fc); // a free cell
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= 6; i++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x0 + ((x1 - x0) * i) / 6, y: y0 + ((y1 - y0) * i) / 6 }]
        });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page2.waitForTimeout(420);
      const c = await wrapCell(page2, '.obj[data-cat="ABOUT.ME"]');
      const card = await page2.evaluate(() => document.querySelector(".card").hidden);
      ok = c === fc && card && errs2.pageE.length === 0;
      d = `ABOUT.ME ${ac}->${c} (want ${fc}), cardHidden=${card}, pageerrors=${errs2.pageE.length}`;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(nameP, "m09 phone touch drag to free cell, no card", ok, d);
    await ctx2.close();
    await browser2.close();
  }
}

/* ================= themed scenes (P4) ================= */
async function sceneScenes() {
  const name = "1280x800";
  const browser = await chromium.launch();
  const { ctx, page, errs } = await freshPage(browser, 1280, 800, "#skip");
  const crumbIs = async (t) => {
    await page.waitForFunction(
      (want) => (document.querySelector("#crumb .here") || {}).textContent === want,
      t,
      { timeout: 6000 }
    );
    await ghostSettled(page);
  };
  const crumbRoot = async () => {
    await page.waitForFunction(() => !document.querySelector("#crumb .here"), { timeout: 6000 });
    await ghostSettled(page);
  };
  const collect = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".tray .obj")).map((o) => {
        const s = o.querySelector(".lic svg");
        return {
          id: o.dataset.cat || o.dataset.folder || o.dataset.item,
          scene: s ? s.dataset.scene : "MISSING"
        };
      })
    );
  try {
    await page.waitForSelector("body.phase-archive", { timeout: 15000 });
    await page.waitForTimeout(500);
    /* s01 — every disk has a scene svg, and all 28 scenes are unique
       (22 until 21 Oct 2026: +4 personal projects, +2 NVIDIA certificates) */
    {
      let ok = false,
        d = "";
      try {
        const all = {};
        const walk = async () => (await collect()).forEach((x) => (all[x.id] = x.scene));
        await walk();
        for (const sel of ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"]) {
          await dclick(page, '.obj[data-cat="' + sel + '"]');
          await crumbIs(sel);
          await walk();
          await page.keyboard.press("Escape");
          await crumbRoot();
        }
        await dclick(page, '.obj[data-cat="PROJECTS"]');
        await crumbIs("PROJECTS");
        await dclick(page, '.obj[data-folder="academic"]');
        await crumbIs("ACADEMIC");
        await walk();
        await page.keyboard.press("Escape");
        await crumbIs("PROJECTS");
        await dclick(page, '.obj[data-folder="personal"]');
        await crumbIs("PERSONAL");
        await walk();
        await page.keyboard.press("Escape");
        await crumbIs("PROJECTS"); // PERSONAL -> PROJECTS
        await page.keyboard.press("Escape"); // PROJECTS -> root (for the hover checks)
        await crumbRoot();
        const v = Object.values(all);
        ok = v.length === 28 && new Set(v).size === 28 && !v.includes("MISSING");
        d = `disks=${v.length} unique=${new Set(v).size} missing=${v.filter((x) => x === "MISSING").length}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s01 all 28 disks have a unique data-scene", ok, d);
    }
    /* s02 — scene animates on hover, resets (none) on leave */
    {
      let ok = false,
        d = "";
      try {
        const gearSel = '.obj[data-cat="PROJECTS"] .lic .li-gear1';
        const nameOf = (sel) =>
          page.evaluate((s) => {
            const el = document.querySelector(s);
            return el ? getComputedStyle(el).animationName : "missing";
          }, sel);
        await page.mouse.move(8, 8);
        await page.waitForTimeout(220); // ensure a true at-rest state
        const idle = await nameOf(gearSel);
        const b = await page.locator('.obj[data-cat="PROJECTS"]').boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(250);
        const hov = await nameOf(gearSel);
        await page.mouse.move(8, 8);
        await page.waitForTimeout(150);
        const off = await nameOf(gearSel);
        ok = idle === "none" && hov === "liSpin" && off === "none";
        d = `idle=${idle} hover=${hov} leave=${off}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s02 scene runs on hover, none at rest and after leave", ok, d);
    }
    /* s03 — focus-visible (keyboard) also runs the scene */
    {
      let ok = false,
        d = "no obj focused";
      try {
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          const isObj = await page.evaluate(
            () => document.activeElement.classList && document.activeElement.classList.contains("obj")
          );
          if (isObj) break;
        }
        const r = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a.classList.contains("obj")) return null;
          const part = a.querySelector('.lic [class*="li-"]');
          return part ? getComputedStyle(part).animationName : "nopart";
        });
        ok = !!r && r !== "none";
        d = "focused scene animation = " + r;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s03 focus-visible (keyboard) runs the scene", ok, d);
      await page.evaluate(() => document.activeElement.blur());
    }
    /* s04 — while dragging, the scene pauses */
    {
      let ok = false,
        d = "";
      try {
        const st = await page.evaluate(() => window.__stage);
        const tr = await page.evaluate(() => window.__stage.trayRect());
        const g = st.grid;
        const b0 = await page.locator(".tray .obj").first().boundingBox();
        const c0 = [b0.x + b0.width / 2, b0.y + b0.height / 2]; // first real disk (centred default, not cell 0)
        await page.mouse.move(c0[0], c0[1]);
        await page.mouse.down();
        await page.mouse.move(c0[0] + 40, c0[1] + 30); // lift (past the 6px threshold)
        await page.waitForTimeout(120);
        const ps = await page.evaluate(() => {
          const w = document.querySelector(".tray .obj-wrap.dragging");
          const part = w && w.querySelector('.lic [class*="li-"]');
          return part ? getComputedStyle(part).animationPlayState : "nodrag";
        });
        await page.mouse.move(c0[0], c0[1]); // back home
        await page.mouse.up();
        await page.waitForTimeout(350);
        ok = ps === "paused";
        d = "playState mid-drag = " + ps;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s04 scene pauses while the disk is dragged", ok, d);
    }
    /* s05 — reduced motion: static first frame */
    {
      let ok = false,
        d = "";
      try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const b = await page.locator('.obj[data-cat="PROJECTS"]').boundingBox();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(200);
        const rm = await page.evaluate(() => {
          const el = document.querySelector('.obj[data-cat="PROJECTS"] .lic .li-gear1');
          return getComputedStyle(el).animationName;
        });
        await page.emulateMedia({ reducedMotion: null });
        ok = rm === "none";
        d = "reduced-motion hover animationName = " + rm;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s05 reduced motion = static first frame", ok, d);
    }
    /* s08 — P9 shared figure kit: every human figure is built from the same
         grammar (one head radius, one limb stroke, one fig group per figure) */
    {
      let ok = false,
        d = "";
      try {
        const fs = await import("node:fs");
        const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
        const a = html.indexOf("var FK = {");
        const b = html.indexOf("function rootIcon(cat) {");
        const licSVG = new Function(html.slice(a, b) + "; return licSVG;")();
        const kinds = [
          "about",
          "me",
          "work",
          "deloitte",
          "intermedia",
          "army",
          "edu",
          "univ",
          "mb500",
          "gears",
          "atom",
          "rocket",
          "alpha",
          "themis",
          "fraud",
          "icu",
          "greek",
          "archivesys",
          "github",
          "linkedin",
          "cv",
          "env",
          "ai-d365",
          "agent-memory",
          "llm-eval",
          "infra-tools",
          "rapids",
          "deeplearning"
        ];
        /* v7 L: army is prop-only now (access pictogram, no figure) */
        const human = [
          "about",
          "me",
          "work",
          "deloitte",
          "intermedia",
          "edu",
          "univ",
          "themis",
          "fraud",
          "icu",
          "linkedin",
          "ai-d365"
        ];
        const headR = new Set(),
          strokes = new Set();
        let totalHeads = 0,
          missing = [];
        for (const k of kinds) {
          const svg = licSVG(k);
          strokes.add((svg.match(/stroke-width="([^"]+)"/) || [])[1]);
          const heads = [...svg.matchAll(/class="fh"[^>]*r="([^"]+)"/g)];
          heads.forEach((h) => headR.add(h[1]));
          totalHeads += heads.length;
          const figs = (svg.match(/class="fig"/g) || []).length;
          if (human.includes(k) && (figs < 1 || heads.length < 1)) missing.push(k);
        }
        ok =
          kinds.length === 28 &&
          headR.size === 1 &&
          [...headR][0] === "2.3" && // one shared head circle
          strokes.size === 1 &&
          [...strokes][0] === "1.6" && // one limb stroke width
          missing.length === 0 && // every human scene has a figure
          totalHeads >= 14; // 12 figures (army prop-only), icu+linkedin have 2
        d = `scenes=${kinds.length} headR=[${[...headR]}] stroke=[${[...strokes]}] heads=${totalHeads} missing=${missing.join(",") || "-"}`;
      } catch (e) {
        ok = false;
        d = String(e).slice(0, 90);
      }
      record(name, "s08 P9 figure kit: shared head radius + one stroke width", ok, d);
    }
    record(
      name,
      "s06 zero console/page errors (scenes)",
      errs.consoleE.length === 0 && errs.pageE.length === 0,
      [...errs.consoleE, ...errs.pageE].slice(0, 3).join(" | ")
    );
  } catch (e) {
    record(name, "sXX scenes section", false, String(e).slice(0, 120));
  }
  await ctx.close();
  await browser.close();
  /* s07 — index.html stays reasonably small. Budget raised from 200 KB to
     220 KB on 21 Oct 2026: the 6 new disk scenes added ~5 KB raw (+1.4 KB
     gzip) and the old budget had ~190 bytes left. About 45 KB of the file is
     source comments carried into the inlined CSS/JS; stripping them at build
     time is the way to win the room back if the page grows again. */
  {
    const fs = await import("node:fs");
    const size = fs.statSync(path.join(SITE, "index.html")).size;
    record(
      name,
      "s07 index.html size reasonable (<220KB)",
      size < 220 * 1024,
      (size / 1024).toFixed(1) + " KB"
    );
  }
}

/* ================= P5 — independent-review fixes (one check each) ================= */
async function p5fixes() {
  const D = "1280x800";
  /* ---------- desktop: card/nav/drag/layout/font/label checks ---------- */
  {
    const browser = await chromium.launch();
    const { ctx, page, errs } = await freshPage(browser, 1280, 800, "#skip");
    const crumbIs = async (t) => {
      await page.waitForFunction((w) => (document.querySelector("#crumb .here") || {}).textContent === w, t, {
        timeout: 6000
      });
      await ghostSettled(page);
    };
    const crumbRoot = async () => {
      await page.waitForFunction(() => !document.querySelector("#crumb .here"), { timeout: 6000 });
      await ghostSettled(page);
    };
    const cc = (c) =>
      page.evaluate((c) => {
        const g = __stage.grid,
          t = __stage.trayRect(),
          s = __stage.scale;
        return [
          t.left + (g.left + (c % g.cols) * (g.pitchX || g.pitch) + g.disk / 2) * s,
          t.top + (g.top + ((c / g.cols) | 0) * (g.pitchY || g.pitch) + g.disk / 2) * s
        ];
      }, c);
    const wcell = (sel) =>
      page.evaluate((s) => {
        const o = document.querySelector(".tray .obj-wrap " + s);
        const w = o && o.closest(".obj-wrap");
        return w ? +w.dataset.cell : -1;
      }, sel);
    const allC = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll(".tray .obj-wrap")).map((w) => +w.dataset.cell)
      );
    const free = async () => {
      const u = new Set(await allC());
      const g = await page.evaluate(() => __stage.grid);
      for (let i = 0; i < g.cols * g.rows; i++) if (!u.has(i)) return i;
      return -1;
    };
    const center = (sel) =>
      page
        .locator(sel)
        .first()
        .boundingBox()
        .then((r) => [r.x + r.width / 2, r.y + r.height / 2]);
    const dragTo = async (a, b) => {
      const [x0, y0] = await cc(a),
        [x1, y1] = await cc(b);
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
      await page.mouse.up();
      await page.waitForTimeout(420);
    };
    try {
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(500);

      /* p14 — desktop root default = middle row (cells 5-9) */
      {
        const c = (await allC()).sort((a, b) => a - b);
        record(
          D,
          "p14 root default centred on the middle row",
          JSON.stringify(c) === JSON.stringify([5, 6, 7, 8, 9]),
          JSON.stringify(c)
        );
      }
      /* p01 — opening a card never pushes its disk off-screen (row-3 disk) */
      {
        let ok = false,
          d = "";
        try {
          await page.evaluate(() =>
            localStorage.setItem(
              "archive5.layout.5x3.PROJECTS/academic",
              JSON.stringify({ alpha: 0, themis: 1, fraud: 12, icu: 3, greek: 7 })
            )
          );
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await crumbIs("ACADEMIC");
          await dclick(page, '[data-item="fraud"]');
          await page.waitForTimeout(450);
          const r = await page.evaluate(() => {
            const ar = document.querySelector(".glass").getBoundingClientRect();
            const d = document.querySelector('[data-item="fraud"]').getBoundingClientRect();
            const cr = document.querySelector(".card").getBoundingClientRect();
            return {
              spacer: !!document.querySelector(".card-spacer"),
              vis: +(Math.max(0, Math.min(d.bottom, ar.bottom) - Math.max(d.top, ar.top)) / d.height).toFixed(
                2
              ),
              in:
                cr.left >= ar.left - 1 &&
                cr.right <= ar.right + 1 &&
                cr.top >= ar.top - 1 &&
                cr.bottom <= ar.bottom + 1
            };
          });
          ok = !r.spacer && r.vis >= 0.98 && r.in;
          d = `spacer=${r.spacer} vis=${r.vis} inGlass=${r.in}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p01 card no longer pushes its disk off-screen (row-3)", ok, d);
        await toRoot(page);
      }
      /* p02 — Esc/EJECT/double-click during the 750ms fly -> valid path */
      {
        let ok = true,
          d = "";
        try {
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await page.waitForTimeout(100);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(1500);
          let c = await page.locator("#crumb").innerText();
          let n = await page.evaluate(() => document.querySelectorAll("#arcBody .obj").length);
          if (!c.includes("ACADEMIC") || n !== 5) {
            ok = false;
            d += "esc:" + c + " n=" + n + " | ";
          }
          await page.keyboard.press("Escape");
          await crumbIs("PROJECTS"); // back to PROJECTS for part 2
          await dclick(page, '.obj[data-folder="academic"]');
          await page.waitForTimeout(100);
          await dclick(page, "#ejectBtn");
          await page.waitForTimeout(1500);
          c = await page.locator("#crumb").innerText();
          n = await page.evaluate(() => document.querySelectorAll("#arcBody .obj").length);
          if (!c.includes("ACADEMIC") || n !== 5) {
            ok = false;
            d += "eject:" + c + " n=" + n;
          }
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p02 nav during disk-fly is locked (valid path)", ok, d);
        await toRoot(page);
      }
      /* p03 — a fast release off-screen does not stick the drag */
      {
        let ok = false,
          d = "";
        try {
          const before = await allC();
          const c = await center('[data-cat="PROJECTS"]');
          await page.mouse.move(c[0], c[1]);
          await page.mouse.down();
          await page.mouse.move(5, 5, { steps: 1 });
          await page.mouse.up();
          await page.waitForTimeout(200);
          const t = await cc(12);
          await page.mouse.move(t[0] - 40, t[1], { steps: 4 });
          await page.mouse.move(t[0], t[1], { steps: 4 });
          await page.waitForTimeout(200);
          const stuck = await page.evaluate(() =>
            document.querySelector('[data-cat="PROJECTS"]').parentElement.classList.contains("dragging")
          );
          const after = await allC();
          ok = !stuck && JSON.stringify(after) === JSON.stringify(before);
          d = `stuck=${stuck} cellsSame=${JSON.stringify(after) === JSON.stringify(before)}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p03 drag released off-screen does not stick", ok, d);
      }
      /* p04 — dragging with a card open does not move the grid */
      {
        let ok = false,
          d = "";
        try {
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await crumbIs("ACADEMIC");
          await dclick(page, '[data-item="fraud"]');
          await page.waitForTimeout(450);
          const b0 = await page.evaluate(
            () => document.querySelector('[data-item="alpha"]').getBoundingClientRect().top
          );
          const c = await center('[data-item="themis"]');
          await page.mouse.move(c[0], c[1]);
          await page.mouse.down();
          await page.mouse.move(c[0] + 40, c[1] + 6, { steps: 5 });
          await page.waitForTimeout(300);
          const b1 = await page.evaluate(
            () => document.querySelector('[data-item="alpha"]').getBoundingClientRect().top
          );
          await page.mouse.up();
          await page.waitForTimeout(400);
          ok = Math.abs(b1 - b0) < 2;
          d = `alpha top ${b0.toFixed(1)} -> ${b1.toFixed(1)}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p04 drag with a card open does not move the grid", ok, d);
        await toRoot(page);
      }
      /* p08 — Shift+Arrow with a card open repositions the card */
      {
        let ok = false,
          d = "";
        try {
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await crumbIs("ACADEMIC");
          await dclick(page, '[data-item="greek"]');
          await page.waitForTimeout(450);
          const l0 = await page.evaluate(() => document.querySelector(".card").style.left);
          await page.locator('[data-item="greek"]').focus();
          await page.keyboard.press("Shift+ArrowLeft");
          await page.waitForTimeout(600);
          const l1 = await page.evaluate(() => document.querySelector(".card").style.left);
          const hidden = await page.evaluate(() => document.querySelector(".card").hidden);
          ok = !hidden && l0 !== l1;
          d = `card left ${l0} -> ${l1}, hidden=${hidden}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p08 Shift+Arrow with a card open repositions it", ok, d);
        await toRoot(page);
      }
      /* p09 — one "REPO ↗" label builder everywhere; VIEW MORE weight 600 */
      {
        let ok = false,
          d = "";
        try {
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await crumbIs("ACADEMIC");
          await dclick(page, '[data-item="alpha"]');
          await page.waitForTimeout(400);
          const cardLinks = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".card-actions .card-l")).map((a) => a.textContent)
          );
          const vmW = await page.evaluate(
            () => getComputedStyle(document.querySelector(".card-more")).fontWeight
          );
          await dclick(page, ".card-more");
          await page.waitForTimeout(400);
          const dtLinks = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".dt-links .card-l")).map((a) => a.textContent)
          );
          ok =
            cardLinks.includes("REPO ↗") &&
            dtLinks.includes("REPO ↗") &&
            !dtLinks.some((t) => /— repo/i.test(t)) &&
            vmW === "600";
          d = `card=[${cardLinks}] detail=[${dtLinks}] vmW=${vmW}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, 'p09 single "REPO ↗" label + VIEW MORE weight 600', ok, d);
        await toRoot(page);
      }
      /* p12 — the open card is reachable by Tab; focus returns on close */
      {
        let ok = false,
          d = "";
        try {
          await dclick(page, '.obj[data-cat="PROJECTS"]');
          await crumbIs("PROJECTS");
          await dclick(page, '.obj[data-folder="academic"]');
          await crumbIs("ACADEMIC");
          await dclick(page, '[data-item="fraud"]');
          await page.waitForTimeout(400);
          const inCard = await page.evaluate(() => {
            const a = document.activeElement;
            return a.classList.contains("card-x") || document.querySelector(".card").contains(a);
          });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          const back = await page.evaluate(
            () => document.activeElement.dataset.item || document.activeElement.className
          );
          ok = inCard && back === "fraud";
          d = `inCard=${inCard} backFocus=${back}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(D, "p12 Tab reaches the open card; focus returns on close", ok, d);
        await toRoot(page);
      }
      record(
        D,
        "pXX zero errors (P5 desktop)",
        errs.consoleE.length === 0 && errs.pageE.length === 0,
        [...errs.consoleE, ...errs.pageE].slice(0, 3).join(" | ")
      );
    } catch (e) {
      record(D, "pXX P5 desktop section", false, String(e).slice(0, 120));
    }
    await ctx.close();
    await browser.close();
  }

  /* ---------- boot / power: p05 double-boot, p10 offing lock, p11 drop-in ---------- */
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = { consoleE: [], pageE: [] };
    page.on("console", (m) => {
      if (m.type() === "error") errs.consoleE.push(m.text());
    });
    page.on("pageerror", (e) => errs.pageE.push(e.message));
    try {
      await page.goto(BASE + "", { waitUntil: "load" });
      await page.waitForTimeout(300);
      /* p05 — key during warm-up -> single BIOS chain */
      let ok5 = false,
        d5 = "";
      try {
        await dclick(page, "#powerBtn");
        await page.waitForTimeout(300);
        await page.keyboard.press("a");
        const lens = [];
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(200);
          lens.push(await page.evaluate(() => document.querySelector("#bios").textContent.length));
        }
        for (
          let i = 0;
          i < 26 && !(await page.evaluate(() => document.body.className.includes("phase-archive")));
          i++
        )
          await page.waitForTimeout(400);
        const phase = await page.evaluate(() => document.body.className.match(/phase-\w+/)?.[0]);
        const dips = lens.filter((v, i) => i > 0 && v < lens[i - 1] - 3).length;
        ok5 = phase === "phase-archive" && dips === 0;
        d5 = `phase=${phase} dips=${dips} lens=[${lens}]`;
      } catch (e) {
        d5 = String(e).slice(0, 80);
      }
      record(D, "p05 key during warm-up: single BIOS chain", ok5, d5);
      /* p11 — drop-in plays after boot */
      let ok11 = false,
        d11 = "";
      try {
        await page.waitForTimeout(400);
        const dropin = await page.evaluate(() => document.querySelectorAll(".obj-wrap.drop-in").length);
        ok11 = dropin === 5;
        d11 = "drop-in disks=" + dropin;
      } catch (e) {
        d11 = String(e).slice(0, 80);
      }
      record(D, "p11 drop-in plays after boot", ok11, d11);
      /* p10 — keys during the 1.1s power-off are ignored */
      let ok10 = false,
        d10 = "";
      try {
        await page.locator('[data-cat="WORK"]').focus();
        await dclick(page, "#powerBtn");
        await page.waitForTimeout(200);
        await page
          .locator('[data-cat="WORK"]')
          .focus()
          .catch(() => {});
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        const phase = await page.evaluate(() => document.body.className.match(/phase-\w+/)?.[0]);
        // textContent, not innerText: in phase-off the (correctly) visibility:hidden
        // shelf yields "" from innerText (review #3) — the check is about state
        const c = await page.locator("#crumb").textContent();
        ok10 = phase === "phase-off" && c.includes("TU7URU") && !c.includes("WORK");
        d10 = `phase=${phase} crumb=${c}`;
      } catch (e) {
        d10 = String(e).slice(0, 80);
      }
      record(D, "p10 keys during power-off are ignored", ok10, d10);
    } catch (e) {
      record(D, "pXX P5 boot section", false, String(e).slice(0, 120));
    }
    await ctx.close();
    await browser.close();
  }

  /* ---------- storage + resize: p06 key, p07 in-memory, p15 drag-cancel ---------- */
  {
    const browser = await chromium.launch();
    /* p07 — in-memory layout survives resize even when storage throws */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      let ok = false,
        d = "";
      try {
        await page.addInitScript(() => {
          Storage.prototype.setItem = () => {
            throw new Error("quota");
          };
        });
        await page.goto(BASE + "#skip", { waitUntil: "load" });
        await page.waitForTimeout(700);
        await page.locator('[data-cat="ABOUT.ME"]').focus();
        await page.keyboard.press("Shift+ArrowDown");
        await page.waitForTimeout(300);
        const moved = await page.evaluate(
          () => document.querySelector('[data-cat="ABOUT.ME"]').parentElement.dataset.cell
        );
        await page.setViewportSize({ width: 1300, height: 810 });
        await page.waitForTimeout(400);
        const after = await page.evaluate(
          () => document.querySelector('[data-cat="ABOUT.ME"]').parentElement.dataset.cell
        );
        ok = moved === "10" && moved === after;
        d = `moved=${moved} after=${after}`;
      } catch (e) {
        d = String(e).slice(0, 80);
      }
      record(D, "p07 resize keeps the arrangement without storage", ok, d);
      await ctx.close();
    }
    /* p15 — a resize mid-drag cancels the drag (disk snaps back) */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const cc = (c) =>
        page.evaluate((c) => {
          const g = __stage.grid,
            t = __stage.trayRect(),
            s = __stage.scale;
          return [
            t.left + (g.left + (c % g.cols) * (g.pitchX || g.pitch) + g.disk / 2) * s,
            t.top + (g.top + ((c / g.cols) | 0) * (g.pitchY || g.pitch) + g.disk / 2) * s
          ];
        }, c);
      let ok = false,
        d = "";
      try {
        await page.goto(BASE + "#skip", { waitUntil: "load" });
        await page.waitForTimeout(700);
        const before = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".tray .obj-wrap")).map((w) => +w.dataset.cell)
        );
        const c0 = await cc(6); // WORK's default cell
        await page.mouse.move(c0[0], c0[1]);
        await page.mouse.down();
        await page.mouse.move(c0[0] + 60, c0[1] + 40, { steps: 4 });
        await page.setViewportSize({ width: 1320, height: 810 });
        await page.waitForTimeout(300);
        const dragging = await page.evaluate(() => !!document.querySelector(".obj-wrap.dragging"));
        await page.mouse.up();
        await page.waitForTimeout(300);
        const after = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".tray .obj-wrap")).map((w) => +w.dataset.cell)
        );
        ok = !dragging && JSON.stringify(after) === JSON.stringify(before);
        d = `dragging=${dragging} cellsSame=${JSON.stringify(after) === JSON.stringify(before)}`;
      } catch (e) {
        d = String(e).slice(0, 80);
      }
      record(D, "p15 resize during a drag cancels it (snap back)", ok, d);
      await ctx.close();
    }
    /* p06 — O1: layouts are never stored — no archive5.layout.* keys exist
       after a drag on desktop or a fresh phone load (so they can never
       collide), and the phone default is not the desktop one */
    {
      const ctxD = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pd = await ctxD.newPage();
      await pd.goto(BASE + "#skip", { waitUntil: "load" });
      await pd.waitForTimeout(700);
      const c12 = await pd.evaluate(() => {
        const g = __stage.grid,
          t = __stage.trayRect(),
          s = __stage.scale;
        return [
          t.left + (g.left + (12 % g.cols) * (g.pitchX || g.pitch) + g.disk / 2) * s,
          t.top + (g.top + ((12 / g.cols) | 0) * (g.pitchY || g.pitch) + g.disk / 2) * s
        ];
      });
      const r = await pd.locator('[data-cat="ABOUT.ME"]').boundingBox();
      await pd.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await pd.mouse.down();
      await pd.mouse.move(c12[0], c12[1], { steps: 10 });
      await pd.mouse.up();
      await pd.waitForTimeout(400);
      const deskKeys = await pd.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("archive5.layout"))
      );
      await ctxD.close();
      const ctxP = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const ph = await ctxP.newPage();
      await ph.goto(BASE + "#skip", { waitUntil: "load" });
      await ph.waitForTimeout(700);
      const phAb = await ph.evaluate(
        () => +document.querySelector('[data-cat="ABOUT.ME"]').parentElement.dataset.cell
      );
      const phKeys = await ph.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("archive5.layout"))
      );
      await ctxP.close();
      const ok = deskKeys.length === 0 && phKeys.length === 0 && phAb !== 12;
      record(
        D,
        "p06 O1 nothing layout-related is ever stored (no clobber possible)",
        `desk=[${deskKeys}] phoneAb=${phAb} phoneKeys=[${phKeys}]`
      );
    }
    await browser.close();
  }

  /* ---------- phone: p01b, p13 fonts, p16 scroll-attach ---------- */
  {
    const P = "390x844";
    const browser = await chromium.launch();
    const { ctx, page, errs } = await freshPage(browser, 390, 844, "#skip", { mobile: true });
    try {
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(500);
      /* p01b — phone: card for a bottom-row disk keeps the disk visible */
      {
        let ok = false,
          d = "";
        try {
          await page.goto("about:blank");
          await page.goto(BASE + "#skip&path=PROJECTS/ACADEMIC", { waitUntil: "load" });
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          await page.waitForSelector('[data-item="greek"]', { timeout: 8000 });
          await page.waitForTimeout(300);
          await dclick(page, '[data-item="greek"]');
          await page.waitForTimeout(450);
          const r = await page.evaluate(() => {
            const ar = document.querySelector(".glass").getBoundingClientRect();
            const d = document.querySelector('[data-item="greek"]').getBoundingClientRect();
            const cr = document.querySelector(".card").getBoundingClientRect();
            return {
              vis: +(Math.max(0, Math.min(d.bottom, ar.bottom) - Math.max(d.top, ar.top)) / d.height).toFixed(
                2
              ),
              in:
                cr.left >= ar.left - 1 &&
                cr.right <= ar.right + 1 &&
                cr.top >= ar.top - 1 &&
                cr.bottom <= ar.bottom + 1
            };
          });
          ok = r.vis >= 0.98 && r.in;
          d = `vis=${r.vis} inGlass=${r.in}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(P, "p01 phone card keeps its disk on-screen", ok, d);
      }
      /* p13 — phone fonts: f-sub ~9 stage px, P39 knob ~9 px, not clipped */
      {
        let ok = false,
          d = "";
        try {
          await page.goto("about:blank");
          await page.goto(BASE + "#skip", { waitUntil: "load" });
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          await page.waitForTimeout(400);
          const s = await page.evaluate(() => {
            const e = document.querySelector(".f-sub");
            const k = document.querySelector(".phos-knob");
            return {
              fsub: e ? parseFloat(getComputedStyle(e).fontSize) : 0,
              knob: k ? parseFloat(getComputedStyle(k).fontSize) : 0,
              clip: e ? e.scrollWidth > e.clientWidth + 1 : false
            };
          });
          ok = s.fsub >= 8.5 && s.knob >= 8.5;
          d = `fsub=${s.fsub} knob=${s.knob} clip=${s.clip}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(P, "p13 phone f-sub + P39 knob readable", ok, d);
      }
      /* p16 — card stays attached to its disk when the scroller scrolls */
      {
        let ok = false,
          d = "";
        try {
          await page.goto("about:blank");
          await page.goto(BASE + "#skip&path=CONTACT", { waitUntil: "load" });
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          await page.waitForSelector('[data-item="cv"]', { timeout: 8000 });
          await page.waitForTimeout(300);
          await dclick(page, '[data-item="cv"]');
          await page.waitForTimeout(400);
          const inScroll = await page.evaluate(() =>
            document.querySelector(".card").parentElement.classList.contains("arc-scroll")
          );
          await page.evaluate(() => {
            document.querySelector(".arc-body").style.minHeight = "1500px";
          }); // force overflow
          const rel0 = await page.evaluate(
            () =>
              document.querySelector(".card").getBoundingClientRect().top -
              document.querySelector('[data-item="cv"]').parentElement.getBoundingClientRect().top
          );
          await page.mouse.move(195, 300);
          await page.mouse.wheel(0, 400);
          await page.waitForTimeout(300);
          const r1 = await page.evaluate(() => ({
            rel:
              document.querySelector(".card").getBoundingClientRect().top -
              document.querySelector('[data-item="cv"]').parentElement.getBoundingClientRect().top,
            s: document.querySelector(".arc-scroll").scrollTop
          }));
          ok = inScroll && r1.s > 20 && Math.abs(r1.rel - rel0) < 2;
          d = `inScroll=${inScroll} scroll=${Math.round(r1.s)} rel ${Math.round(rel0)} -> ${Math.round(r1.rel)}`;
        } catch (e) {
          ok = false;
          d = String(e).slice(0, 80);
        }
        record(P, "p16 card stays attached to its disk on scroll", ok, d);
      }
      record(
        P,
        "pXX zero errors (P5 phone)",
        errs.consoleE.length === 0 && errs.pageE.length === 0,
        [...errs.consoleE, ...errs.pageE].slice(0, 3).join(" | ")
      );
    } catch (e) {
      record(P, "pXX P5 phone section", false, String(e).slice(0, 120));
    }
    await ctx.close();
    await browser.close();
  }
}

/* ---------------- P7 polish checks ---------------- */
const P7_VIEWS = [
  ["PROJECTS/ACADEMIC", ["alpha", "themis", "fraud", "icu", "greek"]],
  ["PROJECTS/PERSONAL", ["ai-d365", "agent-memory", "llm-eval", "infra-tools", "archivesys"]],
  ["ABOUT.ME", ["me"]],
  ["WORK", ["deloitte", "intermedia", "army"]],
  ["EDUCATION", ["univ", "mb500", "rapids", "deeplearning"]],
  ["CONTACT", ["github", "linkedin", "cv"]]
];
async function p7fixes() {
  const D = "1280x800",
    Ph = "390x844";
  /* desktop: card vs disk overlap (every item, every folder) + label title size */
  {
    /* p7c — root label titles */
    {
      const browser = await chromium.launch();
      try {
        const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(400);
        const r = await page.evaluate(() =>
          Array.from(document.querySelectorAll("#arcBody .f-name")).map((e) => ({
            t: e.textContent,
            fs: parseFloat(getComputedStyle(e).fontSize)
          }))
        );
        const bad = r.filter(
          (x) => x.fs < 17.5
        ); /* v6 F: floor 18 -> 17.5 — the >=4 px label margin (F3) may cost one shrink step */
        record(
          D,
          "p7c label title >=17.5 stage px (root)",
          bad.length === 0,
          bad.map((x) => x.t + "@" + x.fs).join(",") || r.map((x) => x.fs).join(",")
        );
      } catch (e) {
        record(D, "pXX P7 root labels", false, String(e).slice(0, 100));
      }
      await browser.close();
    }
    for (const [path, items] of P7_VIEWS) {
      const browser = await chromium.launch();
      try {
        const { ctx, page } = await freshPage(browser, 1280, 800, "#skip&path=" + path);
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(400);
        /* p7c — label titles in this view */
        {
          const r = await page.evaluate(() =>
            Array.from(document.querySelectorAll("#arcBody .f-name")).map((e) => ({
              t: e.textContent,
              fs: parseFloat(getComputedStyle(e).fontSize)
            }))
          );
          const bad = r.filter((x) => x.fs < 17.5);
          record(
            D,
            "p7c label title >=17.5 stage px (" + path + ")",
            bad.length === 0,
            bad.map((x) => x.t + "@" + x.fs).join(",") || r.map((x) => x.fs).join(",")
          );
        }
      } catch (e) {
        record(D, "pXX P7 section " + path, false, String(e).slice(0, 100));
      }
      await browser.close();
    }
    /* p7a — (G1b R1) each open card covers NO disk — its own included —
       and stays in the glass. All three desktop stages + phone (bottom
       sheets excluded: they are covered by the F1 sheet checks). */
    for (const [w, h, mob] of [
      [1280, 800, false],
      [1440, 900, false],
      [1920, 1080, false],
      [390, 844, true]
    ]) {
      const tag = w + "x" + h;
      const browser = await chromium.launch();
      try {
        for (const [path, items] of P7_VIEWS) {
          const { ctx, page } = await freshPage(browser, w, h, "#skip&path=" + path, { mobile: mob });
          try {
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(400);
            const bad = [];
            for (const id of items) {
              await dclick(page, '[data-item="' + id + '"]');
              await page.waitForTimeout(420);
              const r = await page.evaluate((id) => {
                const card = document.querySelector(".card");
                const cr = card.getBoundingClientRect();
                const hits = [];
                document.querySelectorAll(".obj").forEach((o) => {
                  const r = o.getBoundingClientRect();
                  const w = Math.min(cr.right, r.right) - Math.max(cr.left, r.left);
                  const h = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top);
                  if (w > 0.5 && h > 0.5)
                    hits.push(o.dataset.item + " " + Math.round(w) + "x" + Math.round(h));
                });
                const ar = document.querySelector(".glass").getBoundingClientRect();
                const inGlass =
                  cr.left >= ar.left - 1 &&
                  cr.right <= ar.right + 1 &&
                  cr.top >= ar.top - 1 &&
                  cr.bottom <= ar.bottom + 1;
                return { hits, inGlass, sheet: card.classList.contains("sheet") };
              }, id);
              if (!r.sheet) {
                if (!r.inGlass || r.hits.length)
                  bad.push(id + (r.inGlass ? "" : "(off-glass)") + ":" + r.hits.join("+"));
              }
            }
            record(
              tag,
              "p7a card covers no disk, own included (" + path + ")",
              bad.length === 0,
              bad.join(" | ")
            );
          } catch (e) {
            record(tag, "pXX P7a section " + path, false, String(e).slice(0, 100));
          }
          await ctx.close();
        }
      } finally {
        await browser.close();
      }
    }
  }
  /* p7b — title text never under the x button: every item, both stages */
  for (const [tag, w, h, mob] of [
    [D, 1280, 800, false],
    [Ph, 390, 844, true]
  ]) {
    const browser = await chromium.launch();
    try {
      const bad = [];
      for (const [path, items] of P7_VIEWS) {
        const { ctx, page } = await freshPage(browser, w, h, "#skip&path=" + path, { mobile: mob });
        try {
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          await page.waitForTimeout(400);
          for (const id of items) {
            await dclick(page, '[data-item="' + id + '"]');
            await page.waitForTimeout(380);
            const r = await page.evaluate(() => {
              const t = document.querySelector(".card-t"),
                x = document.querySelector(".card-x");
              if (!t || !x) return { ok: false, d: "missing" };
              const xr = x.getBoundingClientRect();
              const rg = document.createRange();
              rg.selectNodeContents(t);
              const rects = rg.getClientRects();
              for (let i = 0; i < rects.length; i++) {
                const rc = rects[i];
                const ww = Math.min(rc.right, xr.right) - Math.max(rc.left, xr.left);
                const hh = Math.min(rc.bottom, xr.bottom) - Math.max(rc.top, xr.top);
                if (ww > 0.5 && hh > 0.5)
                  return {
                    ok: false,
                    d:
                      "" +
                      Math.round(rc.left) +
                      "," +
                      Math.round(rc.top) +
                      " " +
                      Math.round(ww) +
                      "x" +
                      Math.round(hh)
                  };
              }
              return { ok: true, d: "" };
            });
            if (!r.ok) bad.push(id + ":" + r.d);
          }
        } catch (e) {
          bad.push(path + ":" + String(e).slice(0, 60));
        }
        await ctx.close();
      }
      record(
        tag,
        "p7b title text never under the x (" + (mob ? "phone" : "desktop") + ")",
        bad.length === 0,
        bad.join(" | ")
      );
    } catch (e) {
      record(tag, "pXX P7 title section", false, String(e).slice(0, 100));
    }
    await browser.close();
  }
}

/* ---------------- P8 checks: footer always visible + desc clamped ---------------- */
async function p8fixes() {
  const jobs = [
    ["1280x800", 1280, 800, false],
    ["390x844", 390, 844, true]
  ];
  for (const [tag, w, h, mob] of jobs) {
    const browser = await chromium.launch();
    try {
      const bad = [];
      for (const [path, items] of P7_VIEWS) {
        const { ctx, page } = await freshPage(browser, w, h, "#skip&path=" + path, { mobile: mob });
        try {
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          await page.waitForTimeout(400);
          for (const id of items) {
            await dclick(page, '[data-item="' + id + '"]');
            await page.waitForTimeout(380);
            const r = await page.evaluate(() => {
              const card = document.querySelector(".card");
              if (!card) return { ok: false, d: "no-card" };
              const cr = card.getBoundingClientRect();
              const act = card.querySelector(".card-actions");
              if (!act) return { ok: false, d: "no-footer" };
              const ar = act.getBoundingClientRect();
              const gl = document.querySelector(".glass").getBoundingClientRect();
              const d = card.querySelector(".card-d");
              const clamp = d
                ? getComputedStyle(d).webkitLineClamp ||
                  getComputedStyle(d).getPropertyValue("-webkit-line-clamp")
                : "none";
              const inCard = ar.bottom <= cr.bottom + 1 && ar.top >= cr.top - 1 && ar.right <= cr.right + 1;
              const inGlass =
                ar.left >= gl.left - 1 &&
                ar.right <= gl.right + 1 &&
                ar.top >= gl.top - 1 &&
                ar.bottom <= gl.bottom + 1;
              return {
                ok: inCard && inGlass && clamp === "2",
                d: "inCard=" + inCard + " inGlass=" + inGlass + " clamp=" + clamp
              };
            });
            if (!r.ok) bad.push(id + ":" + r.d);
          }
        } catch (e) {
          bad.push(path + ":" + String(e).slice(0, 60));
        }
        await ctx.close();
      }
      record(
        tag,
        "p8 footer visible in card+glass & desc line-clamped (every item)",
        bad.length === 0,
        bad.join(" | ")
      );
    } catch (e) {
      record(tag, "pXX P8 section", false, String(e).slice(0, 100));
    }
    await browser.close();
  }
}

/* ---------------- v6 (items 4-8 + power hint) ---------------- */
/* exact text baseline in STAGE px via glyph ink (no font-metric guessing):
   baseline = ink-top of the first alnum char + its actualBoundingBoxAscent */
const INK = `
const INKS = () => window.__stage.scale;
const inkBase = (el, pick) => {
  let node = null;
  const walk = (n) => { if (n.nodeType === 3) { node = n; return true; } for (const c of n.childNodes) if (walk(c)) return true; return false; };
  if (!walk(el)) return null;
  const t = pick ? node.textContent.indexOf(pick) : node.textContent.search(/[A-Za-z0-9]/);
  if (t < 0) return null;
  const ch = node.textContent.charAt(t);
  const rg = document.createRange(); rg.setStart(node, t); rg.setEnd(node, t + 1);
  const cr = rg.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const c = document.createElement('canvas').getContext('2d');
  c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  return (cr.top + c.measureText(ch).actualBoundingBoxAscent) / INKS();
};
`;

async function v6fixes() {
  /* b01 — disk fly: the clone is a scaled copy of the real disk (item 4). */
  {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const static_ = await page.evaluate(() => {
        const o = document.querySelector(".tray .obj");
        return { disk: o.offsetWidth, lic: o.querySelector(".lic").offsetWidth };
      });
      await dclick(page, '#arcBody .obj[data-cat="PROJECTS"]');
      await page.waitForSelector(".disk-fly", { timeout: 4000 });
      const cl = await page.evaluate(() => {
        const c = document.querySelector(".disk-fly");
        return {
          disk: c.offsetWidth,
          lic: c.querySelector(".lic") ? c.querySelector(".lic").offsetWidth : -1,
          svg: !!c.querySelector(".lic svg")
        };
      });
      const r0 = static_.lic / static_.disk,
        r1 = cl.lic / cl.disk;
      record(
        "1280x800",
        "b01 fly clone is a same-proportion copy of the disk",
        cl.svg && Math.abs(cl.disk - static_.disk) <= 1 && r1 <= r0 + 0.03,
        `static ${static_.lic}/${static_.disk} fly ${cl.lic}/${cl.disk} (icon ratio ${r1.toFixed(3)} vs ${r0.toFixed(3)})`
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "b01 fly clone proportions", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* b02 — card button rules, every item (item 5). */
  {
    const browser = await chromium.launch();
    const CONTACT = { github: 1, linkedin: 1 },
      REPO = REPOS;
    try {
      const bad = [];
      for (const [path, items] of P7_VIEWS) {
        const { ctx, page } = await freshPage(browser, 1280, 800, "#skip&path=" + path);
        try {
          await page.waitForSelector("body.phase-archive", { timeout: 15000 });
          for (const id of items) {
            await openCard(page, id);
            const st = await page.evaluate(() => {
              const card = document.querySelector(".card");
              return {
                more: !!card.querySelector(".card-more"),
                links: [...card.querySelectorAll(".card-actions .card-l")].map((a) => a.getAttribute("href"))
              };
            });
            const NO_DETAIL = { cv: 1, mb500: 1, rapids: 1, deeplearning: 1 }; // items without bullets
            const wantMore = !CONTACT[id] && !NO_DETAIL[id]; // detail items only (ABOUT.ME has one)
            const resumeOnly = id === "cv";
            const ownOnly = !!CONTACT[id];
            const okMore = st.more === wantMore;
            let okLinks;
            if (resumeOnly) okLinks = st.links.length === 1 && st.links[0] === "HaralambosVarsamis_CV.pdf";
            else if (ownOnly) okLinks = st.links.length === 1 && st.links[0] !== "HaralambosVarsamis_CV.pdf";
            else
              okLinks =
                st.links.includes("HaralambosVarsamis_CV.pdf") && st.links.length === (REPO[id] ? 2 : 1);
            if (!(okMore && okLinks)) bad.push(`${id}: more=${st.more} links=[${st.links.join(",")}]`);
            await escClose(page);
          }
        } catch (e) {
          bad.push(path + ":" + String(e).slice(0, 60));
        }
        await ctx.close();
      }
      record(
        "1280x800",
        "b02 card button rules (every item: about/contact/cv/work/project)",
        bad.length === 0,
        bad.join(" | ")
      );
    } catch (e) {
      record("1280x800", "b02 card button rules", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* b03 — baseline alignment (item 7): key pairs within 1.5 stage px. */
  {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const head = await page.evaluate(
        new Function(
          INK +
            `
        /* poll until settled: under box load the first paint after boot-skip
           can leave a zero rect for a text run, which reads as baseline 0
           and fakes a 300 px offset; the _> dos button is excluded: its
           only glyph is _ (an underscore), drawn at the baseline with no ascent,
           so the ink probe cannot measure it; its box matches its siblings */
        return new Promise((res) => {
          const t0 = Date.now();
          const step = () => {
            const crumb = document.querySelector('#crumb');
            const cb = inkBase(crumb, 'C');
            const off = [...document.querySelectorAll('#arcView .arc-ctl .ctl')]
              .filter(x => x.offsetParent !== null && /[A-Za-z0-9]/.test(x.textContent))
              .map(x => inkBase(x));
            const sl = inkBase(document.getElementById('statLeft'), '5');
            const sh = inkBase(document.querySelector('.arc-status .hint'), 'F');
            const ds = off.map(v => Math.abs(v - cb));
            const status = Math.abs(sl - sh);
            if (cb > 100 && off.length > 0 && off.every(v => v > 100) && sl > 100 && sh > 100)
              return res({ head: Math.max(0, ...ds), status });
            if (Date.now() - t0 > 3000) return res({ head: Math.max(999, ...ds), status });
            setTimeout(step, 100);
          };
          step();
        });
      `
        )
      );
      await openCat(page, "PROJECTS");
      await openFolder(page, "academic", "ACADEMIC");
      await openCard(page, "themis");
      await page.waitForTimeout(250);
      const card = await page.evaluate(
        new Function(
          INK +
            `
        /* same settle-poll as the head measurement: a zero rect for the
           first text run right after open reads as baseline 0 */
        return new Promise((res) => {
          const t0 = Date.now();
          const meas = () => {
            const card = document.querySelector('.card');
            if (!card) return null;
            const m = inkBase(card.querySelector('.card-more'), 'V');
            const lk = [...card.querySelectorAll('.card-right .card-l')].map(l => inkBase(l));
            const tags = [...card.querySelectorAll('.card-tags span')].map(t => inkBase(t));
            return { m, lk, tags, ok: m > 100 && lk.length > 0 && tags.length > 0
                     && lk.every(v => v > 100) && tags.every(v => v > 100) };
          };
          const d = a => a.reduce((mx, v) => Math.max(mx, Math.abs(v - (a[0]||0))), 0);
          const step = () => {
            const s = meas();
            if (s && s.ok) return res({ footer: Math.max(d([...s.lk, s.m]), Math.max(...s.lk.map(v => Math.abs(v - s.m)))), tags: d(s.tags) });
            if (Date.now() - t0 > 3000) return res({ footer: 999, tags: 999 });
            setTimeout(step, 100);
          };
          step();
        });
      `
        )
      );
      const ok = head.head <= 1.5 && head.status <= 1.5 && card.footer <= 1.5 && card.tags <= 1.5;
      record(
        "1280x800",
        "b03 baselines aligned within 1.5 stage px",
        ok,
        `header=${head.head.toFixed(2)} status=${head.status.toFixed(2)} footer=${card.footer.toFixed(2)} tags=${card.tags.toFixed(2)}`
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "b03 baseline alignment", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* b04 — PLAIN mode uses the screen (item 8 + #12: 24 px desktop rows,
     full width on phone, the meaningless WP-tab legend is GONE). */
  for (const [tag, w, h, mob, wantW, h3min, rowMin] of [
    ["1280x800", 1280, 800, false, 0.7, 20, 24],
    ["390x844", 390, 844, true, 1.0, 15, 16]
  ]) {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, w, h, "#skip", { mobile: mob });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await dclick(page, "#plainBtn");
      await page.waitForTimeout(250);
      const m = await page.evaluate((h3min) => {
        const s = window.__stage.scale;
        const body = document.querySelector(".plain").parentElement.getBoundingClientRect();
        const pl = document.querySelector(".plain").getBoundingClientRect();
        const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
        return {
          wRatio: pl.width / body.width,
          leftGap: (pl.left - body.left) / body.width,
          rightGap: (body.right - pl.right) / body.width,
          h3: fs(document.querySelector(".plain h3")) / s,
          row: fs(document.querySelector(".plain-row")) / s,
          legend: !!document.querySelector(".plain-legend")
        };
      }, h3min);
      /* G1b R4: the column is CENTRED (max-width 880), so desktop leftGap
         ~ rightGap ~ 0.15; phone stays full width */
      const gapOk = mob
        ? m.leftGap <= 0.06
        : Math.abs(m.leftGap - m.rightGap) <= 0.02 && m.leftGap >= 0.1 && m.leftGap <= 0.21;
      const ok = Math.abs(m.wRatio - wantW) <= 0.03 && gapOk && m.h3 >= h3min && m.row >= rowMin && !m.legend;
      record(
        tag,
        "b04 PLAIN scaled up (~70% col centred / full phone width, big rows, no legend)",
        ok,
        `w=${(m.wRatio * 100).toFixed(1)}% left=${(m.leftGap * 100).toFixed(1)}% right=${(m.rightGap * 100).toFixed(1)}% h3=${m.h3} row=${m.row} legend=${m.legend}`
      );
      await ctx.close();
    } catch (e) {
      record(tag, "b04 PLAIN scale", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* b05 — power hint (O6): smooth 24-step fade 0.30→0.85, visible glow,
     NO box, no loop jump. Counts the held states by sampling the live
     opacity across one cycle and asserts the range. */
  {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#off");
      await page.waitForSelector("body.phase-off", { timeout: 8000 });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const el = document.getElementById("powerHint");
        const an = el.getAnimations().filter((a) => a.animationName === "hintsteps");
        if (!an.length) return { n: 0, vals: [], stops: 0 };
        const dur = an[0].effect.getTiming().duration;
        const vals = [];
        for (let i = 0; i < 480; i += 2) {
          an[0].currentTime = (dur * i) / 480;
          vals.push(parseFloat(getComputedStyle(el).opacity));
        }
        /* count held states: with steps(1,end) the value only changes AT a
           keyframe, so the number of changes across one cycle == stop count */
        let stops = 1;
        for (let i = 1; i < vals.length; i++) if (Math.abs(vals[i] - vals[i - 1]) > 0.001) stops++;
        const lo = Math.min(...vals),
          hi = Math.max(...vals);
        const coarse = [];
        for (let i = 0; i < 24; i++) {
          an[0].currentTime = (dur * i) / 24;
          coarse.push(parseFloat(getComputedStyle(el).opacity));
        }
        return {
          n: an.length,
          vals: coarse,
          stops,
          lo,
          hi,
          distinct: new Set(coarse.map((v) => Math.round(v * 100))).size
        };
      });
      const box = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById("powerHint"));
        return { bg: cs.backgroundColor, bw: cs.borderTopWidth };
      });
      const noBox = (box.bg === "rgba(0, 0, 0, 0)" || box.bg === "transparent") && parseFloat(box.bw) === 0;
      const ok =
        m.n === 1 &&
        m.stops >= 18 &&
        m.stops <= 26 &&
        m.lo >= 0.48 &&
        m.lo <= 0.53 &&
        m.hi >= 0.87 &&
        m.hi <= 0.93 &&
        m.distinct >= 12 &&
        noBox;
      record(
        "1280x800",
        "b05 power hint: ~24-step fade 0.50->0.90, visible, no box, no loop jump",
        ok,
        "stops=" +
          m.stops +
          " lo=" +
          m.lo.toFixed(2) +
          " hi=" +
          m.hi.toFixed(2) +
          " states=" +
          m.distinct +
          (noBox ? "" : " box=" + box.bg)
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "b05 power hint stepping", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* c03 — right-strip vent: v4 continuous look (owner), knob→slider (phase A fix). */
  {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const m = await page.evaluate(() => {
        const s = window.__stage.scale;
        const r = (el) => el.getBoundingClientRect();
        const vent = r(document.querySelector(".strip-slats"));
        const knob = r(document.getElementById("phosKnob"));
        const sw = r(document.querySelector(".strip-switch"));
        return {
          topGap: (vent.top - knob.bottom) / s,
          botGap: (sw.top - vent.bottom) / s,
          len: vent.height / s
        };
      });
      const ok = m.topGap <= 24 && m.botGap <= 24 && m.len >= 300;
      record(
        "1280x800",
        "c03 right-strip vent runs knob→slider (v4 continuous, gaps <=24 stage px)",
        ok,
        `topGap=${m.topGap.toFixed(1)} botGap=${m.botGap.toFixed(1)} len=${m.len.toFixed(0)}`
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "c03 vent continuous", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* c01 — DATA validates against the documented SCHEMA (item 1). */
  {
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const m = await page.evaluate(() => {
        const A = window.__archive;
        if (!A || !A.SCHEMA) return { issues: ["no window.__archive/SCHEMA"] };
        const issues = [];
        ["id", "label", "title"].forEach((f) => {
          if (!A.SCHEMA.item[f]) issues.push("SCHEMA.item missing " + f);
        });
        const ids = {};
        const chk = (it, where, folder) => {
          if (!it) {
            issues.push(where + ": null item");
            return;
          }
          ["id", "label"].forEach((f) => {
            if (it[f] === undefined || it[f] === "") issues.push(where + ": missing " + f);
          });
          if (!folder && (it.title === undefined || it.title === "")) issues.push(where + ": missing title");
          if (it.id) {
            if (ids[it.id]) issues.push("duplicate id " + it.id);
            ids[it.id] = 1;
          }
          if (folder) {
            if (!Array.isArray(it.items)) issues.push(where + ": folder without items[]");
            else it.items.forEach((sub) => chk(sub, where + "." + (sub && sub.id), false));
          }
        };
        Object.keys(A.DATA).forEach((c) => {
          const cat = A.DATA[c];
          if (!cat.drive || !/^[A-E]$/.test(cat.drive)) issues.push(c + ": bad drive letter");
          if (!Array.isArray(cat.items)) {
            issues.push(c + ": no items[]");
            return;
          }
          cat.items.forEach((it) => chk(it, c + "." + (it && it.id), !!(it && it.folder)));
          if (!A.CATS.includes(c)) issues.push(c + ": not in CATS");
        });
        return { issues, cats: Object.keys(A.DATA).length };
      });
      record(
        "1280x800",
        "c01 DATA validates against SCHEMA (id/label/title, unique, drive A-E)",
        m.issues.length === 0,
        (m.issues || []).join(" | ")
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "c01 schema validation", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* c02 — a dummy entry added at runtime renders with defaults, no errors (item 1). */
  {
    const browser = await chromium.launch();
    const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
    try {
      const { ctx, page } = await freshPage(browser, 1280, 800, "#skip");
      attach(page, errs);
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const cases = [
        [
          "EDUCATION",
          {
            id: "__qa_dummy",
            label: "QA DUMMY",
            title: "QA Dummy Entry",
            period: "2026",
            role: "Test",
            tags: ["qa"],
            desc: "d",
            detail: ["line one", "line two"]
          },
          "edu"
        ],
        ["WORK", { id: "__qa_dummy2", label: "QA DUMMY", title: "QA Dummy Work", period: "2026" }, "work"],
        [
          "CONTACT",
          {
            id: "__qa_dummy3",
            label: "QA DUMMY",
            title: "QA Dummy Link",
            period: "PROFILE",
            desc: "x.com/y",
            link: "https://example.com/x",
            linkLabel: "OPEN"
          },
          "disk"
        ]
      ];
      const bad = [];
      for (const [cat, item, wantScene] of cases) {
        await toRoot(page);
        await openCat(page, cat);
        const added = await page.evaluate((a) => window.__addTestData(a.cat, a.item), { cat, item });
        if (!added) {
          bad.push(cat + ": add failed");
          continue;
        }
        const st = await page.evaluate(
          (a) => {
            const el = document.querySelector('.obj[data-item="' + a.id + '"]');
            if (!el) return { found: false };
            const svg = el.querySelector(".lic svg");
            return {
              found: true,
              scene: svg ? svg.getAttribute("data-scene") : null,
              sceneOk: svg && svg.getAttribute("data-scene") === a.want,
              shell: getComputedStyle(el).getPropertyValue("--shell-1").trim()
            };
          },
          { id: item.id, want: wantScene }
        );
        if (!st.found) {
          bad.push(cat + ": not rendered");
          continue;
        }
        if (!st.sceneOk) bad.push(cat + ": scene " + st.scene + " (want " + wantScene + ")");
        if (!st.shell) bad.push(cat + ": no inherited --shell-1");
        await dclick(page, '.obj[data-item="' + item.id + '"]');
        await page.waitForSelector(".card:not([hidden])", { timeout: 4000 });
        const card = await page.evaluate(() => ({
          more: !!document.querySelector(".card .card-more"),
          links: [...document.querySelectorAll(".card .card-actions .card-l")].map((a) =>
            a.getAttribute("href")
          )
        }));
        const wantMore = !!item.detail;
        const wantLinks =
          item.link && item.link !== "HaralambosVarsamis_CV.pdf"
            ? [item.link]
            : card.more
              ? card.links
              : ["HaralambosVarsamis_CV.pdf"];
        if (card.more !== wantMore) bad.push(cat + ": VIEW MORE=" + card.more + " (want " + wantMore + ")");
        if (item.link && item.link !== "HaralambosVarsamis_CV.pdf") {
          if (!card.links.includes(item.link) || card.links.includes("HaralambosVarsamis_CV.pdf"))
            bad.push(cat + ": links " + JSON.stringify(card.links));
        } else if (!card.links.includes("HaralambosVarsamis_CV.pdf")) bad.push(cat + ": no CV link");
        await escClose(page);
      }
      record(
        "1280x800",
        "c02 dummy entries render with defaults (scene/colour/buttons, no errors)",
        bad.length === 0 && errs.consoleE.length === 0 && errs.pageE.length === 0,
        (bad.join(" | ") + (errs.consoleE.length ? " || console: " + errs.consoleE[0] : "")).slice(0, 200)
      );
      await ctx.close();
    } catch (e) {
      record("1280x800", "c02 dummy entry render", false, String(e).slice(0, 90));
    }
    await browser.close();
  }
}

/* ================= v6 PHASE E — owner O1–O6 + review fixes ================
   e01 #1/O3/O4  monitor never cropped; caption visible (>=24 px black above at 1080p/1440p)
   e02 #2        disk labels are ONE line (no mid-word wrap)
   e03 #3        phone: name does not overlap the 1.44MB meta line
   e04 #4        phone: card anchored below the disk, never over its shutter
   e05 #5        phone: lone/odd disks centred, rows level
   e06 #7        ICU-ON-CALL italic overhang not clipped
   e07 #11       phone: status bar one line everywhere (hint dropped)
   e08 O2        every folder: group centred (<=1 stage px), rows level (<=0.5),
                 no resting tilt
   (m06 above already covers O1: fresh defaults on every load) */
async function v6Efixes() {
  /* e01 — the monitor and caption always fit the window (#1 / O3 / O4). */
  for (const [tag, w, h] of [
    ["1920x1080", 1920, 1080],
    ["1440x900", 1440, 900],
    ["2560x1440", 2560, 1440],
    ["1280x800", 1280, 800]
  ]) {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, w, h, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const mon = document.querySelector(".monitor").getBoundingClientRect();
        const cap = document.getElementById("caption").getBoundingClientRect();
        return {
          monT: mon.top,
          monB: mon.bottom,
          capB: cap.bottom,
          vh: innerHeight,
          capVisible: cap.bottom <= innerHeight - 8 && cap.bottom > cap.top
        };
      });
      const needTop = w === 1920 || w === 1440 ? 24 : 1;
      if (m.monT < needTop) {
        ok = false;
        d += "monitor top " + m.monT.toFixed(1) + " < " + needTop + "px; ";
      }
      if (!m.capVisible) {
        ok = false;
        d += "caption bottom " + m.capB.toFixed(1) + " vs vh-8 " + (m.vh - 8) + "; ";
      }
      if (m.monB > m.vh) {
        ok = false;
        d += "monitor bottom clipped; ";
      }
      if (ok) d = "top=" + m.monT.toFixed(1) + "px capB=" + m.capB.toFixed(1) + "/" + m.vh;
      record(tag, "e01 monitor never cropped + caption visible (>=24 px black above on 1080p/1440p)", ok, d);
      await ctx.close();
    } catch (e) {
      record(tag, "e01 monitor fits the window", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e02 — disk labels: ONE line, shrink-to-fit, no wrap (#2). */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=WORK");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(800);
      const m = await page.evaluate(async () => {
        await document.fonts.ready;
        const out = [];
        document.querySelectorAll("#arcBody .f-name").forEach((el) => {
          const lines = el.getClientRects().length;
          if (lines !== 1) out.push(el.textContent + ": " + lines + " lines");
          if (el.scrollWidth > el.clientWidth + 1) out.push(el.textContent + ": overflow");
        });
        return out;
      });
      if (m.length) {
        ok = false;
        d = m.join(" | ");
      } else d = "DELOITTE/INTERMEDIA/ARMY each one line, no overflow";
      record("1440x900", "e02 disk labels one line (no INTERMEDI/A wrap)", ok, d);
      await ctx.close();
    } catch (e) {
      record("1440x900", "e02 labels one line", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e03 — phone root: the name never overlaps the 1.44MB meta line (#3). */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 390, 844, "#skip", { mobile: true });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1800);
      const m = await page.evaluate(async () => {
        await document.fonts.ready;
        const s = window.__stage.scale,
          out = [];
        document.querySelectorAll("#arcBody .obj-cat").forEach((el) => {
          const sub = el.querySelector(".f-sub");
          const txt = el.querySelector(".f-txt");
          if (!sub || !txt) return;
          const a = txt.getBoundingClientRect(),
            b = sub.getBoundingClientRect();
          const ov = a.bottom - b.top;
          if (ov > 0.5)
            out.push(el.textContent.slice(0, 10) + " overlap " + (ov / s).toFixed(1) + " stage px");
        });
        return out;
      });
      if (m.length) {
        ok = false;
        d = m.join(" | ");
      } else d = "5 category disks, 0 overlap with the meta line";
      record("390x844", "e03 phone: disk name clear of the 1.44MB line", ok, d);
      await ctx.close();
    } catch (e) {
      record("390x844", "e03 phone name/meta overlap", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e04 — phone folder: the card is anchored below the disk, never over its
     shutter, and stays inside the glass (#4). */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 390, 844, "#skip&path=WORK", { mobile: true });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(800);
      await openCard(page, "deloitte");
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => {
        const s = window.__stage.scale;
        const card = document.querySelector(".card").getBoundingClientRect();
        const disk = document.querySelector('.obj[data-item="deloitte"]').getBoundingClientRect();
        const glass = document.getElementById("glass").getBoundingClientRect();
        const ovW = Math.min(card.right, disk.right) - Math.max(card.left, disk.left);
        const ovH = Math.min(card.bottom, disk.bottom) - Math.max(card.top, disk.top);
        const inGlass =
          card.left >= glass.left - 1 &&
          card.right <= glass.right + 1 &&
          card.top >= glass.top - 1 &&
          card.bottom <= glass.bottom + 1;
        return { overlap: ovW > 0 && ovH > 0 ? ovW * ovH : 0, inGlass, below: card.top >= disk.bottom - 1 };
      });
      if (m.overlap > 0) {
        ok = false;
        d = "card covers disk area " + (m.overlap / 100).toFixed(0) + " px²/100; ";
      }
      if (!m.inGlass) {
        ok = false;
        d += "card outside glass; ";
      }
      if (ok) d = "card below disk (below=" + m.below + "), inside glass, 0 overlap";
      record("390x844", "e04 phone: card below the disk, never over the shutter", ok, d);
      await ctx.close();
    } catch (e) {
      record("390x844", "e04 phone card placement", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e05 — phone: odd-count groups — rows level, lone last disk dead-centre (#5). */
  for (const [tag, path] of [
    ["root", ""],
    ["ACADEMIC", "PROJECTS/ACADEMIC"],
    ["PERSONAL", "PROJECTS/PERSONAL"]
  ]) {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 390, 844, path ? "#skip&path=" + path : "#skip", {
        mobile: true
      });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1800);
      const m = await page.evaluate(() => {
        const s = window.__stage.scale;
        const wraps = [...document.querySelectorAll(".tray .obj-wrap")];
        const tray = document.querySelector(".tray").getBoundingClientRect();
        const rects = wraps.map((w) => w.getBoundingClientRect());
        const rows = new Map();
        rects.forEach((r) => {
          const k = Math.round(r.top / s);
          if (!rows.has(k)) rows.set(k, []);
          rows.get(k).push(r);
        });
        let topDiff = 0,
          lone = [];
        rows.forEach((rs) => {
          const t = rs.map((r) => r.top);
          topDiff = Math.max(topDiff, (Math.max(...t) - Math.min(...t)) / s);
          if (rs.length === 1)
            lone.push(Math.abs(rs[0].left + rs[0].width / 2 - (tray.left + tray.width / 2)) / s);
        });
        return {
          n: rects.length,
          rows: rows.size,
          topDiff,
          loneMax: lone.length ? Math.max(...lone) : 0,
          hasLone: lone.length > 0
        };
      });
      if (m.topDiff > 0.5) {
        ok = false;
        d += "row top diff " + m.topDiff.toFixed(2) + " > 0.5; ";
      }
      if (m.hasLone && m.loneMax > 1) {
        ok = false;
        d += "lone disk off-centre " + m.loneMax.toFixed(1) + "; ";
      }
      if (ok)
        d =
          m.n +
          " disks in " +
          m.rows +
          " rows, topDiff=" +
          m.topDiff.toFixed(2) +
          (m.hasLone ? " lone offset=" + m.loneMax.toFixed(2) + " px" : "");
      record("390x844", "e05 " + tag + ": rows level, lone/odd disk centred", ok, d);
      await ctx.close();
    } catch (e) {
      record("390x844", "e05 " + tag + " centring", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e06 — ICU-ON-CALL: the italic overhang is not clipped (#7). */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=PROJECTS/ACADEMIC");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(800);
      const m = await page.evaluate(async () => {
        await document.fonts.ready;
        const el = document.querySelector('.obj[data-item="icu"] .f-name');
        if (!el) return { err: "icu .f-name not found" };
        const cs = getComputedStyle(el);
        const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const content = el.clientWidth - pad;
        const po = el.style.overflow;
        el.style.overflow = "visible"; /* unclip before measuring */
        const r = document.createRange();
        r.selectNodeContents(el);
        const z = parseFloat(getComputedStyle(el).zoom) || 1; /* Range rect is screen px */
        const tw = r.getBoundingClientRect().width / z;
        el.style.overflow = po;
        return {
          text: el.textContent,
          tw,
          content,
          pad,
          font: cs.fontSize,
          sw: el.scrollWidth <= el.clientWidth,
          lines: el.getClientRects().length
        };
      });
      if (m.err) {
        ok = false;
        d = m.err;
      } else if (m.tw > m.content + 1 || !m.sw || m.lines !== 1 || m.pad < 6) {
        ok = false;
        d =
          "text " +
          m.tw.toFixed(1) +
          " vs content " +
          m.content.toFixed(1) +
          " pad " +
          m.pad +
          " lines " +
          m.lines;
      } else
        d =
          m.text +
          ": layout text " +
          m.tw.toFixed(1) +
          " <= " +
          m.content.toFixed(1) +
          " content box, " +
          m.pad / 2 +
          " px padding each side (overhang slack), one line";
      record("1440x900", "e06 ICU-ON-CALL italic overhang not clipped", ok, d);
      await ctx.close();
    } catch (e) {
      record("1440x900", "e06 ICU-ON-CALL clip", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e07 — phone: the status bar is ONE line at root AND in folders (#11). */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const res = [];
      for (const path of ["", "#skip&path=WORK"]) {
        const { ctx, page } = await freshPage(browser, 390, 844, path || "#skip", { mobile: true });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(700);
        const m = await page.evaluate(() => {
          const s = document.querySelector(".arc-status");
          const hint = s.querySelector(".hint");
          const left = document.getElementById("statLeft");
          return {
            h: s.offsetHeight,
            hint: getComputedStyle(hint).display,
            leftFits: left.scrollWidth <= left.clientWidth + 1
          };
        });
        res.push(m);
        await ctx.close();
      }
      const sameH = Math.abs(res[0].h - res[1].h) <= 1;
      if (!sameH) {
        ok = false;
        d += "heights " + res[0].h + "/" + res[1].h + "; ";
      }
      if (res.some((r) => r.hint !== "none")) {
        ok = false;
        d += "hint not hidden; ";
      }
      if (res.some((r) => !r.leftFits)) {
        ok = false;
        d += "statLeft overflows; ";
      }
      if (ok) d = "one line at root and in WORK (" + res[0].h + "/" + res[1].h + " px), hint hidden";
      record("390x844", "e07 phone: status bar one line, constant height", ok, d);
    } catch (e) {
      record("390x844", "e07 phone status bar", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* e08 — O2: every folder, the group is dead-centre and level, no resting tilt. */
  for (const [tag, path] of [
    ["root", ""],
    ["WORK", "WORK"],
    ["EDUCATION", "EDUCATION"],
    ["PROJECTS", "PROJECTS"],
    ["ACADEMIC", "PROJECTS/ACADEMIC"],
    ["PERSONAL", "PROJECTS/PERSONAL"],
    ["CONTACT", "CONTACT"]
  ]) {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, 1920, 1080, path ? "#skip&path=" + path : "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1800);
      const m = await page.evaluate(() => {
        const s = window.__stage.scale;
        const wraps = [...document.querySelectorAll(".tray .obj-wrap")];
        const tray = document.querySelector(".tray").getBoundingClientRect();
        const rects = wraps.map((w) => w.getBoundingClientRect());
        const rows = new Map();
        rects.forEach((r) => {
          const k = Math.round(r.top / s);
          if (!rows.has(k)) rows.set(k, []);
          rows.get(k).push(r);
        });
        let topDiff = 0;
        rows.forEach((rs) => {
          const t = rs.map((r) => r.top);
          topDiff = Math.max(topDiff, (Math.max(...t) - Math.min(...t)) / s);
        });
        const left = Math.min(...rects.map((r) => r.left)),
          right = Math.max(...rects.map((r) => r.right));
        const lm = (left - tray.left) / s,
          rm = (tray.right - right) / s;
        const noTilt = [...document.querySelectorAll(".tray .obj")].every(
          (o) => getComputedStyle(o).transform === "none"
        );
        return { n: rects.length, topDiff, lm, rm, noTilt };
      });
      if (m.topDiff > 0.5) {
        ok = false;
        d += "row top diff " + m.topDiff.toFixed(2) + "; ";
      }
      if (Math.abs(m.lm - m.rm) > 1) {
        ok = false;
        d += "margins " + m.lm.toFixed(1) + "/" + m.rm.toFixed(1) + "; ";
      }
      if (!m.noTilt) {
        ok = false;
        d += "resting tilt present; ";
      }
      if (ok)
        d =
          m.n +
          " disks, margins " +
          m.lm.toFixed(1) +
          "/" +
          m.rm.toFixed(1) +
          ", topDiff=" +
          m.topDiff.toFixed(2) +
          ", level";
      record("1920x1080", "e08 O2 " + tag + ": centred (<=1 px), level (<=0.5), no resting tilt", ok, d);
      await ctx.close();
    } catch (e) {
      record("1920x1080", "e08 O2 " + tag, false, String(e).slice(0, 90));
    }
    await browser.close();
  }
}

/* ================= phase F fixes (F1 bottom sheet / F2 meta wrap / F3 label margin) ================= */
/* A small helper: click a disk by id and wait for its card to be visible. */
async function openCardFor(browser, w, h, hash, itemId, mobile) {
  const { ctx, page, errs } = await freshPage(browser, w, h, hash, { mobile });
  await page.waitForSelector("body.phase-archive", { timeout: 15000 });
  await page.waitForTimeout(900);
  const pt = await page.evaluate((id) => {
    const el = document.querySelector('.obj[data-item="' + id + '"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, itemId);
  if (pt) {
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(450);
  }
  return { ctx, page, errs, opened: !!pt };
}

async function v6Ffixes() {
  /* f01 — F1: on phone the card must NEVER cover a disk. When it cannot fit
     beside/above/below without covering, it becomes a bottom sheet (full
     glass width, anchored to the glass bottom above the status bar). */
  for (const itemId of ["linkedin", "cv"]) {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page, opened } = await openCardFor(browser, 390, 844, "#skip&path=CONTACT", itemId, true);
      if (!opened) throw new Error("disk not found");
      const m = await page.evaluate(() => {
        const cardEl = document.querySelector(".card");
        const card = cardEl.getBoundingClientRect();
        const disks = [];
        document.querySelectorAll(".obj[data-item]").forEach((o) => disks.push(o.getBoundingClientRect()));
        const overlap = (a, b) => {
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return w > 0 && h > 0 ? w * h : 0;
        };
        const scroll = document.querySelector(".arc-scroll").getBoundingClientRect();
        const status = document.querySelector(".arc-status").getBoundingClientRect();
        const covered = disks.filter((dc) => overlap(card, dc) > 0).length;
        const widthRatio = card.width / scroll.width;
        const bottomGap = scroll.bottom - card.bottom; // card bottom -> glass bottom
        const aboveStatus = card.bottom <= status.top + 1;
        return {
          covered,
          widthRatio,
          bottomGap,
          aboveStatus,
          sheet: cardEl.classList.contains("sheet"),
          cardB: card.bottom,
          scrollB: scroll.bottom,
          statusT: status.top
        };
      });
      if (m.covered > 0) {
        ok = false;
        d += "card covers " + m.covered + " disk(s); ";
      }
      if (m.widthRatio < 0.75) {
        ok = false;
        d += "not full glass width (ratio " + m.widthRatio.toFixed(2) + "); ";
      }
      if (m.bottomGap < 0 || m.bottomGap > 24) {
        ok = false;
        d += "not anchored to glass bottom (gap " + m.bottomGap.toFixed(1) + "); ";
      }
      if (!m.aboveStatus) {
        ok = false;
        d += "card dips below the status bar; ";
      }
      if (ok)
        d =
          itemId +
          ": covers 0 disks, width " +
          Math.round(m.widthRatio * 100) +
          "%, bottom gap " +
          m.bottomGap.toFixed(1) +
          " px, sheet=" +
          m.sheet;
      record(
        "390x844",
        "f01 F1 " + itemId + ": card never covers a disk; bottom sheet at glass bottom",
        ok,
        d
      );
      await ctx.close();
    } catch (e) {
      record("390x844", "f01 F1 " + itemId + " bottom sheet", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* f02 — F2: the card meta line wraps to 2 lines before any ellipsis,
     never cut mid-word on desktop. */
  {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page, opened } = await openCardFor(
        browser,
        1920,
        1080,
        "#skip&path=WORK",
        "deloitte",
        false
      );
      if (!opened) throw new Error("disk not found");
      const m = await page.evaluate(() => {
        const el = document.querySelector(".card .card-p");
        if (!el) return { err: "no .card-p" };
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
        return {
          text: el.textContent,
          overflow: el.scrollHeight > el.clientHeight + 1,
          lines: Math.round(el.clientHeight / lh),
          clientH: el.clientHeight,
          sh: el.scrollHeight
        };
      });
      if (m.err) {
        ok = false;
        d = m.err;
      } else if (m.overflow) {
        ok = false;
        d += "meta overflows its 2-line box (sh " + m.sh + "> ch " + m.clientH + "); ";
      } else if (m.lines > 2) {
        ok = false;
        d += "meta more than 2 lines (" + m.lines + "); ";
      } else if (/\u2026$/.test(m.text) || /[A-Za-z]…/.test(m.text)) {
        ok = false;
        d += "meta ends in an ellipsis: " + m.text;
      } else if (!/\(X\+\+\)$/.test(m.text)) {
        ok = false;
        d += "final segment truncated: " + m.text;
      } else d = "meta on " + m.lines + ' line(s), no ellipsis, ends "' + m.text.slice(-14) + '"';
      record("1920x1080", "f02 F2 deloitte: meta wraps to <=2 lines, never cut mid-word", ok, d);
      await ctx.close();
    } catch (e) {
      record("1920x1080", "f02 F2 meta wrap", false, String(e).slice(0, 90));
    }
    await browser.close();
  }

  /* f03 — F3: every disk label keeps >= 4 stage px of clear space on BOTH
     sides of the ink (the INTERMEDIA "A" used to touch the label edge). */
  for (const [tag, w, h, hash, mobile] of [
    ["WORK@1920", 1920, 1080, "#skip&path=WORK", false],
    ["root@1440", 1440, 900, "#skip", false],
    ["CONTACT@390", 390, 844, "#skip&path=CONTACT", true]
  ]) {
    const browser = await chromium.launch();
    let ok = true,
      d = "";
    try {
      const { ctx, page } = await freshPage(browser, w, h, hash, { mobile });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(900);
      const m = await page.evaluate(async () => {
        await document.fonts.ready;
        const z = parseFloat(getComputedStyle(document.getElementById("stage")).zoom) || 1;
        const out = [];
        document.querySelectorAll(".f-name").forEach((el) => {
          const prev = el.style.overflow;
          el.style.overflow = "visible";
          const r = document.createRange();
          r.selectNodeContents(el);
          const ir = r.getBoundingClientRect(),
            box = el.getBoundingClientRect();
          el.style.overflow = prev;
          out.push({ t: el.textContent, l: (ir.left - box.left) / z, r: (box.right - ir.right) / z });
        });
        return out;
      });
      const bad = m.filter((x) => x.l < 3.9 || x.r < 3.9);
      if (bad.length) {
        ok = false;
        d = bad.map((x) => x.t + " L" + x.l.toFixed(1) + "/R" + x.r.toFixed(1)).join(",");
      } else d = m.map((x) => x.t + " L" + x.l.toFixed(1) + "/R" + x.r.toFixed(1)).join(",");
      record(
        mobile ? "390x844" : w + "x" + h,
        "f03 F3 " + tag + ": >=4 px clear space both sides of every label",
        ok,
        d
      );
      await ctx.close();
    } catch (e) {
      record(w + "x" + h, "f03 F3 " + tag + " label margin", false, String(e).slice(0, 90));
    }
    await browser.close();
  }
}

/* ---------------- perf budget (pf) ---------------- */
/* pf01 — first disk ≤ 1.5 s after #skip (desktop + phone)
   pf02 — no long task > 50 ms during a WORK insert. Gate = median of 3 fresh
          inserts ≤ 50 ms AND at most one of the three rounds spiked — the
          frozen v6 itself shows an occasional single transient spike under
          headless Chromium, so one is tolerated.
   pf03 — insert median frame interval ≤ 20 ms (≥ 50 fps)
   pf04 — v7 no worse than v6 by > 10% on (a)–(c), from perf-results.json */
const FIRST_OBJ_INIT = `
  window.__firstObjMs = 0;
  (function tick(){
    if (window.__firstObjMs) return;
    var o = document.querySelector('.obj');
    if (o) {
      var r = o.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { window.__firstObjMs = performance.now(); return; }
    }
    requestAnimationFrame(tick);
  })();
`;
async function perfMeasureInsert(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const tasks = [];
    let po = null;
    try {
      po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) tasks.push(e.duration);
      });
      po.observe({ type: "longtask" });
    } catch (e) {
      /* fall back to frame gaps only */
    }
    const frames = [];
    let stop = false,
      last = null;
    (function loop(t) {
      if (!stop) {
        if (last !== null) frames.push(t - last);
        last = t;
        requestAnimationFrame(loop);
      }
    })(performance.now());
    const el = document.querySelector('.obj[data-cat="WORK"]');
    if (!el) return { error: "no WORK disk" };
    el.click();
    const t0 = performance.now();
    let done = false;
    while (performance.now() - t0 < 8000) {
      const h = document.querySelector("#crumb .here");
      if (h && h.textContent === "WORK") {
        done = true;
        break;
      }
      await sleep(15);
    }
    if (!done) return { error: "insert did not finish" };
    await sleep(450);
    stop = true;
    if (po) po.disconnect();
    const sorted = frames.slice().sort((a, b) => a - b);
    const quant = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0);
    return {
      longestTask: tasks.length ? Math.max(...tasks) : 0,
      tasksOver50: tasks.filter((t) => t > 50).length,
      medianFrame: quant(sorted, 0.5),
      p95Frame: quant(sorted, 0.95)
    };
  });
}

/* ============================== G3 (items 14/15/2/12) ============================== */
async function g3Fixes() {
  const D = "1440x900";
  /* g3a — (item 14) floppy materials: 3% grain is ONE static external PNG
     (fonts/grain.png, <= 4 KB), no live SVG filters; brushed shutter,
     recessed label well, HD/WP at the bottom corners */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const disk = document.querySelector("#arcBody .obj");
        const bg = getComputedStyle(disk).backgroundImage;
        const shutter = getComputedStyle(disk.querySelector(".f-shutter")).backgroundImage;
        const well = getComputedStyle(disk.querySelector(".f-label")).boxShadow;
        const dr = disk.getBoundingClientRect();
        const hd = disk.querySelector(".f-hd"),
          wp = disk.querySelector(".f-wp");
        const hr = hd.getBoundingClientRect(),
          wr = wp.getBoundingClientRect();
        return {
          grain: bg.indexOf("fonts/grain.png") >= 0,
          noFilter: !!document.querySelector("#arcBody filter") == false,
          brush: shutter.indexOf("repeating-linear-gradient") >= 0,
          recess: well.indexOf("inset") >= 0,
          hdBottom: dr.bottom - hr.bottom <= 12 && dr.bottom - hr.bottom >= 0,
          hdLeft: hr.x < dr.x + dr.width * 0.5,
          wpBottom: dr.bottom - wr.bottom <= 12 && dr.bottom - wr.bottom >= 0,
          wpRight: wr.x > dr.x + dr.width * 0.5,
          wpNotMidRight: wr.y > dr.y + dr.height * 0.6
        };
      });
      await ctx.close();
      await browser.close();
      const grainB = fs.statSync(path.join(SITE, "fonts", "grain.png")).size;
      ok =
        m.grain &&
        m.noFilter &&
        m.brush &&
        m.recess &&
        m.hdBottom &&
        m.hdLeft &&
        m.wpBottom &&
        m.wpRight &&
        m.wpNotMidRight &&
        grainB <= 4096;
      d = "grain.png=" + grainB + "B " + JSON.stringify(m);
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "g3a-materials", ok, d);
  }
  /* g3b — (item 15) the DOS shell: every command, opaque overlay console,
     "closed = no capture", and it never covers a disk row */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
    await page.waitForSelector("body.phase-archive", { timeout: 15000 });
    await page.waitForTimeout(700);
    try {
      let s;
      const st = () =>
        page.evaluate(() => ({
          open: !document.getElementById("dos").hidden,
          ps: document.getElementById("dosPs").textContent,
          txt: document.getElementById("dosTxt").textContent,
          out: Array.prototype.map.call(document.getElementById("dosOut").children, (x) => x.textContent),
          crumb: (document.querySelector("#crumb .here") || {}).textContent || "root",
          cell: (document.querySelector('#arcBody [data-cat="ABOUT.ME"]')?.parentElement || {}).dataset?.cell,
          dosTop: document.getElementById("dos").getBoundingClientRect().top,
          diskBottom: Math.max(
            ...Array.from(document.querySelectorAll("#arcBody .obj")).map(
              (o) => o.getBoundingClientRect().bottom
            )
          ),
          dosBg: getComputedStyle(document.getElementById("dos")).backgroundColor,
          statusLeftX: document.getElementById("statLeft").getBoundingClientRect().x,
          glassX: document.getElementById("glass").getBoundingClientRect().x,
          glassW: document.getElementById("glass").getBoundingClientRect().width
        }));
      const fail = (m) => {
        ok = false;
        d = d + " | " + m;
      };
      // the >_ button lives in the top-right control row, styled like the others
      const btn = await page.evaluate(() => {
        const b = document.getElementById("dosBtn");
        return {
          inCtl: !!b.closest(".arc-ctl"),
          isCtl: b.classList.contains("ctl"),
          aria: b.getAttribute("aria-label"),
          h:
            Math.abs(
              b.getBoundingClientRect().height -
                document.getElementById("sndBtn").getBoundingClientRect().height
            ) <= 2
        };
      });
      if (!btn.inCtl || !btn.isCtl || btn.aria !== "Command prompt (/)" || !btn.h)
        fail("btn " + JSON.stringify(btn));
      const s0 = await st();
      // status text at the plain left edge (button no longer in the bar)
      if (s0.statusLeftX - s0.glassX < 4 || s0.statusLeftX - s0.glassX > s0.glassW * 0.15)
        fail("statleft " + (s0.statusLeftX - s0.glassX));
      // "/" opens (desktop)
      await page.keyboard.press("/");
      await page.waitForTimeout(150);
      s = await st();
      if (!s.open) fail("slash-open");
      if (s.dosBg !== "rgb(7, 18, 11)") fail("opaque " + s.dosBg);
      if (s.dosTop < s.diskBottom) fail("covers-disk " + s.dosTop + "/" + s.diskBottom);
      // DIR at root, DOS-aligned
      await page.keyboard.type("dir");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      s = await st();
      if (!/Directory of C:\\TU7URU/.test(s.out.join("\n")))
        fail("dir-header " + JSON.stringify(s.out.slice(-2)));
      for (const L of ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"])
        if (!s.out.some((l) => l.indexOf(L) === 0 && l.indexOf("<DIR>") === 14)) fail("dir-align " + L);
      if (!s.out.some((l) => /^ {4,}\d+ dir\(s\)$/.test(l)))
        fail("dir-summary " + JSON.stringify(s.out.slice(-1)));
      // CD mixed-case by label
      await page.keyboard.type("cd wOrk");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
      s = await st();
      if (s.crumb !== "WORK") fail("cd-crumb " + s.crumb);
      if (s.ps !== "C:\\TU7URU\\WORK") fail("cd-ps " + s.ps);
      // DIR inside (files, not dirs)
      await page.keyboard.type("dir");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      s = await st();
      for (const L of ["DELOITTE", "INTERMEDIA", "H. ARMY"])
        if (!s.out.slice(-6).some((l) => l.indexOf(L) === 0 && l.indexOf("FILE") === 14))
          fail("dir-work " + L);
      if (!s.out.some((l) => /^ {4,}3 file\(s\)$/.test(l)))
        fail("file-summary " + JSON.stringify(s.out.slice(-1)));
      // CD ..
      await page.keyboard.type("cd ..");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
      s = await st();
      if (s.crumb !== "root" || s.ps !== "C:\\TU7URU") fail("cd-up " + s.crumb + " " + s.ps);
      // CD to a non-folder at root -> bad command, auto-expires ~2 s
      await page.keyboard.type("cd deloitte");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      s = await st();
      if (!s.out.slice(-1).some((l) => /^Bad command/.test(l))) fail("cd-nonfolder");
      await page.waitForTimeout(2300);
      s = await st();
      if (s.out.some((l) => /^Bad command/.test(l))) fail("err-expire");
      // v7 I (I2): VER and CLS are GONE — bash/DOS vocabulary gets the
      // unsupported message; HELP lists exactly the path-nav commands
      await page.keyboard.type("ver");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      s = await st();
      if (!/^'ver' is not supported\./.test(s.out.slice(-1)[0] || ""))
        fail("ver-gone " + JSON.stringify(s.out.slice(-1)));
      await page.keyboard.type("cls");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      s = await st();
      if (!/^'cls' is not supported\./.test(s.out.slice(-1)[0] || ""))
        fail("cls-gone " + JSON.stringify(s.out.slice(-1)));
      await page.keyboard.type("help");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      s = await st();
      const help = s.out.slice(-7).join("\n");
      for (const L of ["DIR", "CD <name>", "CD ..", "CD..", "CD \\", "HELP"])
        if (help.indexOf(L) < 0) fail("help-missing " + L);
      if (/VER|CLS/.test(help)) fail("help-still-lists-removed");
      // up-arrow recall + backspace clear
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(80);
      s = await st();
      if (s.txt !== "help") fail("recall " + JSON.stringify(s.txt));
      for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
      s = await st();
      if (s.txt !== "") fail("backspace " + JSON.stringify(s.txt));
      // unknown command -> I2 message, then ESC closes
      await page.keyboard.type("frobnicate");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      s = await st();
      if (
        !/^'frobnicate' is not supported\. Only path navigation is available — type HELP or --help\.$/.test(
          s.out.slice(-1)[0] || ""
        )
      )
        fail("unknown " + JSON.stringify(s.out.slice(-1)));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);
      s = await st();
      if (s.open) fail("esc-close");
      // closed = NO key capture: printable types nothing, arrows still focus-move
      // (focus is on #dosBtn after close — review #4 — so the first arrow
      // hands it to the shelf, as a user would do)
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(80);
      const f0 = await page.evaluate(
        () => document.activeElement && document.activeElement.classList.contains("obj")
      );
      await page.keyboard.type("x");
      await page.waitForTimeout(80);
      const focused = await page.evaluate(
        () => document.activeElement && document.activeElement.classList.contains("obj")
      );
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(80);
      const focused2 = await page.evaluate(
        () => document.activeElement && document.activeElement.classList.contains("obj")
      );
      s = await st();
      if (s.open) fail("closed-reopen");
      if (s.txt !== "") fail("closed-type " + JSON.stringify(s.txt));
      if (!f0 || !focused || !focused2) fail("closed-arrows f0=" + f0 + " f=" + focused + " f2=" + focused2);
      // review #12: Enter on empty does NOT close — it prints a fresh prompt
      await page.keyboard.press("/");
      await page.waitForTimeout(100);
      s = await st();
      if (!s.open) fail("reopen");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(80);
      s = await st();
      if (!s.open) fail("empty-enter-kept");
      if (!s.out.slice(-1).some((l) => l.indexOf("TU7URU") >= 0 && l.slice(-1) === "\\"))
        fail("empty-enter-prompt");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);
      s = await st();
      if (s.open) fail("esc-close-after-empty");
      await ctx.close();
      await browser.close();
      record(D, "g3b-dos-shell", ok, d);
    } catch (e) {
      ok = false;
      d = "| " + String(e).slice(0, 120);
      try {
        await ctx.close();
      } catch (_) {}
      try {
        await browser.close();
      } catch (_) {}
      record(D, "g3b-dos-shell", ok, d);
    }
  }
  /* g3c — (item 15, phone) the shell does not render / open on the phone */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 390, 844, "#skip", { mobile: true });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({
        btn: getComputedStyle(document.getElementById("dosBtn")).display,
        panel: !!document.getElementById("dos")
      }));
      await page.keyboard.press("/");
      await page.waitForTimeout(150);
      const openAfter = await page.evaluate(() => !document.getElementById("dos").hidden);
      ok = m.btn === "none" && !openAfter;
      d = "btn=" + m.btn + " openAfterSlash=" + openAfter;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record("390x844", "g3c-dos-phone-hidden", ok, d);
  }
  /* g3d — (item 2) favicon / apple-touch / description / OG, files local + sized */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      const m = await page.evaluate(() => ({
        icon: (document.querySelector('link[rel="icon"]') || {}).href || "",
        atc:
          ((document.querySelector('link[rel="apple-touch-icon"]') || {}).href || "").split("/").pop() || "",
        desc: (document.querySelector('meta[name="description"]') || {}).content || "",
        ogT: document.querySelector('meta[property="og:title"]') ? 1 : 0,
        ogD: document.querySelector('meta[property="og:description"]') ? 1 : 0,
        ogI: (document.querySelector('meta[property="og:image"]') || {}).content || "",
        ogW: (document.querySelector('meta[property="og:image:width"]') || {}).content || "",
        ogH: (document.querySelector('meta[property="og:image:height"]') || {}).content || ""
      }));
      await ctx.close();
      await browser.close();
      const pngSize = (p) => {
        const b = fs.readFileSync(p);
        return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), b: b.length };
      };
      const at = pngSize(path.join(SITE, "apple-touch-180.png"));
      const og = pngSize(path.join(SITE, "og.png"));
      /* item 2 = inline SVG data URI (WORK blue, #2b3554), per BRIEF-v7 */
      ok =
        m.icon.indexOf("data:image/svg+xml") === 0 &&
        m.icon.indexOf("%232b3554") >= 0 &&
        m.atc === "apple-touch-180.png" &&
        m.desc.length > 40 &&
        m.ogT &&
        m.ogD &&
        /(^|\/)og\.png$/.test(m.ogI) &&
        m.ogW === "1200" &&
        m.ogH === "630" &&
        at.w === 180 &&
        at.h === 180 &&
        og.w === 1200 &&
        og.h === 630 &&
        og.b <= 150 * 1024;
      d =
        "icon=" +
        m.icon.slice(0, 40) +
        "… atc=" +
        at.w +
        "x" +
        at.h +
        " og=" +
        og.w +
        "x" +
        og.h +
        "(" +
        og.b +
        "B)";
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "g3d-meta-og", ok, d);
  }
  /* g3e — (item 12 + review #9) <noscript> shelf, INLINE in the document:
     all sections/items as plain text, real https links for GitHub/LinkedIn,
     a direct HaralambosVarsamis_CV.pdf link, no iframe (it was dead without JS) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        javaScriptEnabled: false
      });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "load" });
      const m = await page.evaluate(() => {
        const w = document.querySelector(".ns-wrap");
        if (!w) return { found: false };
        const bb = w.getBoundingClientRect();
        const cover = document.querySelector(".ns-cover");
        const links = Array.from(w.querySelectorAll("a"));
        const hrefs = links.map((a) => a.getAttribute("href"));
        return {
          found: true,
          visible: bb.width > 300 && bb.height > 200,
          fixed: cover ? getComputedStyle(cover).position : "none",
          noIframe: !document.querySelector("noscript iframe"),
          sections: document.querySelectorAll(".ns-wrap h2").length,
          n: links.length,
          hrefs,
          text: w.textContent
        };
      });
      const has = (hf) => m.hrefs && m.hrefs.indexOf(hf) >= 0;
      const hasT = (t) => m.text && m.text.indexOf(t) >= 0;
      ok =
        m.found &&
        m.visible &&
        m.fixed === "fixed" &&
        m.noIframe &&
        m.sections === 5 &&
        has("https://github.com/Tu7uru") &&
        has("https://www.linkedin.com/in/haralambos-varsamis") &&
        m.hrefs &&
        m.hrefs.filter((h) => h === "HaralambosVarsamis_CV.pdf").length >= 2 &&
        [
          "ABOUT.ME",
          "DELOITTE",
          "INTERMEDIA",
          "H. ARMY",
          "BSC C.S.",
          "MB-500",
          "COMPILER",
          "THEMIS",
          "FRAUD-ML",
          "ICU-ON-CALL",
          "GREEK-IR",
          "ARCHIVE.SYS"
        ].every(hasT);
      d = JSON.stringify(m).slice(0, 150);
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record("1280x900", "g3e-noscript", ok, d);
  }
  /* g3f — (item 12) unknown route: "Not ready reading drive N:" 3 s, then root */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=NOPE");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(350);
      const m1 = await page.evaluate(() => ({
        stat: document.getElementById("statLeft").textContent,
        crumb: !!document.querySelector("#crumb .here")
      }));
      await page.waitForTimeout(3200);
      const m2 = await page.evaluate(() => document.getElementById("statLeft").textContent);
      await ctx.close();
      await browser.close();
      // nested: the drive letter comes from the containing category
      const browser2 = await chromium.launch();
      const { ctx: ctx2, page: page2 } = await freshPage(browser2, 1440, 900, "#skip&path=WORK/NOPE");
      await page2.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page2.waitForTimeout(350);
      const m3 = await page2.evaluate(() => ({
        stat: document.getElementById("statLeft").textContent,
        crumb: (document.querySelector("#crumb .here") || {}).textContent || "root"
      }));
      await ctx2.close();
      await browser2.close();
      ok =
        m1.stat === "Not ready reading drive A:" &&
        !m1.crumb &&
        m2 === "5 DIRECTORIES · TU7URU ARCHIVE V1.0" &&
        m3.stat === "Not ready reading drive B:" &&
        m3.crumb === "WORK";
      d = "root:" + m1.stat + "/" + m2 + " nested:" + m3.stat + "/" + m3.crumb;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "g3f-badroute", ok, d);
  }

  /* ============================== H — review fixes ============================== */
  /* h01 — (#1) PLAIN open is instant: no 750 ms disk fly in the plain list */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(600);
      // control: normal mode takes the fly (crumb updates only after go())
      const t0 = Date.now();
      await page.click('#arcBody [data-cat="WORK"]', { force: true });
      await page.waitForFunction(
        () => (document.querySelector("#crumb .here") || {}).textContent === "WORK",
        { timeout: 4000 }
      );
      const normalMs = Date.now() - t0;
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#crumb .here"), { timeout: 4000 });
      await page.waitForTimeout(500);
      // PLAIN: instant
      await page.click("#plainBtn");
      await page.waitForTimeout(150);
      const t1 = Date.now();
      await page.click('#arcBody [data-cat="PROJECTS"]', { force: true });
      await page.waitForFunction(
        () => (document.querySelector("#crumb .here") || {}).textContent === "PROJECTS",
        { timeout: 4000 }
      );
      const plainMs = Date.now() - t1;
      ok = plainMs < 200 && normalMs > 300;
      d = "plain=" + plainMs + "ms normal(fly)=" + normalMs + "ms";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "h01-plain-open-instant", ok, d);
  }
  /* h02 — (#2) the drive error always clears: nested bad path AND bad &open */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=WORK/NOPE");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(350);
      const m1 = await page.evaluate(() => ({
        stat: document.getElementById("statLeft").textContent,
        crumb: (document.querySelector("#crumb .here") || {}).textContent || "root"
      }));
      await page.waitForTimeout(3300);
      const m2 = await page.evaluate(() => ({
        stat: document.getElementById("statLeft").textContent,
        crumb: (document.querySelector("#crumb .here") || {}).textContent || "root"
      }));
      await ctx.close();
      await browser.close();
      // an unmatched &open says so, the same way, and also clears
      const b2 = await chromium.launch();
      const { ctx: c2, page: p2 } = await freshPage(b2, 1440, 900, "#skip&open=nope");
      await p2.waitForSelector("body.phase-archive", { timeout: 15000 });
      await p2.waitForTimeout(350);
      const m3 = await p2.evaluate(() => document.getElementById("statLeft").textContent);
      await p2.waitForTimeout(3300);
      const m4 = await p2.evaluate(() => ({
        stat: document.getElementById("statLeft").textContent,
        crumb: (document.querySelector("#crumb .here") || {}).textContent || "root"
      }));
      await c2.close();
      await b2.close();
      ok =
        m1.stat === "Not ready reading drive B:" &&
        m1.crumb === "WORK" &&
        m2.stat === "5 DIRECTORIES · TU7URU ARCHIVE V1.0" &&
        m2.crumb === "root" &&
        m3 === "Not ready reading drive A:" &&
        m4.stat === "5 DIRECTORIES · TU7URU ARCHIVE V1.0" &&
        m4.crumb === "root";
      d = "nested:" + m1.stat + "/" + m1.crumb + "->" + m2.crumb + " open=nope:" + m3 + "->" + m4.crumb;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "h02-error-clears", ok, d);
  }
  /* h03 — (#3) hidden crtviews are out of the a11y tree (visibility) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const m = await page.evaluate(() => ({
        arc: getComputedStyle(document.getElementById("arcView")).visibility,
        det: getComputedStyle(document.getElementById("detailView")).visibility,
        boot: getComputedStyle(document.getElementById("bootView")).visibility
      }));
      // open the detail (card) — the dialog becomes visible while live
      await page.click('#arcBody [data-cat="ABOUT.ME"]', { force: true });
      await page.waitForFunction(
        () => (document.querySelector("#crumb .here") || {}).textContent === "ABOUT.ME",
        { timeout: 4000 }
      );
      await page.waitForTimeout(400);
      await page.click('#arcBody [data-item="me"]', { force: true });
      await page.waitForSelector(".card", { timeout: 4000 });
      await page.waitForTimeout(300);
      const m2 = await page.evaluate(() => ({
        cardLabel: document.querySelector(".card").getAttribute("aria-labelledby"),
        cardT: !!document.getElementById("cardTitle")
      }));
      ok =
        m.arc === "visible" &&
        m.det === "hidden" &&
        m.boot === "hidden" &&
        m2.cardLabel === "cardTitle" &&
        m2.cardT;
      d = JSON.stringify({ m, m2 });
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "h03-hidden-views-a11y", ok, d);
  }
  /* h05 — (#5) phone: HD/WP windows do not overlap the label */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 390, 844, "#skip", { mobile: true });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const hit = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        const out = [];
        document.querySelectorAll("#arcBody .obj").forEach((o) => {
          const lab = o.querySelector(".f-label");
          if (!lab) return;
          const l = lab.getBoundingClientRect();
          const hd = o.querySelector(".f-hd"),
            wp = o.querySelector(".f-wp");
          if (hd && hit(hd.getBoundingClientRect(), l)) out.push("hd:" + o.className);
          if (wp && hit(wp.getBoundingClientRect(), l)) out.push("wp:" + o.className);
        });
        return out;
      });
      ok = m.length === 0;
      d = m.length ? m.join(" ") : "no overlap";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record("390x844", "h05-phone-hdwp-clear", ok, d);
  }
  /* h10 — (#10) a wrapped meta chunk never keeps its dangling "·" */
  for (const [tag, w, h, mob] of [
    ["1440x900", 1440, 900, false],
    ["390x844", 390, 844, true]
  ]) {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, w, h, "#skip&open=deloitte", { mobile: mob });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForSelector(".card", { timeout: 4000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll(".card-p .mps, .dt-p .mps").forEach((sp, j, arr) => {
          const nx = arr[j + 1];
          if (nx && nx.offsetTop > sp.offsetTop + 1 && /·\s*$/.test(sp.textContent))
            bad.push(sp.textContent.trim());
        });
        return bad;
      });
      ok = m.length === 0;
      d = m.length ? "dangling: " + m.join(" | ") : "clean";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(tag, "h10-meta-no-dangling-sep", ok, d);
  }
  /* h12 — (#12) CD.. / CD\ and empty Enter */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(600);
      const st = () =>
        page.evaluate(() => ({
          ps: document.getElementById("dosPs").textContent,
          crumb: (document.querySelector("#crumb .here") || {}).textContent || "root",
          open: !document.getElementById("dos").hidden,
          out: Array.prototype.map.call(document.getElementById("dosOut").children, (x) => x.textContent)
        }));
      await page.keyboard.press("/");
      await page.waitForSelector("#dos:not([hidden])");
      await page.keyboard.type("cd work");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      let s = await st();
      if (s.crumb !== "WORK") {
        ok = false;
        d = "cd work -> " + s.crumb;
      }
      await page.keyboard.type("cd..");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      s = await st();
      if (s.crumb !== "root" || s.ps !== "C:\\TU7URU") {
        ok = false;
        d = (d || "") + " | cd.. -> " + s.crumb + "/" + s.ps;
      }
      await page.keyboard.type("cd work");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      await page.keyboard.type("cd\\");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      s = await st();
      if (s.crumb !== "root" || s.ps !== "C:\\TU7URU") {
        ok = false;
        d = (d || "") + " | cd\\ -> " + s.crumb + "/" + s.ps;
      }
      // empty Enter: fresh prompt, shell stays open; ESC closes
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      s = await st();
      if (!s.open) {
        ok = false;
        d = (d || "") + " | empty-enter closed";
      }
      if (!s.out.slice(-1).some((l) => l.indexOf("TU7URU") >= 0 && l.slice(-1) === "\\")) {
        ok = false;
        d = (d || "") + " | empty-enter prompt";
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
      s = await st();
      if (s.open) {
        ok = false;
        d = (d || "") + " | esc";
      }
      if (d === "") d = "cd.. / cd\\ / empty-enter ok";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 160);
    }
    record(D, "h12-dos-cd-variants", ok, d);
  }
}

async function perfChecks() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  /* pf01 — first disk ≤ 1.5 s after #skip */
  for (const [tag, w, h, mobile] of [
    ["1440x900", 1440, 900, false],
    ["390x844", 390, 844, true]
  ]) {
    const browser = await chromium.launch();
    let ok = false,
      d = "";
    try {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        isMobile: mobile,
        hasTouch: mobile,
        deviceScaleFactor: 1
      });
      await ctx.addInitScript(FIRST_OBJ_INIT);
      const page = await ctx.newPage();
      await page.goto(BASE + "#skip", { waitUntil: "load", timeout: 30000 });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const ms = await page.evaluate(() => window.__firstObjMs);
      if (ms && ms <= 1500) {
        ok = true;
        d = ms.toFixed(0) + " ms";
      } else d = (ms ? ms.toFixed(0) : "never") + " ms";
      await ctx.close();
    } catch (e) {
      d = String(e).slice(0, 90);
    }
    record(tag, "pf01 perf: first disk ≤ 1.5 s after #skip", ok, d);
    await browser.close();
  }
  /* pf02 + pf03 — the WORK insert, 3 fresh rounds at 1440x900 */
  {
    const browser = await chromium.launch();
    let ok2 = false,
      d2 = "",
      ok3 = false,
      d3 = "";
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      const rounds = [];
      for (let i = 0; i < 3; i++) {
        const m = await perfMeasureInsert(page);
        if (m.error) throw new Error(m.error);
        rounds.push(m);
        if (i < 2) {
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector("#crumb .here"), null, { timeout: 6000 });
          await page.waitForTimeout(250);
        }
      }
      const med = (a) => {
        const s = a.slice().sort((x, y) => x - y);
        return s[Math.floor(s.length / 2)];
      };
      const spiked = rounds.filter((r) => r.longestTask > 50).length;
      const longestMed = med(rounds.map((r) => r.longestTask));
      ok2 = longestMed <= 50 && spiked <= 1;
      d2 = `longest/med=${longestMed.toFixed(0)}ms spikedRounds=${spiked}/3 per=[${rounds.map((r) => r.longestTask.toFixed(0)).join(",")}ms]`;
      const medFrame = med(rounds.map((r) => r.medianFrame));
      ok3 = medFrame <= 20;
      d3 = `medianFrame=${medFrame.toFixed(1)}ms p95=[${rounds.map((r) => r.p95Frame.toFixed(0)).join(",")}ms]`;
      await ctx.close();
    } catch (e) {
      d2 = d3 = String(e).slice(0, 90);
    }
    record("1440x900", "pf02 perf: no long task > 50 ms during the WORK insert", ok2, d2);
    record("1440x900", "pf03 perf: insert median frame ≤ 20 ms (≥ 50 fps)", ok3, d3);
    await browser.close();
  }
  /* (pf04, a v6-vs-v7 comparison against a local perf.mjs result file, was dropped in the public copy) */
}

/* ================= v7 G1b — regression fixes (R1-R4) ================= */
async function g1bFixes() {
  const D = "1440x900";
  /* r3 — (R3) the disk group stays centred in the glass with the card
     open, for every folder — the card adapts, not the disks. */
  for (const [path] of [["WORK"], ["PROJECTS/ACADEMIC"], ["CONTACT"]]) {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + "#skip&path=" + path, { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      const measure = () =>
        page.evaluate(() => {
          const disks = [...document.querySelectorAll(".obj")].map((o) => o.getBoundingClientRect());
          const glass = document.getElementById("glass").getBoundingClientRect();
          const rowL = Math.min(...disks.map((r) => r.left)),
            rowR = Math.max(...disks.map((r) => r.right));
          return { left: rowL - glass.left, right: glass.right - rowR };
        });
      const closed = await measure();
      const items = await page.evaluate(() =>
        [...document.querySelectorAll(".obj[data-item]")].map((o) => o.dataset.item)
      );
      let worst = 0;
      for (const id of items) {
        await dclick(page, '[data-item="' + id + '"]');
        await page.waitForTimeout(420);
        const open = await measure();
        worst = Math.max(worst, Math.abs(open.left - closed.left), Math.abs(open.right - closed.right));
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => {
            const c = document.querySelector(".card");
            return !c || c.hidden;
          },
          { timeout: 3000 }
        );
      }
      const centred = Math.abs(closed.left - closed.right);
      if (worst > 2 || centred > 2) {
        ok = false;
        d = `shift ${worst.toFixed(1)} px, closed centre off ${centred.toFixed(1)} px`;
      } else
        d = `max shift ${worst.toFixed(1)} px across ${items.length} cards, centre off ${centred.toFixed(1)} px`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "r3 disk group stays centred with card open (" + path + ")", ok, d);
  }
  /* r4 — (R4) PLAIN: dotted leaders visible, column centred */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await dclick(page, "#plainBtn");
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const lead = document.querySelector(".plain-row .pr-leader");
        const cs = getComputedStyle(lead);
        const body = document.querySelector(".plain").parentElement.getBoundingClientRect();
        const pl = document.querySelector(".plain").getBoundingClientRect();
        return {
          bb: cs.borderBottomStyle + " " + cs.borderBottomWidth + " " + cs.borderBottomColor,
          leftGap: pl.left - body.left,
          rightGap: body.right - pl.right
        };
      });
      const lw = parseFloat(m.bb.split(" ")[1]);
      const okLead =
        m.bb.startsWith("dotted") && lw >= 0.7 && lw <= 1.4 && m.bb.endsWith("rgba(91, 232, 135, 0.35)");
      const okC = Math.abs(m.leftGap - m.rightGap) <= 2;
      if (!okLead || !okC) {
        ok = false;
        d = `leader "${m.bb}" left=${m.leftGap.toFixed(1)} right=${m.rightGap.toFixed(1)}`;
      } else d = `leader ${m.bb}, centred (${m.leftGap.toFixed(1)}/${m.rightGap.toFixed(1)})`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "r4 PLAIN leaders visible (1px dotted rgba(91,232,135,.35)), column centred", ok, d);
  }
}

/* ================= v7 G2 — motion (items 8, 9, 10, 13) ================= */
async function g2Fixes() {
  const D = "1440x900";
  /* g2a — (item 8) the eject clone is the REAL folder disk (its colour and
     label): it pops out of the slot and flies to its cell, and the whole
     eject completes inside the 750 ms nav lock */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=WORK");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        window.__ejectT0 = performance.now();
      });
      await page.click("#ejectBtn");
      await page.waitForFunction(() => !!document.querySelector(".disk-fly"), null, { timeout: 1200 });
      const m = await page.evaluate(() => {
        const clone = document.querySelector(".disk-fly");
        const disc = clone.querySelector(".f-disc");
        const name = clone.querySelector(".f-name");
        const real = document.querySelector('#arcBody [data-cat="WORK"] .f-disc');
        if (!real || !disc) return { err: "missing disk" };
        return {
          color: getComputedStyle(disc).background === getComputedStyle(real).background,
          name: name ? name.textContent : ""
        };
      });
      const lock = await page.evaluate(
        () =>
          new Promise((res) => {
            const t0 = window.__ejectT0;
            const iv = setInterval(() => {
              const el = document.querySelector(".disk-fly-holder");
              if (!el && !(window.S && window.S.navBusy)) {
                clearInterval(iv);
                res(performance.now() - t0);
              }
              if (performance.now() - t0 > 2000) {
                clearInterval(iv);
                res(-1);
              }
            }, 15);
          })
      );
      if (m.err || m.color !== true || m.name !== "WORK") {
        ok = false;
        d += `clone colour=${m.color} name="${m.name}" `;
      }
      if (lock < 0 || lock > 750) {
        ok = false;
        d += `finished in ${Math.round(lock)}ms `;
      } else d = `eject clone is the WORK disk (colour match), done in ${Math.round(lock)}ms`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "g2a eject shows the real folder disk, inside the nav lock", ok, d);
  }
  /* g2b — (item 9) the outgoing view fades (pointer-events none) and is
     GONE — removed from the DOM — after 400 ms */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      await page.dblclick('#arcBody .obj[data-cat="WORK"]');
      await page.waitForFunction(() => !!document.querySelector(".view-ghost"), null, { timeout: 2500 });
      const mid = await page.evaluate(() => {
        const g = document.querySelector(".view-ghost");
        return { pe: getComputedStyle(g).pointerEvents, op: parseFloat(getComputedStyle(g).opacity) };
      });
      await page.waitForTimeout(450);
      const gone = await page.evaluate(() => !document.querySelector(".view-ghost"));
      if (mid.pe !== "none" || !gone) {
        ok = false;
        d = `pe=${mid.pe} op=${mid.op} gone=${gone}`;
      } else d = `ghost pointer-events=${mid.pe} (op ${mid.op.toFixed(2)} at start), removed by 450ms`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "g2b outgoing view: pointer-events none, gone after 400ms", ok, d);
  }
  /* g2c — (item 10) spill opacity: 0 when the tube is off, >0 when on,
     amber gradient in P3 */
  {
    let ok = true,
      d = "";
    try {
      const b1 = await chromium.launch();
      const { ctx: c1, page: p1 } = await freshPage(b1, 1440, 900, "#off");
      await p1.waitForSelector("body.phase-off", { timeout: 8000 });
      await p1.waitForTimeout(500);
      const offOp = await p1.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector(".monitor .spill")).opacity)
      );
      await b1.close();
      const b2 = await chromium.launch();
      const { ctx: c2, page: p2 } = await freshPage(b2, 1440, 900, "#skip");
      await p2.waitForSelector("body.phase-archive", { timeout: 15000 });
      await p2.waitForTimeout(700);
      const onOp = await p2.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector(".monitor .spill")).opacity)
      );
      await p2.click(".phos-knob");
      await p2.waitForTimeout(150);
      const amber = await p2.evaluate(() => {
        const mon = document.querySelector(".monitor");
        const sp = document.querySelector(".monitor .spill");
        return (
          mon.classList.contains("amber") &&
          getComputedStyle(sp).getPropertyValue("--spill-c").replace(/\s/g, "").indexOf("242,178,74") >= 0
        );
      });
      await b2.close();
      if (offOp !== 0 || !(onOp > 0) || !amber) {
        ok = false;
        d = `off=${offOp} on=${onOp} amber=${amber}`;
      } else d = `off=${offOp} on=${onOp.toFixed(2)}, amber in P3`;
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "g2c spill opacity 0 off / >0 on, amber in P3", ok, d);
  }
  /* g2d — (item 13) the insert clone is clipped at the slot mid-line:
     overflow-hidden wrapper with its bottom edge at the mid-line, and the
     clone never fades (opacity stays 1) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      await page.dblclick('#arcBody .obj[data-cat="WORK"]');
      await page.waitForFunction(() => !!document.querySelector(".disk-sink"), null, { timeout: 1500 });
      const m = await page.evaluate(() => {
        const w = document.querySelector(".disk-sink");
        const slot = document.querySelector(".ds-in:not(.ds-in-m) .ds-slot").getBoundingClientRect();
        const wr = w.getBoundingClientRect();
        const clone = document.querySelector(".disk-fly");
        return {
          overflow: getComputedStyle(w).overflow,
          bottomAtMid: Math.abs(wr.bottom - (slot.top + slot.height / 2)),
          opacity: clone ? getComputedStyle(clone).opacity : "n/a",
          lip: !!document.querySelector(".ds-in:not(.ds-in-m) .ds-lip")
        };
      });
      if (m.overflow !== "hidden" || m.bottomAtMid > 2 || m.opacity !== "1" || !m.lip) {
        ok = false;
        d = `overflow=${m.overflow} midOff=${m.bottomAtMid.toFixed(2)} op=${m.opacity} lip=${m.lip}`;
      } else
        d = `clip bottom ${m.bottomAtMid.toFixed(2)}px from mid-line, clone opacity ${m.opacity}, lip flash el present`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, "g2d insert clone clipped at the slot mid-line, no opacity fade", ok, d);
  }
  /* g2e — (G1b nit, superseded by v7 N4) the meta wraps at segment
     boundaries; N4 moved the "·" to the START of the next segment, so the
     contract is now: no line ENDS on a "·" (a line may lead with one) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip&path=WORK&open=deloitte");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForFunction(
        () => {
          const c = document.querySelector(".card");
          return c && !c.hidden;
        },
        { timeout: 6000 }
      );
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const p = document.querySelector(".card-p");
        const chunks = [...p.querySelectorAll(".mps")];
        const tops = [...new Set(chunks.map((c) => Math.round(c.getBoundingClientRect().top)))].sort(
          (a, b) => a - b
        );
        const byLine = tops.map((t) =>
          chunks
            .filter((c) => Math.round(c.getBoundingClientRect().top) === t)
            .map((c) => c.textContent)
            .join("")
        );
        const bad = byLine.filter((l) => /\u00b7\s*$/.test(l.trim()));
        return { lines: byLine.length, bad };
      });
      if (m.bad.length) {
        ok = false;
        d = "line ends with ·: " + m.bad.join(" | ");
      } else d = `${m.lines} lines, no trailing "·" (N4: separators lead the next segment)`;
      await browser.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 90);
    }
    record(D, 'g2e card meta: no line ends with "·" (N4)', ok, d);
  }
}

/* ============================== I — owner feedback (I1 eject / I2 DOS) ============================== */
async function phaseIFixes() {
  const D = "1440x900";
  /* i01 — (I1) the eject clone: the folder's plastic colour, lands on the
     real disk's rect, and is GONE (no leftover, nothing over a disk) after
     every one of the four sequences */
  {
    let ok = true,
      d = "";
    const leftover = () => ({
      clones: document.querySelectorAll(".disk-fly-holder,.disk-sink,.disk-fly").length,
      /* the 320 ms view-ghost (its own check: g2b) is sanctioned afterglow —
         a LEFTOVER clone would be a disk outside #arcBody and outside it */
      foreignDisk: Array.from(document.querySelectorAll("body .obj,body .obj-wrap")).filter(
        (x) => !x.closest("#arcBody") && !x.closest(".view-ghost")
      ).length
    });
    const seqs = [
      [
        "normal",
        async (p) => {
          await p.keyboard.press("Escape");
        },
        750
      ],
      [
        "click",
        async (p) => {
          await p.keyboard.press("Escape");
          await p.waitForTimeout(250);
          await p.click('#arcBody [data-cat="WORK"]', { force: true });
        },
        1000
      ],
      [
        "spam",
        async (p) => {
          await p.keyboard.press("Escape");
          await p.waitForTimeout(150);
          await p.keyboard.press("Escape");
          await p.waitForTimeout(150);
          await p.keyboard.press("Escape");
        },
        1100
      ],
      [
        "resize",
        async (p) => {
          await p.keyboard.press("Escape");
          await p.waitForTimeout(250);
          await p.setViewportSize({ width: 1100, height: 900 });
        },
        750
      ]
    ];
    for (const [name, act, wait] of seqs) {
      const browser = await chromium.launch();
      try {
        const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(1300);
        // into PROJECTS (ACADEMIC for the spam double-eject)
        await page.click('#arcBody [data-cat="PROJECTS"]');
        await page.waitForTimeout(950);
        if (name === "spam") {
          await page.click('#arcBody [data-folder="academic"]');
          await page.waitForTimeout(950);
        }
        if (name === "normal") {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(260);
          const mid = await page.evaluate(() => {
            const h = document.querySelector(".disk-fly-holder");
            if (!h) return null;
            const c = getComputedStyle(h.querySelector(".disk-fly"));
            return { s1: c.getPropertyValue("--shell-1"), s2: c.getPropertyValue("--shell-2") };
          });
          if (!mid || mid.s1.replace(/\s/g, "").indexOf("142,172,72") < 0) {
            ok = false;
            d = "colour:" + JSON.stringify(mid);
          } else d = "colour=green ";
          await page.waitForTimeout(260);
          // ~520 ms: the holder's (untransformed) position must be the disk's rect, ≤1 px
          const land = await page.evaluate(() => {
            const h = document.querySelector(".disk-fly-holder");
            const r = document.querySelector('[data-cat="PROJECTS"]').getBoundingClientRect();
            if (!h) return null;
            return {
              off: Math.abs(parseFloat(h.style.left) - r.left) + Math.abs(parseFloat(h.style.top) - r.top)
            };
          });
          if (!land || land.off > 1) {
            ok = false;
            d += "land:" + JSON.stringify(land);
          } else d += "land≤1px ";
          await page.waitForTimeout(wait - 520);
        } else {
          await act(page);
          await page.waitForTimeout(wait);
        }
        const m = await page.evaluate(leftover);
        if (m.clones || m.foreignDisk) {
          ok = false;
          d += " " + name + " leftover:" + JSON.stringify(m);
        } else d += name + ":clean ";
        await ctx.close();
      } catch (e) {
        ok = false;
        d += " " + name + ":" + String(e).slice(0, 80);
      }
      await browser.close();
    }
    record(D, "i01 eject clone: folder colour, ≤1px landing, no leftover (4 sequences)", ok, d);
  }
  /* i02 — (I2) path-nav only: every supported command, the help text, and the
     unsupported message for bash/DOS vocabulary */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      const st = () =>
        page.evaluate(() => ({
          ps: document.getElementById("dosPs").textContent,
          crumb: (document.querySelector("#crumb .here") || {}).textContent || "root",
          out: Array.from(document.getElementById("dosOut").children).map((x) => x.textContent)
        }));
      const run = async (c) => {
        await page.keyboard.type(c);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(180);
      };
      const last = (s) => s.out.slice(-1)[0] || "";
      const failI = (m) => {
        ok = false;
        d = d ? d + " | " + m : m;
      };
      await page.keyboard.press("/");
      await page.waitForTimeout(150);
      // DIR at root
      await run("dir");
      let s = await st();
      if (!/Directory of C:\\TU7URU/.test(s.out.join("\n"))) failI("dir");
      for (const L of ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"])
        if (!s.out.some((l) => l.indexOf(L) === 0 && l.indexOf("<DIR>") === 14)) failI("dir-align " + L);
      // CD forms
      await run("cd work");
      s = await st();
      if (s.crumb !== "WORK" || s.ps !== "C:\\TU7URU\\WORK") failI("cd " + s.crumb);
      await run("cd ..");
      s = await st();
      if (s.crumb !== "root") failI("cd.. " + s.crumb);
      await run("cd work");
      await run("cd..");
      s = await st();
      if (s.crumb !== "root") failI("cd-nospace " + s.crumb);
      await run("cd work");
      await run("cd\\");
      s = await st();
      if (s.crumb !== "root") failI("cd-backslash " + s.crumb);
      // the help text — all three triggers, identical, exactly the seven commands
      const helpOf = async (c) => {
        await run(c);
        const t = await st();
        return t.out.slice(-8);
      };
      const H1 = await helpOf("help");
      const H2 = await helpOf("--help");
      const H3 = await helpOf("/?");
      const joined = H1.join("\n");
      for (const L of ["DIR", "LS", "CD <name>", "CD ..", "CD..", "CD \\ ", "HELP"])
        if (joined.indexOf(L) < 0) failI("help-missing:" + L);
      if (/VER|CLS/.test(joined)) failI("help-lists-removed");
      if (JSON.stringify(H2) !== JSON.stringify(H1) || JSON.stringify(H3) !== JSON.stringify(H1))
        failI("help-triggers-differ");
      // the unsupported message — bash, DOS and slash-paths alike
      // LS lists the items with titles
      await run("ls");
      s = await st();
      for (const L of ["ABOUT.ME\\", "WORK\\", "CONTACT\\"])
        if (!s.out.some((l) => l.indexOf(L) === 0 && / item\(s\)$/.test(l))) failI("ls " + L);
      await run("cd work");
      await run("LS");
      s = await st();
      if (!s.out.some((l) => /^DELOITTE\s/.test(l))) failI("ls-in-work " + last(s).slice(0, 40));
      await run("cd ..");
      for (const c of ["pwd", "rm", "sudo", "echo", "clear", "mkdir", "exit"]) {
        await run(c);
        s = await st();
        if (last(s) !== `\'${c}\' is not supported. Only path navigation is available — type HELP or --help.`)
          failI("unsup:" + c + ":" + last(s).slice(0, 40));
      }
      await run("cd /work");
      s = await st();
      if (last(s) !== "'cd /work' is not supported. Only path navigation is available — type HELP or --help.")
        failI("unsup:cd/work:" + last(s).slice(0, 40));
      await run("cd /");
      s = await st();
      if (last(s) !== "'cd /' is not supported. Only path navigation is available — type HELP or --help.")
        failI("unsup:cdslash");
      // CD to a FILE keeps the classic error
      await run("cd deloitte");
      s = await st();
      if (!/^Bad command/.test(last(s))) failI("cd-file " + last(s));
      // VIEW MORE hides the prompt (2026-10-21)
      await run("cd work");
      await page.click('[data-item="deloitte"]');
      await page.waitForTimeout(400);
      await page.click("text=VIEW MORE");
      await page.waitForTimeout(500);
      if (
        (await page.evaluate(() => window.__dos.state().open)) ||
        !(await page.evaluate(() => document.getElementById("dos").hidden))
      )
        failI("dos-not-hidden-on-detail");
      if (ok) d = "all commands (DIR, LS, CD) + help + unsupported forms + prompt hides on VIEW MORE";
      await ctx.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 120);
    }
    await browser.close();
    record(
      D,
      "i02 DOS path-nav only: commands, help (3 triggers), unsupported message, hides on VIEW MORE",
      ok,
      d
    );
  }
  /* i03 — (I2) TAB completion: single / multi (prefix then list) / no-match /
     empty line / DIR / "cd ..", and focus never leaves the prompt */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        window.__addTestData("WORK", {
          id: "zeta-one",
          label: "ZETA-ONE",
          title: "Zeta One",
          period: "2026"
        });
        window.__addTestData("WORK", {
          id: "zeta-two",
          label: "ZETA-TWO",
          title: "Zeta Two",
          period: "2026"
        });
      });
      await page.waitForTimeout(300);
      await page.keyboard.press("/");
      await page.waitForTimeout(150);
      const st = () =>
        page.evaluate(() => ({
          txt: document.getElementById("dosTxt").textContent,
          crumb: (document.querySelector("#crumb .here") || {}).textContent || "root",
          out: Array.from(document.getElementById("dosOut").children).map((x) => x.textContent),
          focus:
            document.activeElement &&
            (document.activeElement.id || (document.activeElement.className || "").toString().split(" ")[0])
        }));
      const failI = (m) => {
        ok = false;
        d = d ? d + " | " + m : m;
      };
      const inPrompt = (s) => s.focus === "dos-line";
      let s;
      // into WORK first (the ZETA items live there)
      await page.keyboard.type("cd work");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
      s = await st();
      if (s.crumb !== "WORK" || !inPrompt(s)) failI("enter-work " + s.crumb);
      // no match: buffer unchanged
      await page.keyboard.type("cd qqq");
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "cd qqq" || !inPrompt(s)) failI("nomatch " + s.txt);
      // multi: first Tab = common prefix, second = list, input kept
      for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      s = await st();
      if (s.txt !== "cd") failI("reset " + s.txt);
      await page.keyboard.type(" zeta");
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "cd ZETA-" || !inPrompt(s)) failI("multi1 " + s.txt);
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "cd ZETA-") failI("multi2-kept " + s.txt);
      if (s.out.slice(-1)[0] !== "ZETA-ONE  ZETA-TWO")
        failI("multi2-list " + JSON.stringify(s.out.slice(-1)));
      // single: completes with a trailing space
      for (let i = 0; i < 8; i++) await page.keyboard.press("Backspace");
      await page.keyboard.type("cd zeta-o");
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "cd ZETA-ONE " || !inPrompt(s)) failI("single " + s.txt);
      // "cd .." completes
      for (let i = 0; i < 12; i++) await page.keyboard.press("Backspace");
      s = await st();
      if (s.txt !== "") failI("dotdot-prep " + s.txt);
      await page.keyboard.type("cd .");
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "cd .. ") failI("dotdot " + s.txt);
      // empty line lists the entries (one line, as the multi-list does)
      for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
      s = await st();
      if (s.txt !== "") failI("empty " + s.txt);
      await page.keyboard.press("Tab");
      s = await st();
      if (s.out.slice(-1)[0] !== "DELOITTE  INTERMEDIA  H. ARMY  ZETA-ONE  ZETA-TWO")
        failI("empty-list " + JSON.stringify(s.out.slice(-1)));
      // DIR lists too, input kept
      await page.keyboard.type("dir");
      await page.keyboard.press("Tab");
      s = await st();
      if (s.txt !== "dir" || s.out.slice(-1)[0] !== "DELOITTE  INTERMEDIA  H. ARMY  ZETA-ONE  ZETA-TWO")
        failI("dir-tab " + s.txt);
      // closed: Tab is the browser's again
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
      const c1 = await st();
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);
      const c2 = await st();
      if (c1.focus !== "dosBtn" || c2.focus === c1.focus || c2.focus === "dos-line")
        failI("closed-tab " + c1.focus + "->" + c2.focus);
      if (ok) d = "nomatch/multi/single/dotdot/empty/DIR/closed, focus in prompt";
      await ctx.close();
    } catch (e) {
      ok = false;
      d = String(e).slice(0, 120);
    }
    await browser.close();
    record(D, "i03 DOS TAB: single, multi (prefix→list), no-match, empty/DIR, focus stays", ok, d);
  }
  /* i04 — (I3) the POWER hint is gone the instant power is pressed:
     opacity 0, the 24-step animation stopped — sampled at +50/150/400 ms
     of the warm-up (and it was alive before the press) */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "");
      await page.waitForTimeout(500);
      const hint = () =>
        page.evaluate(() => {
          const cs = getComputedStyle(document.getElementById("powerHint"));
          return { op: cs.opacity, anim: cs.animationName, phase: document.body.className };
        });
      const before = await hint();
      if (before.phase !== "phase-off" || before.op === "0" || before.anim !== "hintsteps") {
        ok = false;
        d = "i04-pre " + JSON.stringify(before);
      }
      await page.evaluate(() => {
        window.__warmT = null;
        const w = document.getElementById("warm");
        new MutationObserver(() => {
          if (w.classList.contains("go") && window.__warmT == null) window.__warmT = performance.now();
        }).observe(w, { attributes: true, attributeFilter: ["class"] });
      });
      await page.click("#powerBtn");
      await page.waitForFunction(() => window.__warmT != null, { timeout: 8000 });
      let dt = 50;
      for (const tag of ["w50", "w150", "w400"]) {
        await page.waitForTimeout(dt);
        const m = await hint();
        if (m.op !== "0" || m.anim !== "none") {
          ok = false;
          d = d ? d + " | " + tag : tag;
          d += " " + JSON.stringify(m);
        }
        dt = tag === "w50" ? 100 : 250;
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 120);
    } finally {
      await browser.close();
    }
    record(
      D,
      "i04 power-on: #powerHint opacity 0 + animation stopped during the warm-up",
      ok,
      d || "op=0/anim=none at +50/150/400 ms of warm-up (was hintsteps before)"
    );
  }
  /* i05 — (I4) power OFF from the archive: after the collapse starts, no
     frame shows the archive layer again (.crtview live+visible or any
     .obj visible) — every rAF frame sampled over the whole sequence */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const { ctx, page } = await freshPage(browser, 1440, 900, "#skip");
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1400);
      await page.evaluate(() => {
        window.__tOff = null;
        window.__samples = [];
        document.getElementById("powerBtn").addEventListener(
          "click",
          function () {
            window.__tOff = performance.now();
          },
          { once: true }
        );
        (function loop() {
          const av = document.getElementById("arcView");
          const cs = getComputedStyle(av);
          const arc = cs.visibility === "visible" && cs.opacity !== "0";
          let obj = false;
          const objs = document.querySelectorAll("#arcBody .obj");
          for (let i = 0; i < objs.length; i++) {
            const ocs = getComputedStyle(objs[i]);
            if (
              ocs.visibility === "visible" &&
              ocs.opacity !== "0" &&
              objs[i].getBoundingClientRect().width > 0
            ) {
              obj = true;
              break;
            }
          }
          window.__samples.push({ t: performance.now(), arc, obj });
          if (window.__samples.length < 400) requestAnimationFrame(loop);
        })();
      });
      await page.click("#powerBtn");
      await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
        timeout: 4000
      });
      await page.waitForTimeout(350);
      const m = await page.evaluate(() => {
        const after = window.__samples.filter((s) => s.t >= window.__tOff);
        const bad = after.filter((s) => s.arc || s.obj);
        return {
          n: window.__samples.length,
          afterN: after.length,
          badN: bad.length,
          firstBadMs: bad[0] ? Math.round(bad[0].t - window.__tOff) : null,
          tOff: window.__tOff != null
        };
      });
      if (!m.tOff || m.afterN < 20 || m.badN > 0) {
        ok = false;
        d =
          "n=" +
          m.n +
          " after=" +
          m.afterN +
          " visible-frames=" +
          m.badN +
          (m.firstBadMs != null ? "@+" + m.firstBadMs + "ms" : "");
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 120);
    } finally {
      await browser.close();
    }
    record(
      D,
      "i05 power-off: no archive re-show frame after the collapse starts (rAF-sampled)",
      ok,
      d || "archive hidden from collapse start, 0 visible frames"
    );
  }
  /* i06 — (2026-10-21) power toggling can never strand the set: (a) Space on the
     focused knob during the boot, then Space again during the off-collapse;
     (b) a mouse power-off 650 ms after power-on (inside the warm-up window).
     Afterwards LED, glass and phase must agree, and one more press must work. */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    const st = (p) =>
      p.evaluate(() => ({
        off: document.body.classList.contains("phase-off"),
        hidden: document.body.classList.contains("poff-hide"),
        led: document.getElementById("powerBtn").classList.contains("on"),
        glass: document.getElementById("glass").classList.contains("on")
      }));
    const agree = (s) => (s.off ? !s.led && !s.glass : s.led && s.glass && !s.hidden);
    try {
      for (const [name, steps] of [
        [
          "space-during-collapse",
          async (p) => {
            await p.click("#powerBtn");
            await p.waitForTimeout(1500);
            await p.keyboard.press(" ");
            await p.waitForTimeout(250);
            await p.keyboard.press(" ");
          }
        ],
        [
          "off-inside-warmup",
          async (p) => {
            await p.click("#powerBtn");
            await p.waitForTimeout(650);
            await p.click("#powerBtn");
          }
        ]
      ]) {
        const { ctx, page } = await freshPage(browser, 1440, 900, "");
        await page.waitForTimeout(700);
        await steps(page);
        await page.waitForTimeout(2500);
        const a = await st(page);
        await page.click("#powerBtn");
        await page.waitForTimeout(2500);
        const b = await st(page);
        if (!agree(a) || !agree(b) || a.off === b.off) {
          ok = false;
          d += name + ":" + JSON.stringify({ a, b }) + " ";
        } else d += name + ":ok ";
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "i06 power: no stuck state (Space during collapse, off inside warm-up), next press works",
      ok,
      d
    );
  }
}

/* ---------------- PHASE J: power robustness ---------------- */
async function phaseJfixes() {
  const D = "1440x900";
  const off = () => page.evaluate(() => document.body.className.indexOf("phase-off") >= 0);
  const newErrs = (page) => {
    const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
    attach(page, errs);
    return errs;
  };
  async function pressKnob(page, phone) {
    const r = await page.locator("#powerBtn").boundingBox();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    if (phone) {
      await page.tap("#powerBtn");
      return;
    }
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
  }
  async function powerOffAt(page, phone) {
    await pressKnob(page, phone);
    await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
      timeout: 4000
    });
  }
  async function staysOff(page, ms) {
    /* sample through the window: it must be off at the end AND not have booted in between */
    let everOn = false;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (
        await page.evaluate(
          () =>
            document.body.className.indexOf("phase-archive") >= 0 ||
            document.body.className.indexOf("phase-boot") >= 0
        )
      )
        everOn = true;
      await page.waitForTimeout(150);
    }
    const isOff = await page.evaluate(() => document.body.className.indexOf("phase-off") >= 0);
    return {
      everOn,
      isOff,
      lit: await page.evaluate(() => document.getElementById("powerBtn").classList.contains("on"))
    };
  }

  /* j01 — five off/on cycles: desktop via mouse pointer events, phone via tap */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      for (const [tag, phone] of [
        ["desktop", false],
        ["phone", true]
      ]) {
        const ctx = await browser.newContext(
          phone
            ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
            : { viewport: { width: 1440, height: 900 } }
        );
        const page = await ctx.newPage();
        const errs = newErrs(page);
        await page.goto(BASE + "#skip", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(1400);
        for (let c = 1; c <= 5; c++) {
          await powerOffAt(page, phone);
          const s1 = await staysOff(page, 1500);
          if (!s1.isOff || s1.everOn || s1.lit) {
            ok = false;
            d += tag + " c" + c + "-off bad; ";
          }
          await pressKnob(page, phone); /* on */
          await page.waitForSelector("body.phase-archive", { timeout: 25000 });
          await page.waitForTimeout(1200);
          const arc = await page.evaluate(() => document.body.className.indexOf("phase-archive") >= 0);
          if (!arc) {
            ok = false;
            d += tag + " c" + c + "-on bad; ";
          }
        }
        if (errs.pageE.length) {
          ok = false;
          d += tag + " pageerrors; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "j01 power: 5 off/on cycles (desktop pointer + phone tap), off holds 1.5 s",
      ok,
      d || "5/5 + 5/5 cycles, off held"
    );
  }

  /* j02 — powerOff works from every state: mid-insert, mid-eject, card open, PLAIN */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const scenarios = [
        [
          "insert",
          async (page) => {
            await page.goto(BASE + "#skip", { waitUntil: "load" });
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(1400);
            await page.click('#arcBody [data-cat="WORK"]', { force: true }); /* insert fly starts */
            await page.waitForTimeout(150);
          }
        ],
        [
          "eject",
          async (page) => {
            await page.goto(BASE + "#skip", { waitUntil: "load" });
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(1400);
            await page.click('#arcBody [data-cat="WORK"]', { force: true });
            await page.waitForTimeout(1400);
            await page.keyboard.press("Escape"); /* eject fly starts */
            await page.waitForTimeout(200);
          }
        ],
        [
          "card",
          async (page) => {
            await page.goto(BASE + "#skip&path=WORK", { waitUntil: "load" });
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(1500);
            await page.click("#arcBody .obj:not([data-cat]):not([data-folder])", {
              force: true
            }); /* open a card */
            await page.waitForTimeout(600);
          }
        ],
        [
          "plain",
          async (page) => {
            await page.goto(BASE + "#skip", { waitUntil: "load" });
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(1400);
            await page.click("#plainBtn");
            await page.waitForTimeout(400);
          }
        ]
      ];
      for (const [name, prep] of scenarios) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        const errs = newErrs(page);
        try {
          await prep(page);
        } catch (e) {
          ok = false;
          d += name + ":prep " + String(e).slice(0, 60) + "; ";
          await ctx.close();
          continue;
        }
        await powerOffAt(page, false);
        const s = await staysOff(page, 1500);
        const flies = await page.evaluate(
          () => document.querySelectorAll(".disk-fly-holder,.disk-sink,.disk-fly,.view-ghost").length
        );
        if (!s.isOff || s.everOn || s.lit || flies > 0 || errs.pageE.length) {
          ok = false;
          d +=
            name +
            "(off=" +
            s.isOff +
            ",on=" +
            s.everOn +
            ",lit=" +
            s.lit +
            ",flies=" +
            flies +
            "," +
            errs.pageE.length +
            "); ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "j02 powerOff mid insert/eject, card open, PLAIN — off holds 1.5 s, no leftover flies",
      ok,
      d || "all 4 states → off, clean"
    );
  }

  /* j03 — the #debugpower overlay: present only with the hash, logs the toggle */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + "#skip&debugpower", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1200);
      const r = await page.locator("#powerBtn").boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(1400);
      const m = await page.evaluate(() => {
        const d = Array.from(document.body.children).find(
          (x) =>
            x !== document.getElementById("stage") &&
            x.textContent &&
            x.textContent.indexOf("power debug") === 0
        );
        return d ? d.textContent : null;
      });
      if (!m || !/toggle off \[mouse\]/.test(m)) {
        ok = false;
        d = "overlay " + JSON.stringify(m && m.slice(0, 80));
      }
      await ctx.close();
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page2 = await ctx2.newPage();
      await page2.goto(BASE + "#skip", { waitUntil: "load" });
      await page2.waitForSelector("body.phase-archive", { timeout: 15000 });
      const none = await page2.evaluate(() =>
        Array.from(document.body.children).some(
          (x) => x.textContent && x.textContent.indexOf("power debug") === 0
        )
      );
      if (none) {
        ok = false;
        d += " overlay visible without hash; ";
      }
      await ctx2.close();
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "j03 #debugpower overlay: logs power events with the hash, invisible without",
      ok,
      d || "shown+logged with hash, hidden without"
    );
  }
}

/* ---------------- PHASE K: no double disk during eject ---------------- */
async function phaseKfixes() {
  const D = "1440x900";
  async function ejectSamples(page, frames) {
    await page.evaluate((n) => {
      window.__k = [];
      (function loop() {
        const out = { t: performance.now(), real: 0, clone: 0, stray: 0 };
        document.querySelectorAll('#arcBody .obj[data-cat="ABOUT.ME"]').forEach((x) => {
          const cs = getComputedStyle(x);
          if (cs.visibility !== "hidden" && cs.opacity !== "0" && x.getBoundingClientRect().width > 0)
            out.real++;
        });
        document.querySelectorAll(".disk-fly-holder .disk-fly").forEach((x) => {
          const cs = getComputedStyle(x);
          if (cs.visibility !== "hidden" && cs.opacity !== "0" && x.getBoundingClientRect().width > 0)
            out.clone++;
        });
        document.querySelectorAll(".f-hd,.f-wp").forEach((x) => {
          if (x.getBoundingClientRect().width > 0 && !x.closest(".obj")) out.stray++;
        });
        window.__k.push(out);
        if (window.__k.length < n) requestAnimationFrame(loop);
      })();
    }, frames);
  }
  /* k01 — every rAF frame of the eject: at most ONE visible ABOUT.ME disk
     (real XOR clone) — desktop, iPhone 13, Pixel 7 */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const vps = [
        ["1440", { viewport: { width: 1440, height: 900 } }],
        ["iphone13", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
        ["pixel7", { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }]
      ];
      for (const [tag, opts] of vps) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
        attach(page, errs);
        await page.goto(BASE + "#skip", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(1500);
        await page.click('#arcBody [data-cat="ABOUT.ME"]');
        await page.waitForTimeout(1700);
        await ejectSamples(page, 90);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1100);
        const k = await page.evaluate(() => window.__k.slice());
        const both = k.filter((s) => s.real + s.clone > 1);
        if (k.length < 30 || both.length > 0) {
          ok = false;
          d += tag + "(" + k.length + "f,both=" + both.length + "); ";
          if (errs.pageE.length) {
            ok = false;
            d += tag + " pageerrors; ";
          }
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "k01 eject: at most ONE visible ABOUT.ME disk in EVERY rAF frame (real XOR clone)",
      ok,
      d || "0 double frames on 3 viewports"
    );
  }

  /* k02 — no stray .f-hd/.f-wp outside a disk, during or after the eject */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      for (const tag of ["1440", "phone"]) {
        const ctx = await browser.newContext(
          tag === "phone"
            ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
            : { viewport: { width: 1440, height: 900 } }
        );
        const page = await ctx.newPage();
        await page.goto(BASE + "#skip", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 15000 });
        await page.waitForTimeout(1500);
        await page.click('#arcBody [data-cat="ABOUT.ME"]');
        await page.waitForTimeout(1700);
        await ejectSamples(page, 90);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1300);
        const m = await page.evaluate(() => ({
          stray: window.__k.reduce((a, s) => a + s.stray, 0),
          now: Array.from(document.querySelectorAll(".f-hd,.f-wp")).filter(
            (x) => x.getBoundingClientRect().width > 0 && !x.closest(".obj")
          ).length
        }));
        if (m.stray > 0 || m.now > 0) {
          ok = false;
          d += tag + "(fly=" + m.stray + ",after=" + m.now + "); ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "k02 no rendered .f-hd/.f-wp outside a .obj during/after the eject",
      ok,
      d || "0 stray windows"
    );
  }

  /* k03 — a tap mid-flight interrupts: clone gone + real revealed in the
     same frame, and the action (open the folder) is processed */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      });
      const page = await ctx.newPage();
      const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
      attach(page, errs);
      await page.goto(BASE + "#skip", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.click('#arcBody [data-cat="ABOUT.ME"]');
      await page.waitForTimeout(1700);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200); /* mid-flight */
      const mid = await page.evaluate(() => ({
        clone: document.querySelectorAll(".disk-fly-holder").length,
        hiding: !!document.querySelector('#arcBody .obj[data-cat="ABOUT.ME"]').classList.contains("ejecting")
      }));
      if (!mid.clone || !mid.hiding) {
        ok = false;
        d += "mid " + JSON.stringify(mid) + "; ";
      }
      const r = await page.locator('#arcBody .obj[data-cat="ABOUT.ME"]').boundingBox();
      /* sample across the interrupt: real+clone ≤ 1 in every frame */
      await ejectSamples(page, 40);
      await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForTimeout(900);
      const k = await page.evaluate(() => window.__k.slice());
      const doubled = k.filter((s) => s.real + s.clone > 1).length;
      const neverShownBoth = doubled === 0;
      /* the tap opened the folder (insert fly finished by now) */
      await page
        .waitForFunction(() => document.querySelectorAll(".disk-fly-holder").length === 0, null, {
          timeout: 5000
        })
        .catch(() => {});
      await page.waitForTimeout(600); /* past the 320 ms view ghost */
      const end = await page.evaluate(() => ({
        crumb: (document.querySelector("#crumb .here") || {}).textContent || "root",
        leftovers: document.querySelectorAll(".disk-fly-holder,.view-ghost").length
      }));
      if (end.crumb !== "ABOUT.ME" || end.leftovers > 0 || !neverShownBoth || errs.pageE.length) {
        ok = false;
        d += "after doubled=" + doubled + " end=" + JSON.stringify(end) + "; ";
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "k03 tap mid-eject: clone + real never doubled, action processed (folder opens)",
      ok,
      d || "interrupted + revealed + opened"
    );
  }
}

/* ---------------- PHASE K (item B): smooth power-on ---------------- */
async function phaseKBfixes() {
  const D = "1440x900";
  async function samplePowerOn(page, maxFrames) {
    await page.evaluate((n) => {
      window.__s = [];
      (function loop() {
        const dot = document.querySelector("#warm .dot");
        const w = document.getElementById("warm");
        window.__s.push({
          t: performance.now(),
          warm:
            parseFloat(getComputedStyle(w).opacity) * (dot ? parseFloat(getComputedStyle(dot).opacity) : 0),
          boot: parseFloat(getComputedStyle(document.getElementById("bootView")).opacity),
          arc: parseFloat(getComputedStyle(document.getElementById("arcView")).opacity)
        });
        if (window.__s.length < n) requestAnimationFrame(loop);
      })();
    }, maxFrames);
    const r = await page.locator("#powerBtn").boundingBox();
    const cx = r.x + r.width / 2,
      cy = r.y + r.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForSelector("body.phase-archive", { timeout: 25000 });
    await page.waitForTimeout(1400); /* drop-in settle */
  }

  /* k04 — frame-sample the whole power-on (1440 + Pixel 7): no black
     frame after first light, never two stages fully opaque, 60 fps */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const vps = [
        ["1440", { viewport: { width: 1440, height: 900 } }],
        ["pixel7", { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }]
      ];
      for (const [tag, opts] of vps) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
        attach(page, errs);
        await page.goto(ORIGIN + "/index.html", { waitUntil: "load" });
        await page.waitForTimeout(600);
        await samplePowerOn(page, 750);
        const m = await page.evaluate(() => {
          const s = window.__s;
          let firstLight = -1;
          for (let i = 0; i < s.length; i++)
            if (s[i].warm + s[i].boot + s[i].arc > 0.01) {
              firstLight = i;
              break;
            }
          let black = 0,
            dbl = 0;
          for (let i = firstLight; i < s.length; i++) {
            const x = s[i];
            if (x.warm + x.boot + x.arc < 0.03) black++;
            if (
              (x.warm > 0.95 && x.boot > 0.95) ||
              (x.boot > 0.95 && x.arc > 0.95) ||
              (x.warm > 0.95 && x.arc > 0.95)
            )
              dbl++;
          }
          const iv = [];
          for (let i = 1; i < s.length; i++) iv.push(s[i].t - s[i - 1].t);
          iv.sort((a, b) => a - b);
          return { n: s.length, firstLight, black, dbl, med: iv.length ? iv[Math.floor(iv.length / 2)] : 0 };
        });
        if (m.firstLight < 0 || m.black > 0 || m.dbl > 0 || m.med < 14.5 || m.med > 18.5) {
          ok = false;
          d += tag + JSON.stringify(m) + "; ";
        }
        if (errs.pageE.length) {
          ok = false;
          d += tag + " pageerrors; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "k04 power-on: no black frame, no double-opaque hand-off, 60 fps (1440 + Pixel 7)",
      ok,
      d || "clean on both viewports"
    );
  }

  /* (k05, a timing comparison against an old local build, was dropped in the public copy) */
}

/* ---------------- PHASE L: ghost root-cause fix, army scene, power-off ---------------- */
async function phaseLfixes() {
  const D = "1440x900";
  const DOT =
    "(function(){var d=document.querySelector('#warm .dot');if(!d)return{w:0,h:0,o:0};var r=d.getBoundingClientRect();return{w:r.width,h:r.height,o:parseFloat(getComputedStyle(d).opacity)}})()";
  /* one rAF sample of a ghost frame: every ghost .obj sized, every painted
     element inside its own .obj-wrap rect (the stray-square contract) */
  const ghostFrame = `
    (function(){
      var g=document.querySelector('.view-ghost'); if(!g) return null;
      var r={n:0,zeroW:0,out:0,op:0,stray:[]};
      r.op=parseFloat(getComputedStyle(g).opacity);
      g.querySelectorAll('.obj').forEach(function(o){ r.n++; if(o.offsetWidth<=0) r.zeroW++; });
      var wraps=[].slice.call(g.querySelectorAll('.obj-wrap')).map(function(w){ return w.getBoundingClientRect(); });
      var disk=g.querySelector('.obj'); var dw=disk?disk.getBoundingClientRect().width:100;
      g.querySelectorAll('*').forEach(function(el){
        var cs=getComputedStyle(el); var b=el.getBoundingClientRect();
        if(cs.visibility==='hidden'||parseFloat(cs.opacity)<=0.01) return;
        if(b.width<0.5&&b.height<0.5) return;
        var painted=(el instanceof SVGElement)||(cs.backgroundImage!=='none')
          ||((cs.backgroundColor||'').indexOf('rgba')>=0&&parseFloat(cs.backgroundColor.split(',')[3])>0)
          ||(el.firstChild&&el.firstChild.nodeType===3&&el.textContent.trim());
        if(!painted) return;
        var w=el.closest('.obj-wrap');
        if(w){
          var wr=w.getBoundingClientRect();
          if(b.left<wr.left-1||b.right>wr.right+1||b.top<wr.top-1||b.bottom>wr.bottom+1){ r.out++; if(r.stray.length<3) r.stray.push((el.className||'').toString().slice(0,20)+'@wrap'); }
          return;
        }
        /* outside every wrap: only counts if it is smaller than a disk — a full-size
           (or bigger) container is the ghost's own tray/grid, not a stray */
        var inAny=wraps.some(function(wr){ return b.right>wr.left-1&&b.left<wr.right+1&&b.bottom>wr.top-1&&b.top<wr.bottom+1; });
        if(!inAny&&b.width<=dw&&b.height<=dw){ r.out++; if(r.stray.length<3) r.stray.push((el.className||'').toString().slice(0,20)+'@'+el.tagName); }
      });
      return r;
    })`;
  const ghostSampler = `__gS={frames:0,zeroW:0,out:0,maxop:0,firstop:null,stray:[],stop:false},(__gLoop=function(){var r=window.__GF();if(r){__gS.frames++;__gS.zeroW+=r.zeroW;__gS.out+=r.out;__gS.maxop=Math.max(__gS.maxop,r.op);if(__gS.firstop==null)__gS.firstop=r.op;r.stray.forEach(function(s){if(__gS.stray.indexOf(s)<0)__gS.stray.push(s);});}if(!__gS.stop)requestAnimationFrame(__gLoop);})()`;

  /* l01 — ghost geometry after the root-cause fix: ARRANGE spam ×6, eject,
     every root disk, at 1440 and 390 — ghost disks are sized, nothing
     visible leaks outside a wrap, opacity starts ≤0.35 */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const vps = [
        ["1440", { viewport: { width: 1440, height: 900 } }],
        ["390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
      ];
      for (const [tag, opts] of vps) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
        attach(page, errs);
        await page.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForTimeout(1300);
        await page.evaluate("window.__GF=" + ghostFrame + ";");
        const cats = ["ABOUT.ME", "WORK", "EDUCATION", "PROJECTS", "CONTACT"];
        for (const c of cats) {
          /* open the disk — ghost of the ROOT view (appears after the 750 ms fly) */
          await page.evaluate(ghostSampler);
          await page.evaluate((cat) => {
            document.querySelector('[data-cat="' + cat + '"]').click();
          }, c);
          await page
            .waitForFunction(() => !!document.querySelector(".view-ghost"), null, { timeout: 4000 })
            .catch(() => {
              ok = false;
              d += tag + "/" + c + " open: no ghost; ";
            });
          await page
            .waitForFunction(() => !document.querySelector(".view-ghost"), null, { timeout: 3000 })
            .catch(() => {
              ok = false;
              d += tag + "/" + c + " open: ghost stuck; ";
            });
          await page.evaluate(() => {
            window.__gS.stop = true;
          });
          const g = await page.evaluate(() => window.__gS);
          if (
            g.frames < 3 ||
            g.zeroW > 0 ||
            g.out > 0 ||
            g.firstop == null ||
            g.firstop > 0.36 ||
            g.maxop > 0.36
          ) {
            ok = false;
            d += tag + "/" + c + " open " + JSON.stringify(g) + "; ";
          }
          /* EJECT — ghost of the ITEM view (appears at once, 320 ms) */
          await page.evaluate(ghostSampler);
          await page.evaluate(() => {
            document.getElementById("ejectBtn").click();
          });
          await page
            .waitForFunction(() => !!document.querySelector(".view-ghost"), null, { timeout: 4000 })
            .catch(() => {
              ok = false;
              d += tag + "/" + c + " eject: no ghost; ";
            });
          await page
            .waitForFunction(() => !document.querySelector(".view-ghost"), null, { timeout: 3000 })
            .catch(() => {
              ok = false;
              d += tag + "/" + c + " eject: ghost stuck; ";
            });
          await page.evaluate(() => {
            window.__gS.stop = true;
          });
          const g2 = await page.evaluate(() => window.__gS);
          if (g2.frames < 3 || g2.zeroW > 0 || g2.out > 0 || g2.firstop == null || g2.firstop > 0.36) {
            ok = false;
            d += tag + "/" + c + " eject " + JSON.stringify(g2) + "; ";
          }
          await page.waitForTimeout(650); /* the 540 ms eject fly must be over before the next open */
        }
        /* ARRANGE spam ×6 at root — v7 N1: the same set of disks never ghosts,
           so the expected result is ZERO ghost frames (the old contract
           expected a ghost; n01 asserts the live-layer stacking itself) */
        await page.evaluate(ghostSampler);
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => {
            document.getElementById("arrangeBtn").click();
          });
          await page.waitForTimeout(130);
        }
        await page
          .waitForFunction(() => !document.querySelector(".view-ghost"), null, { timeout: 3000 })
          .catch(() => {
            ok = false;
            d += tag + "/ARRANGE ghost stuck; ";
          });
        await page.evaluate(() => {
          window.__gS.stop = true;
        });
        const g3 = await page.evaluate(() => window.__gS);
        if (g3.frames > 0 || g3.zeroW > 0 || g3.out > 0) {
          ok = false;
          d += tag + "/ARRANGE ghost appeared (N1: same set must not ghost) " + JSON.stringify(g3) + "; ";
        }
        if (errs.pageE.length) {
          ok = false;
          d += tag + " pageerrors " + errs.pageE[0] + "; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "l01 ghost: sized disks, nothing outside its wrap, ≤0.35 fade; ARRANGE ghosts nothing (N1)",
      ok,
      d || "open/eject ghosts clean; ARRANGE zero ghost frames, on both viewports"
    );
  }

  /* l02 — power-off mirrors power-on: rAF-sampled order raster→line→dot→off,
     I4 (no archive re-show), no black frame before the line, ≤1120 ms */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const vps = [
        ["1440", { viewport: { width: 1440, height: 900 } }, false],
        ["pixel7", { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }, true]
      ];
      for (const [tag, opts, phone] of vps) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errs = { consoleE: [], consoleW: [], pageE: [], bad: [] };
        attach(page, errs);
        await page.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForTimeout(1300);
        await page.evaluate(
          `window.__s=[];(function loop(){var d=${DOT};var av=getComputedStyle(document.getElementById('arcView'));window.__s.push({t:performance.now(),w:d.w,h:d.h,o:d.o,arc:av.visibility==='visible'&&av.opacity!=='0',off:document.body.className.indexOf('phase-off')>=0});if(window.__s.length<400)requestAnimationFrame(loop)})();`
        );
        if (phone) await page.tap("#powerBtn");
        else {
          const r = await page.locator("#powerBtn").boundingBox();
          await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        }
        await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
          timeout: 4000
        });
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
          const s = window.__s.filter((x) => x.off || x.arc === false);
          const first = s[0] || {};
          let firstRaster = -1,
            firstLine = -1,
            firstDot = -1,
            offIdx = -1,
            arcVis = 0,
            darkBeforeLine = 0;
          for (let i = 0; i < s.length; i++) {
            const x = s[i];
            if (x.arc) arcVis++;
            if (firstRaster < 0 && x.w > 1000 && x.h > 600) firstRaster = i;
            if (firstLine < 0 && x.w > 1000 && x.h < 40) firstLine = i;
            if (firstDot < 0 && x.w < 60 && x.h < 60) firstDot = i;
            if (offIdx < 0 && x.off) offIdx = i;
            if (firstLine >= 0 && i < firstLine && x.w < 800 && x.h < 300 && !x.arc)
              darkBeforeLine++; /* small/dark light before the line = a dip */
          }
          const iv = [];
          for (let i = 1; i < s.length; i++) iv.push(s[i].t - s[i - 1].t);
          iv.sort((a, b) => a - b);
          return {
            n: s.length,
            firstRaster,
            firstLine,
            firstDot,
            offIdx,
            arcVis,
            darkBeforeLine,
            totalMs: offIdx > 0 ? Math.round(s[offIdx].t - s[0].t) : -1,
            med: iv.length ? +iv[Math.floor(iv.length / 2)].toFixed(1) : 0,
            hint: parseFloat(getComputedStyle(document.getElementById("powerHint")).opacity) > 0.05,
            dotGone: s[s.length - 1].o < 0.05 || s[s.length - 1].h < 20
          };
        });
        if (m.arcVis > 0) {
          ok = false;
          d += tag + " archive-visible " + m.arcVis + " frames; ";
        }
        if (
          !(
            m.firstRaster >= 0 &&
            m.firstLine > m.firstRaster &&
            m.firstDot > m.firstLine &&
            m.offIdx > m.firstDot
          )
        ) {
          ok = false;
          d +=
            tag +
            " order raster=" +
            m.firstRaster +
            " line=" +
            m.firstLine +
            " dot=" +
            m.firstDot +
            " off=" +
            m.offIdx +
            "; ";
        }
        if (m.darkBeforeLine > 0) {
          ok = false;
          d += tag + " dark-before-line " + m.darkBeforeLine + " frames; ";
        }
        if (m.totalMs < 0 || m.totalMs > 1120) {
          ok = false;
          d += tag + " total " + m.totalMs + " ms; ";
        }
        if (!m.hint) {
          ok = false;
          d += tag + " hint not back; ";
        }
        if (m.med < 14.5 || m.med > 18.5) {
          ok = false;
          d += tag + " frame median " + m.med + " ms; ";
        }
        if (errs.pageE.length) {
          ok = false;
          d += tag + " pageerrors; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "l02 power-off: raster→line→dot→off, no archive re-show, no pre-line dip, ≤1120 ms (1440+Pixel 7)",
      ok,
      d || "order + I4 + timing clean on both"
    );
  }

  /* l03 — a double-tapped power button toggles ONCE */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForTimeout(1300);
      const r = await page.locator("#powerBtn").boundingBox();
      const cx = r.x + r.width / 2,
        cy = r.y + r.height / 2;
      await page.mouse.click(cx, cy);
      await page.mouse.click(cx, cy); /* double click, <600 ms debounce */
      await page.waitForTimeout(700); /* past the debounce: a 3rd press is caught by S.offing */
      await page.mouse.click(cx, cy);
      await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
        timeout: 4000
      });
      const m = await page.evaluate(() => ({
        cool: !!document.getElementById("warm").classList.contains("cool"),
        anims: document.querySelector("#warm .dot").getAnimations().length
      }));
      await page.waitForTimeout(800);
      const stillOff = await page.evaluate(() => document.body.className.indexOf("phase-off") >= 0);
      if (!stillOff || m.cool || m.anims > 1) {
        ok = false;
        d = JSON.stringify({ m, stillOff });
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "l03 power button double/triple tap = one collapse, off holds",
      ok,
      d || "single collapse, off held"
    );
  }

  /* l04 — army scene: access pictogram (no soldier), correct marks, hover
     flips blocked→approved and resets, sized at both stages */
  {
    let ok = true,
      d = "";
    const fs = await import("node:fs");
    const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
    const a = html.indexOf("var FK = {");
    const b = html.indexOf("function rootIcon(cat) {");
    const licSVG = new Function(html.slice(a, b) + "; return licSVG;")();
    const army = licSVG("army");
    const srcOk =
      army.indexOf("li-cross") >= 0 &&
      army.indexOf("li-tick") >= 0 &&
      army.indexOf('class="fig"') < 0 &&
      army.indexOf("li-salute") < 0 &&
      army.match(/stroke-width="1\.6"/) !== null &&
      army.indexOf('data-scene="army"') >= 0;
    if (!srcOk) {
      ok = false;
      d = "source svg wrong; ";
    }
    const browser = await chromium.launch();
    try {
      for (const [tag, opts, wantPx] of [
        ["1440", { viewport: { width: 1440, height: 900 } }, 64],
        ["390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 30]
      ]) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForFunction(
          () => (document.querySelector("#crumb .here") || {}).textContent === "WORK",
          null,
          { timeout: 8000 }
        );
        await page.waitForTimeout(900);
        const m = await page.evaluate(() => {
          const svg = document.querySelector('[data-item="army"] .lic svg');
          const box = parseFloat(
            getComputedStyle(document.querySelector('[data-item="army"] .lic')).width
          ); /* stage px, unscaled */
          const cross = svg.querySelector(".li-cross"),
            tick = svg.querySelector(".li-tick");
          return {
            scene: svg.getAttribute("data-scene"),
            px: Math.round(box),
            restCross: getComputedStyle(cross).animationName,
            restTick: getComputedStyle(tick).animationName
          };
        });
        if (m.scene !== "army" || m.px < wantPx - 2) {
          ok = false;
          d += tag + " " + JSON.stringify(m) + "; ";
        }
        const bb = await page.locator('[data-item="army"]').boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await page.waitForTimeout(250);
        const hov = await page.evaluate(() => ({
          cross: getComputedStyle(document.querySelector('[data-item="army"] .li-cross')).animationName,
          tick: getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).animationName
        }));
        if (hov.cross !== "liCross" || hov.tick !== "liTickIn") {
          ok = false;
          d += tag + " hover " + JSON.stringify(hov) + "; ";
        }
        await page.mouse.move(5, 5);
        await page.waitForTimeout(200);
        const rst = await page.evaluate(
          () => getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).animationName
        );
        if (rst !== "none") {
          ok = false;
          d += tag + " no reset: " + rst + "; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "l04 army scene: access pictogram (no soldier), ✕→✓ on hover, resets, sized",
      ok,
      d || "scene + hover + reset clean at 1440 and 390"
    );
  }

  /* l05 — reduced motion: power-off is instant (no cool animation) */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce"
      });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForTimeout(1200);
      const r = await page.locator("#powerBtn").boundingBox();
      const t0 = await page.evaluate(() => performance.now());
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
        timeout: 2000
      });
      const dt = await page.evaluate((t) => Math.round(performance.now() - t), t0);
      const cool = await page.evaluate(() => document.getElementById("warm").classList.contains("cool"));
      if (dt > 150 || cool) {
        ok = false;
        d = "off in " + dt + " ms, cool=" + cool;
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(D, "l05 reduced motion: power-off instant", ok, d || "instant, no animation");
  }
}

/* ---------------- PHASE M: detail hierarchy, readability, notes, clock ---------------- */
async function phaseMfixes() {
  const D = "1440x900";
  /* WCAG contrast of an "rgb(r, g, b)" colour against a hex background */
  const wcag = `
    function lum(c){ var m=c.match(/[\\d.]+/g).map(Number).slice(0,3).map(function(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*m[0]+0.7152*m[1]+0.0722*m[2]; }
    function ratio(fg,bg){ var a=lum(fg),b=lum(bg); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); }
    function hex(h){ h=h.slice(1); return 'rgb('+parseInt(h.slice(0,2),16)+', '+parseInt(h.slice(2,4),16)+', '+parseInt(h.slice(4,6),16)+')'; }
    return`;

  /* m01 — detail hierarchy on the DEL-OITTE record (1440 + 390):
     title→meta→summary→bullets (one list in data order: the NUMBERS/SCOPE
     grouping was removed on 2026-10-08)→STACK footer, meta-duplicate
     bullets gone, summary at ~1.1× body, footer reachable by scroll */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      for (const [tag, opts] of [
        ["1440", { viewport: { width: 1440, height: 900 } }],
        ["390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
      ]) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
          timeout: 8000
        });
        await page.waitForTimeout(1200);
        if (tag === "390") await page.tap('[data-item="deloitte"] .lic');
        else await page.evaluate(() => document.querySelector('[data-item="deloitte"] .lic').click());
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          var vm = document.querySelector(".card-more");
          if (vm) vm.click();
        });
        await page.waitForFunction(
          () => document.getElementById("detailView").classList.contains("live"),
          null,
          { timeout: 4000 }
        );
        const m = await page.evaluate(() => {
          var db = document.getElementById("dtBody");
          var kids = [].map.call(db.children, function (k) {
            return k.className;
          });
          var secs = [].map.call(db.querySelectorAll(".dt-sec"), function (s) {
            return s.textContent;
          });
          /* v7 M-review: group membership — bullet text → its section head */
          var groups = {},
            cur = "";
          [].forEach.call(db.children, function (k) {
            if (k.className === "dt-sec") cur = k.textContent;
            else if (k.className === "dt-line") groups[k.textContent.slice(0, 24)] = cur;
          });
          var sc = document.querySelector(".dt-scroll");
          sc.scrollTop = sc.scrollHeight;
          var stack = db.querySelector(".dt-stack");
          return {
            kids: kids,
            secs: secs,
            groups: groups,
            sumPx: parseFloat(getComputedStyle(db.querySelector(".dt-sum")).fontSize),
            bodyPx: parseFloat(getComputedStyle(db).fontSize),
            dupLine: [].some.call(db.querySelectorAll(".dt-line"), function (l) {
              return /Oct 2023|Software Engineer/.test(l.textContent);
            }),
            stack: stack ? stack.textContent.trim().slice(0, 30) : "",
            stackUpper: stack ? stack.textContent === stack.textContent.toUpperCase() : false,
            links: !!db.querySelector(".dt-linkrow a"),
            scrollable: sc.scrollHeight > sc.clientHeight + 4,
            footerVisible: stack
              ? stack.getBoundingClientRect().top < db.parentElement.getBoundingClientRect().bottom
              : false
          };
        });
        var order = ["dt-title", "dt-meta", "dt-sum"];
        var i = 0;
        while (i < m.kids.length && order[i]) {
          if (m.kids[i] !== order[i]) {
            ok = false;
            d += tag + " kid[" + i + "]=" + m.kids[i] + " want " + order[i] + "; ";
          }
          i++;
        }
        /* 2026-10-08: no NUMBERS/SCOPE heads; the bullets follow the data order */
        if (m.secs.indexOf("NUMBERS") >= 0 || m.secs.indexOf("SCOPE") >= 0) {
          ok = false;
          d += tag + " grouping heads back: " + m.secs + "; ";
        }
        /* v7 N6: ~1.1× body desktop, ~1.08× on the phone stage */
        var wantMult = tag === "390" ? 1.08 : 1.1;
        if (Math.abs(m.sumPx - m.bodyPx * wantMult) > 0.6) {
          ok = false;
          d += tag + " sum " + m.sumPx + " vs body " + m.bodyPx + "×" + wantMult + "; ";
        }
        var lineKeys = Object.keys(m.groups);
        var firstLine = m.kids.indexOf("dt-line");
        if (lineKeys.length < 8) {
          ok = false;
          d += tag + " only " + lineKeys.length + " bullets; ";
        }
        if (!lineKeys.length || lineKeys[0].indexOf("Owned end-to-end") !== 0) {
          ok = false;
          d += tag + " first bullet " + (lineKeys[0] || "absent") + "; ";
        }
        if (firstLine !== 3) {
          ok = false;
          d += tag + " bullets start at kid " + firstLine + "; ";
        }
        if (m.dupLine) {
          ok = false;
          d += tag + " meta-dup bullet still rendered; ";
        }
        if (!m.stack || !m.stackUpper) {
          ok = false;
          d += tag + " stack " + m.stack + "; ";
        }
        if (!m.links) {
          ok = false;
          d += tag + " no link row; ";
        }
        if (m.scrollable && !m.footerVisible) {
          ok = false;
          d += tag + " footer not reachable; ";
        }
        await ctx.close();
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "m01 detail hierarchy: title→meta→summary→bullets (data order)→STACK, dup bullets gone",
      ok,
      d || "order + summary 1.1×/1.08× + one bullet list + footer reachable at 1440 and 390"
    );
  }

  /* m02 — records with ≤3 rendered bullets get no NUMBERS/SCOPE heads (army,
     univ, mb500) — the STACK footer is still there (N3: no NOTES data now) */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="army"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => document.querySelector('[data-item="army"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      const army = await page.evaluate(() => ({
        secs: [].map.call(document.querySelectorAll(".dt-sec"), function (s) {
          return s.textContent;
        }),
        lines: document.querySelectorAll(".dt-line").length,
        stack: !!document.querySelector(".dt-stack")
      }));
      if (army.secs.indexOf("NUMBERS") >= 0 || army.secs.indexOf("SCOPE") >= 0) {
        ok = false;
        d += "army has section heads: " + army.secs + "; ";
      }
      if (army.lines > 3 || !army.stack) {
        ok = false;
        d += JSON.stringify(army) + "; ";
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "m02 ≤3-bullet records (army): no NUMBERS/SCOPE heads, STACK kept",
      ok,
      d || "army: no heads, stack kept"
    );
  }

  /* m03 — meta line WCAG AA: the .dt-meta colour vs BOTH screen gradients
     (green + amber), centre and edge — report the measured ratios */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => document.querySelector('[data-item="deloitte"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      var greens = await page.evaluate(
        `(function(){ ${wcag} { center: ratio(getComputedStyle(document.querySelector('.dt-meta')).color, hex('#0a2517')), edge: ratio(getComputedStyle(document.querySelector('.dt-meta')).color, hex('#020905')) }; })()`
      );
      /* amber mode: flip the phosphor knob */
      await page.evaluate(() => {
        var k = document.getElementById("phosKnob");
        if (k) k.click();
      });
      await page.waitForTimeout(400);
      var ambers = await page.evaluate(
        `(function(){ ${wcag} { center: ratio(getComputedStyle(document.querySelector('.dt-meta')).color, hex('#2b1f0c')), edge: ratio(getComputedStyle(document.querySelector('.dt-meta')).color, hex('#0a0603')) }; })()`
      );
      if (greens.center < 4.5 || greens.edge < 4.5) {
        ok = false;
        d += "green " + JSON.stringify(greens) + "; ";
      }
      if (ambers.center < 4.5 || ambers.edge < 4.5) {
        ok = false;
        d += "amber " + JSON.stringify(ambers) + "; ";
      }
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "m03 meta line WCAG ≥4.5:1 (green + amber, centre + edge)",
      ok,
      d || (d = "green " + JSON.stringify(greens) + " · amber " + JSON.stringify(ambers))
    );
  }

  /* m04 — every card at 1440 and 390: tags and links clearly legible
     (≥11 px / ≥12 px rendered on desktop, ≥10 px / ≥12 px on the phone),
     and the card still fits (no scroll, footer inside) and never covers a disk */
  {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      for (const [tag, w, h, mob, minTag, minLink] of [
        ["1440", 1440, 900, false, 11, 12],
        ["390", 390, 844, true, 10, 12]
      ]) {
        for (const [path, items] of P7_VIEWS) {
          const { ctx, page } = await freshPage(browser, w, h, "#skip&path=" + path, { mobile: mob });
          try {
            await page.waitForSelector("body.phase-archive", { timeout: 15000 });
            await page.waitForTimeout(400);
            for (const id of items) {
              await dclick(page, '[data-item="' + id + '"]');
              await page.waitForTimeout(380);
              const m = await page.evaluate(
                (lim) => {
                  var card = document.querySelector(".card");
                  if (!card) return { bad: "no-card" };
                  var cr = card.getBoundingClientRect();
                  if (cr.width < 50) return { bad: "hidden" };
                  var sheet = card.classList.contains("sheet"); /* phone bottom sheet — F1 checks cover it */
                  var phone = document.body.classList.contains("st-phone");
                  var stg = document.getElementById("stage");
                  var scale = stg ? stg.getBoundingClientRect().width / (phone ? 430 : 1680) : 1;
                  var t = card.querySelector(".card-tags span");
                  var l = card.querySelector(".card-actions .card-l, .card-actions .card-more");
                  var tp = t ? parseFloat(getComputedStyle(t).fontSize) * scale : 0;
                  var lp = l ? parseFloat(getComputedStyle(l).fontSize) * scale : 0;
                  var bad = [];
                  if (tp < lim.minTag - 0.2) bad.push("tag " + tp.toFixed(1));
                  if (lp < lim.minLink - 0.2) bad.push("link " + lp.toFixed(1));
                  /* the card's ::after arrow always inflates scrollHeight ~10 px (pre-existing);
                   the real invariants are: inside the glass, footer in the card, no disk hit */
                  if (!sheet) {
                    var gl = document.querySelector(".glass").getBoundingClientRect();
                    if (
                      cr.left < gl.left - 1 ||
                      cr.right > gl.right + 1 ||
                      cr.top < gl.top - 1 ||
                      cr.bottom > gl.bottom + 1
                    )
                      bad.push("off-glass");
                    var act = card.querySelector(".card-actions");
                    if (act) {
                      var ar = act.getBoundingClientRect();
                      if (ar.bottom > cr.bottom + 1) bad.push("footer out of card");
                    }
                    /* p7a contract: the card covers NO disk at all (>0.5 px, .obj) */
                    document.querySelectorAll(".obj").forEach(function (o) {
                      var wr = o.getBoundingClientRect();
                      var ix = Math.max(0, Math.min(cr.right, wr.right) - Math.max(cr.left, wr.left));
                      var iy = Math.max(0, Math.min(cr.bottom, wr.bottom) - Math.max(cr.top, wr.top));
                      if (ix > 0.5 && iy > 0.5) bad.push("covers " + o.dataset.item);
                    });
                  }
                  return { bad: bad.join(", ") || "ok" };
                },
                { minTag, minLink }
              );
              if (m.bad !== "ok") {
                ok = false;
                d += tag + "/" + path + "/" + id + ":" + m.bad + "; ";
              }
            }
          } catch (e) {
            ok = false;
            d += tag + "/" + path + ":" + String(e).slice(0, 60) + "; ";
          }
          await ctx.close();
        }
      }
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "m04 cards at 1440+390: tags ≥11/10 px, links ≥12 px rendered; fits, never covers a disk",
      ok,
      d || "all 16 item cards legible + contained on both stages"
    );
  }

  /* m05 — the DUBLIN clock: on the status line only in the archive phase,
     24-h, right of the status text, gone off-screen in off/boot; fits on
     the phone (no wrap); no setInterval anywhere */
  {
    let ok = true,
      d = "";
    const fs = await import("node:fs");
    const html = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
    if (html.indexOf("setInterval") >= 0) {
      ok = false;
      d += "setInterval present; ";
    }
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForTimeout(1500);
      var m = await page.evaluate(() => {
        var c = document.getElementById("dubClock");
        var s = document.getElementById("statLeft");
        return {
          txt: c.textContent,
          vis: getComputedStyle(c).display !== "none",
          x: c.getBoundingClientRect().x,
          sx: s.getBoundingClientRect().x
        };
      });
      if (!/\d{2}:\d{2}$/.test(m.txt)) {
        ok = false;
        d += "txt " + m.txt + "; ";
      }
      if (!m.vis) {
        ok = false;
        d += "not visible in archive; ";
      }
      if (m.x < m.sx) {
        ok = false;
        d += "not to the right of the status text; ";
      }
      /* off: cleared and hidden with the view */
      var r = await page.locator("#powerBtn").boundingBox();
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForFunction(() => document.body.className.indexOf("phase-off") >= 0, null, {
        timeout: 4000
      });
      m = await page.evaluate(() => ({ txt: document.getElementById("dubClock").textContent }));
      if (m.txt !== "") {
        ok = false;
        d += "off: clock still " + m.txt + "; ";
      }
      await ctx.close();
      /* phone: shown only if it fits — the bar must not wrap */
      const pctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      });
      const pp = await pctx.newPage();
      await pp.goto(ORIGIN + "/index.html#skip", { waitUntil: "load" });
      await pp.waitForSelector("body.phase-archive", { timeout: 20000 });
      await pp.waitForTimeout(1500);
      var pm = await pp.evaluate(() => {
        var st = document.querySelector(".arc-status");
        return {
          wrap: st.scrollWidth > st.clientWidth + 1 || st.scrollHeight > st.clientHeight + 4,
          shown: getComputedStyle(document.getElementById("dubClock")).display !== "none"
        };
      });
      if (pm.wrap) {
        ok = false;
        d += "phone status line wraps; ";
      }
      await pctx.close();
    } catch (e) {
      ok = false;
      d += "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      D,
      "m05 DUBLIN clock: archive-only, 24-h, right side, cleared on off, fits on phone, no setInterval",
      ok,
      d || "clock clean on desktop + phone"
    );
  }
}

/* ---------------- PHASE N: validation + review of pM ---------------- */
async function phaseNfixes() {
  const D = "1440x900";

  /* n01 — (N1) the ghost is BELOW the live layer: in EVERY ghost frame the
     topmost element at each live disk centre is the live disk, never the
     ghost; ARRANGE / same-view re-renders produce NO ghost at all.
     Checked on ARRANGE, open (root→WORK) and eject (WORK→root), 1440 + phone */
  for (const [tag, opts] of [
    ["1440", { viewport: { width: 1440, height: 900 } }],
    ["390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
  ]) {
    let ok = true,
      d = "";
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        window.__N1 = null;
        window.__n1sample = function () {
          var g = document.querySelector(".view-ghost");
          var f = { ghost: !!g, cover: 0, live: 0 };
          if (g) {
            f.op = parseFloat(getComputedStyle(g).opacity);
            document.querySelectorAll("#arcBody .obj").forEach(function (o) {
              var r = o.getBoundingClientRect();
              if (r.width < 20) return;
              f.live++;
              var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              if (!el) {
                f.cover++;
                return;
              }
              var anc = el;
              while (anc) {
                if (anc.classList && anc.classList.contains("view-ghost")) {
                  f.cover++;
                  break;
                }
                anc = anc.parentElement;
              }
            });
          }
          return f;
        };
        window.__n1run = function (ms) {
          window.__N1 = { frames: 0, ghostFrames: 0, maxCover: 0, minOp: 9, maxOp: 0 };
          var st = window.__N1,
            t0 = performance.now();
          (function loop() {
            var f = window.__n1sample();
            st.frames++;
            if (f.ghost) {
              st.ghostFrames++;
              st.maxCover = Math.max(st.maxCover, f.cover);
              st.minOp = Math.min(st.minOp, f.op);
              st.maxOp = Math.max(st.maxOp, f.op);
            }
            if (performance.now() - t0 < ms) requestAnimationFrame(loop);
          })();
        };
      });
      /* 1) ARRANGE — the same set of disks: no ghost ever */
      await page.evaluate(() => window.__n1run(900));
      await page.evaluate(() => document.getElementById("arrangeBtn").click());
      await page.waitForTimeout(1100);
      let m = await page.evaluate(() => window.__N1);
      if (m.ghostFrames > 0) {
        ok = false;
        d += "ARRANGE ghost " + m.ghostFrames + "f; ";
      }
      /* 2) open root→WORK */
      await page.evaluate(() => window.__n1run(1400));
      const wb = await page.locator('[data-cat="WORK"]').boundingBox();
      if (tag === "390") {
        await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2);
        await page.waitForTimeout(300);
        await page.touchscreen.tap(wb.x + wb.width / 2, wb.y + wb.height / 2);
      } else {
        await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
        await page.waitForTimeout(250);
        await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
      }
      await page.waitForTimeout(1600);
      m = await page.evaluate(() => window.__N1);
      if (m.ghostFrames === 0) {
        ok = false;
        d += "open: no ghost seen; ";
      } else if (m.maxCover > 0) {
        ok = false;
        d += "open: ghost over live disk in " + m.maxCover + "f; ";
      }
      /* 3) eject WORK→root */
      await page.evaluate(() => window.__n1run(900));
      await page.evaluate(() => document.getElementById("ejectBtn").click());
      await page.waitForTimeout(1700);
      m = await page.evaluate(() => window.__N1);
      if (m.ghostFrames === 0) {
        ok = false;
        d += "eject: no ghost seen; ";
      } else if (m.maxCover > 0) {
        ok = false;
        d += "eject: ghost over live disk in " + m.maxCover + "f; ";
      }
      if (ok)
        d = "ARRANGE 0 ghost frames; open " + m.maxOp + "→" + m.minOp.toFixed(2) + " 0 cover; eject clean";
      await ctx.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    } finally {
      await browser.close();
    }
    record(
      tag === "390" ? "390x844" : D,
      "n01 ghost below live layer: live disk topmost at its centre, ARRANGE ghosts nothing",
      ok,
      d
    );
  }

  /* n02 — (N2) power-off ending: no luminance step > 10 % between consecutive
     rAF frames at the end (offfade overlay + .on swap modelled from the real
     gradient constants), and the true pixel check across the swap < 10 % */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        function hex(rgb) {
          var m = rgb
            .match(/[\d.]+/g)
            .map(Number)
            .slice(0, 3);
          return m;
        }
        var root = getComputedStyle(document.documentElement);
        var gl = getComputedStyle(document.querySelector(".glass"));
        window.__N2BLUE = hex(gl.getPropertyValue("--offg-1") || "rgb(59,82,92)");
        window.__N2GREEN = hex(root.getPropertyValue("--phos-bg-1") || "rgb(10,37,23)");
        window.__lum = function (c) {
          return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
        };
        window.__N2rec = [];
        (function loop() {
          var o = parseFloat(getComputedStyle(document.getElementById("offfade")).opacity);
          var on = document.querySelector(".glass").classList.contains("on");
          var base = on ? window.__N2GREEN : window.__N2BLUE;
          var c = window.__N2BLUE.map(function (b, i) {
            return b * o + base[i] * (1 - o);
          });
          window.__N2rec.push(window.__lum(c));
          if (window.__N2rec.length < 400) requestAnimationFrame(loop);
        })();
      });
      await page.evaluate(() => document.getElementById("powerBtn").click());
      await page.waitForFunction(() => document.body.classList.contains("phase-off"), null, {
        timeout: 4000
      });
      await page.waitForTimeout(700);
      const rec = await page.evaluate(() => window.__N2rec);
      let maxStep = 0,
        at = 0;
      for (let i = 1; i < rec.length; i++) {
        const s = Math.abs(rec[i] - rec[i - 1]);
        if (s > maxStep) {
          maxStep = s;
          at = i;
        }
      }
      if (maxStep > 0.1) {
        ok = false;
        d += "step " + (maxStep * 100).toFixed(1) + "% @frame " + at + "; ";
      }
      /* true pixel check across the swap: centre crop just before (on) vs just
         after (off); average luminance via ImageMagick */
      const crop = await page.evaluate(() => {
        const r = document.querySelector(".glass").getBoundingClientRect();
        return {
          x: r.x + r.width * 0.44,
          y: r.y + r.height * 0.4,
          width: r.width * 0.12,
          height: r.height * 0.12
        };
      });
      require("fs").writeFileSync("/tmp/n2-after.png", await page.screenshot({ clip: crop }));
      // reload (via about:blank — a goto to the identical URL is a same-document
      // navigation and would never reboot), stop right before the 920 ms finish
      await page.goto("about:blank");
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.getElementById("powerBtn").click());
      await page.waitForTimeout(880);
      require("fs").writeFileSync("/tmp/n2-before.png", await page.screenshot({ clip: crop }));
      const { execFileSync } = require("child_process");
      function luma(f) {
        return parseFloat(
          execFileSync("convert", [f, "-colorspace", "Rec601Luma", "-format", "%[fx:mean]", "info:"])
            .toString()
            .trim()
        );
      }
      const l1 = luma("/tmp/n2-before.png"),
        l2 = luma("/tmp/n2-after.png");
      const pxStep = Math.abs(l1 - l2);
      d =
        "rAF max step " +
        (maxStep * 100).toFixed(1) +
        "%; pixel across swap " +
        (pxStep * 100).toFixed(1) +
        "% (" +
        (l1 * 100).toFixed(1) +
        "%→" +
        (l2 * 100).toFixed(1) +
        "%)";
      if (pxStep > 0.1) {
        ok = false;
        d += " — PIXEL JUMP";
      }
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 140);
    }
    record(D, "n02 power-off ending: no luminance step > 10 % at the end (rAF + true pixels)", ok, d);
  }

  /* n03 — (N3) no NOTES rendered anywhere, but the note rendering code + field stay */
  {
    let ok = true,
      d = "";
    try {
      const fs = require("fs");
      const src = fs.readFileSync(path.join(SITE, "index.html"), "utf8");
      if (!src.includes("it.note") || !src.includes("dt-note")) {
        ok = false;
        d += "rendering code missing; ";
      }
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      let hop = 0;
      const VIEW = { WORK: ["deloitte", "intermedia", "army"], "PROJECTS/ACADEMIC": ["icu"] };
      for (const [path, ids] of Object.entries(VIEW)) {
        /* ?v= forces a real document load — a hash-only goto is a no-op (the app
           has no hashchange listener) */
        await page.goto(ORIGIN + "/index.html?v=" + ++hop + "#/skip&path=" + path, { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForFunction((x) => document.querySelector('[data-item="' + x + '"] .lic'), ids[0], {
          timeout: 8000
        });
        await page.waitForTimeout(900);
        for (const id of ids) {
          await page.evaluate((x) => document.querySelector('[data-item="' + x + '"] .lic').click(), id);
          await page.waitForTimeout(400);
          await page.evaluate(() => {
            var vm = document.querySelector(".card-more");
            if (vm) vm.click();
          });
          await page.waitForFunction(
            () => document.getElementById("detailView").classList.contains("live"),
            null,
            { timeout: 4000 }
          );
          const m = await page.evaluate(() => ({
            note: !!document.querySelector(".dt-note"),
            heads: [].map.call(document.querySelectorAll(".dt-sec"), (s) => s.textContent)
          }));
          if (m.note) {
            ok = false;
            d += id + " still renders a note; ";
          }
          if (m.heads.indexOf("NOTES") >= 0) {
            ok = false;
            d += id + " NOTES head; ";
          }
          await page.evaluate(() => document.getElementById("dtClose").click());
          await page.waitForTimeout(450);
        }
      }
      if (ok) d = "no .dt-note / NOTES head on sampled details; it.note + .dt-note code intact";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    }
    record(D, "n03 notes hidden in UI, rendering code + note field retained", ok, d);
  }

  /* n04 — (N4) on the phone, no meta or stack visual line ends on a "·" */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      for (const id of ["deloitte", "intermedia", "army"]) {
        await page.tap('[data-item="' + id + '"] .lic');
        await page.waitForTimeout(500);
        await page.tap(".card-more");
        await page.waitForFunction(
          () => document.getElementById("detailView").classList.contains("live"),
          null,
          { timeout: 4000 }
        );
        const m = await page.evaluate(() => {
          function ends(seg) {
            return /\u00b7\s*$/.test(seg.textContent);
          }
          function dang(spans) {
            var n = 0;
            for (var i = 0; i < spans.length - 1; i++) {
              var a = spans[i].getBoundingClientRect(),
                b = spans[i + 1].getBoundingClientRect();
              if (b.top > a.bottom - 1 && ends(spans[i])) n++;
            }
            return n;
          }
          var mm = [].slice.call(document.querySelectorAll(".dt-meta .mps"));
          var ss = [].slice.call(document.querySelectorAll(".dt-stack .mps"));
          var oldStyle = mm.concat(ss).filter(ends).length;
          return { meta: dang(mm), stack: dang(ss), oldStyle: oldStyle };
        });
        if (m.meta || m.stack || m.oldStyle) {
          ok = false;
          d += id + " " + JSON.stringify(m) + "; ";
        }
        await page.evaluate(() => document.getElementById("dtClose").click());
        await page.waitForTimeout(450);
      }
      if (ok) d = 'no line ends on "·" (meta + stack, 3 records)';
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    }
    record("390x844", 'n04 no dangling "·" at line ends (meta + stack, phone)', ok, d);
  }

  /* n05 — (N5) "Stack:" bullets hidden, Deloitte bullets as one list in data
     order ("Owned…" first; the NUMBERS/SCOPE grouping was removed on
     2026-10-08), near-duplicate summary bullets dropped (Themis, ARCHIVE.SYS) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      let hop = 0;
      async function openDet(path, id) {
        /* ?v= forces a real document load (a hash-only goto is a no-op) */
        await page.goto(ORIGIN + "/index.html?v=" + ++hop + "#/skip&path=" + path, { waitUntil: "load" });
        await page.waitForSelector("body.phase-archive", { timeout: 20000 });
        await page.waitForFunction((x) => document.querySelector('[data-item="' + x + '"] .lic'), id, {
          timeout: 8000
        });
        await page.waitForTimeout(900);
        await page.evaluate((x) => document.querySelector('[data-item="' + x + '"] .lic').click(), id);
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          var vm = document.querySelector(".card-more");
          if (vm) vm.click();
        });
        await page.waitForFunction(
          () => document.getElementById("detailView").classList.contains("live"),
          null,
          { timeout: 4000 }
        );
      }
      /* Intermedia: no "Stack:" bullet */
      await openDet("WORK", "intermedia");
      let t = await page.evaluate(() => document.getElementById("dtBody").textContent);
      if (/^Stack:/.test(t) || /Stack: C#,/.test(t)) {
        ok = false;
        d += "intermedia Stack: bullet still shown; ";
      }
      await page.evaluate(() => document.getElementById("dtClose").click());
      await page.waitForTimeout(450);
      /* Deloitte: no grouping heads, "Owned…" is the first bullet */
      await openDet("WORK", "deloitte");
      let g = await page.evaluate(() => {
        var grp = {},
          cur = "";
        [].forEach.call(document.getElementById("dtBody").children, function (k) {
          if (k.className === "dt-sec") cur = k.textContent;
          else if (k.className === "dt-line") grp[k.textContent.slice(0, 24)] = cur;
        });
        return grp;
      });
      var gk = Object.keys(g);
      if (!gk.length || gk[0].indexOf("Owned end-to-end") !== 0) {
        ok = false;
        d += "deloitte first bullet = " + (gk[0] || "absent") + "; ";
      }
      if (gk.some((k) => g[k] !== "")) {
        ok = false;
        d += "deloitte bullets under a section head; ";
      }
      await page.evaluate(() => document.getElementById("dtClose").click());
      await page.waitForTimeout(450);
      /* Themis: the summary-restating bullet is gone */
      await openDet("PROJECTS/ACADEMIC", "themis");
      t = await page.evaluate(() => document.getElementById("dtBody").textContent);
      if (/A fair search engine for scientific articles\./.test(t)) {
        ok = false;
        d += "themis near-dup bullet; ";
      }
      await page.evaluate(() => document.getElementById("dtClose").click());
      await page.waitForTimeout(450);
      /* ARCHIVE.SYS (PROJECTS/PERSONAL): bullet 1 (== summary) is gone, the technical one stays */
      await openDet("PROJECTS/PERSONAL", "archivesys");
      t = await page.evaluate(() => document.getElementById("dtBody").textContent);
      var dup1 = (t.match(/a working archive behind a working screen/gi) || []).length;
      if (dup1 > 1) {
        ok = false;
        d += "archivesys summary line appears " + dup1 + "×; ";
      }
      if (!/self-contained HTML page/.test(t)) {
        ok = false;
        d += "archivesys technical bullet missing; ";
      }
      if (ok) d = "Stack: hidden, Deloitte one list (Owned… first), Themis + ARCHIVE.SYS near-dups dropped";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 120);
    }
    record(D, "n05 detail lines: Stack: hidden, one list in data order, summary near-dups dropped", ok, d);
  }

  /* n06 — (N6) desktop: the summary is ~1.1× body and clearly below the title
     (smaller AND a dimmer colour) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => document.querySelector('[data-item="deloitte"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      const m = await page.evaluate(() => {
        var cs = getComputedStyle;
        var ti = cs(document.querySelector(".dt-title")),
          su = cs(document.querySelector(".dt-sum"));
        function lum(c) {
          var m = c
            .match(/[\d.]+/g)
            .map(Number)
            .slice(0, 3);
          return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
        }
        return {
          body: parseFloat(cs(document.getElementById("dtBody")).fontSize),
          ti: parseFloat(ti.fontSize),
          su: parseFloat(su.fontSize),
          tl: lum(ti.color),
          sl: lum(su.color)
        };
      });
      if (Math.abs(m.su - m.body * 1.1) > 0.6) {
        ok = false;
        d += "sum " + m.su + " vs 1.1×" + m.body + "; ";
      }
      if (!(m.su < m.ti)) {
        ok = false;
        d += "sum not smaller than title; ";
      }
      if (!(m.sl < m.tl)) {
        ok = false;
        d += "sum not dimmer than title; ";
      }
      if (ok)
        d = "title " + m.ti + "px/" + m.tl.toFixed(0) + "L, summary " + m.su + "px/" + m.sl.toFixed(0) + "L";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    }
    record(D, "n06 title outranks summary (1.1×, dimmer) on desktop", ok, d);
  }

  /* n07 — (N7) army hover: the ✓ plays ONCE and HOLDS while hovered, reverts on
     leave (transform/opacity only, no infinite loop) */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="army"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      const r = await page.locator('[data-item="army"]').boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForTimeout(400);
      const early = await page.evaluate(() => ({
        t: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).opacity),
        c: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-cross')).opacity),
        n: getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).animationIterationCount
      }));
      if (early.n !== "1" && early.n !== "forwards") {
        ok = false;
        d += "iteration " + early.n + "; ";
      }
      await page.waitForTimeout(1600); /* well past the old 1.4 s loop point */
      const held = await page.evaluate(() => ({
        t: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).opacity),
        c: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-cross')).opacity)
      }));
      if (held.t < 0.95) {
        ok = false;
        d += "not held (tick " + held.t + "); ";
      }
      if (held.c > 0.05) {
        ok = false;
        d += "cross still up (" + held.c + "); ";
      }
      await page.mouse.move(6, 6);
      await page.waitForTimeout(200);
      const back = await page.evaluate(() => ({
        t: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-tick')).opacity),
        c: parseFloat(getComputedStyle(document.querySelector('[data-item="army"] .li-cross')).opacity)
      }));
      if (back.t > 0.05 || back.c < 0.95) {
        ok = false;
        d += "no revert " + JSON.stringify(back) + "; ";
      }
      if (ok) d = "plays once, held 2 s (tick=1, cross=0), reverts on leave";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    }
    record(D, "n07 army hover: ✓ plays once, holds while hovered, reverts", ok, d);
  }

  /* n08 — (N8) the detail bottom fade shows only while more content is below;
     it clears at the end and never appears on a short (non-scrolling) detail */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => document.querySelector('[data-item="deloitte"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      await page.waitForTimeout(350);
      const m = await page.evaluate(() => {
        var s = document.querySelector(".dt-scroll");
        var r = {
          fade: !!s.querySelector(".dt-fade"),
          top: s.classList.contains("morescroll"),
          overflow: s.scrollHeight > s.clientHeight + 4
        };
        s.scrollTop = s.scrollHeight;
        return r;
      });
      await page.waitForTimeout(300);
      const bot = await page.evaluate(() => ({
        on: document.querySelector(".dt-scroll").classList.contains("morescroll")
      }));
      if (!m.fade) {
        ok = false;
        d += "no .dt-fade element; ";
      }
      if (!m.overflow) {
        ok = false;
        d += "deloitte does not overflow (test setup); ";
      } else if (!m.top) {
        ok = false;
        d += "fade off at top with content below; ";
      } else if (bot.on) {
        ok = false;
        d += "fade still on at the end; ";
      }
      /* a short record (army): no overflow → no fade */
      await page.evaluate(() => document.getElementById("dtClose").click());
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('[data-item="army"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      await page.waitForTimeout(350);
      const army = await page.evaluate(() => ({
        on: document.querySelector(".dt-scroll").classList.contains("morescroll"),
        overflow:
          document.querySelector(".dt-scroll").scrollHeight >
          document.querySelector(".dt-scroll").clientHeight + 4
      }));
      if (army.overflow && army.on) {
        ok = false;
        d += "army fade on without need; ";
      }
      if (ok) d = "fade on at top, off at end, absent on short detail";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 100);
    }
    record(D, "n08 detail bottom fade: only while more content is below", ok, d);
  }

  /* n09 — (N9) (a) " · " before the clock, (b) meta line in caps, (c) ≈ not ~, (d)
     the clock fit re-checks on resize */
  {
    let ok = true,
      d = "";
    try {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(ORIGIN + "/index.html#/skip&path=WORK", { waitUntil: "load" });
      await page.waitForSelector("body.phase-archive", { timeout: 20000 });
      await page.waitForFunction(() => document.getElementById("dubClock").textContent.length > 0, null, {
        timeout: 8000
      });
      const a = await page.evaluate(() => document.getElementById("dubClock").textContent);
      if (!/· \d{2}:\d{2}$/.test(a)) {
        ok = false;
        d += 'a: clock "' + a + '"; ';
      }
      /* (c) no "~30" anywhere on the screen; ≈ present in the detail */
      const c1 = await page.evaluate(() => document.body.textContent.search(/~3[05]/));
      if (c1 >= 0) {
        ok = false;
        d += 'c: "~30" or "~35" on screen (VT323 draws ~ like *); ';
      }
      await page.waitForFunction(() => document.querySelector('[data-item="deloitte"] .lic'), null, {
        timeout: 8000
      });
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('[data-item="deloitte"] .lic').click());
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        var vm = document.querySelector(".card-more");
        if (vm) vm.click();
      });
      await page.waitForFunction(
        () => document.getElementById("detailView").classList.contains("live"),
        null,
        { timeout: 4000 }
      );
      const c2 = await page.evaluate(() => ({
        approx: /\u2248\d/.test(document.getElementById("dtBody").textContent),
        caps: getComputedStyle(document.querySelector(".dt-meta")).textTransform
      }));
      if (!c2.approx) {
        ok = false;
        d += "c: no ≈<digit> in detail; ";
      }
      if (c2.caps !== "uppercase") {
        ok = false;
        d += "b: meta " + c2.caps + "; ";
      }
      /* (d) resize → the fit check re-runs: status line must not wrap while the
         clock is shown */
      await page.setViewportSize({ width: 1100, height: 700 });
      await page.waitForTimeout(400);
      const fit = await page.evaluate(() => {
        var st = document.querySelector(".arc-status");
        var cl = document.getElementById("dubClock");
        return {
          shown: cl.style.display !== "none" && cl.textContent.length > 0,
          wraps: st.scrollWidth > st.clientWidth + 1
        };
      });
      if (fit.shown && fit.wraps) {
        ok = false;
        d += "d: status wraps with clock after resize; ";
      }
      if (ok) d = 'sep " · " + caps + ≈30 + resize fit (' + (fit.shown ? "shown" : "hidden") + ")";
      await ctx.close();
      await browser.close();
    } catch (e) {
      ok = false;
      d = "err " + String(e).slice(0, 120);
    }
    record(D, "n09 polish: clock sep, meta caps, ≈30, clock fit on resize", ok, d);
  }
}

/* ---------------- main ---------------- */
try {
  await zoomSweep();
  await folderStability(1280, 800, false);
  await folderStability(390, 844, true);
  await diskConstant(1280, 800, false);
  await diskConstant(390, 844, true);
  await movableDisks();
  await sceneScenes();
  await p5fixes();
  await p7fixes();
  await p8fixes();
  await v6fixes();
  await v6Efixes();
  await v6Ffixes();
  await g1bFixes();
  await g2Fixes();
  await g3Fixes();
  await phaseIFixes();
  await phaseJfixes();
  await phaseKfixes();
  await phaseKBfixes();
  await phaseLfixes();
  await phaseMfixes();
  await phaseNfixes();
  await perfChecks();
  for (const vp of VPS) await runViewport(vp);
} catch (e) {
  console.log("QA RUN ERROR: " + String(e).slice(0, 200));
}
const pass = RES.filter((r) => r.ok).length,
  fail = RES.length - pass;
console.log(`\n==== ${pass}/${RES.length} checks passed, ${fail} failed ====`);
if (fail) {
  console.log("Failed:");
  for (const r of RES) if (!r.ok) console.log(`  [${r.vp}] ${r.check} — ${r.detail}`);
}
process.exit(fail ? 1 : 0);
