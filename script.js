/* Ru Services – Landing Page · kleine Interaktionen, kein Build-Schritt */
(function () {
  "use strict";

  // --- Mobiles Menü ---
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // --- Screenshot-Lightbox ---
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightboxImg");
  if (lb && lbImg) {
    document.querySelectorAll(".shot-media").forEach(function (el) {
      el.addEventListener("click", function (e) {
        // Leere Platzhalter (noch kein Bild) ignorieren
        var img = el.querySelector("img");
        if (!img) return;
        e.preventDefault();
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt || "";
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
      });
    });
    lb.addEventListener("click", function () {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      lbImg.src = "";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lb.classList.contains("open")) {
        lb.classList.remove("open");
        lb.setAttribute("aria-hidden", "true");
        lbImg.src = "";
      }
    });
  }

  // --- Platzhalter automatisch durch echtes Bild ersetzen, sobald vorhanden ---
  // Jede .shot-media.empty mit data-src bekommt ein <img>; schlägt das Laden
  // fehl (Datei noch nicht abgelegt), bleibt der Platzhaltertext stehen.
  document.querySelectorAll(".shot-media.empty[data-src]").forEach(function (el) {
    var src = el.getAttribute("data-src");
    var probe = new Image();
    probe.onload = function () {
      el.classList.remove("empty");
      el.textContent = "";
      var img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.alt = el.getAttribute("data-alt") || "Screenshot aus Ru Services";
      el.appendChild(img);
    };
    probe.src = src;
  });
})();
