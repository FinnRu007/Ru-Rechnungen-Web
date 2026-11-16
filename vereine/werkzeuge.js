/* KI-Wissensportal für Vereine · interaktive Werkzeuge
   Alles läuft im Browser. Es wird nichts gespeichert und nichts übertragen. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ================= KI-Check ================= */
  (function () {
    var form = $("kiCheckForm");
    var out = $("kiCheckErgebnis");
    if (!form || !out) return;

    var ziele = {
      baukasten: { titel: "Prompt-Baukasten", text: "In drei Klicks zur fertigen Anweisung für Einladung, Beitrag oder Trainingsplan.", link: "#baukasten", knopf: "Zum Baukasten" },
      kasse: { titel: "Kassentabelle mit KI", text: "Vom Export der Vereinssoftware zur geordneten Aufstellung, Schritt für Schritt.", link: "#ki-einfach", knopf: "Zur Anleitung" },
      erechnung: { titel: "E-Rechnungen lesen", text: "ZUGFeRD und XRechnung im Browser öffnen, ohne Upload und ohne Anmeldung.", link: "#e-rechnung", knopf: "Zum Abschnitt" },
      ampel: { titel: "Datenschutz-Ampel", text: "Prüfen Sie zuerst, was in eine KI hinein darf und was im Verein bleiben muss.", link: "#ampel", knopf: "Zur Ampel" },
      praxistest: { titel: "KI-Modelle im Praxistest", text: "Dieselbe Vereinsaufgabe, drei Modelle, die Antworten im direkten Vergleich.", link: "#praxistest", knopf: "Zum Vergleich" },
      social: { titel: "Social Media planen", text: "Redaktionsplan und Beitragsideen, damit regelmäßig etwas erscheint.", link: "#moeglichkeiten", knopf: "Zu den Beispielen" },
      zeit: { titel: "Zeitspar-Rechner", text: "Schätzen Sie, wie viele Stunden im Jahr sich im Vorstand gewinnen lassen.", link: "#zeitrechner", knopf: "Zum Rechner" }
    };
    var reihenfolge = ["baukasten", "ampel", "kasse", "praxistest", "erechnung", "social", "zeit"];
    var punkte = {
      groesse: { klein: { baukasten: 1 }, mittel: { kasse: 1 }, gross: { kasse: 2, ampel: 1 } },
      zeitfresser: {
        texte: { baukasten: 3 }, social: { social: 3, baukasten: 1 }, kasse: { kasse: 3 },
        training: { baukasten: 2, praxistest: 1 }, orga: { zeit: 2, baukasten: 1 }
      },
      erfahrung: { keine: { baukasten: 2, ampel: 2 }, etwas: { praxistest: 1, ampel: 1 }, viel: { praxistest: 3 } },
      rechnungen: { ja: { erechnung: 3 }, nein: {}, unsicher: { erechnung: 2 } },
      daten: { ja: { ampel: 4 }, nein: {}, unsicher: { ampel: 2 } }
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var summe = {};
      var offen = [];
      Object.keys(punkte).forEach(function (frage) {
        var wahl = form.querySelector('input[name="' + frage + '"]:checked');
        if (!wahl) { offen.push(frage); return; }
        var plus = punkte[frage][wahl.value] || {};
        Object.keys(plus).forEach(function (k) { summe[k] = (summe[k] || 0) + plus[k]; });
      });
      out.textContent = "";
      if (offen.length) {
        out.appendChild(el("p", "vw-hinweis", "Bitte beantworten Sie alle fünf Fragen."));
        return;
      }
      var top = reihenfolge.slice().sort(function (a, b) {
        return (summe[b] || 0) - (summe[a] || 0) || reihenfolge.indexOf(a) - reihenfolge.indexOf(b);
      }).slice(0, 3);
      out.appendChild(el("h4", "vw-ergebnis-titel", "Damit fangen Sie am besten an"));
      var liste = el("ol", "vw-empfehlungen");
      top.forEach(function (k) {
        var z = ziele[k];
        var li = el("li");
        li.appendChild(el("strong", null, z.titel));
        li.appendChild(el("span", null, z.text));
        var a = el("a", "btn btn-secondary", z.knopf);
        a.href = z.link;
        li.appendChild(a);
        liste.appendChild(li);
      });
      out.appendChild(liste);
      out.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  })();

  /* ================= Prompt-Baukasten ================= */
  (function () {
    var ziel = $("baukastenText");
    var art = $("bkArt"), aufgabe = $("bkAufgabe"), ton = $("bkTon"), laenge = $("bkLaenge"), name = $("bkName");
    if (!ziel || !art || !aufgabe || !ton || !laenge) return;

    var aufgaben = {
      einladung: {
        satz: "Schreibe eine Einladung zur Mitgliederversammlung.",
        felder: ["Datum und Uhrzeit: [EINTRAGEN]", "Ort: [EINTRAGEN]", "Tagesordnung: [PUNKTE EINTRAGEN]", "Frist für Anträge laut Satzung: [EINTRAGEN]"],
        regel: "Halte dich genau an die Tagesordnung und ergänze keine Punkte."
      },
      social: {
        satz: "Schreibe einen Beitrag für [KANAL, z. B. Instagram].",
        felder: ["Anlass: [EINTRAGEN]", "Wann, wo, für wen: [EINTRAGEN]", "So erreicht man uns: [EINTRAGEN]"],
        regel: "Schlage fünf passende Hashtags vor. Nenne keine Personen namentlich."
      },
      dank: {
        satz: "Schreibe einen Dankesbrief an einen Sponsor oder Spender.",
        felder: ["Wofür wir danken: [EINTRAGEN]", "Was dadurch möglich wurde: [EINTRAGEN]", "Wer unterschreibt (Amt): [EINTRAGEN]"],
        regel: "Nenne keine Beträge, wenn ich keine angegeben habe."
      },
      training: {
        satz: "Erstelle einen Trainings- oder Übungsplan.",
        felder: ["Sportart oder Thema: [EINTRAGEN]", "Alter der Gruppe: [EINTRAGEN]", "Gruppengröße: [EINTRAGEN]", "Dauer der Einheit: [EINTRAGEN]", "Vorhandenes Material: [EINTRAGEN]"],
        regel: "Achte auf Sicherheit und altersgerechte Belastung. Der Plan ersetzt keine Trainerausbildung."
      },
      presse: {
        satz: "Schreibe eine Pressemitteilung für die Lokalzeitung.",
        felder: ["Anlass: [EINTRAGEN]", "Wann und wo: [EINTRAGEN]", "Zitat und von wem (Amt): [EINTRAGEN]", "Kontakt für Rückfragen: [EINTRAGEN]"],
        regel: "Das Wichtigste gehört in den ersten Satz. Erfinde keine Zitate."
      },
      foerder: {
        satz: "Entwirf die Projektbeschreibung für einen Förderantrag.",
        felder: ["Förderprogramm: [EINTRAGEN]", "Projektidee: [EINTRAGEN]", "Zielgruppe: [EINTRAGEN]", "Zeitraum: [EINTRAGEN]", "Geplante Kosten: [EINTRAGEN]"],
        regel: "Schreibe nur, was ich angegeben habe. Markiere Stellen, an denen ich die Förderrichtlinie prüfen muss."
      },
      protokoll: {
        satz: "Formuliere aus meinen Stichpunkten ein Protokoll.",
        felder: ["Art der Sitzung: [EINTRAGEN]", "Datum: [EINTRAGEN]", "Stichpunkte: [OHNE NAMEN EINFÜGEN, z. B. „Kassenwart“ statt Name]"],
        regel: "Gib Beschlüsse wörtlich wieder und ändere keine Zahlen."
      },
      excel: {
        satz: "Hilf mir bei einer Excel-Tabelle.",
        felder: ["Spaltenüberschriften: [EINFÜGEN]", "Zwei erfundene Beispielzeilen: [EINFÜGEN, KEINE ECHTEN DATEN]", "Das soll die Tabelle können: [EINTRAGEN]"],
        regel: "Nenne Formeln für die deutsche Excel-Version und erkläre jeden Schritt für Einsteiger."
      }
    };

    var bauen = function () {
      var a = aufgaben[aufgabe.value];
      var vereinsname = name && name.value.trim() ? name.value.trim() : "[NAME DES VEREINS]";
      var artText = art.options[art.selectedIndex].text;
      var zeilen = [
        "Du hilfst einem ehrenamtlich geführten Verein in Deutschland.",
        "Verein: " + vereinsname + " (" + artText + ")",
        "",
        "Aufgabe: " + a.satz,
        "",
        "Angaben dazu:"
      ];
      a.felder.forEach(function (f) { zeilen.push("- " + f); });
      zeilen.push("");
      if (aufgabe.value !== "excel") {
        zeilen.push("Ton: " + ton.options[ton.selectedIndex].text + ".");
        zeilen.push("Länge: " + laenge.options[laenge.selectedIndex].text + ".");
        zeilen.push("");
      }
      zeilen.push("Wichtig:");
      zeilen.push("- " + a.regel);
      zeilen.push("- Erfinde keine Daten, Fristen oder Namen. Wo etwas fehlt, setze einen Platzhalter in eckigen Klammern.");
      zeilen.push("- Stelle mir am Ende Rückfragen, falls dir Angaben fehlen.");
      ziel.textContent = zeilen.join("\n");
      var nurText = aufgabe.value === "excel";
      ton.disabled = nurText;
      laenge.disabled = nurText;
    };
    [art, aufgabe, ton, laenge].forEach(function (s) { s.addEventListener("change", bauen); });
    if (name) name.addEventListener("input", bauen);
    bauen();
  })();

  /* ================= Zeitspar-Rechner ================= */
  (function () {
    var box = $("zeitrechner");
    if (!box) return;
    var regler = box.querySelectorAll("input[data-stunden]");
    var anteil = $("zrAnteil");
    var outMonat = $("zrMonat"), outJahr = $("zrJahr"), outTage = $("zrTage"), outAnteil = $("zrAnteilWert");
    if (!regler.length || !anteil || !outJahr) return;

    var zahl = function (n) { return String(Math.round(n * 10) / 10).replace(".", ","); };
    var rechnen = function () {
      var monat = 0;
      Array.prototype.forEach.call(regler, function (r) {
        monat += Number(r.value);
        var anzeige = $(r.id + "Wert");
        if (anzeige) anzeige.textContent = r.value + " Std.";
      });
      var quote = Number(anteil.value) / 100;
      var jahr = monat * 12 * quote;
      outAnteil.textContent = anteil.value + " %";
      outMonat.textContent = zahl(monat);
      outJahr.textContent = zahl(jahr);
      outTage.textContent = zahl(jahr / 8);
    };
    Array.prototype.forEach.call(regler, function (r) { r.addEventListener("input", rechnen); });
    anteil.addEventListener("input", rechnen);
    rechnen();
  })();

  /* ================= Datenschutz-Ampel ================= */
  (function () {
    var liste = $("ampelListe");
    var out = $("ampelErgebnis");
    if (!liste || !out) return;

    var stufen = { rot: "Nicht eingeben", gelb: "Erst anonymisieren", gruen: "In Ordnung" };
    var daten = [
      { name: "Mitgliederliste mit Namen und Adressen", stufe: "rot", text: "Das sind personenbezogene Daten. In einen freien KI-Dienst gehören sie nicht. Erlaubt wäre das nur mit Rechtsgrundlage und einem Vertrag zur Auftragsverarbeitung." },
      { name: "Kontodaten und IBAN", stufe: "rot", text: "Bankdaten bleiben im Verein. Für Formeln und Auswertungen reichen der KI erfundene Beispielzeilen." },
      { name: "Gesundheitsangaben, Atteste, Allergien", stufe: "rot", text: "Gesundheitsdaten sind nach Art. 9 DSGVO besonders geschützt. Sie gehören in keinen KI-Dienst." },
      { name: "Foto mit erkennbaren Personen", stufe: "rot", text: "Ein Foto mit erkennbaren Personen ist ein personenbezogenes Datum. Ohne Einwilligung der Abgebildeten nicht hochladen, bei Kindern besonders vorsichtig sein." },
      { name: "Sitzungsprotokoll mit Namen", stufe: "gelb", text: "Namen durch Ämter ersetzen, zum Beispiel „Kassenwart“ statt Name. Danach kann die KI den Text glätten." },
      { name: "E-Mail eines Mitglieds", stufe: "gelb", text: "Name, Adresse und Signatur entfernen und nur den Sachverhalt schildern. Dann lässt sich eine Antwort entwerfen." },
      { name: "Kassenzahlen ohne Namen", stufe: "gelb", text: "Datenschutzrechtlich meist unkritisch, aber vertraulich. Der Vorstand sollte festlegen, ob solche Zahlen in eine KI dürfen." },
      { name: "Spaltenüberschriften einer Tabelle", stufe: "gruen", text: "Der Aufbau einer Tabelle enthält keine Daten von Personen. Genau das braucht die KI für Formeln." },
      { name: "Ankündigung oder Spielbericht ohne Namen", stufe: "gruen", text: "Texte ohne Personenbezug können Sie bedenkenlos überarbeiten lassen." },
      { name: "Satzung des Vereins", stufe: "gruen", text: "Die Satzung ist in der Regel öffentlich. Die KI kann sie zusammenfassen oder Fragen dazu beantworten. Rechtliche Auskünfte bitte gegenprüfen." }
    ];

    var zeigen = function (d, knopf) {
      Array.prototype.forEach.call(liste.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", "false"); });
      knopf.setAttribute("aria-pressed", "true");
      out.className = "vw-ampel-ergebnis ist-" + d.stufe;
      out.textContent = "";
      var kopf = el("p", "vw-ampel-stufe");
      kopf.appendChild(el("span", "vw-lampe"));
      kopf.appendChild(el("strong", null, stufen[d.stufe]));
      out.appendChild(kopf);
      out.appendChild(el("p", "vw-ampel-name", d.name));
      out.appendChild(el("p", null, d.text));
    };
    daten.forEach(function (d) {
      var b = el("button", "vw-chip", d.name);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { zeigen(d, b); });
      liste.appendChild(b);
    });
  })();

  /* ================= Vorher und Nachher ================= */
  (function () {
    var regler = $("vnRegler");
    var buehne = $("vnBuehne");
    if (!regler || !buehne) return;
    var setzen = function () { buehne.style.setProperty("--vn", regler.value + "%"); };
    regler.addEventListener("input", setzen);
    setzen();
  })();

  /* ================= Praxistest: Modelle im Vergleich ================= */
  (function () {
    var daten = window.VEREIN_ARENA;
    var tabs = $("arenaTabs");
    var prompt = $("arenaPrompt");
    var gitter = $("arenaGitter");
    var fazit = $("arenaFazit");
    if (!daten || !tabs || !prompt || !gitter) return;

    var woerter = function (t) {
      return t.split(/\s+/).filter(function (w) { return /[A-Za-zÄÖÜäöüß0-9]/.test(w) && w.charAt(0) !== "#"; }).length;
    };
    var marke = function (ok, text) {
      return el("span", "vw-marke " + (ok ? "ist-ok" : "ist-nein"), (ok ? "✓ " : "✗ ") + text);
    };

    var zeigen = function (aufgabe) {
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.setAttribute("aria-selected", b.getAttribute("data-id") === aufgabe.id ? "true" : "false");
      });
      prompt.textContent = aufgabe.prompt;
      gitter.textContent = "";
      daten.modelle.forEach(function (m) {
        var antwort = m.antworten[aufgabe.id];
        if (!antwort) return;
        var karte = el("article", "vw-antwort");
        karte.appendChild(el("h4", null, m.name));
        var marken = el("p", "vw-marken");
        if (aufgabe.maxWoerter) {
          var n = woerter(antwort);
          marken.appendChild(marke(n <= aufgabe.maxWoerter, n + " von höchstens " + aufgabe.maxWoerter + " Wörtern"));
        }
        if (aufgabe.hashtags) {
          var h = (antwort.match(/#[A-Za-zÄÖÜäöüß0-9_]+/g) || []).length;
          marken.appendChild(marke(h === aufgabe.hashtags, h + " Hashtags"));
        }
        if (marken.childNodes.length) karte.appendChild(marken);
        karte.appendChild(el("div", "vw-antwort-text", antwort));
        var b = m.beobachtung && m.beobachtung[aufgabe.id];
        if (b) {
          var p = el("p", "vw-beobachtung");
          p.appendChild(el("strong", null, "Beobachtung: "));
          p.appendChild(document.createTextNode(b));
          karte.appendChild(p);
        }
        gitter.appendChild(karte);
      });
      if (fazit) fazit.textContent = aufgabe.fazit || "";
    };

    daten.aufgaben.forEach(function (a, i) {
      var b = el("button", "vw-tab", a.titel);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("data-id", a.id);
      b.addEventListener("click", function () { zeigen(a); });
      tabs.appendChild(b);
      if (i === 0) zeigen(a);
    });
  })();
})();
