/* ============================== DOS SHELL (v7 G3 item 15) ============================== */
/* a typed prompt on the glass — desktop stage only. It navigates the SAME
archive (S.path). v7 I (I2): PATH NAVIGATION ONLY — DIR, LS, CD (name / .. / .. / \)
and HELP; everything else says so, and TAB completes path names. */
var dosS = { open: false, buf: "", hist: [], hIdx: -1, errT: null };
function dosItems() {
  var n = curNode();
  if (n) return n.items;
  return CATS.map(function (c) {
    return { id: c, label: c, folder: true, items: DATA[c].items };
  });
}
function dosPathStr() {
  return (
    "C:\\TU7URU" +
    S.path
      .map(function (x) {
        return "\\" + x;
      })
      .join("")
  );
}
function dosUpdatePs() {
  var p = document.getElementById("dosPs");
  if (p) p.textContent = dosPathStr();
}
function dosOut() {
  return document.getElementById("dosOut");
}
function dosPrint(lines) {
  var out = dosOut(),
    sc = document.querySelector(".dos-scroll");
  lines.forEach(function (l) {
    var d = document.createElement("div");
    d.className = "dos-row" + (/^Bad command/.test(l) ? " dos-err" : "");
    d.textContent = l;
    out.appendChild(d);
  });
  sc.scrollTop = sc.scrollHeight;
  if (dosS.errT) {
    clearTimeout(dosS.errT);
    dosS.errT = null;
  }
  if (lines.length && /^Bad command/.test(lines[lines.length - 1])) {
    var last = out.lastChild;
    dosS.errT = setTimeout(function () {
      if (last && last.parentNode) last.remove();
      dosS.errT = null;
    }, 2000);
  }
}
function dosClearInput() {
  dosS.buf = "";
  dosS.hIdx = -1;
  var t = document.getElementById("dosTxt");
  if (t) t.textContent = "";
}
/* I2: the help text — exactly the supported commands, one line each.
   HELP / --help / /? all print it. */
function dosHelp() {
  return [
    "Available commands:",
    "  DIR          list the current folder",
    "  LS           list the items here, with their titles",
    "  CD <name>    enter folder <name>",
    "  CD ..        go up one level",
    "  CD..         go up one level (no-space form)",
    "  CD \\         go back to the root drive",
    "  HELP         show this help (also: --help, /?)"
  ];
}
function dosSetBuf(s) {
  dosS.buf = s;
  var t = document.getElementById("dosTxt");
  if (t) t.textContent = s;
}
/* I2: TAB completes PATH NAMES from the current directory (case-insensitive
   prefix). One hit -> complete it; several -> first Tab the common prefix,
   second Tab the list. Empty line / DIR list the entries. */
