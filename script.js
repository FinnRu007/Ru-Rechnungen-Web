/* Ru-Services Website · kleine Interaktionen, kein Build-Schritt */
(function () {
  "use strict";

  // --- Alte Ankerlinks der früheren Startseite (Produktseite) weiterleiten ---
  // z. B. ru-services.de/#download -> ru-services.de/rechnungen/#download
  if (document.body.getAttribute("data-page") === "home") {
    var alt = ["#e-rechnung", "#video", "#rundgang", "#vorteile", "#funktionen", "#preis", "#pro-holen", "#download", "#faq"];
    var forward = function () {
      if (alt.indexOf(location.hash) === -1) return false;
      location.replace("/rechnungen/" + location.hash);
      return true;
    };
    if (forward()) return;
    window.addEventListener("hashchange", forward);
  }

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

  // --- Entfallene Abschnitte der Produktseite (Preise, Download, Video) ---
  if (document.body.getAttribute("data-page") === "rechnungen") {
    var ersatz = { "#preis": "#anfrage", "#pro-holen": "#anfrage", "#download": "#anfrage", "#video": "#rundgang" };
    var umleiten = function () { if (ersatz[location.hash]) location.replace(ersatz[location.hash]); };
    umleiten();
    window.addEventListener("hashchange", umleiten);
  }

  // --- Text kopieren (z. B. KI-Vorlage auf der Vereinsseite) ---
  var selectText = function (el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      var el = document.getElementById(btn.getAttribute("data-copy"));
      if (!el) return;
      var done = function () {
        btn.textContent = "Kopiert";
        btn.classList.add("is-done");
        setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove("is-done");
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.textContent).then(done, function () { selectText(el); });
      } else {
        selectText(el);
      }
    });
  });

  // --- Screenshot-Lightbox ---
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightboxImg");
  if (lb && lbImg) {
    var close = function () {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      lbImg.src = "";
    };
    document.querySelectorAll(".shot-media").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var img = el.querySelector("img");
        if (!img) return;
        e.preventDefault();
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt || "";
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
      });
    });
    lb.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lb.classList.contains("open")) close();
    });
  }

})();
