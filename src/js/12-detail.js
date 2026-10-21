/* ============================== DETAIL VIEW ============================== */
function openDetail(id) {
  var it = findItem(id);
  if (!it || !it.detail) return;
  /* 2026-10-21: VIEW MORE takes the glass — the DOS prompt steps aside (type / to bring it back) */
  if (typeof dosS !== "undefined" && dosS.open) dosHide();
  S.detailId = id;
  S.cardId = null;
  if (cardEl) cardEl.hidden = true;
  clearTrayShift();
  S.detailSrc = S.cardSrc || arcBody.querySelector('[data-item="' + id + '"]');
  /* #8: LABEL-based path, like the crumb (was the lowercase item id) */
  dtPath.textContent =
    "C:\\TU7URU\\" + (S.path.length ? pathLabels(S.path).join("\\") + "\\" : "") + it.label;
  var h = '<div class="dt-title">' + it.title + "</div>";
  var meta = metaLine(it);
  if (meta) h += '<div class="dt-meta">' + meta + "</div>";
  if (it.desc) h += '<div class="dt-sum">' + it.desc + "</div>";
  /* v7 M1: bullets that only repeat the meta line (role / period) are not rendered */
  var _n = function (s) {
    return String(s)
      .toLowerCase()
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  };
  var _P = (it.period ? String(it.period).split("\u00b7") : []).map(_n).filter(function (s) {
    return s.length >= 6;
  });
  var _R = _n((it.role || "").split("\u00b7")[0]);
  var _d = it.desc
    ? _n(it.desc)
        .split(/[^a-z0-9]+/)
        .filter(function (t) {
          return t.length >= 3;
        })
    : [];
  var _dset = {};
  _d.forEach(function (t) {
    _dset[t] = 1;
  });
  var _dn = Object.keys(_dset).length;
  var lines = it.detail.filter(function (l) {
    var x = _n(l);
    for (var i = 0; i < _P.length; i++) if (x.indexOf(_P[i]) >= 0) return false;
    if (_R && x.indexOf(_R) === 0) return false;
    /* v7 N5: "Stack: …" is the footer's STACK line already — hide it
(Intermedia's used to land in NUMBERS via ".NET 6") */
    if (x.indexOf("stack:") === 0) return false;
    /* v7 N5: a bullet that near-duplicates the summary (≥ 70 % token overlap
with desc) restates it — drop it */
    if (_dn) {
      var bt = x.split(/[^a-z0-9]+/).filter(function (t) {
        return t.length >= 3;
      });
      var bset = {};
      bt.forEach(function (t) {
        bset[t] = 1;
      });
      var bn = Object.keys(bset).length,
        inter = 0;
      bt.forEach(function (t) {
        if (_dset[t]) inter++;
      });
      var mm = Math.min(bn, _dn);
      if (mm && inter / mm >= 0.7) return false;
    }
    return true;
  });
  var _bl = function (l) {
    return '<div class="dt-line">' + l + "</div>";
  };
  var _sec = function (t) {
    return '<div class="dt-sec">' + t + "</div>";
  };
  /* 2026-10-08: no NUMBERS/SCOPE split — one list, data order */
  h += lines.map(_bl).join("");
  if (it.note) h += _sec("NOTES") + '<div class="dt-note">' + it.note + "</div>";
  h += '<div class="dt-links">';
  if (it.tags && it.tags.length)
    h +=
      '<span class="dt-stack">' +
      it.tags
        .map(function (t, i) {
          return '<span class="mps">' + (i ? "\u00b7\u00a0" : "") + String(t).toUpperCase() + "</span>";
        })
        .join(" ") +
      "</span>";
  h += '<span class="dt-linkrow">';
  h += '<a class="card-l" href="cv.pdf" target="_blank" rel="noopener">OPEN CV ↗</a>';
  if (it.link)
    h += '<a class="card-l" href="' + it.link + '" target="_blank" rel="noopener">' + linkText(it) + "</a>";
  h += "</span></div>";
  dtBody.innerHTML = h;
  var sc = dtView.querySelector(".dt-scroll");
  if (sc) sc.scrollTop = 0;
  dtFadeCheck(); /* v7 N8: the "more below" fade reflects the fresh content */
  dtView.classList.add("live");
}
function closeDetail() {
  S.detailId = null;
  dtView.classList.remove("live");
  var _s = dtView.querySelector(".dt-scroll");
  if (_s) {
    _s.classList.remove("morescroll");
    _s.scrollTop = 0;
  }
  clearTrayShift();
  focusSrc();
}
/* v7 N8: "more below" fade — passive listener, rAF-throttled, one boolean
flip (no layout thrash) */
var dtFadeOn = false,
  dtFadeRaf = null;
