/* Ru-Services · E-Rechnung lesen
   Liest ZUGFeRD / Factur-X (eingebettete XML in der PDF) und XRechnung (CII oder UBL)
   vollständig im Browser. Es wird nichts hochgeladen oder gespeichert.
   PDF-Anhänge werden mit pdf.js (Mozilla, Apache-2.0, lokal unter /vendor/pdfjs) gelesen. */
(function () {
  "use strict";

  var MAX_BYTES = 30 * 1024 * 1024;
  var NS = {
    rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
    cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  };
  var XML_NAMES = ["factur-x.xml", "zugferd-invoice.xml", "xrechnung.xml", "zugferd_invoice.xml"];

  var TYP = {
    "380": "Rechnung",
    "381": "Gutschrift / Rechnungskorrektur",
    "384": "Korrigierte Rechnung",
    "389": "Gutschrift (Selbstfakturierung)",
    "326": "Teilrechnung",
    "386": "Vorauszahlungsrechnung",
    "875": "Teilschlussrechnung",
    "876": "Schlussrechnung",
    "877": "Abschlagsrechnung"
  };

  var $ = function (id) { return document.getElementById(id); };
  var drop = $("dropzone");
  var input = $("fileInput");
  var msg = $("toolMsg");
  var result = $("result");
  var lastXml = "";
  var lastName = "e-rechnung.xml";

  // ---------- Ereignisse ----------
  input.addEventListener("change", function () {
    if (input.files && input.files[0]) handle(input.files[0]);
    input.value = "";
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); });
  });
  drop.addEventListener("drop", function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handle(f);
  });
  $("saveXml").addEventListener("click", function () {
    if (!lastXml) return;
    var blob = new Blob([lastXml], { type: "application/xml" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = lastName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  // ---------- Ablauf ----------
  function setMsg(text, kind) {
    msg.textContent = "";
    if (!text) return;
    var box = document.createElement("div");
    box.className = "profile " + (kind || "warn");
    box.textContent = text;
    msg.appendChild(box);
  }

  function handle(file) {
    result.hidden = true;
    lastXml = "";
    if (file.size > MAX_BYTES) {
      setMsg("Die Datei ist größer als 30 MB und wird nicht gelesen.", "bad");
      return;
    }
    setMsg("Datei wird gelesen …", "ok");
    file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      if (isPdf(bytes)) {
        return xmlFromPdf(bytes).then(function (found) {
          lastName = found.name;
          return found.text;
        });
      }
      lastName = file.name.replace(/\.[^.]+$/, "") + ".xml";
      return decode(bytes);
    }).then(function (xmlText) {
      lastXml = xmlText;
      show(parse(xmlText));
      setMsg("");
      result.hidden = false;
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (err) {
      setMsg(err && err.userMessage ? err.userMessage : "Die Datei konnte nicht gelesen werden. Ist es eine PDF mit eingebetteter E-Rechnung oder eine XML-Datei?", "bad");
      if (!(err && err.userMessage) && window.console) console.warn(err);
    });
  }

  function fail(text) { var e = new Error(text); e.userMessage = text; return e; }

  function isPdf(b) {
    // "%PDF" kann nach einigen Bytes Vorspann stehen
    var head = String.fromCharCode.apply(null, b.subarray(0, Math.min(b.length, 1024)));
    return head.indexOf("%PDF-") !== -1;
  }

  function decode(bytes) {
    // Zeichensatz aus der XML-Deklaration übernehmen, Standard UTF-8
    var head = String.fromCharCode.apply(null, bytes.subarray(0, Math.min(bytes.length, 200)));
    var m = head.match(/encoding=["']([A-Za-z0-9._-]+)["']/);
    var dec;
    try { dec = new TextDecoder(m ? m[1] : "utf-8"); } catch (e) { dec = new TextDecoder("utf-8"); }
    var text = dec.decode(bytes);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.trim().charAt(0) !== "<") throw fail("Das ist weder eine PDF noch eine XML-Datei.");
    return text;
  }

  function xmlFromPdf(bytes) {
    return import("/vendor/pdfjs/pdf.min.js").then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js";
      return pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        stopAtErrors: false
      }).promise;
    }).then(function (pdf) {
      return pdf.getAttachments().then(function (att) {
        var list = att ? Object.keys(att).map(function (k) { return att[k]; }) : [];
        var xmls = list.filter(function (a) { return /\.xml$/i.test(a.filename || ""); });
        if (!xmls.length) {
          throw fail("Diese PDF enthält keine eingebettete XML-Datei. Es ist wahrscheinlich eine normale PDF-Rechnung und keine E-Rechnung.");
        }
        var pick = null;
        XML_NAMES.some(function (n) {
          pick = xmls.filter(function (a) { return a.filename.toLowerCase() === n; })[0] || null;
          return !!pick;
        });
        pick = pick || xmls[0];
        var found = { name: pick.filename, text: decode(pick.content) };
        pdf.destroy();
        return found;
      }, function (err) { pdf.destroy(); throw err; });
    }, function (err) {
      if (err && err.userMessage) throw err;
      if (err && err.name === "PasswordException") throw fail("Die PDF ist mit einem Passwort geschützt und kann nicht gelesen werden.");
      throw fail("Die PDF konnte nicht geöffnet werden. Ist die Datei beschädigt?");
    });
  }

  // ---------- XML auswerten ----------
  function parse(text) {
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw fail("Die XML-Datei ist fehlerhaft und kann nicht gelesen werden.");
    var root = doc.documentElement;
    var name = root.localName;
    var ns = root.namespaceURI || "";

    function nodes(ctx, path) {
      var r = doc.evaluate(path, ctx, function (p) { return NS[p] || null; }, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      var out = [];
      for (var i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i));
      return out;
    }
    function t(ctx, path) {
      var n = nodes(ctx, path)[0];
      return n ? (n.textContent || "").trim() : "";
    }
    function all(ctx, path) {
      return nodes(ctx, path).map(function (n) { return (n.textContent || "").trim(); }).filter(Boolean);
    }

    if (name === "CrossIndustryInvoice" && ns === NS.rsm) return cii(root, t, nodes, all);
    if ((name === "Invoice" || name === "CreditNote") && ns.indexOf("urn:oasis:names:specification:ubl:schema:xsd:") === 0) return ubl(root, t, nodes, all, name);
    if (name === "CrossIndustryDocument") {
      throw fail("Das ist eine Rechnung im alten Format ZUGFeRD 1.0. Dieses Format gilt nicht als E-Rechnung im Sinne des Umsatzsteuergesetzes und wird hier nicht angezeigt.");
    }
    throw fail("Unbekanntes Format (Wurzel-Element „" + name + "“). Unterstützt werden ZUGFeRD / Factur-X und XRechnung (CII und UBL).");
  }

  function cii(root, t, nodes, all) {
    function party(p) {
      return {
        name: t(root, p + "/ram:Name"),
        street: [t(root, p + "/ram:PostalTradeAddress/ram:LineOne"), t(root, p + "/ram:PostalTradeAddress/ram:LineTwo")].filter(Boolean).join(", "),
        zip: t(root, p + "/ram:PostalTradeAddress/ram:PostcodeCode"),
        city: t(root, p + "/ram:PostalTradeAddress/ram:CityName"),
        country: t(root, p + "/ram:PostalTradeAddress/ram:CountryID"),
        vat: t(root, p + "/ram:SpecifiedTaxRegistration/ram:ID[@schemeID='VA']"),
        taxNo: t(root, p + "/ram:SpecifiedTaxRegistration/ram:ID[@schemeID='FC']"),
        email: t(root, p + "/ram:URIUniversalCommunication/ram:URIID") || t(root, p + "/ram:DefinedTradeContact/ram:EmailURIUniversalCommunication/ram:URIID")
      };
    }
    var cur = t(root, "//ram:InvoiceCurrencyCode") || "EUR";
    function amount(path) {
      // Bei mehreren Beträgen (z. B. Steuer in zwei Währungen) den in Rechnungswährung nehmen
      var list = nodes(root, path);
      var hit = list.filter(function (n) { var c = n.getAttribute("currencyID"); return !c || c === cur; })[0] || list[0];
      return hit ? hit.textContent.trim() : "";
    }
    var lines = nodes(root, "//ram:IncludedSupplyChainTradeLineItem").map(function (l) {
      var q = nodes(l, "ram:SpecifiedLineTradeDelivery/ram:BilledQuantity")[0];
      return {
        nr: t(l, "ram:AssociatedDocumentLineDocument/ram:LineID"),
        name: t(l, "ram:SpecifiedTradeProduct/ram:Name"),
        qty: q ? q.textContent.trim() : "",
        unit: q ? (q.getAttribute("unitCode") || "") : "",
        price: t(l, "ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount"),
        rate: t(l, "ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:RateApplicablePercent"),
        net: t(l, "ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount")
      };
    });
    var sum = "//ram:SpecifiedTradeSettlementHeaderMonetarySummation/";
    return {
      syntax: "CII (UN/CEFACT Cross Industry Invoice)",
      guideline: t(root, "//rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID"),
      number: t(root, "//rsm:ExchangedDocument/ram:ID"),
      type: t(root, "//rsm:ExchangedDocument/ram:TypeCode"),
      date: fmtDate(t(root, "//rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString")),
      delivery: fmtDate(t(root, "//ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/udt:DateTimeString")),
      period: range(t(root, "//ram:ApplicableHeaderTradeSettlement/ram:BillingSpecifiedPeriod/ram:StartDateTime/udt:DateTimeString"),
                    t(root, "//ram:ApplicableHeaderTradeSettlement/ram:BillingSpecifiedPeriod/ram:EndDateTime/udt:DateTimeString")),
      due: fmtDate(t(root, "//ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/udt:DateTimeString")),
      currency: cur,
      buyerRef: t(root, "//ram:ApplicableHeaderTradeAgreement/ram:BuyerReference"),
      order: t(root, "//ram:BuyerOrderReferencedDocument/ram:IssuerAssignedID"),
      notes: all(root, "//rsm:ExchangedDocument/ram:IncludedNote/ram:Content"),
      seller: party("//ram:SellerTradeParty"),
      buyer: party("//ram:BuyerTradeParty"),
      pay: {
        iban: t(root, "//ram:PayeePartyCreditorFinancialAccount/ram:IBANID") || t(root, "//ram:PayeePartyCreditorFinancialAccount/ram:ProprietaryID"),
        bic: t(root, "//ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID"),
        ref: t(root, "//ram:ApplicableHeaderTradeSettlement/ram:PaymentReference"),
        terms: all(root, "//ram:SpecifiedTradePaymentTerms/ram:Description").join(" ")
      },
      lines: lines,
      totals: {
        net: amount(sum + "ram:LineTotalAmount"),
        taxBasis: amount(sum + "ram:TaxBasisTotalAmount"),
        tax: amount(sum + "ram:TaxTotalAmount"),
        gross: amount(sum + "ram:GrandTotalAmount"),
        prepaid: amount(sum + "ram:TotalPrepaidAmount"),
        payable: amount(sum + "ram:DuePayableAmount")
      }
    };
  }

  function ubl(root, t, nodes, all, rootName) {
    var credit = rootName === "CreditNote";
    function party(p) {
      return {
        name: t(root, p + "/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName") || t(root, p + "/cac:Party/cac:PartyName/cbc:Name"),
        street: [t(root, p + "/cac:Party/cac:PostalAddress/cbc:StreetName"), t(root, p + "/cac:Party/cac:PostalAddress/cbc:AdditionalStreetName")].filter(Boolean).join(", "),
        zip: t(root, p + "/cac:Party/cac:PostalAddress/cbc:PostalZone"),
        city: t(root, p + "/cac:Party/cac:PostalAddress/cbc:CityName"),
        country: t(root, p + "/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode"),
        vat: t(root, p + "/cac:Party/cac:PartyTaxScheme[cac:TaxScheme/cbc:ID='VAT']/cbc:CompanyID") || t(root, p + "/cac:Party/cac:PartyTaxScheme/cbc:CompanyID"),
        taxNo: t(root, p + "/cac:Party/cac:PartyTaxScheme[cac:TaxScheme/cbc:ID!='VAT']/cbc:CompanyID"),
        email: t(root, p + "/cac:Party/cac:Contact/cbc:ElectronicMail") || t(root, p + "/cac:Party/cbc:EndpointID[@schemeID='EM']")
      };
    }
    var lineTag = credit ? "cac:CreditNoteLine" : "cac:InvoiceLine";
    var qtyTag = credit ? "cbc:CreditedQuantity" : "cbc:InvoicedQuantity";
    var lines = nodes(root, "/*/" + lineTag).map(function (l) {
      var q = nodes(l, qtyTag)[0];
      return {
        nr: t(l, "cbc:ID"),
        name: t(l, "cac:Item/cbc:Name"),
        qty: q ? q.textContent.trim() : "",
        unit: q ? (q.getAttribute("unitCode") || "") : "",
        price: t(l, "cac:Price/cbc:PriceAmount"),
        rate: t(l, "cac:Item/cac:ClassifiedTaxCategory/cbc:Percent"),
        net: t(l, "cbc:LineExtensionAmount")
      };
    });
    var cur = t(root, "/*/cbc:DocumentCurrencyCode") || "EUR";
    var taxNodes = nodes(root, "/*/cac:TaxTotal/cbc:TaxAmount");
    var tax = taxNodes.filter(function (n) { return n.getAttribute("currencyID") === cur; })[0] || taxNodes[0];
    return {
      syntax: "UBL 2.1 (" + (credit ? "CreditNote" : "Invoice") + ")",
      guideline: t(root, "/*/cbc:CustomizationID"),
      number: t(root, "/*/cbc:ID"),
      type: t(root, credit ? "/*/cbc:CreditNoteTypeCode" : "/*/cbc:InvoiceTypeCode"),
      date: fmtDate(t(root, "/*/cbc:IssueDate")),
      delivery: fmtDate(t(root, "/*/cac:Delivery/cbc:ActualDeliveryDate")),
      period: range(t(root, "/*/cac:InvoicePeriod/cbc:StartDate"), t(root, "/*/cac:InvoicePeriod/cbc:EndDate")),
      due: fmtDate(t(root, "/*/cbc:DueDate") || t(root, "/*/cac:PaymentMeans/cbc:PaymentDueDate")),
      currency: cur,
      buyerRef: t(root, "/*/cbc:BuyerReference"),
      order: t(root, "/*/cac:OrderReference/cbc:ID"),
      notes: all(root, "/*/cbc:Note"),
      seller: party("/*/cac:AccountingSupplierParty"),
      buyer: party("/*/cac:AccountingCustomerParty"),
      pay: {
        iban: t(root, "/*/cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID"),
        bic: t(root, "/*/cac:PaymentMeans/cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID"),
        ref: t(root, "/*/cac:PaymentMeans/cbc:PaymentID"),
        terms: all(root, "/*/cac:PaymentTerms/cbc:Note").join(" ")
      },
      lines: lines,
      totals: {
        net: t(root, "/*/cac:LegalMonetaryTotal/cbc:LineExtensionAmount"),
        taxBasis: t(root, "/*/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount"),
        tax: tax ? tax.textContent.trim() : "",
        gross: t(root, "/*/cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"),
        prepaid: t(root, "/*/cac:LegalMonetaryTotal/cbc:PrepaidAmount"),
        payable: t(root, "/*/cac:LegalMonetaryTotal/cbc:PayableAmount")
      }
    };
  }

  // ---------- Profil erkennen ----------
  function profile(id) {
    var s = (id || "").toLowerCase();
    if (!s) return { label: "nicht angegeben", kind: "warn", text: "Die Datei enthält keine Profilkennung. Ob es sich um eine zulässige E-Rechnung handelt, lässt sich so nicht erkennen." };
    if (s.indexOf("minimum") !== -1) return { label: "ZUGFeRD MINIMUM", kind: "bad", text: "Dieses Profil enthält nicht alle Pflichtangaben und gilt laut Bundesfinanzministerium nicht als E-Rechnung. Es ist eine sonstige Rechnung." };
    if (s.indexOf("basicwl") !== -1) return { label: "ZUGFeRD BASIC WL", kind: "bad", text: "Dieses Profil enthält keine Rechnungspositionen und gilt laut Bundesfinanzministerium nicht als E-Rechnung. Es ist eine sonstige Rechnung." };
    var ok = "Dieses Format gilt nach Auffassung des Bundesfinanzministeriums grundsätzlich als zulässige E-Rechnung. Ob die Rechnung inhaltlich vollständig und richtig ist, prüft dieses Werkzeug nicht.";
    var x = s.match(/xrechnung_(\d+(?:\.\d+)*)/);
    if (x) return { label: "XRechnung " + x[1], kind: "ok", text: ok };
    if (s.indexOf("xrechnung") !== -1) return { label: "XRechnung", kind: "ok", text: ok };
    if (s.indexOf("extended") !== -1) return { label: "ZUGFeRD EXTENDED", kind: "ok", text: ok };
    if (/:basic(\b|$)/.test(s)) return { label: "ZUGFeRD BASIC", kind: "ok", text: ok };
    if (s.indexOf("peppol") !== -1) return { label: "Peppol BIS Billing 3.0", kind: "ok", text: ok };
    if (s.indexOf("urn:cen.eu:en16931:2017") === 0) return { label: "EN 16931 (ZUGFeRD-Profil EN 16931, früher COMFORT)", kind: "ok", text: ok };
    return { label: "unbekannt", kind: "warn", text: "Die Profilkennung ist unbekannt. Ob es sich um eine zulässige E-Rechnung handelt, lässt sich hier nicht sagen." };
  }

  // ---------- Formatierung ----------
  // Häufige Einheiten-Codes (UN/ECE Rec. 20/21) lesbar machen, sonst Code anzeigen
  var UNITS = {
    C62: "Stk.", H87: "Stk.", EA: "Stk.", XPP: "Stk.", HUR: "Std.", MIN: "Min.", DAY: "Tag(e)",
    WEE: "Woche(n)", MON: "Monat(e)", ANN: "Jahr(e)", KGM: "kg", GRM: "g", TNE: "t", MTR: "m",
    KMT: "km", MTK: "m²", MTQ: "m³", LTR: "l", SET: "Set", LS: "pauschal", KWH: "kWh", P1: "%"
  };
  function unit(code) { return UNITS[code] || code; }
  function fmtDate(s) {
    s = (s || "").trim();
    if (/^\d{8}$/.test(s)) return s.slice(6, 8) + "." + s.slice(4, 6) + "." + s.slice(0, 4);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4);
    return s;
  }
  function range(a, b) {
    a = fmtDate(a); b = fmtDate(b);
    if (a && b) return a + " bis " + b;
    return a || b || "";
  }
  function money(v, cur) {
    if (v === "" || v == null) return "";
    var n = Number(v);
    if (!isFinite(n)) return v;
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(n); }
    catch (e) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " " + (cur || ""); }
  }
  function num(v) {
    var n = Number(v);
    return v !== "" && isFinite(n) ? n.toLocaleString("de-DE", { maximumFractionDigits: 4 }) : (v || "");
  }

  // ---------- Anzeige (nur textContent, keine HTML-Einfügung) ----------
  function kv(el, rows) {
    el.textContent = "";
    rows.forEach(function (r) {
      if (!r[1]) return;
      var dt = document.createElement("dt"); dt.textContent = r[0];
      var dd = document.createElement("dd"); dd.textContent = r[1];
      if (r[2]) dd.className = r[2];
      el.appendChild(dt); el.appendChild(dd);
    });
    if (!el.children.length) {
      var d = document.createElement("dd"); d.textContent = "keine Angaben"; d.style.color = "var(--ink-faint)";
      el.appendChild(d);
    }
  }
  function partyRows(p) {
    return [
      ["Name", p.name],
      ["Anschrift", [p.street, [p.zip, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ")],
      ["USt-IdNr.", p.vat],
      ["Steuernummer", p.taxNo],
      ["E-Mail", p.email]
    ];
  }

  function show(d) {
    var pr = profile(d.guideline);
    $("resTitle").textContent = (TYP[d.type] || "Rechnung") + (d.number ? " " + d.number : "");

    var box = $("resProfile");
    box.textContent = "";
    var div = document.createElement("div");
    div.className = "profile " + pr.kind;
    var b = document.createElement("b"); b.textContent = "Profil: " + pr.label;
    var p1 = document.createElement("p"); p1.textContent = pr.text;
    var p2 = document.createElement("p"); p2.textContent = "Syntax: " + d.syntax + (d.guideline ? " · Kennung: " + d.guideline : "");
    div.appendChild(b); div.appendChild(p1); div.appendChild(p2);
    box.appendChild(div);

    kv($("resMeta"), [
      ["Nummer", d.number],
      ["Art", d.type ? d.type + (TYP[d.type] ? " (" + TYP[d.type] + ")" : "") : ""],
      ["Datum", d.date],
      ["Leistungsdatum", d.delivery],
      ["Leistungszeitraum", d.period],
      ["Fällig am", d.due],
      ["Währung", d.currency],
      ["Käuferreferenz / Leitweg-ID", d.buyerRef],
      ["Bestellnummer", d.order]
    ]);
    kv($("resPay"), [
      ["IBAN", d.pay.iban],
      ["BIC", d.pay.bic],
      ["Verwendungszweck", d.pay.ref],
      ["Zahlungsbedingungen", d.pay.terms]
    ]);
    kv($("resSeller"), partyRows(d.seller));
    kv($("resBuyer"), partyRows(d.buyer));

    var tb = $("resLines");
    tb.textContent = "";
    if (!d.lines.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 6; td0.textContent = "Keine Positionen in der XML enthalten.";
      tr0.appendChild(td0); tb.appendChild(tr0);
    }
    d.lines.forEach(function (l) {
      var tr = document.createElement("tr");
      [
        [l.nr, ""],
        [l.name, ""],
        [num(l.qty) + (l.unit ? " " + unit(l.unit) : ""), "num"],
        [money(l.price, d.currency), "num"],
        [l.rate !== "" ? num(l.rate) + " %" : "", "num"],
        [money(l.net, d.currency), "num"]
      ].forEach(function (c) {
        var td = document.createElement("td");
        td.textContent = c[0];
        if (c[1]) td.className = c[1];
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });

    kv($("resTotals"), [
      ["Summe Positionen (netto)", money(d.totals.net, d.currency)],
      ["Steuerbasis", d.totals.taxBasis !== d.totals.net ? money(d.totals.taxBasis, d.currency) : ""],
      ["Umsatzsteuer", money(d.totals.tax, d.currency)],
      ["Gesamtbetrag (brutto)", money(d.totals.gross, d.currency)],
      ["Bereits bezahlt", money(d.totals.prepaid, d.currency)],
      ["Zahlbetrag", money(d.totals.payable, d.currency), "grand"]
    ]);

    var notes = $("resNotes");
    notes.textContent = "";
    if (d.notes.length) {
      var n = document.createElement("div");
      n.className = "notice";
      var h = document.createElement("strong"); h.textContent = "Hinweise in der Rechnung";
      n.appendChild(h);
      d.notes.forEach(function (txt) {
        var p = document.createElement("p"); p.textContent = txt; p.style.whiteSpace = "pre-line";
        n.appendChild(p);
      });
      notes.appendChild(n);
    }

    $("resXml").textContent = lastXml;
  }
})();
