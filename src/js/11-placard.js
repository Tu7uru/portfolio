/* ============================== PLACARD ============================== */
var cardEl = null;
function buildCardEl() {
  cardEl = document.createElement("div");
  cardEl.className = "card";
  cardEl.hidden = true;
  cardEl.setAttribute("role", "dialog");
  /* review #4: labelled by the card's own title, not the literal word "description" */
  cardEl.setAttribute("aria-labelledby", "cardTitle");
  /* inside the scroller: the card scrolls with its disk and is always clipped
to the glass — it never pushes the grid and never floats off the screen */
  document.querySelector(".arc-scroll").appendChild(cardEl);
}
function metaLine(it) {
  /* v7 N4: the "·" belongs to the START of the next segment (no-break
space) — a line can end on a segment, never on a dangling "·" */
  var sgs = metaSegs(it);
  return sgs
    .map(function (seg, i) {
      return '<span class="mps">' + (i ? "\u00b7\u00a0" : "") + seg + "</span>";
    })
    .join(" ");
}
function metaSegs(it) {
  /* period can already contain "A · B" — merge with role and drop repeats */
  var segs = (it.period ? String(it.period).split("·") : []).concat(it.role ? [String(it.role)] : []);
  var seen = {},
    out = [];
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i].trim();
    if (!s) continue;
    var k = s.toLowerCase();
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(s);
  }
  return out;
}
/* #6/F2: the meta line WRAPS to 2 lines before anything is dropped;
whole "·" segments are removed only while it still overflows 2 lines.
Never cut mid-word. Must run while the card is VISIBLE (a hidden box
reports scrollWidth 0, which is what made the old pass a no-op). */
function fitMeta(el) {
  if (!el) return;
  var segs = el.__segs || [],
    i = segs.length;
  var render = function (n) {
    el.innerHTML = segs
      .slice(0, n)
      .map(function (seg, k) {
        return '<span class="mps">' + seg + (k < n - 1 ? " ·" : "") + "</span>";
      })
      .join(" ");
  };
  var tall = function () {
    return el.scrollHeight > el.clientHeight + 1;
  };
  while (i > 1 && tall()) {
    i--;
    render(i);
  }
  if (i < segs.length) render(i);
  /* review #10: a chunk whose next chunk starts a NEW line must not keep its
   trailing "·" — the separator dangled at line end */
  var mps = Array.prototype.slice.call(el.querySelectorAll(".mps"));
  for (var j = 0; j < mps.length - 1; j++) {
    if (mps[j + 1].offsetTop > mps[j].offsetTop + 1)
      mps[j].textContent = mps[j].textContent.replace(/\s*·\s*$/, "");
  }
}
/* ONE link-label builder for every surface (card + detail): clean, upper,
always ends with ↗ ("REPO ↗" by default). */
function linkText(it) {
  var lab = String(it.linkLabel || "REPO")
    .replace(/^\s*—\s*/, "")
    .replace(/\s*↗\s*$/, "")
    .trim()
    .toUpperCase();
  if (!lab) lab = "REPO";
  return lab + " ↗";
}
function cardHTML(it) {
  var h = '<button class="card-x" aria-label="close">✕</button>';
  h +=
    '<div class="card-t" id="cardTitle' + (it.title.length > 25 ? " long" : "") + '">' + it.title + "</div>";
  var meta = metaLine(it);
  if (meta) h += '<div class="card-p">' + meta + "</div>";
  if (it.tags && it.tags.length) {
    h +=
      '<div class="card-tags">' +
      it.tags
        .map(function (t) {
          return "<span>" + t + "</span>";
        })
        .join("") +
      "</div>";
  }
  h += '<p class="card-d">' + it.desc + "</p>";
  var isCV = it.link && (it.link === "HaralambosVarsamis_CV.pdf" || /^open cv/i.test(it.linkLabel || ""));
  /* v6 card button rules — derived from the item's data, not per item
(documented in CONTENT-GUIDE.md):
contact-style link item (its own link, no detail)  -> its link ONLY
CV-only item (the CV)                          -> OPEN CV ONLY
everything else (about / work / project)           -> VIEW MORE (if it
has detail) +
OPEN CV, plus
REPO/OPEN when the
item has a non-CV link */
  var isContact = it.link && !isCV && !it.detail;
  h += '<div class="card-actions">';
  h += it.detail
    ? '<button class="card-more" type="button">VIEW MORE</button>'
    : '<span aria-hidden="true"></span>';
  h += '<span class="card-right">';
  if (!isContact)
    h += '<a class="card-l" href="HaralambosVarsamis_CV.pdf" target="_blank" rel="noopener">OPEN CV ↗</a>';
  if (it.link && !isCV) {
    if (!isContact) h += '<i class="card-sep" aria-hidden="true"></i>';
    h += '<a class="card-l" href="' + it.link + '" target="_blank" rel="noopener">' + linkText(it) + "</a>";
  }
  h += "</span></div>";
  return h;
}
function showCard(id) {
  var it = findItem(id);
  if (!it) return;
  var el = arcBody.querySelector('[data-item="' + id + '"]');
  if (!el) return;
  if (S.cardId === id && !cardEl.hidden) {
    return;
  }
  S.cardId = id;
  S.cardSrc = el;
  cardEl.innerHTML = cardHTML(it);
  cardEl.classList.remove("below", "mode-left", "mode-right", "sheet");
  cardEl.style.width = "";
  cardEl.hidden = false; /* F2: visible BEFORE measuring the meta line */
  /* F2: meta wraps to 2 lines; drop whole segments only if still too tall */
  var pm = cardEl.querySelector(".card-p");
  if (pm) {
    pm.__segs = metaSegs(it);
    fitMeta(pm);
  }
  positionCard(el);
  cardEl.querySelector(".card-x").addEventListener("click", closeCard);
  var vm = cardEl.querySelector(".card-more");
  if (vm)
    vm.addEventListener("click", function () {
      AU.blip(1600, 0.03, 0.05);
      openDetail(it.id);
    });
  /* the open card is reachable by Tab: land focus on its close button;
closing returns focus to the disk (focusSrc) */
  cardEl.querySelector(".card-x").focus({ preventScroll: true });
}
