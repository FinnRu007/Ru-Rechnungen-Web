/* SEO- und GEO-Check: Bewertung einer Webseite anhand ihres HTML-Quelltexts.
   Reine Auswertung, kein Netzwerk. Wird von pruefer.js aufgerufen und in den
   Tests direkt im Browser benutzt.

   analysiere({ html, url, robots, sitemap, llms }) liefert
   { checks: [...], scores: { seo, geo }, facts: {...} }.
   robots/sitemap/llms: { status: 'ok' | 'fehlt' | 'unbekannt', text } */
(function (global) {
  'use strict';

  // Gewichte: wie stark ein Punkt in die Note eingeht
  var FAKTOR = { gut: 1, mittel: 0.5, schlecht: 0 };

  var SUCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'Bingbot', 'Googlebot'];
  var TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent'];

  var NICHTSSAGEND = ['hier', 'hier klicken', 'klicken sie hier', 'mehr', 'mehr erfahren', 'weiter', 'weiterlesen', 'mehr lesen', 'link', 'click here', 'here', 'read more', 'more', 'details', 'mehr dazu', '>>', '»'];

  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function attr(doc, sel, a) { var el = doc.querySelector(sel); return el ? (el.getAttribute(a) || '').trim() : ''; }
  function kurz(s, n) { s = String(s || ''); n = n || 90; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function zahl(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* ---------- robots.txt ---------- */
  function robotsGruppen(text) {
    var gruppen = [], akt = null, letzteWarAgent = false;
    String(text || '').split(/\r?\n/).forEach(function (zeile) {
      var z = zeile.replace(/#.*$/, '').trim();
      if (!z) return;
      var m = z.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) return;
      var feld = m[1].toLowerCase(), wert = m[2].trim();
      if (feld === 'user-agent') {
        if (!letzteWarAgent || !akt) { akt = { agents: [], regeln: [] }; gruppen.push(akt); }
        akt.agents.push(wert.toLowerCase());
        letzteWarAgent = true;
      } else {
        letzteWarAgent = false;
        if (akt && (feld === 'allow' || feld === 'disallow')) akt.regeln.push({ art: feld, pfad: wert });
      }
    });
    return gruppen;
  }

  // Darf "bot" die Seite "pfad" lesen? Längste passende Regel gewinnt (wie bei Google).
  function robotsErlaubt(gruppen, bot, pfad) {
    bot = bot.toLowerCase();
    var eigene = gruppen.filter(function (g) { return g.agents.indexOf(bot) >= 0; });
    var gruppe = eigene.length ? eigene : gruppen.filter(function (g) { return g.agents.indexOf('*') >= 0; });
    if (!gruppe.length) return true;
    var beste = null;
    gruppe.forEach(function (g) {
      g.regeln.forEach(function (r) {
        if (r.art === 'disallow' && r.pfad === '') return;
        if (passt(r.pfad, pfad)) {
          if (!beste || r.pfad.length > beste.pfad.length || (r.pfad.length === beste.pfad.length && r.art === 'allow')) beste = r;
        }
      });
    });
    return !beste || beste.art === 'allow';
  }
  function passt(muster, pfad) {
    var ende = /\$$/.test(muster);
    var m = muster.replace(/\$$/, '').split('*').map(function (t) { return t.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }).join('.*');
    return new RegExp('^' + m + (ende ? '$' : '')).test(pfad);
  }

  /* ---------- strukturierte Daten ---------- */
  function jsonLd(doc) {
    var objekte = [], fehler = 0;
    doc.querySelectorAll('script[type="application/ld+json" i]').forEach(function (s) {
      try {
        var d = JSON.parse(s.textContent);
        (function sammle(x) {
          if (Array.isArray(x)) { x.forEach(sammle); return; }
          if (x && typeof x === 'object') {
            objekte.push(x);
            if (x['@graph']) sammle(x['@graph']);
            Object.keys(x).forEach(function (k) {
              if (k !== '@graph' && x[k] && typeof x[k] === 'object') sammle(x[k]);
            });
          }
        })(d);
      } catch (e) { fehler++; }
    });
    return { objekte: objekte, fehler: fehler };
  }
  function typen(o) {
    var t = o['@type'];
    return (Array.isArray(t) ? t : (t ? [t] : [])).map(String);
  }

  var ORG_TYPEN = /^(Organization|Corporation|LocalBusiness|ProfessionalService|Store|Restaurant|FoodEstablishment|HomeAndConstructionBusiness|AutomotiveBusiness|HealthAndBeautyBusiness|MedicalBusiness|LegalService|FinancialService|LodgingBusiness|SportsActivityLocation|EntertainmentBusiness|Dentist|Physician|Bakery|CafeOrCoffeeShop|BarOrPub|Hotel|Electrician|Plumber|RoofingContractor|HVACBusiness|GeneralContractor|HousePainter|Locksmith|MovingCompany|AutoRepair|AutoDealer|BeautySalon|HairSalon|NGO|SportsClub|SportsOrganization|EducationalOrganization|Person|OnlineStore|OnlineBusiness|.*Store|.*Business|.*Contractor|.*Shop)$/;

  /* ---------- Hauptfunktion ---------- */
  function analysiere(e) {
    var html = String(e.html || '');
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var url = null;
    try { url = e.url ? new URL(e.url) : null; } catch (x) { url = null; }
    var host = url ? url.hostname.replace(/^www\./, '') : '';
    var checks = [];
    function c(area, id, titel, status, gewicht, befund, tipp) {
      checks.push({ area: area, id: id, titel: titel, status: status, gewicht: gewicht, befund: befund, tipp: tipp || '' });
    }

    // Grunddaten
    var title = txt(doc.querySelector('title'));
    var desc = attr(doc, 'meta[name="description" i]', 'content');
    var h1 = Array.prototype.map.call(doc.querySelectorAll('h1'), txt).filter(Boolean);
    var hAlle = Array.prototype.slice.call(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    var h2 = doc.querySelectorAll('h2').length;
    var lang = (doc.documentElement.getAttribute('lang') || '').trim();
    var viewport = attr(doc, 'meta[name="viewport" i]', 'content');
    var canonical = attr(doc, 'link[rel~="canonical" i]', 'href');
    var robotsMeta = (attr(doc, 'meta[name="robots" i]', 'content') + ',' + attr(doc, 'meta[name="googlebot" i]', 'content')).toLowerCase();
    var charset = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="content-type" i]');
    var favicon = doc.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="apple-touch-icon" i]');
    var bilder = Array.prototype.slice.call(doc.querySelectorAll('img')).filter(function (i) {
      var w = parseInt(i.getAttribute('width'), 10), h = parseInt(i.getAttribute('height'), 10);
      return !((w && w <= 2) || (h && h <= 2)); // Zählpixel ignorieren
    });
    var ohneAlt = bilder.filter(function (i) { return !i.hasAttribute('alt'); });

    // sichtbarer Text ohne Skripte, Stile, Navigation zählt trotzdem mit (wie Crawler)
    var body = doc.body ? doc.body.cloneNode(true) : doc.createElement('body');
    body.querySelectorAll('script,style,noscript,template,svg,iframe').forEach(function (x) { x.remove(); });
    var text = txt(body);
    var woerter = (text.match(/[A-Za-zÄÖÜäöüß0-9][\wÄÖÜäöüß'-]*/g) || []).length;

    // Links
    var links = Array.prototype.slice.call(doc.querySelectorAll('a[href]'));
    var intern = 0, extern = 0, nichtssagend = [];
    links.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
      var ziel = null;
      try { ziel = new URL(href, url || 'https://beispiel.invalid/'); } catch (x) { return; }
      var zielHost = ziel.hostname.replace(/^www\./, '');
      if (!url || zielHost === host || ziel.hostname === 'beispiel.invalid') intern++; else extern++;
      var t = txt(a).toLowerCase().replace(/[.:!→›]+$/, '').trim();
      var label = (a.getAttribute('aria-label') || a.getAttribute('title') || '').trim();
      if (!label && NICHTSSAGEND.indexOf(t) >= 0 && nichtssagend.indexOf(t) < 0) nichtssagend.push(t);
    });

    var ld = jsonLd(doc);
    var alleTypen = [];
    ld.objekte.forEach(function (o) { typen(o).forEach(function (t) { if (alleTypen.indexOf(t) < 0) alleTypen.push(t); }); });
    doc.querySelectorAll('[itemtype]').forEach(function (el) {
      var t = (el.getAttribute('itemtype') || '').split('/').pop();
      if (t && alleTypen.indexOf(t) < 0) alleTypen.push(t);
    });
    var org = ld.objekte.filter(function (o) { return typen(o).some(function (t) { return ORG_TYPEN.test(t); }); });

    /* ================= SEO ================= */

    if (url) {
      if (url.protocol === 'https:') c('seo', 'https', 'Verschlüsselte Verbindung (HTTPS)', 'gut', 3, 'Die Seite wird über HTTPS ausgeliefert.');
      else c('seo', 'https', 'Verschlüsselte Verbindung (HTTPS)', 'schlecht', 3, 'Die Seite läuft ohne Verschlüsselung (http).', 'Richten Sie ein SSL-Zertifikat ein und leiten Sie alle Aufrufe auf https um. Browser warnen sonst vor Ihrer Seite, und Google bevorzugt sichere Seiten.');
    }

    if (e.status && e.status >= 400) {
      c('seo', 'status', 'Erreichbarkeit', 'schlecht', 5, 'Der Server meldet den Fehlercode ' + e.status + '.', 'Prüfen Sie, ob die Adresse stimmt. Eine Seite mit Fehlercode wird von Suchmaschinen nicht aufgenommen.');
    }

    if (/noindex/.test(robotsMeta)) {
      c('seo', 'noindex', 'Für Suchmaschinen freigegeben', 'schlecht', 5, 'Die Seite enthält die Anweisung „noindex“. Suchmaschinen nehmen sie dann nicht in ihre Ergebnisse auf.', 'Entfernen Sie „noindex“ aus dem Meta-Tag „robots“, wenn die Seite gefunden werden soll.');
    } else {
      c('seo', 'noindex', 'Für Suchmaschinen freigegeben', 'gut', 2, 'Die Seite sperrt sich nicht selbst für Suchmaschinen (kein „noindex“).');
    }

    if (!title) c('seo', 'title', 'Seitentitel', 'schlecht', 3, 'Die Seite hat keinen Titel (title).', 'Geben Sie jeder Seite einen eigenen Titel mit Ihrem wichtigsten Begriff und Ort, zum Beispiel „Tischlerei in Gütersloh | Müller“. Der Titel erscheint als Überschrift in den Suchergebnissen.');
    else if (title.length < 15) c('seo', 'title', 'Seitentitel', 'mittel', 3, 'Der Titel ist sehr kurz (' + title.length + ' Zeichen): „' + kurz(title) + '“', 'Ein guter Titel hat etwa 30 bis 60 Zeichen und nennt Leistung und Ort.');
    else if (title.length > 65) c('seo', 'title', 'Seitentitel', 'mittel', 3, 'Der Titel ist lang (' + title.length + ' Zeichen) und wird in den Suchergebnissen abgeschnitten: „' + kurz(title) + '“', 'Kürzen Sie den Titel auf etwa 60 Zeichen. Das Wichtigste gehört an den Anfang.');
    else c('seo', 'title', 'Seitentitel', 'gut', 3, 'Titel mit ' + title.length + ' Zeichen: „' + kurz(title) + '“');

    if (!desc) c('seo', 'desc', 'Beschreibung für Suchergebnisse', 'schlecht', 3, 'Es fehlt die Meta-Beschreibung (meta description).', 'Schreiben Sie zwei Sätze, die Ihr Angebot zusammenfassen (etwa 120 bis 160 Zeichen). Google zeigt diesen Text oft unter dem Titel an, KI-Assistenten nutzen ihn als Zusammenfassung.');
    else if (desc.length < 50) c('seo', 'desc', 'Beschreibung für Suchergebnisse', 'mittel', 3, 'Die Beschreibung ist kurz (' + desc.length + ' Zeichen): „' + kurz(desc, 120) + '“', 'Erweitern Sie die Beschreibung auf etwa 120 bis 160 Zeichen.');
    else if (desc.length > 170) c('seo', 'desc', 'Beschreibung für Suchergebnisse', 'mittel', 3, 'Die Beschreibung ist lang (' + desc.length + ' Zeichen) und wird abgeschnitten.', 'Kürzen Sie auf etwa 160 Zeichen.');
    else c('seo', 'desc', 'Beschreibung für Suchergebnisse', 'gut', 3, 'Beschreibung mit ' + desc.length + ' Zeichen: „' + kurz(desc, 120) + '“');

    if (h1.length === 1) c('seo', 'h1', 'Hauptüberschrift (H1)', 'gut', 3, 'Genau eine Hauptüberschrift: „' + kurz(h1[0]) + '“');
    else if (h1.length === 0) c('seo', 'h1', 'Hauptüberschrift (H1)', 'schlecht', 3, 'Die Seite hat keine Hauptüberschrift (H1).', 'Setzen Sie genau eine H1, die sagt, worum es auf der Seite geht. Sie ist für Suchmaschinen das wichtigste Thema der Seite.');
    else c('seo', 'h1', 'Hauptüberschrift (H1)', 'mittel', 3, 'Die Seite hat ' + h1.length + ' Hauptüberschriften (H1).', 'Verwenden Sie nur eine H1 pro Seite und für Unterpunkte H2 und H3.');

    var sprung = null, vorher = 0;
    hAlle.forEach(function (h) { var n = +h.tagName.charAt(1); if (vorher && n > vorher + 1 && !sprung) sprung = 'H' + vorher + ' auf H' + n; vorher = n; });
    if (!hAlle.length) c('seo', 'gliederung', 'Gliederung mit Zwischenüberschriften', 'schlecht', 2, 'Die Seite hat keine Überschriften.', 'Gliedern Sie den Text mit Überschriften (H1, darunter H2, H3).');
    else if (h2 === 0) c('seo', 'gliederung', 'Gliederung mit Zwischenüberschriften', 'mittel', 2, 'Es gibt keine Zwischenüberschriften (H2).', 'Teilen Sie längere Inhalte mit H2-Überschriften in Abschnitte auf.');
    else if (sprung) c('seo', 'gliederung', 'Gliederung mit Zwischenüberschriften', 'mittel', 2, h2 + ' Zwischenüberschriften, aber eine Ebene wird übersprungen (' + sprung + ').', 'Halten Sie die Reihenfolge ein: unter H2 folgt H3, nicht direkt H4.');
    else c('seo', 'gliederung', 'Gliederung mit Zwischenüberschriften', 'gut', 2, h2 + ' Zwischenüberschriften (H2) in sauberer Reihenfolge.');

    if (woerter >= 300) c('seo', 'text', 'Textumfang', 'gut', 2, 'Rund ' + zahl(woerter) + ' Wörter lesbarer Text.');
    else if (woerter >= 120) c('seo', 'text', 'Textumfang', 'mittel', 2, 'Nur rund ' + zahl(woerter) + ' Wörter lesbarer Text.', 'Beschreiben Sie Ihre Leistungen ausführlicher. Suchmaschinen und KI-Assistenten brauchen Text, um zu verstehen, was Sie anbieten. Bilder allein reichen nicht.');
    else c('seo', 'text', 'Textumfang', 'schlecht', 2, 'Kaum lesbarer Text im Quelltext (rund ' + zahl(woerter) + ' Wörter).', 'Ergänzen Sie aussagekräftigen Text zu Ihrem Angebot, Ihrem Ort und Ihren Kontaktdaten.');

    if (viewport && /width\s*=\s*device-width/i.test(viewport)) c('seo', 'viewport', 'Für Smartphones eingerichtet', 'gut', 3, 'Die Seite passt sich der Bildschirmbreite an (viewport).');
    else c('seo', 'viewport', 'Für Smartphones eingerichtet', 'schlecht', 3, 'Es fehlt die Angabe für Mobilgeräte (meta viewport mit width=device-width).', 'Google bewertet die Handy-Ansicht zuerst. Fügen Sie <meta name="viewport" content="width=device-width, initial-scale=1"> ein und prüfen Sie die Darstellung auf dem Smartphone.');

    if (lang) c('seo', 'lang', 'Sprache angegeben', 'gut', 1, 'Sprache der Seite: „' + lang + '“.');
    else c('seo', 'lang', 'Sprache angegeben', 'mittel', 1, 'Die Sprache der Seite ist nicht angegeben.', 'Ergänzen Sie <html lang="de">. Das hilft Suchmaschinen, Vorleseprogrammen und KI-Systemen.');

    if (bilder.length === 0) c('seo', 'alt', 'Bildbeschreibungen (Alt-Texte)', 'info', 0, 'Auf der Seite wurden keine Bilder gefunden.');
    else {
      var anteil = Math.round((bilder.length - ohneAlt.length) / bilder.length * 100);
      if (anteil >= 90) c('seo', 'alt', 'Bildbeschreibungen (Alt-Texte)', 'gut', 2, anteil + ' % der ' + bilder.length + ' Bilder haben einen Alt-Text.');
      else c('seo', 'alt', 'Bildbeschreibungen (Alt-Texte)', anteil >= 60 ? 'mittel' : 'schlecht', 2, ohneAlt.length + ' von ' + bilder.length + ' Bildern fehlt der Alt-Text.', 'Beschreiben Sie jedes Bild kurz im alt-Attribut, zum Beispiel „Neues Badezimmer mit bodengleicher Dusche“. Das hilft der Bildersuche und blinden Besuchern.');
    }

    if (canonical) {
      var canHost = '';
      try { canHost = new URL(canonical, url || undefined).hostname.replace(/^www\./, ''); } catch (x) { canHost = ''; }
      if (url && canHost && canHost !== host) c('seo', 'canonical', 'Eindeutige Adresse (Canonical)', 'mittel', 1, 'Die kanonische Adresse zeigt auf eine andere Domain: ' + kurz(canonical), 'Prüfen Sie, ob das gewollt ist. Sonst ordnet Google die Seite der anderen Domain zu.');
      else c('seo', 'canonical', 'Eindeutige Adresse (Canonical)', 'gut', 1, 'Kanonische Adresse gesetzt: ' + kurz(canonical));
    } else c('seo', 'canonical', 'Eindeutige Adresse (Canonical)', 'mittel', 1, 'Keine kanonische Adresse (link rel="canonical") angegeben.', 'Mit einer kanonischen Adresse vermeiden Sie, dass dieselbe Seite unter mehreren Adressen doppelt gezählt wird (mit und ohne www, mit Parametern).');

    if (intern >= 3) c('seo', 'links', 'Interne Verlinkung', 'gut', 1, intern + ' Links zu anderen Seiten Ihrer Website.');
    else if (intern > 0) c('seo', 'links', 'Interne Verlinkung', 'mittel', 1, 'Nur ' + intern + ' interne Links gefunden.', 'Verlinken Sie Ihre wichtigen Unterseiten (Leistungen, Kontakt, Über uns) von der Startseite aus.');
    else c('seo', 'links', 'Interne Verlinkung', 'schlecht', 1, 'Im Quelltext wurden keine internen Links gefunden.', 'Suchmaschinen finden Unterseiten über Links. Setzen Sie ein Menü aus normalen Links (a href).');

    if (nichtssagend.length) c('seo', 'linktext', 'Aussagekräftige Linktexte', 'mittel', 1, 'Nichtssagende Linktexte gefunden: „' + nichtssagend.slice(0, 4).join('“, „') + '“', 'Schreiben Sie in den Link, wohin er führt, zum Beispiel „Preise für Dachsanierung“ statt „hier“.');
    else if (links.length) c('seo', 'linktext', 'Aussagekräftige Linktexte', 'gut', 1, 'Keine nichtssagenden Linktexte wie „hier klicken“ gefunden.');

    var og = ['og:title', 'og:description', 'og:image'].filter(function (p) { return attr(doc, 'meta[property="' + p + '"]', 'content'); });
    if (og.length === 3) c('seo', 'og', 'Vorschau beim Teilen (Open Graph)', 'gut', 1, 'Titel, Beschreibung und Bild für die Vorschau in WhatsApp, Facebook und Co. sind gesetzt.');
    else c('seo', 'og', 'Vorschau beim Teilen (Open Graph)', 'mittel', 1, og.length ? 'Nur teilweise gesetzt (' + og.join(', ') + ').' : 'Keine Open-Graph-Angaben gefunden.', 'Mit og:title, og:description und og:image sieht ein geteilter Link in WhatsApp oder Facebook ordentlich aus.');

    if (favicon) c('seo', 'favicon', 'Seitensymbol (Favicon)', 'gut', 0.5, 'Ein Favicon ist eingebunden.');
    else c('seo', 'favicon', 'Seitensymbol (Favicon)', 'mittel', 0.5, 'Im Quelltext ist kein Favicon eingebunden.', 'Google zeigt das Favicon neben Ihrem Eintrag in den Suchergebnissen. Binden Sie Ihr Logo als kleines Symbol ein.');

    if (!charset) c('seo', 'charset', 'Zeichensatz', 'mittel', 0.5, 'Der Zeichensatz ist im Quelltext nicht angegeben.', 'Ergänzen Sie <meta charset="UTF-8">, damit Umlaute überall richtig erscheinen.');

    var kb = Math.round(new Blob([html]).size / 1024);
    if (kb > 600) c('seo', 'groesse', 'Größe des Quelltexts', 'mittel', 1, 'Der HTML-Quelltext ist ' + zahl(kb) + ' KB groß.', 'Sehr große Seiten laden langsam, vor allem mobil. Häufige Ursache sind eingebettete Bilder oder Baukasten-Code.');
    else c('seo', 'groesse', 'Größe des Quelltexts', 'gut', 1, 'Der HTML-Quelltext ist ' + zahl(Math.max(kb, 1)) + ' KB groß.');

    var rob = e.robots || { status: 'unbekannt' };
    var gruppen = rob.status === 'ok' ? robotsGruppen(rob.text) : [];
    var pfad = url ? url.pathname || '/' : '/';
    if (rob.status === 'ok') {
      if (!robotsErlaubt(gruppen, 'Googlebot', pfad)) c('seo', 'robots', 'robots.txt', 'schlecht', 3, 'Die robots.txt sperrt diese Seite für Google.', 'Entfernen Sie die Sperre („Disallow“) in der robots.txt, sonst kann Google die Seite nicht lesen.');
      else c('seo', 'robots', 'robots.txt', 'gut', 2, 'Eine robots.txt ist vorhanden und erlaubt Google den Zugriff auf diese Seite.');
    } else if (rob.status === 'fehlt') {
      c('seo', 'robots', 'robots.txt', 'mittel', 1, 'Unter /robots.txt wurde keine Datei gefunden.', 'Ohne robots.txt dürfen alle Suchmaschinen alles lesen, das ist in Ordnung. Mit einer robots.txt können Sie aber zusätzlich auf Ihre Sitemap verweisen.');
    } else c('seo', 'robots', 'robots.txt', 'info', 0, 'Die robots.txt konnte nicht geprüft werden.');

    var sm = e.sitemap || { status: 'unbekannt' };
    var smInRobots = rob.status === 'ok' && /^\s*sitemap\s*:/im.test(rob.text);
    if (sm.status === 'ok' || smInRobots) c('seo', 'sitemap', 'Sitemap', 'gut', 1, smInRobots ? 'Die robots.txt verweist auf eine Sitemap.' : 'Unter /sitemap.xml liegt eine Sitemap.');
    else if (sm.status === 'fehlt') c('seo', 'sitemap', 'Sitemap', 'mittel', 1, 'Es wurde keine Sitemap gefunden (weder /sitemap.xml noch ein Verweis in der robots.txt).', 'Eine Sitemap listet alle Seiten Ihrer Website auf. Reichen Sie sie zusätzlich in der Google Search Console ein.');
    else c('seo', 'sitemap', 'Sitemap', 'info', 0, 'Die Sitemap konnte nicht geprüft werden.');

    /* ================= GEO ================= */

    if (rob.status === 'ok') {
      var gesperrtSuche = SUCH_BOTS.filter(function (b) { return !robotsErlaubt(gruppen, b, pfad); });
      var gesperrtTraining = TRAINING_BOTS.filter(function (b) { return !robotsErlaubt(gruppen, b, pfad); });
      if (gesperrtSuche.length) c('geo', 'ki-bots', 'Zugang für KI-Suchdienste', 'schlecht', 4, 'Die robots.txt sperrt KI-Suchdienste aus: ' + gesperrtSuche.join(', ') + '.', 'Diese Programme holen Inhalte für die Antworten von ChatGPT, Perplexity, Claude oder Copilot. Wenn Sie dort genannt werden wollen, heben Sie die Sperre für diese Namen auf.');
      else if (gesperrtTraining.length) c('geo', 'ki-bots', 'Zugang für KI-Suchdienste', 'mittel', 4, 'KI-Suchdienste dürfen lesen. Für das Training von KI-Modellen gesperrt: ' + gesperrtTraining.join(', ') + '.', 'Das kann eine bewusste Entscheidung sein. Wer möglichst oft in KI-Antworten vorkommen möchte, lässt auch diese zu, da die Modelle Ihr Unternehmen sonst nur aus Fremdquellen kennen.');
      else c('geo', 'ki-bots', 'Zugang für KI-Suchdienste', 'gut', 4, 'Die robots.txt lässt KI-Dienste wie ChatGPT, Claude, Perplexity und Google-KI zu.');
    } else if (rob.status === 'fehlt') {
      c('geo', 'ki-bots', 'Zugang für KI-Suchdienste', 'gut', 4, 'Ohne robots.txt dürfen alle KI-Dienste Ihre Seite lesen.');
    } else c('geo', 'ki-bots', 'Zugang für KI-Suchdienste', 'info', 0, 'Ohne robots.txt konnte nicht geprüft werden, ob KI-Dienste Ihre Seite lesen dürfen.');

    var jsApp = doc.querySelector('#root:empty, #app:empty, #__next:empty, #__nuxt:empty, app-root:empty, [data-reactroot]:empty');
    var jsHinweis = /javascript/i.test(txt(doc.querySelector('noscript')));
    var skripte = doc.querySelectorAll('script[src]').length;
    if (woerter >= 150) c('geo', 'ohne-js', 'Inhalt ohne JavaScript lesbar', 'gut', 4, 'Der Text steht direkt im Quelltext. Auch KI-Crawler, die kein JavaScript ausführen, können ihn lesen.');
    else if (jsApp || jsHinweis || skripte > 5) c('geo', 'ohne-js', 'Inhalt ohne JavaScript lesbar', 'schlecht', 4, 'Im Quelltext steht kaum Text, die Inhalte werden offenbar erst per JavaScript nachgeladen.', 'Viele KI-Crawler führen kein JavaScript aus und sehen dann eine fast leere Seite. Lassen Sie die Inhalte serverseitig ausliefern (Vorrendern oder statische Seiten).');
    else c('geo', 'ohne-js', 'Inhalt ohne JavaScript lesbar', 'mittel', 4, 'Im Quelltext steht wenig Text (rund ' + zahl(woerter) + ' Wörter).', 'KI-Dienste können nur zitieren, was als Text auf der Seite steht. Ergänzen Sie Beschreibungen Ihrer Leistungen in ganzen Sätzen.');

    if (org.length) c('geo', 'schema', 'Strukturierte Daten (Schema.org)', 'gut', 3, 'Gefunden: ' + alleTypen.slice(0, 8).join(', ') + '.');
    else if (alleTypen.length) c('geo', 'schema', 'Strukturierte Daten (Schema.org)', 'mittel', 3, 'Strukturierte Daten vorhanden (' + alleTypen.slice(0, 6).join(', ') + '), aber keine Angaben zum Unternehmen.', 'Ergänzen Sie ein JSON-LD vom Typ „LocalBusiness“ oder „Organization“ mit Name, Anschrift, Telefon und Öffnungszeiten.');
    else c('geo', 'schema', 'Strukturierte Daten (Schema.org)', 'schlecht', 3, 'Keine strukturierten Daten gefunden.', 'Strukturierte Daten (JSON-LD nach Schema.org) beschreiben Ihr Unternehmen maschinenlesbar: Name, Branche, Anschrift, Telefon, Öffnungszeiten. Suchmaschinen und KI-Systeme übernehmen diese Angaben besonders zuverlässig.');
    if (ld.fehler) c('geo', 'schema-fehler', 'Fehlerfreie strukturierte Daten', 'schlecht', 2, ld.fehler + ' JSON-LD-Block enthält einen Syntaxfehler und wird ignoriert.', 'Prüfen Sie den Block mit dem Test für Rich-Suchergebnisse von Google oder dem Schema Markup Validator.');

    if (org.length) {
      var felder = { name: false, adresse: false, telefon: false, zeiten: false };
      org.forEach(function (o) {
        if (o.name) felder.name = true;
        if (o.address) felder.adresse = true;
        if (o.telephone) felder.telefon = true;
        if (o.openingHours || o.openingHoursSpecification) felder.zeiten = true;
      });
      var fehlend = [];
      if (!felder.name) fehlend.push('Name');
      if (!felder.adresse) fehlend.push('Anschrift');
      if (!felder.telefon) fehlend.push('Telefon');
      if (!felder.zeiten) fehlend.push('Öffnungszeiten');
      if (fehlend.length <= 1) c('geo', 'schema-felder', 'Unternehmensdaten maschinenlesbar', 'gut', 2, 'Die strukturierten Daten enthalten die wichtigsten Angaben' + (fehlend.length ? ' (es fehlt nur: ' + fehlend[0] + ').' : ' (Name, Anschrift, Telefon, Öffnungszeiten).'));
      else c('geo', 'schema-felder', 'Unternehmensdaten maschinenlesbar', 'mittel', 2, 'In den strukturierten Daten fehlen: ' + fehlend.join(', ') + '.', 'Je vollständiger diese Angaben sind, desto eher nennen KI-Assistenten Ihr Unternehmen mit korrekten Daten, etwa bei Fragen wie „Welcher Elektriker in meiner Nähe hat samstags geöffnet?“');
    }

    var tel = doc.querySelector('a[href^="tel:" i]') || /(\+49|\b0)\s?[1-9][\d\s\/-]{5,}\d/.test(text);
    var mail = doc.querySelector('a[href^="mailto:" i]') || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);
    var plz = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/.test(text);
    var kontakt = [tel ? 'Telefon' : '', mail ? 'E-Mail' : '', plz ? 'Anschrift' : ''].filter(Boolean);
    if (kontakt.length >= 2) c('geo', 'kontakt', 'Kontaktdaten auf der Seite', 'gut', 2, 'Auf der Seite gefunden: ' + kontakt.join(', ') + '.');
    else c('geo', 'kontakt', 'Kontaktdaten auf der Seite', kontakt.length ? 'mittel' : 'schlecht', 2, kontakt.length ? 'Nur gefunden: ' + kontakt.join(', ') + '.' : 'Keine Telefonnummer, E-Mail-Adresse oder Anschrift im Text gefunden.', 'Nennen Sie Telefon, E-Mail und Anschrift als Text (nicht nur als Bild). KI-Assistenten geben diese Angaben direkt an Suchende weiter.');

    var impressum = links.some(function (a) { return /impressum|imprint|legal notice/i.test(txt(a) + ' ' + a.getAttribute('href')); });
    var ueber = links.some(function (a) { return /über uns|ueber-uns|uber-uns|about|team|wir über uns/i.test(txt(a) + ' ' + a.getAttribute('href')); });
    if (impressum && ueber) c('geo', 'absender', 'Klar erkennbarer Anbieter', 'gut', 2, 'Impressum und eine Seite „Über uns“ sind verlinkt.');
    else if (impressum) c('geo', 'absender', 'Klar erkennbarer Anbieter', 'mittel', 2, 'Ein Impressum ist verlinkt, eine Seite „Über uns“ wurde nicht gefunden.', 'Eine Seite über Sie, Ihr Team und Ihre Erfahrung stärkt das Vertrauen von Besuchern. Auch Suchmaschinen und KI-Systeme bevorzugen Quellen mit erkennbarem Absender.');
    else c('geo', 'absender', 'Klar erkennbarer Anbieter', 'schlecht', 2, 'Kein Link zum Impressum gefunden.', 'In Deutschland ist ein Impressum für geschäftliche Seiten Pflicht. Es zeigt auch Suchmaschinen und KI-Systemen, wer hinter der Seite steht.');

    var fragen = hAlle.filter(function (h) { return /\?\s*$/.test(txt(h)); }).length;
    var summaries = doc.querySelectorAll('details summary').length;
    var faqSchema = alleTypen.indexOf('FAQPage') >= 0;
    var fragenGesamt = fragen + summaries;
    if (faqSchema || fragenGesamt >= 3) c('geo', 'fragen', 'Antworten auf typische Fragen', 'gut', 2, (faqSchema ? 'FAQ als strukturierte Daten vorhanden. ' : '') + (fragenGesamt ? fragenGesamt + ' Fragen mit Antworten gefunden.' : ''));
    else c('geo', 'fragen', 'Antworten auf typische Fragen', 'mittel', 2, fragenGesamt ? 'Nur ' + fragenGesamt + ' Frage(n) als Überschrift gefunden.' : 'Keine Fragen und Antworten (FAQ) gefunden.', 'Menschen fragen KI-Assistenten in ganzen Sätzen. Ein Abschnitt mit echten Kundenfragen und kurzen, klaren Antworten („Was kostet …?“, „Wie lange dauert …?“) wird gern wörtlich übernommen.');

    var listen = Array.prototype.filter.call(doc.querySelectorAll('ul,ol'), function (l) {
      return l.querySelectorAll(':scope > li').length >= 3 && !l.closest('nav,header,footer') && txt(l).length > 60;
    }).length;
    var tabellen = doc.querySelectorAll('table').length;
    if (listen + tabellen > 0) c('geo', 'struktur', 'Übersichtlich aufbereitete Fakten', 'gut', 1, (listen ? listen + ' Aufzählung(en)' : '') + (listen && tabellen ? ' und ' : '') + (tabellen ? tabellen + ' Tabelle(n)' : '') + ' im Inhalt.');
    else c('geo', 'struktur', 'Übersichtlich aufbereitete Fakten', 'mittel', 1, 'Keine Aufzählungen oder Tabellen im Inhalt gefunden.', 'Fakten wie Leistungen, Preise oder Öffnungszeiten als Liste oder Tabelle sind für Menschen und KI-Systeme leichter zu erfassen als Fließtext.');

    var jahr = new Date().getFullYear();
    var datum = ld.objekte.some(function (o) { return o.dateModified || o.datePublished; }) ||
      doc.querySelector('time[datetime], meta[property="article:modified_time"], meta[property="og:updated_time"]') ||
      new RegExp('(Stand|aktualisiert|Updated)[^.]{0,30}(' + jahr + '|' + (jahr - 1) + ')', 'i').test(text);
    if (datum) c('geo', 'aktuell', 'Erkennbar aktuell', 'gut', 1, 'Die Seite enthält ein Datum oder einen Stand.');
    else c('geo', 'aktuell', 'Erkennbar aktuell', 'mittel', 1, 'Kein Datum und kein Hinweis auf den Stand der Inhalte gefunden.', 'KI-Systeme bevorzugen aktuelle Quellen. Ein Vermerk wie „Stand: ' + new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) + '“ oder dateModified in den strukturierten Daten zeigt, dass die Angaben gepflegt werden.');

    var llms = e.llms || { status: 'unbekannt' };
    if (llms.status === 'ok') c('geo', 'llms', 'llms.txt', 'gut', 0.5, 'Eine llms.txt ist vorhanden. Sie fasst Ihre Website für KI-Systeme zusammen.');
    else if (llms.status === 'fehlt') c('geo', 'llms', 'llms.txt', 'info', 0, 'Keine llms.txt gefunden.', 'Die llms.txt ist ein noch junger Vorschlag: eine kurze Textdatei, die Ihre Website für KI-Systeme zusammenfasst. Bisher nutzen sie nicht alle Anbieter, schaden kann sie nicht.');

    /* Noten */
    function note(area) {
      var s = 0, g = 0;
      checks.forEach(function (k) { if (k.area === area && k.status in FAKTOR) { s += FAKTOR[k.status] * k.gewicht; g += k.gewicht; } });
      return g ? Math.round(s / g * 100) : null;
    }

    return {
      checks: checks,
      scores: { seo: note('seo'), geo: note('geo') },
      facts: {
        title: title, description: desc, h1: h1[0] || '', woerter: woerter, bilder: bilder.length,
        intern: intern, extern: extern, typen: alleTypen, lang: lang, kb: kb
      }
    };
  }

  global.SeoGeoAnalyse = { analysiere: analysiere, robotsGruppen: robotsGruppen, robotsErlaubt: robotsErlaubt };
})(typeof window !== 'undefined' ? window : globalThis);