function dosTab() {
  var buf = dosS.buf,
    m = buf.match(/^(cd)([ \t](.*))?$/i);
  if (m) {
    var arg = m[3] || "",
      cand = [];
    if (S.path.length) cand.push("..");
    dosItems().forEach(function (it) {
      cand.push(it.label);
    });
    var up = arg.toUpperCase();
    var hits = cand.filter(function (x) {
      return x.toUpperCase().indexOf(up) === 0;
    });
    if (!hits.length) {
      if (AU.blip) AU.blip(240, 0.05, 0.03);
      return;
    } /* no match: no change */
    if (hits.length === 1) {
      dosSetBuf("cd " + hits[0] + " ");
      return;
    }
    var pre = hits[0].toUpperCase(),
      i,
      j;
    for (i = 1; i < hits.length; i++) {
      var a2 = hits[i].toUpperCase();
      j = 0;
      while (j < pre.length && j < a2.length && pre[j] === a2[j]) j++;
      pre = pre.slice(0, j);
    }
    if (pre.length > arg.length) {
      dosSetBuf("cd " + hits[0].slice(0, pre.length));
      return;
    } /* first Tab */
    dosPrint([hits.join("  ")]); /* second Tab: list the candidates */
    dosFit();
    return;
  }
  var t = buf.trim(),
    c0 = t.toUpperCase();
  if (!t || c0 === "DIR" || c0 === "LS") {
    dosPrint([
      dosItems()
        .map(function (it) {
          return it.label;
        })
        .join("  ")
    ]);
    dosFit();
  }
}
function dosRun(cmd) {
  dosS.hist.push(cmd);
  if (dosS.hist.length > 50) dosS.hist.shift();
  var trimmed = cmd.trim(),
    words = trimmed.split(/\s+/);
  var c = (words[0] || "").toUpperCase(),
    arg = trimmed.length > words[0].length ? trimmed.slice(words[0].length).trim() : "";
  /* review #12: the no-space forms — CD.. and CD\, like "CD .." */
  if (c === "CD.." || c === "CD.") {
    c = "CD";
    arg = "..";
  } else if (c === "CD\\") {
    c = "CD";
    arg = "\\";
  }
  var lines = [],
    its;
  if (c === "DIR") {
    /* DOS-aligned: name padded to 12, type column at 14, summary
right-aligned under the type column */
    lines.push("Directory of " + dosPathStr() + "\\");
    lines.push("");
    its = dosItems();
    var nd = 0,
      nf = 0;
    its.forEach(function (it) {
      var isDir = !!(it.folder || it.items);
      if (isDir) nd++;
      else nf++;
      lines.push(
        (it.label.length < 12 ? it.label + " ".repeat(12 - it.label.length) : it.label) +
          "  " +
          (isDir ? "<DIR>" : "FILE")
      );
    });
    if (nd) lines.push((nd + " dir(s)").padStart(16));
    if (nf) lines.push((nf + " file(s)").padStart(16));
    dosPrint(lines);
  } else if (c === "LS") {
    /* 2026-10-21: LS (any case) — one line per item: name, then a folder's
   item count or a file's title, so a visitor sees what is here at a glance */
    its = dosItems();
    if (!its.length) lines.push("(empty)");
    its.forEach(function (it) {
      var isDir = !!(it.folder || it.items),
        name = it.label + (isDir ? "\\" : "");
      var main =
        it.title && it.title.toUpperCase() !== it.label.toUpperCase() ? it.title : it.role || it.title || "";
      var info = isDir ? (it.items || []).length + " item(s)" : [main, it.period].filter(Boolean).join(" · ");
      lines.push((name.length < 14 ? name + " ".repeat(14 - name.length) : name + "  ") + info);
    });
    dosPrint(lines);
  } else if (c === "CD") {
    if (!arg) {
      lines.push(dosPathStr() + "\\");
      dosPrint(lines);
      dosClearInput();
      return;
    }
    if (arg.indexOf("/") >= 0) {
      /* I2: ''/'' paths are out — path names only */
      lines.push(
        "'" + trimmed + "' is not supported. Only path navigation is available — type HELP or --help."
      );
      dosPrint(lines);
      dosClearInput();
      return;
    }
    if (arg === "\\") {
      /* review #12: CD\ = straight to root */
      if (S.path.length) {
        S.path = [];
        render(true);
        dosUpdatePs();
      }
      dosClearInput();
      return;
    }
    if (arg.toUpperCase() === "..") {
      if (S.path.length) {
        S.path.pop();
        render(true);
        dosUpdatePs();
      }
      dosClearInput();
      return;
    }
    its = dosItems();
    var m = null;
    for (var i = 0; i < its.length; i++)
      if (its[i].label.toUpperCase() === arg.toUpperCase()) {
        m = its[i];
        break;
      }
    if (m && (m.folder || m.items)) {
      S.path = S.path.concat([m.id]);
      render(true);
      dosUpdatePs();
    } else {
      lines.push("Bad command or file name");
      dosPrint(lines);
    }
    dosFit();
    dosClearInput();
    return;
  } else if (c === "HELP" || c === "--HELP" || c === "/?") {
    /* I2: HELP / --help / /? — the same text, every time */
    dosPrint(dosHelp());
  } else {
    /* I2: anything else — bash and DOS vocabulary alike — gets the message */
    lines.push(
      "'" + words[0] + "' is not supported. Only path navigation is available — type HELP or --help."
    );
    dosPrint(lines);
  }
  dosClearInput();
}
function dosKey(e) {
  var k = e.key;
  if (k === "Enter") {
    e.preventDefault();
    if (!dosS.buf.trim()) {
      /* review #12: an empty Enter does not close — it prints a fresh prompt */
      dosPrint([dosPathStr() + "\\"]);
      dosFit();
      return;
    }
    dosRun(dosS.buf);
    return;
  }
  if (k === "Escape") {
    e.preventDefault();
    closeDos();
    return;
  }
  if (k === "ArrowUp") {
    e.preventDefault();
    if (dosS.hist.length) {
      dosS.hIdx = dosS.hIdx < 0 ? dosS.hist.length : dosS.hIdx - 1;
      if (dosS.hIdx >= dosS.hist.length) dosS.hIdx = dosS.hist.length - 1;
      dosS.buf = dosS.hist[dosS.hIdx] || "";
      document.getElementById("dosTxt").textContent = dosS.buf;
    }
    return;
  }
  if (k === "ArrowDown") {
    e.preventDefault();
    if (dosS.hIdx >= 0) {
      dosS.hIdx++;
      dosS.buf = dosS.hIdx >= dosS.hist.length ? "" : dosS.hist[dosS.hIdx] || "";
      if (dosS.hIdx >= dosS.hist.length) dosS.hIdx = -1;
      document.getElementById("dosTxt").textContent = dosS.buf;
    }
    return;
  }
  if (k === "Tab") {
    e.preventDefault();
    dosTab();
    return;
  } /* I2: complete, never move focus */
  if (/^(ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|F\d+|Enter)$/.test(k)) {
    e.preventDefault();
    return;
  }
  if (k === "Backspace") {
    e.preventDefault();
    dosS.buf = dosS.buf.slice(0, -1);
    document.getElementById("dosTxt").textContent = dosS.buf;
    return;
  }
  if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (dosS.buf.length < 60) {
      dosS.buf += k;
      document.getElementById("dosTxt").textContent = dosS.buf;
    }
    return;
  }
  e.preventDefault(); /* swallow the rest — nothing leaks to the shelf */
}
function dosFit() {
  /* the console is a pure overlay: docked above the status bar, and capped
so it never covers a disk row, an open card, or 45% of the glass.
Measured live; the shelf's own layout is never touched. */
  var dosEl = document.getElementById("dos");
  var sc = dosEl.querySelector(".dos-scroll");
  if (!sc || dosEl.hidden || !S.scale) return;
  var st = document.querySelector(".arc-status");
  if (st) dosEl.style.bottom = st.offsetHeight + "px";
  var objs = arcBody.querySelectorAll(".obj");
  var db = 0;
  for (var i = 0; i < objs.length; i++) {
    var r = objs[i].getBoundingClientRect();
    if (r.bottom > db) db = r.bottom;
  }
  var card = cardEl;
  if (card && !card.hidden) {
    var cr = card.getBoundingClientRect();
    if (cr.bottom > db) db = cr.bottom;
  }
  var glass = document.getElementById("glass").getBoundingClientRect();
  var dr = dosEl.getBoundingClientRect();
  var cap = Math.min(dr.bottom - db - 24, glass.height * 0.45) / S.scale;
  sc.style.maxHeight = Math.max(52, cap) + "px";
}
window.addEventListener("resize", function () {
  if (dosS.open) dosFit();
});
function openDos() {
  if (dosS.open || S.phone) return;
  dosS.open = true;
  var dos = document.getElementById("dos");
  dos.hidden = false;
  var dosBtn = document.getElementById("dosBtn");
  dosBtn.classList.add("on");
  dosBtn.setAttribute("aria-expanded", "true"); /* review #4 */
  document.getElementById("dosPs").textContent = dosPathStr();
  dosFit();
  document.querySelector("#dos .dos-line").focus(); /* review #4: the prompt takes focus */
  AU.blip(1200, 0.03, 0.05);
}
/* 2026-10-21: close without moving focus — used when a detail view opens */
function dosHide() {
  if (!dosS.open) return;
  dosS.open = false;
  document.getElementById("dos").hidden = true;
  var dosBtn = document.getElementById("dosBtn");
  dosBtn.classList.remove("on");
  dosBtn.setAttribute("aria-expanded", "false");
  dosClearInput();
  if (dosS.errT) {
    clearTimeout(dosS.errT);
    dosS.errT = null;
  }
}
function closeDos() {
  if (!dosS.open) return;
  dosS.open = false;
  document.getElementById("dos").hidden = true;
  var dosBtn = document.getElementById("dosBtn");
  dosBtn.classList.remove("on");
  dosBtn.setAttribute("aria-expanded", "false"); /* review #4 */
  dosBtn.focus(); /* review #4: focus returns to the button */
  dosClearInput();
  if (dosS.errT) {
    clearTimeout(dosS.errT);
    dosS.errT = null;
  }
  AU.blip(900, 0.03, 0.05);
}
document.getElementById("dosBtn").addEventListener("click", function () {
  if (dosS.open) closeDos();
  else openDos();
});
/* QA / test hook */
window.__dos = {
  state: function () {
    return {
      open: dosS.open,
      buf: dosS.buf,
      out: Array.prototype.map.call(dosOut().children, function (x) {
        return x.textContent;
      })
    };
  }
};
