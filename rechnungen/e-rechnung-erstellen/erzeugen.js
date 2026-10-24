/* Ru-Services · E-Rechnung erstellen: Berechnung, XML und PDF
   Erzeugt eine E-Rechnung nach EN 16931 im Format ZUGFeRD / Factur-X
   (Profil EN 16931, CII-Syntax) als PDF/A-3 mit eingebetteter XML.
   Läuft komplett im Browser. Es werden keine Daten übertragen.
   Bibliotheken (lokal unter /vendor): pdf-lib 1.17.1 und @pdf-lib/fontkit
   1.1.1 (beide MIT). Schrift: Liberation Sans 2.1.5 (SIL OFL 1.1, Datei unverändert). */
var ERechnung = (function () {
  "use strict";

  var NULL = BigInt(0), EINS = BigInt(1), ZWEI = BigInt(2);

  // UN/ECE Recommendation 20 (Maßeinheiten), wie in EN 16931 vorgeschrieben
  var EINHEITEN = [
    { code: "H87", text: "Stück" },
    { code: "HUR", text: "Std." },
    { code: "DAY", text: "Tag" },
    { code: "LS", text: "pauschal" },
    { code: "MTR", text: "m" },
    { code: "MTK", text: "m²" },
    { code: "MTQ", text: "m³" },
    { code: "KGM", text: "kg" },
    { code: "TNE", text: "t" },
    { code: "LTR", text: "l" },
    { code: "KMT", text: "km" },
    { code: "SET", text: "Satz" },
    { code: "MON", text: "Monat" }
  ];
  var KLEINUNTERNEHMER_GRUND = "Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG";

  /* ---------- Zahlen ---------- */

  // "1.234,56" / "1234,56" / "1234.56" -> "1234.56" (oder null)
  function dezimal(text) {
    var s = String(text == null ? "" : text).trim().replace(/[\s €]/g, "");
    if (!s) return null;
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    if (s[0] === "+") s = s.slice(1);
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return s;
  }

  // Dezimaltext -> BigInt mit festen Nachkommastellen (kaufmännisch gerundet)
  function skaliert(dez, stellen) {
    var neg = dez[0] === "-";
    if (neg) dez = dez.slice(1);
    var teile = dez.split(".");
    var nachkomma = teile[1] || "";
    var rest = nachkomma.slice(stellen);
    nachkomma = (nachkomma + "0000000000").slice(0, stellen);
    var wert = BigInt(teile[0] + nachkomma);
    if (rest && rest[0] >= "5") wert += EINS;
    return neg ? -wert : wert;
  }

  // a / b, kaufmännisch gerundet (b > 0)
  function geteilt(a, b) {
    var neg = a < NULL;
    if (neg) a = -a;
    var q = a / b, r = a % b;
    if (r * ZWEI >= b) q += EINS;
    return neg ? -q : q;
  }

  function hoch10(n) { return BigInt("1" + "0".repeat(n)); }

  // BigInt mit n Nachkommastellen -> "1234.5600"
  function alsText(wert, stellen) {
    var neg = wert < NULL;
    var s = (neg ? -wert : wert).toString();
    while (s.length <= stellen) s = "0" + s;
    var t = stellen ? s.slice(0, -stellen) + "." + s.slice(-stellen) : s;
    return (neg ? "-" : "") + t;
  }

  // "1234.5000" -> "1234.5" (mindestens min Nachkommastellen)
  function kuerzen(text, min) {
    if (text.indexOf(".") < 0) return min ? text + "." + "0".repeat(min) : text;
    var t = text.replace(/0+$/, "");
    var nk = t.split(".")[1].length;
    if (nk < min) t += "0".repeat(min - nk);
    return t.replace(/\.$/, "");
  }

  function deutsch(text) {
    var neg = text[0] === "-";
    if (neg) text = text.slice(1);
    var teile = text.split(".");
    var ganz = teile[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + ganz + (teile[1] ? "," + teile[1] : "");
  }

  function euro(cent) { return deutsch(alsText(cent, 2)) + " €"; }

  /* ---------- Datum ---------- */

  function gueltigesDatum(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
    var d = new Date(iso + "T12:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === iso;
  }
  function datumXml(iso) { return iso.replace(/-/g, ""); }
  function datumDe(iso) { var t = iso.split("-"); return t[2] + "." + t[1] + "." + t[0]; }
  function plusTage(iso, tage) {
    var d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + tage);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- Prüfungen ---------- */

  // Zeichen, die die PDF-Schrift kennt (Latein mit Akzenten, Satzzeichen, €).
  // Alles andere wird in PDF und XML gleich durch "?" ersetzt.
  var ERLAUBT = /[^\n\u0020-\u007e\u00a0-\u024f\u2010\u2012-\u2022\u2026\u2030\u2032-\u2034\u2039\u203a\u20ac\u2122\u2190-\u2193\u2212]/g;
  var ersetzt = false;
  function zeichen(text) {
    var s = String(text == null ? "" : text).replace(/\r/g, "").replace(/\t/g, " ");
    var neu = s.replace(/[\ud800-\udbff][\udc00-\udfff]/g, "?").replace(ERLAUBT, "?");
    if (neu !== s) ersetzt = true;
    return neu;
  }
  function txt(v) { return zeichen(v).replace(/\s+/g, " ").trim(); }

  function ibanGueltig(iban) {
    var s = iban.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
    if (s.slice(0, 2) === "DE" && s.length !== 22) return false;
    var umgestellt = s.slice(4) + s.slice(0, 4);
    var rest = 0;
    for (var i = 0; i < umgestellt.length; i++) {
      var c = umgestellt.charCodeAt(i);
      var wert = c >= 65 ? String(c - 55) : umgestellt[i];
      for (var j = 0; j < wert.length; j++) rest = (rest * 10 + (wert.charCodeAt(j) - 48)) % 97;
    }
    return rest === 1;
  }

  function einheitText(code) {
    for (var i = 0; i < EINHEITEN.length; i++) if (EINHEITEN[i].code === code) return EINHEITEN[i].text;
    return code;
  }

  /* ---------- Berechnung und Prüfung der Eingaben ---------- */

  // Positionen und Steuern; fehler (Array) wird ergänzt, zeilen[i] = Nettobetrag der Eingabezeile i
  function rechnePositionen(eingaben, klein, fehler) {
    var positionen = [], gruppen = {}, summeNetto = NULL, zeilenNetto = [];
    eingaben.forEach(function (p, i) {
      var nr = i + 1;
      var leer = !txt(p.bezeichnung) && !txt(p.menge) && !txt(p.preis);
      if (leer) return;
      var bez = zeichen(p.bezeichnung).replace(/\r/g, "").trim();
      if (!bez) fehler.push({ feld: "p" + i + "_bez", text: "Position " + nr + ": Bezeichnung fehlt." });
      var mengeDez = dezimal(p.menge);
      var preisDez = dezimal(p.preis);
      if (mengeDez === null || Number(mengeDez) === 0) fehler.push({ feld: "p" + i + "_menge", text: "Position " + nr + ": Menge fehlt oder ist keine Zahl." });
      if (preisDez === null) fehler.push({ feld: "p" + i + "_preis", text: "Position " + nr + ": Einzelpreis fehlt oder ist keine Zahl." });
      if (mengeDez === null || preisDez === null || !bez) return;
      var menge = skaliert(mengeDez, 4), preis = skaliert(preisDez, 4);
      if (menge === NULL) return;
      // EN 16931 (BR-27): Preis darf nicht negativ sein, dann Menge negativ
      if (preis < NULL) { preis = -preis; menge = -menge; }
      var netto = geteilt(menge * preis, hoch10(6));
      zeilenNetto[i] = netto;
      var satz = klein ? "0" : (String(p.satz) === "7" ? "7" : "19");
      var kat = klein ? "E" : "S";
      var schluessel = kat + satz;
      if (!gruppen[schluessel]) gruppen[schluessel] = { kat: kat, satz: satz, basis: NULL };
      gruppen[schluessel].basis += netto;
      summeNetto += netto;
      var zeilen = bez.split("\n").map(function (z) { return z.trim(); }).filter(Boolean);
      positionen.push({
        nr: positionen.length + 1,
        name: zeilen[0],
        beschreibung: zeilen.slice(1).join("\n"),
        zeilen: zeilen,
        menge: menge,
        preis: preis,
        einheit: p.einheit || "H87",
        satz: satz,
        kat: kat,
        netto: netto
      });
    });
    if (!eingaben.length || (!positionen.length && !fehler.some(function (f) { return f.feld.charAt(0) === "p"; }))) {
      fehler.push({ feld: "p0_bez", text: "Bitte mindestens eine Position eintragen." });
    }

    var steuer = [], summeSteuer = NULL;
    Object.keys(gruppen).sort(function (a, b) { return Number(gruppen[b].satz) - Number(gruppen[a].satz); }).forEach(function (s) {
      var g = gruppen[s];
      var betrag = klein ? NULL : geteilt(g.basis * BigInt(Number(g.satz) * 100), BigInt(10000));
      summeSteuer += betrag;
      steuer.push({ kat: g.kat, satz: g.satz, basis: g.basis, betrag: betrag });
    });
    var brutto = summeNetto + summeSteuer;
    return { positionen: positionen, steuer: steuer, summeNetto: summeNetto, summeSteuer: summeSteuer, brutto: brutto, zeilenNetto: zeilenNetto };
  }

  // Für die Live-Anzeige im Formular: Beträge als Text, ohne Pflichtfeld-Prüfung
  function summen(eingaben, klein) {
    var r = rechnePositionen(eingaben, !!klein, []);
    return {
      zeilen: eingaben.map(function (_, i) { return r.zeilenNetto[i] === undefined ? "" : euro(r.zeilenNetto[i]); }),
      netto: euro(r.summeNetto),
      steuer: r.steuer.map(function (s) { return { satz: s.satz, basis: euro(s.basis), betrag: euro(s.betrag) }; }),
      brutto: euro(r.brutto),
      anzahl: r.positionen.length
    };
  }


  // Liefert { fehler: [{feld, text}], rechnung }; rechnung nur ohne Fehler.
  function berechne(e) {
    var fehler = [];
    ersetzt = false;
    function pflicht(wert, feld, name) {
      if (!txt(wert)) fehler.push({ feld: feld, text: name + " fehlt." });
    }
    var v = e.verkaeufer || {}, k = e.kaeufer || {};
    var klein = !!e.kleinunternehmer;

    pflicht(v.name, "v_name", "Ihr Firmenname");
    pflicht(v.strasse, "v_strasse", "Ihre Straße");
    pflicht(v.plz, "v_plz", "Ihre Postleitzahl");
    pflicht(v.ort, "v_ort", "Ihr Ort");
    var ustid = txt(v.ustid).replace(/\s/g, "").toUpperCase();
    var stnr = txt(v.steuernummer);
    if (!ustid && !stnr) fehler.push({ feld: "v_steuernummer", text: "Steuernummer oder USt-IdNr. fehlt (eine von beiden ist Pflicht)." });
    if (ustid && !/^DE\d{9}$/.test(ustid)) fehler.push({ feld: "v_ustid", text: "Die USt-IdNr. hat nicht das Format DE und 9 Ziffern." });
    if (txt(v.plz) && !/^\d{5}$/.test(txt(v.plz))) fehler.push({ feld: "v_plz", text: "Ihre Postleitzahl muss 5 Ziffern haben." });
    var iban = txt(v.iban).replace(/\s/g, "").toUpperCase();
    if (iban && !ibanGueltig(iban)) fehler.push({ feld: "v_iban", text: "Die IBAN ist nicht gültig. Bitte prüfen Sie die Eingabe." });
    var bic = txt(v.bic).replace(/\s/g, "").toUpperCase();
    if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) fehler.push({ feld: "v_bic", text: "Die BIC hat nicht das richtige Format (8 oder 11 Zeichen)." });
    if (txt(v.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt(v.email))) fehler.push({ feld: "v_email", text: "Ihre E-Mail-Adresse ist nicht vollständig." });

    pflicht(k.name, "k_name", "Name des Kunden");
    pflicht(k.strasse, "k_strasse", "Straße des Kunden");
    pflicht(k.plz, "k_plz", "Postleitzahl des Kunden");
    pflicht(k.ort, "k_ort", "Ort des Kunden");
    if (txt(k.plz) && !/^\d{5}$/.test(txt(k.plz))) fehler.push({ feld: "k_plz", text: "Die Postleitzahl des Kunden muss 5 Ziffern haben." });
    var kUstid = txt(k.ustid).replace(/\s/g, "").toUpperCase();
    if (kUstid && !/^DE\d{9}$/.test(kUstid)) fehler.push({ feld: "k_ustid", text: "Die USt-IdNr. des Kunden hat nicht das Format DE und 9 Ziffern." });
    if (txt(k.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt(k.email))) fehler.push({ feld: "k_email", text: "Die E-Mail-Adresse des Kunden ist nicht vollständig." });

    pflicht(e.nummer, "r_nummer", "Rechnungsnummer");
    if (!gueltigesDatum(e.datum)) fehler.push({ feld: "r_datum", text: "Rechnungsdatum fehlt." });
    var zeitraum = e.leistungsart === "zeitraum";
    if (zeitraum) {
      if (!gueltigesDatum(e.leistungVon)) fehler.push({ feld: "r_von", text: "Beginn des Leistungszeitraums fehlt." });
      if (!gueltigesDatum(e.leistungBis)) fehler.push({ feld: "r_bis", text: "Ende des Leistungszeitraums fehlt." });
      if (gueltigesDatum(e.leistungVon) && gueltigesDatum(e.leistungBis) && e.leistungBis < e.leistungVon) {
        fehler.push({ feld: "r_bis", text: "Der Leistungszeitraum endet vor seinem Beginn." });
      }
    } else if (!gueltigesDatum(e.leistungsdatum)) {
      fehler.push({ feld: "r_leistung", text: "Leistungsdatum fehlt." });
    }
    var tage = parseInt(e.zahlungsziel, 10);
    if (isNaN(tage) || tage < 0) tage = 14;

    var pos = rechnePositionen(e.positionen || [], klein, fehler);
    var positionen = pos.positionen, steuer = pos.steuer;
    var summeNetto = pos.summeNetto, summeSteuer = pos.summeSteuer, brutto = pos.brutto;

    if (fehler.length) return { fehler: fehler, rechnung: null };

    var faellig = plusTage(e.datum, tage);
    var zahltext = tage === 0
      ? "Zahlbar sofort ohne Abzug."
      : "Zahlbar bis zum " + datumDe(faellig) + " ohne Abzug.";
    if (brutto < NULL) zahltext = "Der Betrag von " + euro(-brutto) + " wird Ihnen bis zum " + datumDe(faellig) + " erstattet.";

    return {
      fehler: [],
      zeichenErsetzt: ersetzt,
      rechnung: {
        nummer: txt(e.nummer),
        datum: e.datum,
        zeitraum: zeitraum,
        leistungsdatum: zeitraum ? null : e.leistungsdatum,
        leistungVon: zeitraum ? e.leistungVon : null,
        leistungBis: zeitraum ? e.leistungBis : null,
        faellig: faellig,
        tage: tage,
        zahltext: zahltext,
        kleinunternehmer: klein,
        bestellnummer: txt(e.bestellnummer),
        referenz: txt(e.referenz),
        notiz: zeichen(e.notiz).replace(/\r/g, "").trim(),
        verkaeufer: {
          name: txt(v.name), kontakt: txt(v.kontakt), strasse: txt(v.strasse), plz: txt(v.plz), ort: txt(v.ort),
          telefon: txt(v.telefon), email: txt(v.email), steuernummer: stnr, ustid: ustid,
          iban: iban, bic: bic, bank: txt(v.bank)
        },
        kaeufer: {
          name: txt(k.name), kontakt: txt(k.kontakt), strasse: txt(k.strasse), plz: txt(k.plz), ort: txt(k.ort),
          email: txt(k.email), kundennummer: txt(k.kundennummer), ustid: kUstid
        },
        positionen: positionen,
        steuer: steuer,
        summeNetto: summeNetto,
        summeSteuer: summeSteuer,
        brutto: brutto
      }
    };
  }

  /* ---------- XML (CII, Profil EN 16931) ---------- */

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function betrag(cent) { return alsText(cent, 2); }
  function datumEl(iso) { return '<udt:DateTimeString format="102">' + datumXml(iso) + "</udt:DateTimeString>"; }

  function erstelleXml(r) {
    var v = r.verkaeufer, k = r.kaeufer, x = [];
    function el(name, wert, attr) {
      if (wert === "" || wert == null) return;
      x.push("<" + name + (attr || "") + ">" + esc(wert) + "</" + name + ">");
    }
    function adresse(p) {
      x.push("<ram:PostalTradeAddress>");
      el("ram:PostcodeCode", p.plz);
      el("ram:LineOne", p.strasse);
      el("ram:CityName", p.ort);
      el("ram:CountryID", "DE");
      x.push("</ram:PostalTradeAddress>");
    }

    x.push('<?xml version="1.0" encoding="UTF-8"?>');
    x.push('<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">');
    x.push("<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>");

    x.push("<rsm:ExchangedDocument>");
    el("ram:ID", r.nummer);
    el("ram:TypeCode", "380");
    x.push("<ram:IssueDateTime>" + datumEl(r.datum) + "</ram:IssueDateTime>");
    if (r.notiz) x.push("<ram:IncludedNote><ram:Content>" + esc(r.notiz) + "</ram:Content></ram:IncludedNote>");
    if (r.kleinunternehmer) x.push("<ram:IncludedNote><ram:Content>" + esc(KLEINUNTERNEHMER_GRUND) + "</ram:Content></ram:IncludedNote>");
    x.push("</rsm:ExchangedDocument>");

    x.push("<rsm:SupplyChainTradeTransaction>");
    r.positionen.forEach(function (p) {
      x.push("<ram:IncludedSupplyChainTradeLineItem>");
      x.push("<ram:AssociatedDocumentLineDocument><ram:LineID>" + p.nr + "</ram:LineID></ram:AssociatedDocumentLineDocument>");
      x.push("<ram:SpecifiedTradeProduct>");
      el("ram:Name", p.name);
      el("ram:Description", p.beschreibung);
      x.push("</ram:SpecifiedTradeProduct>");
      x.push("<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>" + kuerzen(alsText(p.preis, 4), 2) + "</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>");
      x.push('<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="' + esc(p.einheit) + '">' + kuerzen(alsText(p.menge, 4), 0) + "</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>");
      x.push("<ram:SpecifiedLineTradeSettlement>");
      x.push("<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>" + p.kat + "</ram:CategoryCode><ram:RateApplicablePercent>" + p.satz + "</ram:RateApplicablePercent></ram:ApplicableTradeTax>");
      x.push("<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>" + betrag(p.netto) + "</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>");
      x.push("</ram:SpecifiedLineTradeSettlement>");
      x.push("</ram:IncludedSupplyChainTradeLineItem>");
    });

    x.push("<ram:ApplicableHeaderTradeAgreement>");
    el("ram:BuyerReference", r.referenz);
    // Verkäufer (BG-4)
    x.push("<ram:SellerTradeParty>");
    // BR-CO-26: ohne USt-IdNr. dient die Steuernummer als Verkäuferkennung (wie FeRD-Beispiel E13)
    if (!v.ustid && v.steuernummer) el("ram:ID", v.steuernummer);
    el("ram:Name", v.name);
    if (v.kontakt || v.telefon || v.email) {
      x.push("<ram:DefinedTradeContact>");
      el("ram:PersonName", v.kontakt || v.name);
      if (v.telefon) x.push("<ram:TelephoneUniversalCommunication><ram:CompleteNumber>" + esc(v.telefon) + "</ram:CompleteNumber></ram:TelephoneUniversalCommunication>");
      if (v.email) x.push("<ram:EmailURIUniversalCommunication><ram:URIID>" + esc(v.email) + "</ram:URIID></ram:EmailURIUniversalCommunication>");
      x.push("</ram:DefinedTradeContact>");
    }
    adresse(v);
    if (v.email) x.push('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + esc(v.email) + "</ram:URIID></ram:URIUniversalCommunication>");
    if (v.ustid) x.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + esc(v.ustid) + "</ram:ID></ram:SpecifiedTaxRegistration>");
    if (v.steuernummer) x.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">' + esc(v.steuernummer) + "</ram:ID></ram:SpecifiedTaxRegistration>");
    x.push("</ram:SellerTradeParty>");
    // Käufer (BG-7)
    x.push("<ram:BuyerTradeParty>");
    el("ram:ID", k.kundennummer);
    el("ram:Name", k.name);
    if (k.kontakt) x.push("<ram:DefinedTradeContact><ram:PersonName>" + esc(k.kontakt) + "</ram:PersonName></ram:DefinedTradeContact>");
    adresse(k);
    if (k.email) x.push('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + esc(k.email) + "</ram:URIID></ram:URIUniversalCommunication>");
    if (k.ustid) x.push('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + esc(k.ustid) + "</ram:ID></ram:SpecifiedTaxRegistration>");
    x.push("</ram:BuyerTradeParty>");
    if (r.bestellnummer) x.push("<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>" + esc(r.bestellnummer) + "</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>");
    x.push("</ram:ApplicableHeaderTradeAgreement>");

    x.push("<ram:ApplicableHeaderTradeDelivery>");
    if (r.leistungsdatum) x.push("<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>" + datumEl(r.leistungsdatum) + "</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>");
    x.push("</ram:ApplicableHeaderTradeDelivery>");

    x.push("<ram:ApplicableHeaderTradeSettlement>");
    if (v.iban) el("ram:PaymentReference", r.nummer);
    el("ram:InvoiceCurrencyCode", "EUR");
    if (v.iban) {
      x.push("<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode>");
      x.push("<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>" + esc(v.iban) + "</ram:IBANID><ram:AccountName>" + esc(v.name) + "</ram:AccountName></ram:PayeePartyCreditorFinancialAccount>");
      if (v.bic) x.push("<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>" + esc(v.bic) + "</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>");
      x.push("</ram:SpecifiedTradeSettlementPaymentMeans>");
    }
    r.steuer.forEach(function (s) {
      x.push("<ram:ApplicableTradeTax>");
      x.push("<ram:CalculatedAmount>" + betrag(s.betrag) + "</ram:CalculatedAmount>");
      x.push("<ram:TypeCode>VAT</ram:TypeCode>");
      if (s.kat === "E") el("ram:ExemptionReason", KLEINUNTERNEHMER_GRUND);
      x.push("<ram:BasisAmount>" + betrag(s.basis) + "</ram:BasisAmount>");
      x.push("<ram:CategoryCode>" + s.kat + "</ram:CategoryCode>");
      x.push("<ram:RateApplicablePercent>" + s.satz + "</ram:RateApplicablePercent>");
      x.push("</ram:ApplicableTradeTax>");
    });
    if (r.zeitraum) {
      x.push("<ram:BillingSpecifiedPeriod><ram:StartDateTime>" + datumEl(r.leistungVon) + "</ram:StartDateTime><ram:EndDateTime>" + datumEl(r.leistungBis) + "</ram:EndDateTime></ram:BillingSpecifiedPeriod>");
    }
    x.push("<ram:SpecifiedTradePaymentTerms>");
    el("ram:Description", r.zahltext);
    x.push("<ram:DueDateDateTime>" + datumEl(r.faellig) + "</ram:DueDateDateTime>");
    x.push("</ram:SpecifiedTradePaymentTerms>");
    x.push("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
    x.push("<ram:LineTotalAmount>" + betrag(r.summeNetto) + "</ram:LineTotalAmount>");
    x.push("<ram:TaxBasisTotalAmount>" + betrag(r.summeNetto) + "</ram:TaxBasisTotalAmount>");
    x.push('<ram:TaxTotalAmount currencyID="EUR">' + betrag(r.summeSteuer) + "</ram:TaxTotalAmount>");
    x.push("<ram:GrandTotalAmount>" + betrag(r.brutto) + "</ram:GrandTotalAmount>");
    x.push("<ram:DuePayableAmount>" + betrag(r.brutto) + "</ram:DuePayableAmount>");
    x.push("</ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
    x.push("</ram:ApplicableHeaderTradeSettlement>");
    x.push("</rsm:SupplyChainTradeTransaction>");
    x.push("</rsm:CrossIndustryInvoice>");
    return x.join("\n") + "\n";
  }

  /* ---------- PDF/A-3 mit eingebetteter XML ---------- */

  var PRODUZENT = "Ru-Services, E-Rechnung erstellen (ru-services.de)";

  function xmp(r, isoZeit) {
    var titel = esc("Rechnung " + r.nummer);
    var autor = esc(r.verkaeufer.name);
    var thema = esc("E-Rechnung nach EN 16931 (ZUGFeRD / Factur-X, Profil EN 16931)");
    function feld(name, typ, text) {
      return '<rdf:li rdf:parseType="Resource"><pdfaProperty:name>' + name + "</pdfaProperty:name><pdfaProperty:valueType>" + typ + "</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>" + text + "</pdfaProperty:description></rdf:li>";
    }
    return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>\n' +
      '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:format>application/pdf</dc:format>' +
      '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' + titel + "</rdf:li></rdf:Alt></dc:title>" +
      "<dc:creator><rdf:Seq><rdf:li>" + autor + "</rdf:li></rdf:Seq></dc:creator>" +
      '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' + thema + "</rdf:li></rdf:Alt></dc:description>" +
      "</rdf:Description>\n" +
      '<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>' + esc(PRODUZENT) + "</pdf:Producer></rdf:Description>\n" +
      '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>' + esc(PRODUZENT) + "</xmp:CreatorTool><xmp:CreateDate>" + isoZeit + "</xmp:CreateDate><xmp:ModifyDate>" + isoZeit + "</xmp:ModifyDate><xmp:MetadataDate>" + isoZeit + "</xmp:MetadataDate></rdf:Description>\n" +
      '<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">' +
      "<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType=\"Resource\">" +
      "<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>" +
      "<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>" +
      "<pdfaSchema:prefix>fx</pdfaSchema:prefix>" +
      "<pdfaSchema:property><rdf:Seq>" +
      feld("DocumentFileName", "Text", "The name of the embedded XML document") +
      feld("DocumentType", "Text", "The type of the hybrid document in capital letters, e.g. INVOICE or ORDER") +
      feld("Version", "Text", "The actual version of the standard applying to the embedded XML document") +
      feld("ConformanceLevel", "Text", "The conformance level of the embedded XML document") +
      "</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>\n" +
      '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">' +
      "<fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>" +
      "<fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>\n" +
      "</rdf:RDF>\n</x:xmpmeta>\n" + " ".repeat(2000) + '\n<?xpacket end="w"?>';
  }

  function utf8(text) { return new TextEncoder().encode(text); }

  function zufallsHex(bytes) {
    var a = new Uint8Array(bytes), s = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < a.length; j++) s += (a[j] < 16 ? "0" : "") + a[j].toString(16);
    return s.toUpperCase();
  }

  // m: { PDFLib, fontkit, schrift, schriftFett (ArrayBuffer), icc (ArrayBuffer), jetzt (Date) }
  async function erstellePdf(r, xmlText, m) {
    var L = m.PDFLib;
    var jetzt = new Date(Math.floor((m.jetzt || new Date()).getTime() / 1000) * 1000);
    var isoZeit = jetzt.toISOString().replace(/\.\d{3}Z$/, "Z");

    var doc = await L.PDFDocument.create({ updateMetadata: false });
    doc.registerFontkit(m.fontkit);
    var normal = await doc.embedFont(m.schrift, { subset: true, features: { liga: false } });
    var fett = await doc.embedFont(m.schriftFett, { subset: true, features: { liga: false } });

    // Zeichen ohne Glyphe ersetzen (PDF/A verbietet Verweise auf .notdef)
    function sauber(font, text) {
      var fk = font.embedder.font, aus = "";
      for (var z of String(text)) {
        var cp = z.codePointAt(0);
        if (cp === 9) z = " ";
        aus += fk.hasGlyphForCodePoint(z.codePointAt(0)) ? z : "?";
      }
      return aus;
    }

    var A4 = [595.28, 841.89], H = A4[1];
    function mm(v) { return v * 72 / 25.4; }
    var LINKS = mm(25), RECHTS = A4[0] - mm(20);
    var SCHWARZ = L.rgb(0, 0, 0), GRAU = L.rgb(0.33, 0.33, 0.33), LINIE = L.rgb(0.62, 0.62, 0.62);
    var seiten = [];

    function schreibe(seite, text, x, yOben, groesse, font, farbe, ausrichtung) {
      text = sauber(font || normal, text);
      var f = font || normal;
      var breite = f.widthOfTextAtSize(text, groesse);
      var xx = ausrichtung === "rechts" ? x - breite : x;
      seite.drawText(text, { x: xx, y: H - mm(yOben), size: groesse, font: f, color: farbe || SCHWARZ });
      return breite;
    }
    function umbrechen(text, font, groesse, maxBreite) {
      var ergebnis = [];
      String(text).split("\n").forEach(function (absatz) {
        var woerter = sauber(font, absatz).split(/ +/), zeile = "";
        woerter.forEach(function (w) {
          var probe = zeile ? zeile + " " + w : w;
          if (font.widthOfTextAtSize(probe, groesse) <= maxBreite) { zeile = probe; return; }
          if (zeile) ergebnis.push(zeile);
          // zu lange Wörter hart trennen
          while (font.widthOfTextAtSize(w, groesse) > maxBreite) {
            var n = w.length;
            while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), groesse) > maxBreite) n--;
            ergebnis.push(w.slice(0, n));
            w = w.slice(n);
          }
          zeile = w;
        });
        ergebnis.push(zeile);
      });
      return ergebnis;
    }
    function linie(seite, x1, x2, yOben, dicke, farbe) {
      seite.drawLine({ start: { x: x1, y: H - mm(yOben) }, end: { x: x2, y: H - mm(yOben) }, thickness: dicke || 0.5, color: farbe || LINIE });
    }

    var v = r.verkaeufer, k = r.kaeufer;
    var FUSS_OBEN = 268;

    function fusszeile(seite) {
      linie(seite, LINKS, RECHTS, FUSS_OBEN, 0.5);
      var spalten = [[], [], []];
      spalten[0].push(v.name, v.strasse, v.plz + " " + v.ort);
      if (v.telefon) spalten[1].push("Telefon: " + v.telefon);
      if (v.email) spalten[1].push("E-Mail: " + v.email);
      if (v.ustid) spalten[1].push("USt-IdNr.: " + v.ustid);
      if (v.steuernummer) spalten[1].push("Steuernummer: " + v.steuernummer);
      if (v.iban) {
        if (v.bank) spalten[2].push(v.bank);
        spalten[2].push("IBAN: " + v.iban.replace(/(.{4})/g, "$1 ").trim());
        if (v.bic) spalten[2].push("BIC: " + v.bic);
      }
      var breite = (RECHTS - LINKS) / 3;
      spalten.forEach(function (zeilen, i) {
        var umbrochen = [];
        zeilen.forEach(function (z) { umbrochen = umbrochen.concat(umbrechen(z, normal, 7.5, breite - 6)); });
        umbrochen.slice(0, 6).forEach(function (t, j) {
          seite.drawText(t, { x: LINKS + i * breite, y: H - mm(FUSS_OBEN + 4.5 + j * 3.4), size: 7.5, font: normal, color: GRAU });
        });
      });
      // Falz- und Lochmarken (DIN 5008)
      [105, 210].forEach(function (y) { linie(seite, mm(3), mm(8), y, 0.4, LINIE); });
      linie(seite, mm(3), mm(10), 148.5, 0.4, LINIE);
    }

    function neueSeite() {
      var s = doc.addPage(A4);
      seiten.push(s);
      fusszeile(s);
      return s;
    }

    var seite = neueSeite();

    // Kopf: Absender
    var kopf = [v.strasse, v.plz + " " + v.ort];
    if (v.telefon) kopf.push("Telefon " + v.telefon);
    if (v.email) kopf.push(v.email);
    var kopfBreite = 0, platz, groesse = 15, namensZeilen;
    if (m.logo && m.logo.bytes) {
      // Mit Logo: Logo oben rechts, Name und Anschrift links darunter
      var bild = m.logo.typ === "jpg" ? await doc.embedJpg(m.logo.bytes) : await doc.embedPng(m.logo.bytes);
      var f = Math.min(mm(70) / bild.width, mm(24) / bild.height, 72 / 150);
      var bw = bild.width * f, bh = bild.height * f;
      seite.drawImage(bild, { x: RECHTS - bw, y: H - mm(12) - bh, width: bw, height: bh });
      platz = RECHTS - LINKS - bw - mm(8);
      while (groesse > 11 && fett.widthOfTextAtSize(sauber(fett, v.name), groesse) > platz) groesse -= 0.5;
      namensZeilen = umbrechen(v.name, fett, groesse, platz).slice(0, 2);
      var yK = 20;
      namensZeilen.forEach(function (t, i) {
        schreibe(seite, t, LINKS, yK + i * groesse * 0.45, groesse, fett);
      });
      yK += (namensZeilen.length - 1) * groesse * 0.45 + 6;
      // Angaben mit " · " verbinden, solange die Zeile passt
      var zeilenK = [], aktuell = "";
      kopf.forEach(function (teil) {
        teil = sauber(normal, teil);
        var probe = aktuell ? aktuell + " · " + teil : teil;
        if (!aktuell || normal.widthOfTextAtSize(probe, 8.5) <= platz) aktuell = probe;
        else { zeilenK.push(aktuell); aktuell = teil; }
      });
      if (aktuell) zeilenK.push(aktuell);
      zeilenK.forEach(function (t) {
        if (yK > 44) return;
        umbrechen(t, normal, 8.5, platz).forEach(function (u) {
          if (yK > 44) return;
          schreibe(seite, u, LINKS, yK, 8.5, normal, GRAU);
          yK += 4;
        });
      });
    } else {
      kopf.forEach(function (z, i) {
        kopfBreite = Math.max(kopfBreite, schreibe(seite, z, RECHTS, 17 + i * 4, 8.5, normal, GRAU, "rechts"));
      });
      platz = RECHTS - LINKS - kopfBreite - mm(8);
      while (groesse > 11 && fett.widthOfTextAtSize(sauber(fett, v.name), groesse) > platz) groesse -= 0.5;
      namensZeilen = umbrechen(v.name, fett, groesse, platz).slice(0, 2);
      namensZeilen.forEach(function (t, i) {
        schreibe(seite, t, LINKS, (namensZeilen.length > 1 ? 19 : 22) + i * groesse * 0.45, groesse, fett);
      });
    }

    // Anschriftfeld (DIN 5008, Form B)
    var ruecksende = sauber(normal, v.name + " · " + v.strasse + " · " + v.plz + " " + v.ort), rGroesse = 7;
    while (rGroesse > 5.5 && normal.widthOfTextAtSize(ruecksende, rGroesse) > mm(82)) rGroesse -= 0.25;
    if (normal.widthOfTextAtSize(ruecksende, rGroesse) > mm(82)) {
      var ende = " · " + sauber(normal, v.strasse + " · " + v.plz + " " + v.ort), name = sauber(normal, v.name);
      while (name.length > 1 && normal.widthOfTextAtSize(name + "…" + ende, rGroesse) > mm(82)) name = name.slice(0, -1);
      ruecksende = name.trim() + "…" + ende;
    }
    schreibe(seite, ruecksende, LINKS, 52, rGroesse, normal, GRAU);
    linie(seite, LINKS, LINKS + normal.widthOfTextAtSize(ruecksende, rGroesse), 52.8, 0.3, GRAU);
    var anschrift = [k.name];
    if (k.kontakt) anschrift.push(k.kontakt);
    anschrift.push(k.strasse, k.plz + " " + k.ort);
    var yA = 61;
    anschrift.forEach(function (z) {
      umbrechen(z, normal, 10.5, mm(82)).forEach(function (t) {
        if (yA > 88) return;
        schreibe(seite, t, LINKS, yA, 10.5);
        yA += 4.7;
      });
    });

    // Informationsblock rechts
    var info = [["Rechnungsnummer", r.nummer], ["Rechnungsdatum", datumDe(r.datum)]];
    if (r.zeitraum) info.push(["Leistungszeitraum", datumDe(r.leistungVon) + " bis " + datumDe(r.leistungBis)]);
    else info.push(["Leistungsdatum", datumDe(r.leistungsdatum)]);
    if (k.kundennummer) info.push(["Kundennummer", k.kundennummer]);
    if (r.bestellnummer) info.push(["Ihre Bestellung", r.bestellnummer]);
    if (r.referenz) info.push(["Ihre Referenz", r.referenz]);
    if (k.ustid) info.push(["Ihre USt-IdNr.", k.ustid]);
    var yI = 55;
    info.forEach(function (z) {
      schreibe(seite, z[0], mm(118), yI, 8.5, normal, GRAU);
      var wert = sauber(normal, z[1]);
      while (wert.length > 1 && normal.widthOfTextAtSize(wert, 9.5) > mm(42)) wert = wert.slice(0, -1);
      schreibe(seite, wert, RECHTS, yI, 9.5, normal, SCHWARZ, "rechts");
      yI += 4.8;
    });

    // Betreff
    var y = Math.max(103, yI + 8);
    schreibe(seite, "Rechnung Nr. " + r.nummer, LINKS, y, 14, fett);
    y += 8;
    if (r.notiz) {
      umbrechen(r.notiz, normal, 10, RECHTS - LINKS).forEach(function (t) { schreibe(seite, t, LINKS, y, 10); y += 4.6; });
      y += 3;
    }

    // Positionstabelle
    var mitSteuer = !r.kleinunternehmer;
    var SP = {
      pos: LINKS,
      bez: LINKS + mm(9),
      bezBreite: mitSteuer ? mm(68) : mm(80),
      menge: mitSteuer ? mm(115) : mm(127),
      einheit: mitSteuer ? mm(117) : mm(129),
      preis: mitSteuer ? mm(152) : mm(160),
      satz: mm(165),
      netto: RECHTS
    };
    function tabellenKopf() {
      schreibe(seite, "Pos.", SP.pos, y, 8.5, fett);
      schreibe(seite, "Bezeichnung", SP.bez, y, 8.5, fett);
      schreibe(seite, "Menge", SP.menge, y, 8.5, fett, SCHWARZ, "rechts");
      schreibe(seite, "Einheit", SP.einheit, y, 8.5, fett);
      schreibe(seite, "Einzelpreis", SP.preis, y, 8.5, fett, SCHWARZ, "rechts");
      if (mitSteuer) schreibe(seite, "USt.", SP.satz, y, 8.5, fett, SCHWARZ, "rechts");
      schreibe(seite, mitSteuer ? "Gesamt netto" : "Gesamt", SP.netto, y, 8.5, fett, SCHWARZ, "rechts");
      linie(seite, LINKS, RECHTS, y + 2, 0.6, SCHWARZ);
      y += 6.5;
    }
    function folgeseite() {
      seite = neueSeite();
      y = 20;
      schreibe(seite, v.name + " · Rechnung Nr. " + r.nummer, LINKS, y, 8.5, normal, GRAU);
      y += 10;
    }
    tabellenKopf();
    r.positionen.forEach(function (p) {
      var zeilen = [];
      p.zeilen.forEach(function (z) { zeilen = zeilen.concat(umbrechen(z, normal, 9.5, SP.bezBreite)); });
      var hoehe = zeilen.length * 4.3 + 2.2;
      if (y + hoehe > FUSS_OBEN - 12) { folgeseite(); tabellenKopf(); }
      schreibe(seite, String(p.nr), SP.pos, y, 9.5);
      zeilen.forEach(function (t, i) { schreibe(seite, t, SP.bez, y + i * 4.3, 9.5); });
      schreibe(seite, deutsch(kuerzen(alsText(p.menge, 4), 0)), SP.menge, y, 9.5, normal, SCHWARZ, "rechts");
      schreibe(seite, einheitText(p.einheit), SP.einheit, y, 9.5);
      schreibe(seite, deutsch(kuerzen(alsText(p.preis, 4), 2)) + " €", SP.preis, y, 9.5, normal, SCHWARZ, "rechts");
      if (mitSteuer) schreibe(seite, p.satz + " %", SP.satz, y, 9.5, normal, SCHWARZ, "rechts");
      schreibe(seite, euro(p.netto), SP.netto, y, 9.5, normal, SCHWARZ, "rechts");
      y += hoehe;
      linie(seite, LINKS, RECHTS, y - 3.2, 0.3);
      y += 1.2;
    });

    // Summen
    var summen = [];
    if (mitSteuer) {
      summen.push(["Summe netto", euro(r.summeNetto), false]);
      r.steuer.forEach(function (s) { summen.push(["zzgl. " + s.satz + " % USt. auf " + euro(s.basis), euro(s.betrag), false]); });
    }
    summen.push(["Rechnungsbetrag", euro(r.brutto), true]);
    var block = summen.length * 5.6 + 8;
    if (y + block > FUSS_OBEN - 10) folgeseite();
    y += 3;
    summen.forEach(function (s) {
      if (s[2]) { linie(seite, mm(110), RECHTS, y - 4, 0.6, SCHWARZ); y += 1.2; }
      schreibe(seite, s[0], mm(110), y, s[2] ? 10.5 : 9.5, s[2] ? fett : normal);
      schreibe(seite, s[1], RECHTS, y, s[2] ? 10.5 : 9.5, s[2] ? fett : normal, SCHWARZ, "rechts");
      y += 5.6;
    });
    linie(seite, mm(110), RECHTS, y - 4, 0.6, SCHWARZ);
    linie(seite, mm(110), RECHTS, y - 3.4, 0.6, SCHWARZ);
    y += 6;

    // Hinweise unter der Tabelle
    var absaetze = [];
    if (r.kleinunternehmer) absaetze.push(KLEINUNTERNEHMER_GRUND + ".");
    var zahlung = r.zahltext;
    if (v.iban && r.brutto > NULL) zahlung += " Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer " + r.nummer + " auf das unten genannte Konto.";
    absaetze.push(zahlung);
    absaetze.forEach(function (a) {
      var zeilen = umbrechen(a, normal, 10, RECHTS - LINKS);
      if (y + zeilen.length * 4.6 > FUSS_OBEN - 6) folgeseite();
      zeilen.forEach(function (t) { schreibe(seite, t, LINKS, y, 10); y += 4.6; });
      y += 2.5;
    });

    // Seitenzahlen
    if (seiten.length > 1) {
      seiten.forEach(function (s, i) {
        var t = "Seite " + (i + 1) + " von " + seiten.length;
        s.drawText(t, { x: RECHTS - normal.widthOfTextAtSize(t, 8), y: H - mm(FUSS_OBEN - 2.5), size: 8, font: normal, color: GRAU });
      });
    }

    // Metadaten (Info und XMP müssen übereinstimmen)
    var titel = "Rechnung " + r.nummer;
    doc.setTitle(titel, { showInWindowTitleBar: true });
    doc.setAuthor(r.verkaeufer.name);
    doc.setSubject("E-Rechnung nach EN 16931 (ZUGFeRD / Factur-X, Profil EN 16931)");
    doc.setCreator(PRODUZENT);
    doc.setProducer(PRODUZENT);
    doc.setCreationDate(jetzt);
    doc.setModificationDate(jetzt);
    doc.setLanguage("de-DE");

    var ctx = doc.context, katalog = doc.catalog;
    var meta = ctx.stream(utf8(xmp(r, isoZeit)), { Type: "Metadata", Subtype: "XML" });
    katalog.set(L.PDFName.of("Metadata"), ctx.register(meta));

    var icc = ctx.flateStream(new Uint8Array(m.icc), { N: 3 });
    var absicht = ctx.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: L.PDFString.of("sRGB IEC61966-2.1"),
      Info: L.PDFString.of("sRGB IEC61966-2.1"),
      DestOutputProfile: ctx.register(icc)
    });
    katalog.set(L.PDFName.of("OutputIntents"), ctx.obj([ctx.register(absicht)]));

    await doc.attach(utf8(xmlText), "factur-x.xml", {
      mimeType: "text/xml",
      description: "Factur-X/ZUGFeRD Rechnungsdaten",
      creationDate: jetzt,
      modificationDate: jetzt,
      afRelationship: L.AFRelationship.Alternative
    });

    var id = zufallsHex(16);
    ctx.trailerInfo.ID = ctx.obj([L.PDFHexString.of(id), L.PDFHexString.of(id)]);

    return doc.save({ useObjectStreams: false });
  }

  /* ---------- ZIP (ohne Kompression) für PDF und XML zusammen ---------- */

  var CRC_TABELLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t.push(c >>> 0);
    }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC_TABELLE[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // dateien: [{ name, bytes (Uint8Array) }], Ergebnis: Uint8Array
  function zip(dateien, jetzt) {
    var d = jetzt || new Date();
    var zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var tag = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var lokal = [], zentral = [], versatz = 0;
    dateien.forEach(function (f) {
      var name = utf8(f.name), daten = f.bytes, crc = crc32(daten);
      var k = new DataView(new ArrayBuffer(30));
      k.setUint32(0, 0x04034b50, true); k.setUint16(4, 20, true); k.setUint16(6, 0x0800, true);
      k.setUint16(8, 0, true); k.setUint16(10, zeit, true); k.setUint16(12, tag, true);
      k.setUint32(14, crc, true); k.setUint32(18, daten.length, true); k.setUint32(22, daten.length, true);
      k.setUint16(26, name.length, true); k.setUint16(28, 0, true);
      lokal.push(new Uint8Array(k.buffer), name, daten);
      var z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true);
      z.setUint16(10, 0, true); z.setUint16(12, zeit, true); z.setUint16(14, tag, true);
      z.setUint32(16, crc, true); z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true);
      z.setUint16(28, name.length, true); z.setUint32(42, versatz, true);
      zentral.push(new Uint8Array(z.buffer), name);
      versatz += 30 + name.length + daten.length;
    });
    var groesse = zentral.reduce(function (s, t) { return s + t.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, dateien.length, true); e.setUint16(10, dateien.length, true);
    e.setUint32(12, groesse, true); e.setUint32(16, versatz, true);
    var teile = lokal.concat(zentral, [new Uint8Array(e.buffer)]);
    var aus = new Uint8Array(versatz + groesse + 22), pos = 0;
    teile.forEach(function (t) { aus.set(t, pos); pos += t.length; });
    return aus;
  }

  function dateiname(r) {
    return "Rechnung_" + r.nummer.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "Rechnung";
  }

  return {
    EINHEITEN: EINHEITEN,
    dezimal: dezimal,
    berechne: berechne,
    summen: summen,
    erstelleXml: erstelleXml,
    erstellePdf: erstellePdf,
    euro: euro,
    datumDe: datumDe,
    plusTage: plusTage,
    ibanGueltig: ibanGueltig,
    zip: zip,
    utf8: utf8,
    dateiname: dateiname
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ERechnung;
