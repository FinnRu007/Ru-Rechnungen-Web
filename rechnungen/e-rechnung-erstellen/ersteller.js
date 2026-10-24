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
    } catch (e) { /* privater Modus: dann eben nicht */ }
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
  }
  function firmaDaten() {
    var d = { kleinunternehmer: klein() };
    FIRMA_FELDER.forEach(function (id) { d[id] = wert(id); });
    return d;
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
      $("pdfLaden").disabled = true;
      $("xmlLaden").disabled = true;
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

  async function zeichneVorschau(bytes) {
    var ziel = $("seiten");
    ziel.textContent = "";
    var lib = await ladePdfJs();
    var doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    var breite = Math.min(ziel.clientWidth || 800, 900);
    for (var n = 1; n <= doc.numPages; n++) {
      var seite = await doc.getPage(n);
      var basis = seite.getViewport({ scale: 1 });
      var faktor = breite / basis.width;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var vp = seite.getViewport({ scale: faktor * dpr });
      var canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = Math.floor(vp.width / dpr) + "px";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Rechnung, Seite " + n + " von " + doc.numPages);
      var blatt = document.createElement("div");
      blatt.className = "paper";
      blatt.appendChild(canvas);
      ziel.appendChild(blatt);
      await seite.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    }
    return doc.numPages;
  }

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
      var pdf = await E.erstellePdf(r, xml, m);
      ergebnis = { rechnung: r, xml: xml, pdf: pdf };

      $("vorschau").hidden = false;
      $("vorschauTitel").textContent = "Vorschau: Rechnung " + r.nummer + " über " + E.euro(r.brutto);
      $("xmlAnzeige").textContent = xml;
      $("pdfLaden").disabled = false;
      $("xmlLaden").disabled = false;
      var st = $("vorschauStatus");
      st.textContent = "";
      var ok = document.createElement("div");
      ok.className = "profile ok";
      ok.innerHTML = "<b>Die E-Rechnung ist fertig.</b>";
      var p = document.createElement("p");
      p.textContent = "Format ZUGFeRD, Profil EN 16931, als PDF/A-3 mit eingebetteter XML-Datei. Bitte prüfen Sie alle Angaben in der Vorschau, bevor Sie die Rechnung versenden.";
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
})();
