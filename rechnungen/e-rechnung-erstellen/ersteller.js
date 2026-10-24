/* Ru-Services · E-Rechnung erstellen: Formular, Vorschau, Download
   Alles läuft im Browser. Die Bibliotheken (pdf-lib, fontkit, pdf.js) und die
   Schrift werden erst beim Erstellen der Vorschau von ru-services.de geladen.
   Gespeichert wird nur auf Wunsch ("Firmendaten merken") im localStorage
   dieses Browsers. */
(function () {
  "use strict";

  var E = window.ERechnung;
  var $ = function (id) { return document.getElementById(id); };
  var form = $("rechnungForm");
  var liste = $("positionen");
  var SPEICHER = "ru-erechnung-firma";
  var FIRMA_FELDER = ["v_name", "v_kontakt", "v_strasse", "v_plz", "v_ort", "v_telefon", "v_email", "v_steuernummer", "v_ustid", "v_bank", "v_iban", "v_bic"];
  var KOPF_FELDER = FIRMA_FELDER.concat(["k_name", "k_kontakt", "k_strasse", "k_plz", "k_ort", "k_kundennummer", "k_email", "k_ustid", "r_nummer", "r_datum", "r_leistung", "r_von", "r_bis", "r_ziel", "r_bestellung", "r_referenz", "r_notiz"]);

  var zeilen = [];
  var ergebnis = null;      // { rechnung, xml, pdf }
  var logo = null;          // { daten: Data-URL, typ: "png" | "jpg" }
  var leistungGeaendert = false;

  /* ---------- Hilfen ---------- */

  function heute() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function leereZeile() { return { bezeichnung: "", menge: "1", einheit: "H87", preis: "", satz: "19" }; }
  function speicherLesen() {
    try { return JSON.parse(window.localStorage.getItem(SPEICHER) || "null"); } catch (e) { return null; }
  }
  function speicherSchreiben(daten) {
    try {
      if (daten) window.localStorage.setItem(SPEICHER, JSON.stringify(daten));
      else window.localStorage.removeItem(SPEICHER);
    } catch (e) {
      // Speicher voll (großes Logo) oder privater Modus: ohne Logo versuchen
      if (daten && daten.logo) {
        var ohne = Object.assign({}, daten);
        delete ohne.logo;
        speicherSchreiben(ohne);
        $("logoHinweis").textContent = "Das Logo ist zu groß zum Merken. Es wird für diese Rechnung verwendet, beim nächsten Besuch aber nicht mehr eingesetzt.";
      }
    }
  }
  function leistungsart() {
    var r = form.querySelector('input[name="leistungsart"]:checked');
    return r ? r.value : "datum";
  }
  function klein() { return $("kleinunternehmer").checked; }

  /* ---------- Positionen ---------- */

  function feld(label, id, el) {
    var w = document.createElement("div");
    w.className = "field";
    var l = document.createElement("label");
    l.htmlFor = id;
    l.textContent = label;
    el.id = id;
    w.appendChild(l);
    w.appendChild(el);
    return w;
  }

  function zeichnePositionen() {
    liste.textContent = "";
    zeilen.forEach(function (z, i) {
      var box = document.createElement("div");
      box.className = "pos-row";

      var kopf = document.createElement("div");
      kopf.className = "pos-head";
      var titel = document.createElement("b");
      titel.textContent = "Position " + (i + 1);
      kopf.appendChild(titel);
      if (zeilen.length > 1) {
        var weg = document.createElement("button");
        weg.type = "button";
        weg.className = "link-btn";
        weg.textContent = "Position entfernen";
        weg.addEventListener("click", function () {
          zeilen.splice(i, 1);
          zeichnePositionen();
          geaendert();
        });
        kopf.appendChild(weg);
      }
      box.appendChild(kopf);

      var raster = document.createElement("div");
      raster.className = "pos-grid";

      var bez = document.createElement("textarea");
      bez.rows = 2;
      bez.value = z.bezeichnung;
      bez.placeholder = "z. B. Arbeitszeit Geselle oder Material";
      bez.addEventListener("input", function () { z.bezeichnung = bez.value; geaendert(); });
      var fBez = feld("Bezeichnung", "p" + i + "_bez", bez);
      fBez.classList.add("pos-bez");
      raster.appendChild(fBez);

      var menge = document.createElement("input");
      menge.inputMode = "decimal";
      menge.value = z.menge;
      menge.addEventListener("input", function () { z.menge = menge.value; geaendert(); });
      raster.appendChild(feld("Menge", "p" + i + "_menge", menge));

      var einheit = document.createElement("select");
      E.EINHEITEN.forEach(function (eh) {
        var o = document.createElement("option");
        o.value = eh.code;
        o.textContent = eh.text;
        einheit.appendChild(o);
      });
      einheit.value = z.einheit;
      einheit.addEventListener("change", function () { z.einheit = einheit.value; geaendert(); });
      raster.appendChild(feld("Einheit", "p" + i + "_einheit", einheit));

      var preis = document.createElement("input");
      preis.inputMode = "decimal";
      preis.value = z.preis;
      preis.placeholder = "0,00";
      preis.addEventListener("input", function () { z.preis = preis.value; geaendert(); });
      preis.addEventListener("blur", function () {
        var d = E.dezimal(preis.value);
        if (d === null) return;
        var zahl = Number(d);
        var stellen = (d.split(".")[1] || "").replace(/0+$/, "").length;
        preis.value = zahl.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, Math.min(4, stellen)) });
        z.preis = preis.value;
        geaendert();
      });
      raster.appendChild(feld(klein() ? "Einzelpreis in €" : "Einzelpreis netto in €", "p" + i + "_preis", preis));

      var satz = document.createElement("select");
      [["19", "19 %"], ["7", "7 %"]].forEach(function (s) {
        var o = document.createElement("option");
        o.value = s[0];
        o.textContent = s[1];
        satz.appendChild(o);
      });
      satz.value = z.satz;
      satz.addEventListener("change", function () { z.satz = satz.value; geaendert(); });
      var fSatz = feld("Umsatzsteuer", "p" + i + "_satz", satz);
      fSatz.classList.add("pos-satz");
      fSatz.hidden = klein();
      raster.appendChild(fSatz);

      var betrag = document.createElement("output");
      betrag.className = "pos-amount";
      betrag.setAttribute("for", "p" + i + "_menge p" + i + "_preis");
      var fBetrag = feld("Betrag", "p" + i + "_betrag", betrag);
      fBetrag.classList.add("pos-sum");
      raster.appendChild(fBetrag);

      box.appendChild(raster);
      liste.appendChild(box);
    });
    zeigeSummen();
  }

  function zeigeSummen() {
    var s = E.summen(zeilen, klein());
    s.zeilen.forEach(function (t, i) {
      var o = $("p" + i + "_betrag");
      if (o) o.textContent = t;
    });
    var box = $("summen");
    box.textContent = "";
    var dl = document.createElement("dl");
    dl.className = "kv";
    function zeile(a, b, gross) {
      var dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = a;
      dd.textContent = b;
      if (gross) { dt.className = "grand"; dd.className = "grand"; }
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    if (!klein()) {
      zeile("Summe netto", s.netto);
      s.steuer.forEach(function (st) { zeile("zzgl. " + st.satz + " % USt.", st.betrag); });
    }
    zeile("Rechnungsbetrag", s.brutto, true);
    box.appendChild(dl);
  }

  /* ---------- Formular lesen und füllen ---------- */

  function wert(id) { var el = $(id); return el ? el.value : ""; }

  function eingaben() {
    return {
      kleinunternehmer: klein(),
      verkaeufer: {
        name: wert("v_name"), kontakt: wert("v_kontakt"), strasse: wert("v_strasse"), plz: wert("v_plz"), ort: wert("v_ort"),
        telefon: wert("v_telefon"), email: wert("v_email"), steuernummer: wert("v_steuernummer"), ustid: wert("v_ustid"),
        bank: wert("v_bank"), iban: wert("v_iban"), bic: wert("v_bic")
      },
      kaeufer: {
        name: wert("k_name"), kontakt: wert("k_kontakt"), strasse: wert("k_strasse"), plz: wert("k_plz"), ort: wert("k_ort"),
        kundennummer: wert("k_kundennummer"), email: wert("k_email"), ustid: wert("k_ustid")
      },
      nummer: wert("r_nummer"),
      datum: wert("r_datum"),
      leistungsart: leistungsart(),
      leistungsdatum: wert("r_leistung"),
      leistungVon: wert("r_von"),
      leistungBis: wert("r_bis"),
      zahlungsziel: wert("r_ziel"),
      bestellnummer: wert("r_bestellung"),
      referenz: wert("r_referenz"),
      notiz: wert("r_notiz"),
      positionen: zeilen
    };
  }

  function setzeFirma(d) {
    FIRMA_FELDER.forEach(function (id) { if (d[id] != null) $(id).value = d[id]; });
    $("kleinunternehmer").checked = !!d.kleinunternehmer;
    if (d.logo && d.logo.daten) setzeLogo(d.logo);
  }
  function firmaDaten() {
    var d = { kleinunternehmer: klein() };
    FIRMA_FELDER.forEach(function (id) { d[id] = wert(id); });
    if (logo) d.logo = logo;
    return d;
  }

  /* ---------- Logo ---------- */

  var LOGO_HINWEIS = "PNG, JPG oder SVG. Das Logo steht oben rechts auf der Rechnung. Die Datei bleibt auf Ihrem Gerät.";

  function setzeLogo(l) {
    logo = l;
    $("logoVorschau").hidden = !l;
    $("logoWeg").hidden = !l;
    $("logoWaehlen").textContent = l ? "Anderes Logo auswählen" : "Logo auswählen";
    if (l) $("logoBild").src = l.daten;
    else $("logoBild").removeAttribute("src");
  }

  // Bild über ein Canvas neu zeichnen: ergibt immer ein einfaches RGB-Bild
  // (PNG mit Transparenz oder JPG), wie es eine PDF/A-Datei verlangt.
  function leseLogo(datei) {
    return new Promise(function (ok, fehler) {
      var typ = datei.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", gif: "image/gif" })[(datei.name.split(".").pop() || "").toLowerCase()] || "";
      if (!/^image\//.test(typ)) return fehler(new Error("Bitte eine Bilddatei wählen (PNG, JPG oder SVG)."));
      if (datei.size > 15 * 1024 * 1024) return fehler(new Error("Die Datei ist zu groß (mehr als 15 MB)."));
      var url = URL.createObjectURL(datei.type ? datei : new Blob([datei], { type: typ }));
      var img = new Image();
      img.onload = function () {
        try {
          var svg = typ === "image/svg+xml";
          var w = img.naturalWidth || 1200, h = img.naturalHeight || 600;
          var MAX = 1200, f = Math.min(svg ? Infinity : 1, MAX / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * f));
          c.height = Math.max(1, Math.round(h * f));
          var ctx = c.getContext("2d");
          var jpg = typ === "image/jpeg";
          if (jpg) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var daten = jpg ? c.toDataURL("image/jpeg", 0.92) : c.toDataURL("image/png");
          URL.revokeObjectURL(url);
          ok({ daten: daten, typ: jpg ? "jpg" : "png" });
        } catch (e) {
          URL.revokeObjectURL(url);
          fehler(new Error("Dieses Bild kann der Browser nicht verarbeiten. Bitte speichern Sie das Logo als PNG oder JPG."));
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        fehler(new Error("Die Datei konnte nicht als Bild gelesen werden. Bitte speichern Sie das Logo als PNG oder JPG."));
      };
      img.src = url;
    });
  }

  function logoGewaehlt() {
    var datei = $("logoDatei").files && $("logoDatei").files[0];
    $("logoDatei").value = "";
    if (!datei) return;
    var hinweis = $("logoHinweis");
    hinweis.textContent = "Das Logo wird geladen …";
    leseLogo(datei).then(function (l) {
      hinweis.textContent = LOGO_HINWEIS;
      setzeLogo(l);
      if ($("merken").checked) speicherSchreiben(firmaDaten());
      geaendert();
    }, function (e) {
      hinweis.textContent = e.message;
    });
  }

  function zeigeLeistungsart() {
    var zeitraum = leistungsart() === "zeitraum";
    $("feldLeistung").hidden = zeitraum;
    $("feldVon").hidden = !zeitraum;
    $("feldBis").hidden = !zeitraum;
  }

  function zeigeKlein() {
    $("preisHinweis").textContent = klein()
      ? "Preise ohne Umsatzsteuer eingeben, so wie sie bezahlt werden. Für einen Nachlass einen negativen Preis eintragen."
      : "Preise bitte netto eingeben, also ohne Umsatzsteuer. Für einen Nachlass einen negativen Preis eintragen.";
    zeichnePositionen();
  }

  /* ---------- Änderungen ---------- */

  function geaendert() {
    zeigeSummen();
    if (ergebnis) {
      ergebnis = null;
      ["pdfLaden", "zipLaden", "xmlLaden", "grossOeffnen"].forEach(function (id) { $(id).disabled = true; });
      var st = $("vorschauStatus");
      st.textContent = "";
      var p = document.createElement("div");
      p.className = "profile warn";
      p.textContent = "Sie haben die Eingaben geändert. Bitte erstellen Sie die Vorschau neu, bevor Sie herunterladen.";
      st.appendChild(p);
    }
  }

  /* ---------- Fehler anzeigen ---------- */

  function zeigeFehler(fehler) {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    var box = $("fehlerBox");
    box.textContent = "";
    if (!fehler.length) { box.hidden = true; return; }
    var h = document.createElement("p");
    h.innerHTML = "<strong>Bitte ergänzen oder korrigieren Sie:</strong>";
    box.appendChild(h);
    var ul = document.createElement("ul");
    fehler.forEach(function (f) {
      var el = $(f.feld);
      if (el) el.setAttribute("aria-invalid", "true");
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + f.feld;
      a.textContent = f.text;
      a.addEventListener("click", function (ev) {
        if (!el) return;
        ev.preventDefault();
        el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: true });
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.hidden = false;
  }

  function nachricht(text, art) {
    var m = $("toolMsg");
    m.textContent = "";
    if (!text) return;
    var p = document.createElement("div");
    p.className = "profile " + (art || "warn");
    p.textContent = text;
    m.appendChild(p);
  }

  /* ---------- Bibliotheken nachladen ---------- */

  var bibliotheken = null;
  function skript(src) {
    return new Promise(function (ok, fehler) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = function () { fehler(new Error("Datei nicht geladen: " + src)); };
      document.head.appendChild(s);
    });
  }
  function datei(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Datei nicht geladen: " + url);
      return r.arrayBuffer();
    });
  }
  function ladeBibliotheken() {
    if (!bibliotheken) {
      bibliotheken = Promise.all([
        skript("/vendor/pdf-lib/pdf-lib.min.js"),
        skript("/vendor/pdf-lib/fontkit.umd.min.js"),
        datei("/fonts/LiberationSans-Regular.ttf"),
        datei("/fonts/LiberationSans-Bold.ttf"),
        datei("/rechnungen/e-rechnung-erstellen/srgb.icc")
      ]).then(function (t) {
        return { PDFLib: window.PDFLib, fontkit: window.fontkit, schrift: t[2], schriftFett: t[3], icc: t[4] };
      });
      bibliotheken.catch(function () { bibliotheken = null; });
    }
    return bibliotheken;
  }
  var pdfjs = null;
  function ladePdfJs() {
    if (!pdfjs) {
      pdfjs = import("/vendor/pdfjs/pdf.min.js").then(function (m) {
        m.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js";
        return m;
      });
      pdfjs.catch(function () { pdfjs = null; });
    }
    return pdfjs;
  }

  /* ---------- Vorschau ---------- */

  var vorschauDoc = null, vorschauMass = "", vorschauLauf = 0;

  // Breite, die im grauen Rahmen wirklich zur Verfügung steht
  function vorschauBreite() {
    var ziel = $("seiten"), st = window.getComputedStyle(ziel);
    var innen = ziel.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    return Math.floor(Math.min(innen || 800, 900));
  }

  // Jede Seite in der echten Pixeldichte des Bildschirms zeichnen, damit die
  // Vorschau nicht vom Browser hoch- oder heruntergerechnet (unscharf) wird.
  async function zeichneSeiten() {
    if (!vorschauDoc) return;
    var lauf = ++vorschauLauf;
    var doc = vorschauDoc, ziel = $("seiten");
    var breite = vorschauBreite(), dpr = window.devicePixelRatio || 1;
    vorschauMass = breite + "@" + dpr;
    var blaetter = [];
    for (var n = 1; n <= doc.numPages; n++) {
      var seite = await doc.getPage(n);
      if (lauf !== vorschauLauf) return;
      var basis = seite.getViewport({ scale: 1 });
      var faktor = breite / basis.width;
      var hoehe = basis.height * faktor;
      var dichte = Math.min(dpr, 3, Math.sqrt(20e6 / (breite * hoehe)));
      var vp = seite.getViewport({ scale: faktor * dichte });
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(breite * dichte);
      canvas.height = Math.round(hoehe * dichte);
      canvas.style.width = breite + "px";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Rechnung, Seite " + n + " von " + doc.numPages);
      await seite.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      if (lauf !== vorschauLauf) return;
      var blatt = document.createElement("div");
      blatt.className = "paper";
      blatt.appendChild(canvas);
      blaetter.push(blatt);
    }
    ziel.textContent = "";
    blaetter.forEach(function (b) { ziel.appendChild(b); });
  }

  async function zeichneVorschau(bytes) {
    $("seiten").textContent = "";
    var lib = await ladePdfJs();
    vorschauDoc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    await zeichneSeiten();
    return vorschauDoc.numPages;
  }

  // Nach Zoom im Browser, Drehen des Handys oder Fensterwechsel neu zeichnen
  var neuZeichnen = null;
  window.addEventListener("resize", function () {
    clearTimeout(neuZeichnen);
    neuZeichnen = setTimeout(function () {
      if (vorschauDoc && !$("vorschau").hidden && vorschauBreite() + "@" + (window.devicePixelRatio || 1) !== vorschauMass) {
        zeichneSeiten().catch(function () {});
      }
    }, 250);
  });

  async function erstellen(ev) {
    ev.preventDefault();
    nachricht("");
    var b = E.berechne(eingaben());
    zeigeFehler(b.fehler);
    if (b.fehler.length) {
      $("fehlerBox").scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    var knopf = $("erstellen");
    knopf.disabled = true;
    nachricht("Die Rechnung wird erstellt …", "ok");
    try {
      if ($("merken").checked) speicherSchreiben(firmaDaten());
      var r = b.rechnung;
      var xml = E.erstelleXml(r);
      var m = await ladeBibliotheken();
      var pdf = await E.erstellePdf(r, xml, logo ? Object.assign({}, m, { logo: { bytes: logo.daten, typ: logo.typ } }) : m);
      ergebnis = { rechnung: r, xml: xml, pdf: pdf };
      if (pdfUrl) { URL.revokeObjectURL(pdfUrl); pdfUrl = null; }

      $("vorschau").hidden = false;
      $("vorschauTitel").textContent = "Vorschau: Rechnung " + r.nummer + " über " + E.euro(r.brutto);
      $("xmlAnzeige").textContent = xml;
      ["pdfLaden", "zipLaden", "xmlLaden", "grossOeffnen"].forEach(function (id) { $(id).disabled = false; });
      var st = $("vorschauStatus");
      st.textContent = "";
      var ok = document.createElement("div");
      ok.className = "profile ok";
      ok.innerHTML = "<b>Die E-Rechnung ist fertig.</b>";
      var p = document.createElement("p");
      p.textContent = "Format ZUGFeRD, Profil EN 16931, als PDF/A-3. Die XML-Datei mit den Rechnungsdaten steckt schon in der PDF. Bitte prüfen Sie alle Angaben in der Vorschau, bevor Sie die Rechnung versenden.";
      ok.appendChild(p);
      if (b.zeichenErsetzt) {
        var w = document.createElement("p");
        w.textContent = "Hinweis: Einige Sonderzeichen konnten nicht verwendet werden und wurden durch ein Fragezeichen ersetzt.";
        ok.appendChild(w);
      }
      st.appendChild(ok);
      nachricht("");
      $("vorschau").scrollIntoView({ block: "start", behavior: "smooth" });
      try {
        await zeichneVorschau(pdf);
      } catch (e) {
        var hinweis = document.createElement("div");
        hinweis.className = "profile warn";
        hinweis.textContent = "Die Vorschau kann in diesem Browser nicht angezeigt werden. Sie können die Rechnung trotzdem herunterladen und mit einem PDF-Programm öffnen.";
        $("seiten").appendChild(hinweis);
      }
    } catch (e) {
      nachricht("Die Rechnung konnte nicht erstellt werden. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal. (" + (e && e.message ? e.message : e) + ")", "bad");
    } finally {
      knopf.disabled = false;
    }
  }

  var pdfUrl = null;
  function grossOeffnen() {
    if (!ergebnis) return;
    if (!pdfUrl) pdfUrl = URL.createObjectURL(new Blob([ergebnis.pdf], { type: "application/pdf" }));
    var fenster = window.open(pdfUrl, "_blank");
    if (!fenster) herunterladen(ergebnis.pdf, E.dateiname(ergebnis.rechnung) + ".pdf", "application/pdf");
  }

  function herunterladen(inhalt, name, typ) {
    var blob = new Blob([inhalt], { type: typ });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- Beispiel ---------- */

  function beispiel() {
    setzeFirma({
      v_name: "Malerbetrieb Mustermann", v_kontakt: "Max Mustermann", v_strasse: "Musterstraße 1", v_plz: "33330", v_ort: "Gütersloh",
      v_telefon: "05241 000000", v_email: "info@maler-mustermann.example", v_steuernummer: "347/5000/0000", v_ustid: "",
      v_bank: "Musterbank", v_iban: "DE89 3704 0044 0532 0130 00", v_bic: "COBADEFFXXX", kleinunternehmer: false
    });
    $("k_name").value = "Schreinerei Beispiel GmbH";
    $("k_kontakt").value = "Frau Erika Beispiel";
    $("k_strasse").value = "Am Markt 3";
    $("k_plz").value = "33602";
    $("k_ort").value = "Bielefeld";
    $("k_kundennummer").value = "K-1001";
    $("r_nummer").value = "2026-001";
    $("r_notiz").value = "Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:";
    zeilen = [
      { bezeichnung: "Wände streichen, Büro im Erdgeschoss\nzwei Anstriche, weiß, inklusive Abdecken", menge: "42,5", einheit: "MTK", preis: "12,90", satz: "19" },
      { bezeichnung: "Arbeitszeit Geselle", menge: "3", einheit: "HUR", preis: "58,00", satz: "19" },
      { bezeichnung: "Anfahrt", menge: "1", einheit: "LS", preis: "35,00", satz: "19" }
    ];
    zeigeKlein();
    geaendert();
  }

  function leeren() {
    if (!window.confirm("Alle Eingaben auf dieser Seite leeren? Gespeicherte Firmendaten bleiben erhalten.")) return;
    KOPF_FELDER.forEach(function (id) { var el = $(id); if (el && el.tagName !== "SELECT") el.value = ""; });
    $("r_ziel").value = "14";
    $("kleinunternehmer").checked = false;
    $("r_datum").value = heute();
    $("r_leistung").value = heute();
    leistungGeaendert = false;
    zeilen = [leereZeile()];
    zeigeFehler([]);
    $("vorschau").hidden = true;
    ergebnis = null;
    vorschauDoc = null;
    setzeLogo(null);
    $("logoHinweis").textContent = LOGO_HINWEIS;
    zeigeKlein();
  }

  /* ---------- Start ---------- */

  $("r_datum").value = heute();
  $("r_leistung").value = heute();
  zeilen = [leereZeile()];
  var gemerkt = speicherLesen();
  if (gemerkt) {
    setzeFirma(gemerkt);
    $("merken").checked = true;
    $("gemerktHinweis").hidden = false;
  }
  zeigeLeistungsart();
  zeigeKlein();

  form.addEventListener("submit", erstellen);
  form.addEventListener("input", function (ev) {
    if (ev.target && ev.target.id && ev.target.id.charAt(0) !== "p") geaendert();
    if (ev.target && ev.target.id === "r_leistung") leistungGeaendert = true;
  });
  $("r_datum").addEventListener("change", function () {
    if (!leistungGeaendert) $("r_leistung").value = $("r_datum").value;
  });
  form.querySelectorAll('input[name="leistungsart"]').forEach(function (r) {
    r.addEventListener("change", function () { zeigeLeistungsart(); geaendert(); });
  });
  $("kleinunternehmer").addEventListener("change", zeigeKlein);
  $("neuePosition").addEventListener("click", function () {
    zeilen.push(leereZeile());
    zeichnePositionen();
    geaendert();
    var neu = $("p" + (zeilen.length - 1) + "_bez");
    if (neu) neu.focus();
  });
  $("merken").addEventListener("change", function () {
    if ($("merken").checked) speicherSchreiben(firmaDaten());
    else { speicherSchreiben(null); $("gemerktHinweis").hidden = true; }
  });
  $("vergessen").addEventListener("click", function () {
    speicherSchreiben(null);
    $("merken").checked = false;
    $("gemerktHinweis").hidden = true;
  });
  $("logoWaehlen").addEventListener("click", function () { $("logoDatei").click(); });
  $("logoDatei").addEventListener("change", logoGewaehlt);
  $("logoWeg").addEventListener("click", function () {
    setzeLogo(null);
    $("logoHinweis").textContent = LOGO_HINWEIS;
    if ($("merken").checked) speicherSchreiben(firmaDaten());
    geaendert();
    $("logoWaehlen").focus();
  });
  $("beispiel").addEventListener("click", beispiel);
  $("leeren").addEventListener("click", leeren);
  $("aendern").addEventListener("click", function () {
    form.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  $("pdfLaden").addEventListener("click", function () {
    if (ergebnis) herunterladen(ergebnis.pdf, E.dateiname(ergebnis.rechnung) + ".pdf", "application/pdf");
  });
  $("xmlLaden").addEventListener("click", function () {
    if (ergebnis) herunterladen(ergebnis.xml, E.dateiname(ergebnis.rechnung) + ".xml", "application/xml");
  });
  $("zipLaden").addEventListener("click", function () {
    if (!ergebnis) return;
    var name = E.dateiname(ergebnis.rechnung);
    var z = E.zip([
      { name: name + ".pdf", bytes: ergebnis.pdf },
      { name: name + ".xml", bytes: E.utf8(ergebnis.xml) }
    ]);
    herunterladen(z, name + ".zip", "application/zip");
  });
  $("grossOeffnen").addEventListener("click", grossOeffnen);
})();
