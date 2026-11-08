/* SEO- und GEO-Check: Abruf der Seite und Darstellung des Ergebnisses.
   Fremde Seiten lassen sich aus dem Browser wegen der Same-Origin-Regel
   (CORS) meist nicht direkt laden. Deshalb: erst direkt versuchen, dann
   nacheinander mehrere öffentliche Abrufdienste. Als letzte Möglichkeit
   kann der Quelltext von Hand eingefügt werden. */
(function () {
  'use strict';

  var ZEITLIMIT = 12000;

  function enc(u) { return encodeURIComponent(u); }

  // Reihenfolge = Bevorzugung. Jeder Dienst liefert { text, status, url }.
  var DIENSTE = [
    {
      // Jina AI Reader: schnell, erlaubt Abrufe aus dem Browser (CORS).
      // "direct" liefert den Quelltext ohne JavaScript auszuführen, wie ein einfacher Crawler.
      name: 'r.jina.ai',
      adresse: function (u) { return 'https://r.jina.ai/' + u; },
      kopf: { 'X-Return-Format': 'html', 'X-Engine': 'direct', 'X-No-Cache': 'true' },
      lesen: function (r) { return r.text().then(function (t) { return { text: auspacken(t), status: r.status, url: null }; }); }
    },
    {
      name: 'r.jina.ai (Browser)',
      adresse: function (u) { return 'https://r.jina.ai/' + u; },
      kopf: { 'X-Return-Format': 'html' },
      lesen: function (r) { return r.text().then(function (t) { return { text: auspacken(t), status: r.status, url: null }; }); }
    },
    {
      name: 'cors.lol',
      adresse: function (u) { return 'https://api.cors.lol/?url=' + enc(u); },
      lesen: roh
    },
    {
      name: 'allorigins.win',
      adresse: function (u) { return 'https://api.allorigins.win/get?url=' + enc(u); },
      lesen: function (r) {
        return r.json().then(function (j) {
          var st = j && j.status ? j.status.http_code : 0;
          return { text: (j && j.contents) || '', status: st || 200, url: (j && j.status && j.status.url) || null };
        });
      }
    },
    {
      name: 'codetabs.com',
      adresse: function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + enc(u); },
      lesen: roh
    }
  ];

  // Jina verpackt reine Textdateien (robots.txt, llms.txt) wie ein Browser in <pre>.
  function auspacken(t) {
    var m = /^\s*<html><head><meta name="color-scheme"[^>]*><\/head><body><pre[^>]*>([\s\S]*)<\/pre><\/body><\/html>\s*$/.exec(t);
    if (!m) return t;
    var d = document.createElement('textarea');
    d.innerHTML = m[1];
    return d.value;
  }
  function roh(r) { return r.text().then(function (t) { return { text: t, status: r.status, url: null }; }); }

  var bevorzugt = null; // zuletzt funktionierender Dienst

  function mitZeitlimit(adresse, ms, opt) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    var o = { cache: 'no-store', credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer' };
    if (opt) for (var k in opt) o[k] = opt[k];
    if (ctrl) o.signal = ctrl.signal;
    return fetch(adresse, o).finally(function () { clearTimeout(timer); });
  }

  // Liefert { text, status, url, weg } oder wirft einen Fehler.
  // pruefen(text) entscheidet, ob die Antwort brauchbar ist.
  function abrufen(url, pruefen, ms) {
    ms = ms || ZEITLIMIT;
    var wege = [];
    var gleicheHerkunft = false;
    try { gleicheHerkunft = new URL(url).origin === location.origin; } catch (e) { /* egal */ }
    wege.push({ name: 'direkt', direkt: true });
    var liste = DIENSTE.slice();
    if (bevorzugt) { liste.sort(function (a, b) { return (a === bevorzugt ? -1 : 0) - (b === bevorzugt ? -1 : 0); }); }
    if (!gleicheHerkunft) wege = wege.concat(liste);

    var i = 0, fehler = [];
    function naechster() {
      if (i >= wege.length) {
        var err = new Error('alle Wege fehlgeschlagen');
        err.details = fehler;
        return Promise.reject(err);
      }
      var w = wege[i++];
      var p = w.direkt
        ? mitZeitlimit(url, w === wege[0] && !gleicheHerkunft ? 6000 : ms).then(roh)
        : mitZeitlimit(w.adresse(url), ms, w.kopf ? { headers: w.kopf } : null).then(function (r) {
          if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('HTTP ' + r.status);
          return w.lesen(r);
        });
      return p.then(function (res) {
        if (res.status === 404 || res.status === 410) { res.weg = w.name; res.fehlt = true; return res; }
        if (!pruefen(res.text || '')) throw new Error('unbrauchbare Antwort');
        res.weg = w.name;
        if (!w.direkt) bevorzugt = w;
        return res;
      }).catch(function (e) {
        fehler.push(w.name + ': ' + (e && e.name === 'AbortError' ? 'Zeitüberschreitung' : (e && e.message) || 'Fehler'));
        return naechster();
      });
    }
    return naechster();
  }

  function istHtml(t) { return t.length > 40 && /<(html|head|body|title|meta|div|p)[\s>]/i.test(t.slice(0, 200000)); }
  function istRobots(t) { return !/<(html|body|head)[\s>]/i.test(t.slice(0, 2000)) && (/^\s*(user-agent|disallow|allow|sitemap)\s*:/im.test(t) || t.trim() === ''); }
  function istSitemap(t) { return /<(urlset|sitemapindex)[\s>]/i.test(t.slice(0, 5000)); }
  function istLlms(t) { return /^\s*#\s+\S/.test(t) && !/<(html|body|head)[\s>]/i.test(t.slice(0, 2000)); }

  // Nebendatei holen: Ergebnis { status: 'ok' | 'fehlt' | 'unbekannt', text }
  function nebendatei(url, pruefen) {
    return abrufen(url, function (t) { return true; }, 12000).then(function (r) {
      if (r.fehlt) return { status: 'fehlt', text: '' };
      if (pruefen(r.text || '')) return { status: 'ok', text: r.text, weg: r.weg };
      // Viele Server liefern bei fehlenden Dateien eine normale HTML-Seite aus
      return { status: 'fehlt', text: '' };
    }).catch(function () { return { status: 'unbekannt', text: '' }; });
  }

  /* ---------- Oberfläche ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var form = $('checkForm'), feld = $('urlInput'), knopf = $('checkBtn'), msg = $('toolMsg');
  var htmlForm = $('htmlForm');

  function normalisieren(eingabe) {
    var s = String(eingabe || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
      var u = new URL(s);
      if (!/\./.test(u.hostname) || /\s/.test(s)) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function meldung(html, art) {
    msg.innerHTML = html ? '<div class="notice ' + (art || 'blue') + '">' + html + '</div>' : '';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function laden(an) {
    knopf.disabled = an;
    knopf.innerHTML = an ? '<span class="spinner" aria-hidden="true"></span> Wird geprüft …' : 'Jetzt prüfen';
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var url = normalisieren(feld.value);
    if (!url) {
      feld.setAttribute('aria-invalid', 'true');
      meldung('<p>Bitte geben Sie eine gültige Adresse ein, zum Beispiel <b>www.ihre-firma.de</b>.</p>', 'amber');
      feld.focus();
      return;
    }
    feld.removeAttribute('aria-invalid');
    feld.value = url;
    $('result').hidden = true;
    laden(true);
    meldung('<p>Die Seite wird abgerufen. Das dauert meist wenige Sekunden.</p>');

    abrufen(url, istHtml).then(function (seite) {
      if (seite.fehlt) {
        meldung('<p><strong>Die Seite wurde nicht gefunden (Fehler ' + seite.status + ').</strong> Bitte prüfen Sie die Adresse.</p>', 'amber');
        laden(false);
        return;
      }
      var basis = seite.url || url;
      var origin = new URL(basis).origin;
      meldung('<p>Seite geladen. robots.txt, Sitemap und llms.txt werden geprüft …</p>');
      return Promise.all([
        nebendatei(origin + '/robots.txt', istRobots),
        nebendatei(origin + '/sitemap.xml', istSitemap),
        nebendatei(origin + '/llms.txt', istLlms)
      ]).then(function (n) {
        window.__letzterWeg = seite.weg;
        window.__nebendateien = n.map(function (x) { return x.status + (x.weg ? ' (' + x.weg + ')' : ''); });
        var ergebnis = window.SeoGeoAnalyse.analysiere({
          html: seite.text, url: basis, status: seite.status, robots: n[0], sitemap: n[1], llms: n[2]
        });
        anzeigen(ergebnis, basis);
        meldung('');
        laden(false);
      });
    }).catch(function (err) {
      laden(false);
      if (window.console) console.warn('SEO-GEO-Check:', err && err.details);
      meldung('<p><strong>Die Seite konnte nicht abgerufen werden.</strong> Mögliche Gründe: Die Adresse ist falsch, die Seite ist gerade nicht erreichbar oder sie blockiert automatische Abrufe.</p>' +
        '<p>So geht es trotzdem: Öffnen Sie Ihre Seite im Browser, drücken Sie <b>Strg + U</b> (Mac: <b>Wahltaste + Cmd + U</b>), markieren Sie alles mit <b>Strg + A</b>, kopieren Sie es und fügen Sie es unten bei <a href="#quelltext">„Quelltext einfügen“</a> ein.</p>', 'amber');
      $('quelltext').open = true;
      $('htmlUrl').value = url;
    });
  });

  htmlForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var html = $('htmlInput').value;
    if (!/<[a-z!]/i.test(html) || html.length < 40) {
      meldung('<p>Bitte fügen Sie den vollständigen HTML-Quelltext Ihrer Seite ein.</p>', 'amber');
      return;
    }
    var url = normalisieren($('htmlUrl').value);
    var basis = url;
    var nach = url
      ? (function () {
        var o = new URL(url).origin;
        meldung('<p>Quelltext wird ausgewertet, robots.txt und Sitemap werden abgerufen …</p>');
        return Promise.all([nebendatei(o + '/robots.txt', istRobots), nebendatei(o + '/sitemap.xml', istSitemap), nebendatei(o + '/llms.txt', istLlms)]);
      })()
      : Promise.resolve([{ status: 'unbekannt' }, { status: 'unbekannt' }, { status: 'unbekannt' }]);
    nach.then(function (n) {
      var ergebnis = window.SeoGeoAnalyse.analysiere({ html: html, url: basis, robots: n[0], sitemap: n[1], llms: n[2] });
      anzeigen(ergebnis, basis);
      meldung('');
    });
  });

  var SYMBOL = {
    gut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mittel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 16.5v.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    schlecht: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6M12 7.5v.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };
  var STATUSTEXT = { gut: 'Gut', mittel: 'Verbesserbar', schlecht: 'Fehlt oder fehlerhaft', info: 'Hinweis' };

  function urteil(n) {
    if (n === null) return '';
    if (n >= 85) return 'Sehr gut aufgestellt';
    if (n >= 70) return 'Gut, mit einigen Lücken';
    if (n >= 50) return 'Ausbaufähig';
    return 'Deutlicher Nachholbedarf';
  }
  function stufe(n) { return n >= 70 ? 'ok' : n >= 50 ? 'warn' : 'bad'; }

  function punkt(k) {
    return '<li class="check-item is-' + k.status + '">' +
      '<span class="check-icon" title="' + STATUSTEXT[k.status] + '">' + SYMBOL[k.status] + '</span>' +
      '<div><p class="check-title">' + esc(k.titel) + ' <span class="area-tag">' + k.area.toUpperCase() + '</span>' +
      '<span class="sr-only"> (' + STATUSTEXT[k.status] + ')</span></p>' +
      '<p class="check-found">' + esc(k.befund) + '</p>' +
      (k.tipp && k.status !== 'gut' ? '<p class="check-tip"><b>So verbessern Sie es:</b> ' + esc(k.tipp) + '</p>' : '') +
      '</div></li>';
  }

  function anzeigen(r, url) {
    var gut = r.checks.filter(function (k) { return k.status === 'gut'; });
    var reihenfolge = { schlecht: 0, mittel: 1 };
    var schlecht = r.checks.filter(function (k) { return k.status === 'schlecht' || k.status === 'mittel'; })
      .sort(function (a, b) { return (reihenfolge[a.status] - reihenfolge[b.status]) || (b.gewicht - a.gewicht); });
    var info = r.checks.filter(function (k) { return k.status === 'info'; });

    $('resUrl').textContent = url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'den eingefügten Quelltext';
    ['seo', 'geo'].forEach(function (a) {
      var n = r.scores[a];
      var box = $('score-' + a);
      box.className = 'score-box ' + stufe(n);
      box.querySelector('.score-num').textContent = n === null ? '–' : n;
      box.querySelector('.score-verdict').textContent = urteil(n);
      box.querySelector('.score-bar i').style.width = (n || 0) + '%';
    });
    $('resGoodCount').textContent = gut.length;
    $('resBadCount').textContent = schlecht.length;
    $('resGood').innerHTML = gut.map(punkt).join('') || '<li class="check-empty">Noch keine Punkte erfüllt.</li>';
    $('resBad').innerHTML = schlecht.map(punkt).join('') || '<li class="check-empty">Keine Verbesserungen nötig. Sehr gut!</li>';
    $('resInfo').innerHTML = info.map(punkt).join('');
    $('resInfoWrap').hidden = !info.length;

    var f = r.facts;
    var zeilen = [
      ['Titel', f.title || '(fehlt)'],
      ['Beschreibung', f.description || '(fehlt)'],
      ['Hauptüberschrift', f.h1 || '(fehlt)'],
      ['Sprache', f.lang || '(nicht angegeben)'],
      ['Wörter', String(f.woerter)],
      ['Bilder', String(f.bilder)],
      ['Links intern / extern', f.intern + ' / ' + f.extern],
      ['Strukturierte Daten', f.typen.length ? f.typen.join(', ') : '(keine)'],
      ['Quelltext', f.kb + ' KB']
    ];
    $('resFacts').innerHTML = zeilen.map(function (z) { return '<dt>' + esc(z[0]) + '</dt><dd>' + esc(z[1]) + '</dd>'; }).join('');

    var betreff = 'Anfrage SEO und GEO' + (url ? ' für ' + url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');
    $('resMail').href = 'mailto:finn.rummel@gmail.com?subject=' + encodeURIComponent(betreff) +
      '&body=' + encodeURIComponent('Guten Tag,\n\nich habe meine Webseite mit dem SEO- und GEO-Check geprüft (SEO ' + r.scores.seo + ' von 100, GEO ' + r.scores.geo + ' von 100) und hätte gern Unterstützung bei den Verbesserungen.\n\nMit freundlichen Grüßen\n');

    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('resHeading').focus({ preventScroll: true });
  }

  $('printBtn').addEventListener('click', function () { window.print(); });

  // Adresse aus dem Link übernehmen: /webseiten/seo-geo-check/?url=beispiel.de
  try {
    var p = new URLSearchParams(location.search).get('url');
    if (p) feld.value = p;
  } catch (e) { /* egal */ }

  window.SeoGeoPruefer = { abrufen: abrufen, DIENSTE: DIENSTE };
})();