function dtFadeCheck() {
  if (dtFadeRaf) return;
  dtFadeRaf = requestAnimationFrame(function () {
    dtFadeRaf = null;
    var s = dtView.querySelector(".dt-scroll");
    if (!s) return;
    var more = s.scrollHeight > s.clientHeight + 4 && s.scrollTop + s.clientHeight < s.scrollHeight - 4;
    if (more !== dtFadeOn) {
      dtFadeOn = more;
      s.classList.toggle("morescroll", more);
    }
  });
}
(function () {
  var _sc = dtView.querySelector(".dt-scroll");
  if (_sc) _sc.addEventListener("scroll", dtFadeCheck, { passive: true });
})();
/* F1: undo the sheet's tray shift (the tray is rebuilt on render anyway) */
function clearTrayShift() {
  var t = arcBody.querySelector(".tray");
  if (t && t.style.transform) t.style.transform = "";
}
function positionCard(el) {
  /* the card is anchored to the DISK'S CELL, in the scroller's content coords
(stage px). P7: try ABOVE, BELOW, BESIDE-RIGHT, BESIDE-LEFT in order and
take the first one fully inside the glass that covers NO other disk;
if none qualifies, take the one covering the least disk area. It never
moves the grid and the arrow points at the disk. */
  var sc = S.scale || 1;
  var scroll = document.querySelector(".arc-scroll");
  var sr = scroll.getBoundingClientRect();
  var toX = function (x) {
    return (x - sr.left) / sc + scroll.scrollLeft;
  };
  var toY = function (y) {
    return (y - sr.top) / sc + scroll.scrollTop;
  };
  /* v7 G1b (R1): if the tag chips would wrap to a second line, widen the
card (max 400) so they sit on one line — a 2-line tag row made the
worst-case card too tall to clear the disk row */
  var contentW = scroll.clientWidth,
    contentH = scroll.clientHeight;
  cardEl.style.width = "";
  var tagsEl = cardEl.querySelector(".card-tags");
  if (tagsEl) {
    var oneLine = 0,
      chips = tagsEl.querySelectorAll("span");
    chips.forEach(function (c) {
      oneLine += c.offsetWidth + 5;
    });
    if (oneLine - 5 > tagsEl.clientWidth + 1)
      cardEl.style.width = Math.min(460, oneLine + 32, Math.floor(contentW - 16)) + "px";
  }
  var cw = cardEl.offsetWidth,
    ch = cardEl.offsetHeight;
  var gap = 14,
    m = 8,
    CLR = 12;
  /* v7 G1b (R1): disk rects come from the DECLARED layout (wrap left/top),
not the live bounding rect — a mid drop-in / left-top transition rect
is up to ~34 px off and used to misplace the card. .objs is static, so
its rect is a stable origin; the wrap's inline left/top is the settled
position. ALL disks count — the source disk included (the card must
never overlap any disk). */
  var objs = arcBody.querySelector(".objs");
  var objsR = objs.getBoundingClientRect();
  var bX = toX(objsR.left),
    bY = toY(objsR.top);
  var dSize = CELL.disk;
  var srcWrap = el.parentElement;
  var dL = bX + parseFloat(srcWrap.style.left || "0");
  var dT = bY + parseFloat(srcWrap.style.top || "0");
  var dR = dL + dSize,
    dB = dT + dSize;
  var dCx = (dL + dR) / 2,
    dCy = (dT + dB) / 2;
  var all = [];
  arcBody.querySelectorAll(".obj-wrap").forEach(function (w) {
    var l = bX + parseFloat(w.style.left || "0");
    var t = bY + parseFloat(w.style.top || "0");
    all.push({ l: l, t: t, r: l + dSize, b: t + dSize });
  });
  var covRect = function (l, t, w, h) {
    var a = 0;
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      var w2 = Math.min(l + w, o.r) - Math.max(l, o.l);
      var h2 = Math.min(t + h, o.b) - Math.max(t, o.t);
      if (w2 > 0 && h2 > 0) a += w2 * h2;
    }
    return a;
  };
  /* clearance on the candidate's axis (vertical for above/below,
horizontal for right/left) */
  var axisSep = function (l, t, w, h, ax) {
    var s = Infinity;
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      var d = ax === "v" ? Math.max(o.t - (t + h), t - o.b) : Math.max(o.l - (l + w), l - o.r);
      if (d < s) s = d;
    }
    return s === Infinity ? Infinity : s;
  };
  /* F1: EVERY disk counts for the sheet test, the source disk included */
  var allDisks = all;
  var cands;
  if (S.phone && dT - gap - ch < m) {
    /* #4: on phone, when there is not enough room above the disk for the
whole card, anchor it BELOW — the clamped "above" used to sit over the
disk's shutter (~25 px). Bottom rows have room above and keep it. */
    cands = [{ mode: "below", ax: "v", l: dCx - cw / 2, t: dB + gap }];
  } else {
    cands = [
      { mode: "above", ax: "v", l: dCx - cw / 2, t: dT - gap - ch },
      { mode: "below", ax: "v", l: dCx - cw / 2, t: dB + gap },
      { mode: "right", ax: "h", l: dR + gap, t: dCy - ch / 2 },
      { mode: "left", ax: "h", l: dL - gap - cw, t: dCy - ch / 2 }
    ];
  }
  /* valid = zero overlap with every disk AND >= 12 px clearance on the
candidate's own axis; prefer above, then below, then beside */
  var valid = null,
    minA = Infinity,
    minC = null;
  cands.forEach(function (c) {
    var l = Math.min(Math.max(c.l, m), Math.max(m, contentW - cw - m));
    var t = Math.min(Math.max(c.t, m), Math.max(m, contentH - ch - m));
    var a = covRect(l, t, cw, ch);
    if (a === 0 && axisSep(l, t, cw, ch, c.ax) >= CLR && !valid)
      valid = { mode: c.mode, ax: c.ax, l: l, t: t };
    if (a < minA) {
      minA = a;
      minC = { mode: c.mode, ax: c.ax, l: l, t: t };
    }
  });
  var pick = valid || minC;
  var mode = pick.mode,
    left = pick.l,
    top = pick.t;
  /* v7 G1b (R1): if the clamped pick still overlaps (min-overlap fallback),
nudge it along its axis, AWAY from its disk, until it clears or hits
the content margin */
  (function () {
    var guard = 0;
    var lo = pick.ax === "v" ? m : m,
      hi = pick.ax === "v" ? contentH - ch - m : contentW - cw - m;
    while (guard++ < 80 && covRect(left, top, cw, ch) > 0) {
      if (pick.ax === "v") {
        if (mode === "above") {
          if (top <= lo) break;
          top--;
        } else {
          if (top >= hi) break;
          top++;
        }
      } else {
        if (mode === "right") {
          if (left >= hi) break;
          left++;
        } else {
          if (left <= lo) break;
          left--;
        }
      }
    }
  })();
  /* F1: on phone a card must NEVER cover a disk. If the chosen spot still
covers one, pin the card as a BOTTOM SHEET — full glass width, anchored
to the glass bottom (above the status bar). If even the sheet would
cover the bottom disks, shift the tray up until it clears. */
  var sheetW = 0;
  /* cover ANY disk — the source disk included (a clamped "below" can sit
back over it): that is what sends the card into sheet mode */
  var covAll = function (l, t, w, h) {
    var a = 0;
    for (var i2 = 0; i2 < allDisks.length; i2++) {
      var o2 = allDisks[i2];
      var w4 = Math.min(l + w, o2.r) - Math.max(l, o2.l);
      var h4 = Math.min(t + h, o2.b) - Math.max(t, o2.t);
      if (w4 > 0 && h4 > 0) a += w4 * h4;
    }
    return a;
  };
  if (S.phone && covAll(left, top, cw, ch) > 0) {
    var sw2 = scroll.clientWidth,
      sh2 = scroll.clientHeight;
    sheetW = sw2 - 2 * m;
    cardEl.style.width = Math.round(sheetW) + "px";
    ch = cardEl.offsetHeight; /* re-measure at sheet width — the title may rewrap */
    cw = sheetW;
    mode = "sheet";
    left = m;
    top = (scroll.scrollHeight > sh2 ? scroll.scrollTop : 0) + sh2 - ch - m;
    if (top < m) top = m;
  }
  var tray = arcBody.querySelector(".tray");
  if (tray) tray.style.transform = ""; /* recompute any tray shift from scratch */
  if (mode === "sheet" && tray) {
    var hitAll = 0;
    for (var j = 0; j < allDisks.length; j++) {
      var od = allDisks[j];
      var w3 = Math.min(left + sheetW, od.r) - Math.max(left, od.l);
      var h3 = Math.min(top + ch, od.b) - Math.max(top, od.t);
      if (w3 > 0 && h3 > 0) hitAll += w3 * h3;
    }
    if (hitAll > 0) {
      var need = 0;
      for (var k = 0; k < allDisks.length; k++) need = Math.max(need, allDisks[k].b - (top - 12));
      if (need > 0) tray.style.transform = "translateY(" + -Math.ceil(need) + "px)";
    }
  }
  cardEl.classList.remove("below", "mode-left", "mode-right", "sheet");
  if (mode === "below") cardEl.classList.add("below");
  else if (mode === "left") cardEl.classList.add("mode-left");
  else if (mode === "right") cardEl.classList.add("mode-right");
  else if (mode === "sheet") cardEl.classList.add("sheet");
  if (mode === "sheet")
    cardEl.style.width = Math.round(sheetW) + "px"; /* else keep the adaptive width set above */
  cardEl.style.left = Math.round(left) + "px";
  cardEl.style.top = Math.round(top) + "px";
  if (mode === "left" || mode === "right") {
    var py = Math.min(Math.max(dCy - top, 16), ch - 16);
    cardEl.style.setProperty("--py", Math.round(py) + "px");
  } else {
    var px = Math.min(Math.max(dCx - left, 16), cw - 16);
    cardEl.style.setProperty("--px", Math.round(px) + "px");
  }
}
function focusSrc() {
  /* return focus to the disk that opened the card/detail (or first disk) */
  var el = S.detailSrc || S.cardSrc;
  if (!el || !el.isConnected) el = arcBody.querySelector(".obj");
  if (el) el.focus({ preventScroll: false });
  S.cardSrc = null;
  S.detailSrc = null;
}
function closeCard() {
  clearTrayShift();
  var wasOpen = !!S.cardId || (cardEl && !cardEl.hidden);
  S.cardId = null;
  if (cardEl) cardEl.hidden = true;
  if (S.detailId) closeDetail();
  if (!wasOpen) return;
  /* safety: the folder must never be left blank */
  if (!arcBody.querySelector(".obj")) {
    render(false);
    return;
  }
  focusSrc();
}
/* click-outside closes */
document.addEventListener("pointerdown", function (e) {
  if (crumbMenu && !crumb.contains(e.target)) closeCrumbMenu();
  if (!cardEl || cardEl.hidden) return;
  if (cardEl.contains(e.target)) return;
  if (e.target.closest && e.target.closest(".obj,.plain-row")) return; // handled by click
  closeCard();
});
/* re-fit the breadcrumb whenever the header width really changes (first layout after boot, fonts loading) */
(function () {
  var top = crumb.parentElement,
    lastW = -1;
  function refit() {
    var w = top.clientWidth;
    if (w > 0 && w !== lastW && !crumbMenu) {
      lastW = w;
      renderCrumb();
    }
  }
  if (window.ResizeObserver) new ResizeObserver(refit).observe(top);
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      lastW = -1;
      refit();
    });
})();
window.addEventListener("resize", function () {
  cancelDrag();
  fitStage();
  renderCrumb();
  if (cardEl && !cardEl.hidden && S.cardId) {
    var el = arcBody.querySelector('[data-item="' + S.cardId + '"]');
    if (el) positionCard(el);
  }
  if (S.phase === "archive" && !S.plain) applyLayout();
});
