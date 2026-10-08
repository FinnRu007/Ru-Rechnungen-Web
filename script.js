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

  // --- Erklärvideo erst nach Klick laden (Zwei-Klick-Lösung, § 25 TDDDG) ---
  var frame = document.getElementById("videoFrame");
  var loadBtn = document.getElementById("videoLoad");
  if (frame && loadBtn) {
    loadBtn.addEventListener("click", function () {
      var id = frame.getAttribute("data-video-id");
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?rel=0&autoplay=1";
      iframe.title = frame.getAttribute("data-video-title") || "Video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      frame.textContent = "";
      frame.classList.remove("is-consent");
      frame.appendChild(iframe);
    });
  }

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
