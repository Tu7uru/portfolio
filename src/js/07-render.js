/* ============================== RENDER ============================== */
var crumbMenu = null;
function crumbSegments() {
  var s = [{ label: "C:<span class='slash'>\\</span>TU7URU", go: 0 }];
  for (var i = 0; i < S.path.length; i++) s.push({ label: S.path[i].toUpperCase(), go: i + 1 });
  return s;
}
/* #8: the displayed LABEL of every path segment (first = the category key) */
function pathLabels(p) {
  var out = [],
    node = null;
  for (var i = 0; i < p.length; i++) {
    var lab = p[i].toUpperCase();
    if (i > 0 && node) {
      for (var j = 0; j < node.items.length; j++)
        if (node.items[j].id === p[i]) {
          lab = node.items[j].label;
          break;
        }
    }
    out.push(lab);
    if (i === 0) node = DATA[p[0]];
    else if (node) {
      var nx = null;
      for (var k = 0; k < node.items.length; k++)
        if (node.items[k].id === p[i]) {
          nx = node.items[k];
          break;
        }
      node = nx;
    }
  }
  return out;
}
function closeCrumbMenu() {
  if (crumbMenu) {
    crumbMenu.remove();
    crumbMenu = null;
    var e = crumb.querySelector(".ellipsis");
    if (e) e.setAttribute("aria-expanded", "false");
  }
}
function toggleCrumbMenu() {
  if (crumbMenu) {
    closeCrumbMenu();
    return;
  }
  var hid = crumbSegments().slice(1, -1);
  if (!hid.length) return;
  crumbMenu = document.createElement("div");
  crumbMenu.className = "crumb-menu";
  crumbMenu.setAttribute("role", "menu");
  hid.forEach(function (s) {
    var b = document.createElement("button");
    b.className = "crumb-menu-item";
    b.setAttribute("role", "menuitem");
    b.textContent = s.label;
    b.addEventListener("click", function () {
      S.path = S.path.slice(0, s.go);
      render(false);
    });
    crumbMenu.appendChild(b);
  });
  crumb.appendChild(crumbMenu);
  var e = crumb.querySelector(".ellipsis");
  if (e) e.setAttribute("aria-expanded", "true");
}
function renderCrumb() {
  closeCrumbMenu();
  var segs = crumbSegments(),
    n = segs.length;
  function build(hideMid) {
    var h = '<a data-go="0">' + segs[0].label + '</a><span class="slash">\\</span>';
    if (n > 1) {
      if (hideMid) {
        if (n > 2)
          h +=
            '<button class="ellipsis" data-menu aria-expanded="false" aria-label="show ' +
            (n - 2) +
            " hidden folder" +
            (n > 3 ? "s" : "") +
            '">…</button><span class="slash">\\</span>';
        h += '<span class="here">' + segs[n - 1].label + '</span><span class="slash">\\</span>';
      } else {
        for (var i = 1; i < n - 1; i++)
          h += '<a data-go="' + segs[i].go + '">' + segs[i].label + '</a><span class="slash">\\</span>';
        h += '<span class="here">' + segs[n - 1].label + '</span><span class="slash">\\</span>';
      }
    }
    return h;
  }
  crumb.innerHTML = build(false);
  if (n > 2 && crumb.scrollWidth > crumb.clientWidth + 1) crumb.innerHTML = build(true);
  crumb.querySelectorAll("a[data-go]").forEach(function (a) {
    a.addEventListener("click", function () {
      var d = a.getAttribute("data-go");
      S.path = d === "0" ? [] : S.path.slice(0, parseInt(d, 10));
      render(false);
    });
  });
  var el = crumb.querySelector(".ellipsis");
  if (el) el.addEventListener("click", toggleCrumbMenu);
}
/* the folder node currently displayed */
function curNode() {
  if (!S.path.length) return null;
  var node = DATA[S.path[0]];
  for (var i = 1; i < S.path.length; i++) {
    var nxt = null;
    for (var j = 0; j < node.items.length; j++)
      if (node.items[j].id === S.path[i]) {
        nxt = node.items[j];
        break;
      }
    if (!nxt) return null;
    node = nxt;
  }
  return node;
}
function skinClass() {
  return S.plain ? "" : "skin-" + S.skin;
}
function render(fast) {
  closeCard();
  renderCrumb();
  arcBody.className = "arc-body " + skinClass();
  arcBody.classList.toggle("level-item", S.path.length > 0);
  /* v7 G2 (item 9): phosphor persistence — capture the outgoing view as a
ghost before the incoming one replaces it (which appears at once) */
  var ghost = null,
    old = arcBody.querySelector(".objs"),
    oldO = null;
  /* v7 N1: the SAME set of disks re-rendered (ARRANGE, plain toggle, skin
change) must not ghost itself — the afterglow would be the identical disks
1 px off, which reads as "the same disk twice". Only a real view change
keeps the ghost. */
  var viewKey = S.path.join("/") + "|" + (S.plain ? 1 : 0);
  var sameSet = S.prevKey === viewKey;
  S.prevKey = viewKey;
  /* v8 fix (plain-view flash): a PLAIN list must never be ghosted, in either
   direction. The phosphor afterglow is safe in the floppy view because the
   live layer's OPAQUE DISKS cover it (04-objects.css: the ghost sits at
   z-index 0 under the live disks); the plain view's live layer is
   transparent text, so the outgoing plain list — old "C:\TU7URU\..."
   path line plus old rows — shows through the new list for 320 ms and
   reads as the parent/root view flashing for a frame. */
  if (!fast && !RM && old && !sameSet && !S.plain && !old.querySelector(".plain")) {
    ghost = old.cloneNode(true);
    oldO = { l: old.offsetLeft, t: old.offsetTop, w: old.offsetWidth };
    /* v7 L1: the shell colours are painted by .skin-floppy/.obj[data-cat]/
.tray[data-color] descendants, which the ghost will outlive the re-render —
copy the RESOLVED vars onto each clone NOW (same trick as the eject
clone; cloneNode keeps index order, so live[i] ↔ ghost[i]). */
    var lo = old.querySelectorAll(".obj"),
      lg = ghost.querySelectorAll(".obj");
    for (var l1 = 0; l1 < lg.length; l1++) {
      var lcs = getComputedStyle(lo[l1]);
      ["--shell-1", "--shell-2", "--stripe"].forEach(function (p) {
        var lv = lcs.getPropertyValue(p);
        if (lv) lg[l1].style.setProperty(p, lv);
      });
    }
  }
  var h;
  if (S.plain) {
    h = renderPlain();
  } else if (!S.path.length) {
    h = renderRoot();
  } else {
    h = renderItems();
  }
  arcBody.innerHTML = '<div class="objs">' + h + "</div>";
  var node = curNode();
  var n = node ? node.items.length : CATS.length;
  var allf =
    node &&
    node.items.length &&
    node.items.every(function (x) {
      return x.folder;
    });
  statLeft.textContent = S.path.length
    ? n +
      " " +
      (allf ? "FOLDER" : "FILE") +
      (n === 1 ? "" : "S") +
      " · " +
      S.path
        .map(function (x) {
          return x.toUpperCase();
        })
        .join("\\")
    : CATS.length + " DIRECTORIES · TU7URU ARCHIVE V1.0";
  ejectBtn.classList.toggle("show", S.path.length > 0);
  /* disks drop into the tray one by one after boot */
  if (S.dropIn && !S.path.length) {
    var wraps = arcBody.querySelectorAll(".obj-wrap");
    for (var w = 0; w < wraps.length; w++) {
      wraps[w].style.animationDelay = w * 40 + "ms"; /* K-B: 40 ms stagger */
      wraps[w].classList.add("drop-in");
    }
    S.dropIn = false;
  }
  // fit any over-wide disk label down to its label width (no clipped names)
  fitLabels();
  applyLayout();
  /* v7 G2 (item 9): the outgoing view's afterglow fades 1→0 over the new
view — 320 ms, opacity only, pointer-events none (never blocks input).
Appended AFTER applyLayout: the ghost's .obj-wraps are clones and must
never be counted as live disks by the layout. */
  if (ghost) {
    /* v7 L1: the ghost carries the SKIN class itself — the shell paint and
`width:var(--disk)` are descendant rules, and the ghost lives outside
#arcBody, so without them every ghost disk measured 0×0 and only
absolutely-positioned stickers (the tilted ✳ of .f-stk) leaked out. */
    ghost.className = "view-ghost " + skinClass();
    /* positioned in .arc-scroll (the scroll container), NOT in #arcBody —
so no "#arcBody …" selector can ever match the ghost's disks */
    ghost.style.cssText =
      "left:" +
      (arcBody.offsetLeft + (oldO ? oldO.l : 0)) +
      "px;top:" +
      (arcBody.offsetTop + (oldO ? oldO.t : 0)) +
      "px;width:" +
      (oldO ? oldO.w : 0) +
      "px;";
    /* the ghost is purely visual: strip every identity attribute so it can
never be selected, counted, swapped or clicked as a live disk (QA
strict-mode, layout cell lookups, drag swaps) */
    ghost
      .querySelectorAll("[data-cat],[data-folder],[data-item],[data-scene],[data-cell]")
      .forEach(function (x) {
        ["data-cat", "data-folder", "data-item", "data-scene", "data-cell"].forEach(function (a) {
          if (x.hasAttribute(a)) x.removeAttribute(a);
        });
      });
    try {
      ghost.inert = true;
    } catch (e) {}
    arcBody.parentElement.appendChild(ghost);
    /* v7 L1: the ghost is now a REAL full-disk silhouette — start it faint
(0.35) so it reads as phosphor afterglow, never "the same disk twice" */
    var ga = ghost.animate([{ opacity: 0.35 }, { opacity: 0 }], {
      duration: 320,
      easing: "cubic-bezier(.2,0,0,1)"
    });
    ga.onfinish = function () {
      ghost.remove();
    };
  }
  // focus first object (keyboard only)
  var first = arcBody.querySelector(".obj,.plain-row");
  /* I2: while the DOS shell is open, the prompt keeps focus — a view change
   (cd) must not yank it to a disk */
  if (first && kbMode && !(typeof dosS !== "undefined" && dosS.open)) first.focus({ preventScroll: false });
}
/* v7 G1 (item 3): the disk drop waits for the fonts (1.5 s cap) — otherwise
the labels would pop in with fallback metrics and re-fit after */
(function () {
  var origStartArchive = startArchive;
  startArchive = function (fast) {
    if (fast && S.dropIn && !S.path.length) {
      fontsGate().then(function () {
        origStartArchive(fast);
      });
    } else {
      origStartArchive(fast);
    }
  };
})();
if (document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener("loadingdone", function () {
    if (S.phase === "archive") fitLabels();
  });
}
function fitLabels() {
  /* shrink over-wide label text to its box. #7: measure the LAYOUT text
width with a Range (scrollWidth misses italic overhangs such as
ICU-ON-CALL; a canvas measure disagrees with the layout by several px),
and keep the 4 px padding as slack for the overhang */
  arcBody.querySelectorAll(".f-name,.cn,.idx-name,.dptxt,.f-sub").forEach(function (el) {
    /* reset any earlier fit first: a refit (e.g. once the handwriting font
lands) must be able to restore a size the first pass over-shrank on
fallback metrics */
    el.style.fontSize = "";
    var cs0 = getComputedStyle(el),
      fs = parseFloat(cs0.fontSize),
      n = 0;
    var min = el.classList.contains("f-sub") ? 9 : 7.5;
    var pad = parseFloat(cs0.paddingLeft) + parseFloat(cs0.paddingRight);
    var tw = function () {
      /* unclipped text width in layout px: a Range rect is clipped by
overflow:hidden (overflowing text would measure as box-width and
never shrink) and is in SCREEN px, so divide by the stage's CSS
zoom. Used for overhangs (ink wider than the advance width);
scrollWidth is checked too, for plain layout overflow */
      try {
        var z = parseFloat(getComputedStyle(document.getElementById("stage")).zoom) || 1;
        var po = el.style.overflow;
        el.style.overflow = "visible";
        var r = document.createRange();
        r.selectNodeContents(el);
        var w = r.getBoundingClientRect().width / z;
        el.style.overflow = po;
        return w;
      } catch (e) {
        return el.scrollWidth;
      }
    };
    var slack = el.classList.contains("f-name") ? -2 : 1;
    /* F3: disk labels keep the ink >=2 px inside the content box -> with
the 3 px padding, >=4 stage px of clear space on BOTH sides */
    while (
      (el.scrollWidth > el.clientWidth + 1 || tw() > el.clientWidth - pad + slack) &&
      fs > min &&
      n < 40
    ) {
      fs -= 0.5;
      el.style.fontSize = fs + "px";
      n++;
    }
  });
}
/* a disk label first appearing in a view can load its font AFTER
document.fonts.ready has resolved — refit whenever a font finishes */
/* --- object builders --- */
/* 1-bit label icons: one small themed scene per disk (P4), each svg carries
data-scene="<id>"; animated only while the disk is hovered/focused */
