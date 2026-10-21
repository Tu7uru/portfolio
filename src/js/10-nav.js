/* ============================== NAV ACTIONS ============================== */
/* disk inserter: 3.5" slot in the case's bottom strip (or control row on phone) */
function dsSlotEl() {
  var els = document.querySelectorAll(".ds-in");
  for (var i = 0; i < els.length; i++) if (els[i].offsetParent !== null) return els[i];
  return els[0];
}
/* the slot is sized from the same constant as the disk (--slot), so it never changes */
function dsLoad() {
  var el = dsSlotEl();
  if (!el) return;
  el.classList.remove("busy");
  void el.offsetWidth; /* restart LED blink */
  el.classList.add("busy");
  setTimeout(function () {
    el.classList.remove("busy");
  }, 1000);
}
/* disk lifts, tilts toward the viewer, then travels down into the slot (~750 ms).
v6: the flying clone is a SCALED COPY of the real disk — the holder is sized
in screen px, the clone itself is laid out in stage px and scaled by the
stage scale k, so every proportion (shutter, label, scene) is exactly the
real disk's. The scene never reads huge, and the scene never enlarges. */
function diskFly(el, done) {
  dsLoad();
  var slot = dsSlotEl();
  if (RM || !el || !slot || !el.animate) {
    done();
    return;
  }
  var sr = slot.getBoundingClientRect(),
    or = el.getBoundingClientRect();
  var sw = el.offsetWidth || or.width,
    sh = el.offsetHeight || or.height; /* stage px */
  var k = (or.width || sw) / sw; /* screen px per stage px (≈ the stage scale) */
  /* v7 G2 (item 13): the SINK clip — a fixed wrapper whose bottom edge is
the slot mid-line; the disk dives under it instead of fading out */
  var mid = sr.top + sr.height / 2;
  var wrapL = Math.min(or.left, sr.left) - 40,
    wrapT = Math.min(or.top, sr.top) - 40;
  var wrapR = Math.max(or.left + or.width, sr.left + sr.width) + 40;
  var wrap = document.createElement("div");
  wrap.className = "disk-sink";
  wrap.style.cssText =
    "left:" +
    wrapL +
    "px;top:" +
    wrapT +
    "px;width:" +
    (wrapR - wrapL) +
    "px;height:" +
    (mid - wrapT) +
    "px;";
  var holder = document.createElement("div");
  /* K: the holder carries the skin class — the shell colour is painted by the
   `.skin-floppy .obj` descendant rule, and the clone (reparented to <body>)
   loses its original skin ancestor, so without this it falls back to plain
   plastic and lands with a colour pop. fly only runs when !S.plain. */
  holder.className = "disk-fly-holder skin-" + S.skin;
  holder.style.cssText =
    "position:absolute;left:" +
    (or.left - wrapL) +
    "px;top:" +
    (or.top - wrapT) +
    "px;width:" +
    or.width +
    "px;height:" +
    or.height +
    "px;margin:0;z-index:200;pointer-events:none;";
  var clone = el.cloneNode(true);
  clone.classList.add("disk-fly");
  clone.style.cssText =
    "margin:0;width:" +
    sw +
    "px;height:" +
    sh +
    "px;transform:scale(" +
    k +
    ");transform-origin:0 0;transition:none;";
  /* I1: the plastic colour comes from a per-category CSS var that the
   data-* attributes below would orphan — copy the resolved values in */
  var cse = getComputedStyle(el);
  ["--shell-1", "--shell-2", "--stripe"].forEach(function (p) {
    var v = cse.getPropertyValue(p);
    if (v) clone.style.setProperty(p, v);
  });
  /* a fly clone is a VISUAL only: it must never match a live-disk selector
(data-cat/folder/item/scene/cell) while in the DOM */
  Array.prototype.slice.call(clone.attributes).forEach(function (a) {
    if (a.name.indexOf("data-") === 0) clone.removeAttribute(a.name);
  });
  holder.appendChild(clone);
  wrap.appendChild(holder);
  document.body.appendChild(wrap);
  el.classList.add("opening");
  var tx = sr.left + sr.width / 2 - (or.left + or.width / 2);
  /* landing scale: the disk face fits the slot width when it goes in */
  var s2 = Math.max(0.8, (sr.width - 6) / or.width);
  var tyL = sr.bottom + 2 - or.height * s2 - or.top; /* visible landing: bottom just past the slot */
  var tyS = mid + 4 - or.top; /* sunk: the disk top is past the mid-line -> fully clipped */
  /* v7 G2 (item 13): 120 ms slot-lip highlight flash at flight offset .9 */
  var lip = slot.querySelector(".ds-lip"),
    la = null;
  if (lip && lip.animate) {
    la = lip.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.5 }, { opacity: 0 }], {
      delay: Math.round(750 * 0.9 - 60),
      duration: 120,
      easing: "ease-out"
    });
  }
  var a = holder.animate(
    [
      { transform: "translate(0,0) perspective(700px) rotateX(0deg) scale(1)", opacity: 1, offset: 0 },
      {
        transform: "translate(0px,-12px) perspective(700px) rotateX(22deg) scale(1.08)",
        opacity: 1,
        offset: 0.18
      },
      {
        transform:
          "translate(" +
          tx * 0.5 +
          "px," +
          (tyL * 0.42 - 8) +
          "px) perspective(700px) rotateX(46deg) scale(" +
          ((1 + s2) / 2).toFixed(3) +
          ")",
        opacity: 1,
        offset: 0.58
      },
      {
        transform:
          "translate(" + tx + "px," + tyL + "px) perspective(700px) rotateX(70deg) scale(" + s2 + ")",
        opacity: 1,
        offset: 0.82
      },
      {
        transform:
          "translate(" + tx + "px," + tyS + "px) perspective(700px) rotateX(74deg) scale(" + s2 + ")",
        opacity: 1,
        offset: 1
      }
    ],
    { duration: 750, easing: "cubic-bezier(.35,.15,.6,1)" }
  );
  diskFlyState = { wrap: wrap, anim: a, la: la, el: el };
  a.onfinish = function () {
    diskFlyState = null;
    wrap.remove();
    if (la) la.cancel();
    done();
  };
}
var diskFlyState = null;
function cancelDiskFly() {
  var st = diskFlyState;
  if (!st) return;
  diskFlyState = null;
  st.anim.cancel();
  if (st.la) st.la.cancel();
  st.wrap.remove();
  st.el.classList.remove("opening");
}
/* v7 G2 (item 8): eject — the REAL folder disk (a reverse of the insert
clone, with the folder's colour and label): it pops 6 px out of the slot
(cubic-bezier(.3,1.6,.5,1), 220 ms), then flies to its grid cell (320 ms).
The real disk stays visible (it is the next click target); the clone
simply lands on top of it. 220+320 = 540 ms — inside the 750 ms lock.
A nav click mid-flight interrupts the fly (interruptEject). */
function ejectFly(el, done) {
  dsLoad();
  var slot = dsSlotEl();
  if (!slot || !el || !el.animate) {
    done();
    return;
  }
  /* v7 G2 fix: the cell comes from the DECLARED layout (the wrap's inline
left/top, stage px, relative to .objs) — not a live bounding rect. Right
after the view renders the disk is mid drop-in (up to 34 px high); a
holder based on the live rect never touches the slot and lands 80+ px
off the real disk. .objs is position:relative, so the origin is its
rect; S.scale converts stage px to viewport px. */
  var sc = S.scale || 1;
  var w = el.parentElement;
  var objs = arcBody.querySelector(".objs");
  var objsR = objs.getBoundingClientRect();
  var or = {
    left: objsR.left + parseFloat(w.style.left || "0") * sc,
    top: objsR.top + parseFloat(w.style.top || "0") * sc,
    width: el.offsetWidth * sc,
    height: el.offsetHeight * sc
  };
  var sr = slot.getBoundingClientRect();
  var sw = el.offsetWidth || or.width / sc,
    sh = or.height; /* or is in viewport px */
  var k = sc;
  var holder = document.createElement("div");
  holder.className = "disk-fly-holder skin-" + S.skin; /* K: see insert fly — clone keeps its shell colour */
  holder.style.cssText =
    "position:fixed;left:" +
    or.left +
    "px;top:" +
    or.top +
    "px;width:" +
    or.width +
    "px;height:" +
    or.height +
    "px;margin:0;z-index:200;pointer-events:none;";
  var clone = el.cloneNode(true);
  clone.classList.add("disk-fly");
  clone.style.cssText =
    "margin:0;width:" +
    sw +
    "px;height:" +
    sh +
    "px;transform:scale(" +
    k +
    ");transform-origin:0 0;transition:none;";
  /* I1: the plastic colour comes from a per-category CSS var that the
   data-* attributes below would orphan — copy the resolved values in */
  var cse = getComputedStyle(el);
  ["--shell-1", "--shell-2", "--stripe"].forEach(function (p) {
    var v = cse.getPropertyValue(p);
    if (v) clone.style.setProperty(p, v);
  });
  /* a fly clone is a VISUAL only: it must never match a live-disk selector
(data-cat/folder/item/scene/cell) while in the DOM */
  Array.prototype.slice.call(clone.attributes).forEach(function (a) {
    if (a.name.indexOf("data-") === 0) clone.removeAttribute(a.name);
  });
  holder.appendChild(clone);
  document.body.appendChild(holder);
  /* K: the real disk is HIDDEN for the flight (the G2 "real disk stays
   visible" decision is what drew the disk twice) — but it keeps
   pointer-events, so a tap mid-flight still hits it (→ interruptEject)
   and stays the next click target. */
  el.classList.add("ejecting");
  var tx = sr.left + sr.width / 2 - (or.left + or.width / 2);
  var s2 = Math.max(0.8, (sr.width - 6) / or.width);
  /* transform-origin is the holder's CENTER, so the scale grows or.height/2
downward from the centre — the ty offsets are solved for the disk's
LOWER edge: start 16 px BELOW the slot mouth (inside the slot), pop
4 px above it (6 px out), then the cell. */
  var half2 = (or.height * s2) / 2,
    halfT = ((or.height * (s2 * 0.97)) / 2) * Math.cos((58 * Math.PI) / 180);
  var ty0 = sr.top + 16 - or.top - or.height / 2 - halfT;
  var ty1 = sr.top + 2 - or.top - or.height / 2 - half2;
  var a = holder.animate(
    [
      {
        transform:
          "translate(" +
          tx +
          "px," +
          ty0 +
          "px) perspective(600px) rotateX(58deg) scale(" +
          (s2 * 0.97).toFixed(3) +
          ")",
        opacity: 1,
        offset: 0,
        easing: "cubic-bezier(.3,1.6,.5,1)"
      },
      {
        transform: "translate(" + tx + "px," + ty1 + "px) perspective(600px) rotateX(0deg) scale(" + s2 + ")",
        opacity: 1,
        offset: 220 / 540,
        easing: "cubic-bezier(.25,.6,.3,1)"
      },
      { transform: "translate(0px,0px) perspective(600px) rotateX(0deg) scale(1)", opacity: 1, offset: 1 }
    ],
    { duration: 540 }
  );
  var st = { el: el, holder: holder, anim: a, clone: clone };
  ejectFlyState = st;
  /* I1: if the stage is resized mid-flight the fixed-px holder drifts from
the (rescaled) real disk — re-target once, 80 ms before landing. The
<1 px guard keeps a static stage byte-for-byte identical. */
  var snap = function () {
    var r = st.el.isConnected ? st.el.getBoundingClientRect() : null;
    if (!r || !r.width) return;
    if (Math.abs(r.left - or.left) + Math.abs(r.top - or.top) < 1) return;
    holder.style.left = r.left + "px";
    holder.style.top = r.top + "px";
    holder.style.width = r.width + "px";
    holder.style.height = r.height + "px";
    st.clone.style.width = r.width / S.scale + "px";
    st.clone.style.height = r.height / S.scale + "px";
    st.clone.style.transform = "scale(" + S.scale + ")";
  };
  st.tmr = setTimeout(snap, 460);
  /* I1: belt and braces — a fly whose onfinish is lost still vanishes by 600 ms */
  st.guard = setTimeout(function () {
    if (ejectFlyState === st) {
      ejectFlyState = null;
      st.el.classList.remove("ejecting");
      holder.remove();
      done();
    }
  }, 600);
  a.onfinish = function () {
    if (st.tmr) clearTimeout(st.tmr);
    if (st.guard) clearTimeout(st.guard);
    if (ejectFlyState === st) ejectFlyState = null;
    snap();
    /* K: reveal the real disk and remove the clone in the SAME synchronous
   block — no frame with both visible, no frame with neither */
    st.el.classList.remove("ejecting");
    holder.remove();
    done();
  };
}
/* the eject fly is short (540 ms) and the NEW view is already on screen
while it runs — so a click mid-flight INTERRUPTS it (real disk restored,
holder removed) and is processed, instead of being swallowed by the lock */
var ejectFlyState = null;
function cancelEjectFly() {
  var st = ejectFlyState;
  if (!st) return;
  ejectFlyState = null;
  if (st.tmr) clearTimeout(st.tmr);
  if (st.guard) clearTimeout(st.guard);
  st.anim.cancel();
  /* K: reveal the real disk in the same frame the clone is removed */
  st.el.classList.remove("ejecting");
  st.holder.remove();
}
function interruptEject() {
  if (!ejectFlyState) return false;
  cancelEjectFly();
  S.navBusy = false;
  return true;
}
function openCat(catId, el) {
  if (S.navBusy) {
    if (ejectFlyState) {
      cancelEjectFly();
      S.navBusy = false;
    } else return;
  }
  if (S.path[0] === catId && S.path.length === 1) return;
  AU.seek();
  AU.thock();
  S.path = [catId]; // target path is fixed at click time
  S.navBusy = true;
  var go = function () {
    S.navBusy = false;
    render(false);
  };
  /* review #1: PLAIN has no disks to fly — the plain list is instant, like eject */
  if (el && !RM && !S.plain) diskFly(el, go);
  else go();
}
function openFolder(fid, el) {
  if (S.navBusy) {
    if (ejectFlyState) {
      cancelEjectFly();
      S.navBusy = false;
    } else return;
  }
  if (S.path[S.path.length - 1] === fid) return;
  AU.seek();
  AU.thock();
  var base = S.path.slice(); // what the path WAS when the click happened
  S.path = base.concat([fid]);
  S.navBusy = true;
  var go = function () {
    S.navBusy = false;
    render(false);
  };
  /* review #1: PLAIN opens instantly (see openCat) */
  if (el && !RM && !S.plain) diskFly(el, go);
  else go();
}
function eject() {
  if (S.navBusy) {
    if (ejectFlyState) {
      cancelEjectFly();
      S.navBusy = false;
    } else return;
  }
  if (!S.path.length) return;
  AU.seek();
  var base = S.path.slice();
  var fid = base[base.length - 1];
  S.path = base.slice(0, -1);
  S.navBusy = true;
  if (RM || S.plain) {
    render(false);
    S.navBusy = false;
    return;
  }
  /* v7 G2 (item 8+9): the parent view appears AT ONCE (the old one's ghost
fades, item 9); the ejected folder's disk then pops out of the slot
and flies to its cell in the new view */
  render(false);
  var el =
    base.length === 1
      ? arcBody.querySelector('[data-cat="' + fid + '"]')
      : arcBody.querySelector('[data-folder="' + fid + '"]');
  if (!el || !el.animate) {
    S.navBusy = false;
    return;
  }
  ejectFly(el, function () {
    S.navBusy = false;
  });
}
function findItem(id) {
  var node = curNode();
  if (!node) return null;
  for (var i = 0; i < node.items.length; i++) if (node.items[i].id === id) return node.items[i];
  return null;
}
/* deep search across the whole tree (hash #open=) */
function findEverywhere(key) {
  function walk(node, prefix) {
    for (var i = 0; i < node.items.length; i++) {
      var it = node.items[i];
      if (it.id === key || (it.title || "").toLowerCase() === key.toLowerCase())
        return { node: node, path: prefix.concat(it.id) };
      if (it.folder) {
        var r = walk(it, prefix.concat(it.id));
        if (r) return r;
      }
    }
    return null;
  }
  for (var c = 0; c < CATS.length; c++) {
    var r = walk(DATA[CATS[c]], [CATS[c]]);
    if (r) return r;
  }
  return null;
}
