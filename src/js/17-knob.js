/* ============================== PHOSPHOR KNOB (P39 / P3) ============================== */
/* two identical knobs: the desktop right-strip one + the phone bottom-strip one */
(function () {
  var knobs = Array.prototype.slice.call(document.querySelectorAll(".phos-knob"));
  if (!knobs.length) return;
  var amber = false;
  try {
    amber = localStorage.getItem("archive_phos") === "amber";
  } catch (e) {}
  function apply() {
    glass.classList.toggle("amber", amber);
    var mon = document.getElementById("monitor");
    if (mon) mon.classList.toggle("amber", amber); /* v7 G2 (item 10): the spill is amber in P3 */
    knobs.forEach(function (k) {
      k.textContent = amber ? "P3" : "P39";
      k.classList.toggle("amber", amber);
      k.setAttribute("aria-label", amber ? "phosphor: P3 amber" : "phosphor: P39 green");
    });
  }
  knobs.forEach(function (k) {
    k.addEventListener("click", function () {
      amber = !amber;
      try {
        localStorage.setItem("archive_phos", amber ? "amber" : "green");
      } catch (e) {}
      AU.blip(1600, 0.03, 0.05);
      apply();
    });
  });
  apply();
})();
