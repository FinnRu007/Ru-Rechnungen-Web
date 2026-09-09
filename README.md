# Ru-Rechnungen-Web

Marketing- / Download-Website für **Ru Services – Rechnungsersteller**
(Windows-Programm). Statisches HTML/CSS/JS, kein Build-Schritt, läuft über
GitHub Pages.

Live: <https://finnru007.github.io/Ru-Rechnungen-Web/>

Design nach dem gemeinsamen Regelwerk in
[`Ru-Design/DESIGN.md`](https://github.com/FinnRu007/Ru-Design).

## Struktur

```
index.html          Startseite (Hero, E-Rechnung, Video, Screenshot-Rundgang,
                     Vorteile, Funktionen, Free/Pro, So bekommst du Pro, FAQ)
impressum.html       Impressum (§ 5 DDG)
datenschutz.html     Datenschutzerklärung (DSGVO)
styles.css           komplettes Design (Tokens aus Ru-Design)
script.js            Menü, Screenshot-Lightbox, Platzhalter-Ersatz
img/screenshots/     Programm-Screenshots (siehe README dort)
.nojekyll            liefert die Dateien 1:1 aus
```

## Pflege

- **Screenshots** → PNGs nach `img/screenshots/` legen (Namen siehe
  `img/screenshots/README.md`). Kein Code-Eingriff nötig.
- **Erklärvideo** → in `index.html` im `#video`-Abschnitt die YouTube-Video-ID
  im `<iframe src="…/embed/VIDEO_ID">` austauschen.
- **Neue Programmversion** → als GitHub-Release in **diesem** Repo
  veröffentlichen und die `.exe` **zweimal** als Asset anhängen:
  1. `Ru-Services-Setup-<version>.exe` (zur Nachvollziehbarkeit auf der Releases-Seite)
  2. `Ru-Services-Setup.exe` (**fester Name ohne Version** – darauf zeigt der Website-Button)

  Release als *Latest* markieren. **Die Website muss dann nicht angefasst werden.**
- **Preis / Texte** → direkt in `index.html`.

## Download-Datei

Der Installer wird **nicht** im Repo gespeichert, sondern als Release-Asset.
Der Button auf der Seite zeigt fest auf
`releases/latest/download/Ru-Services-Setup.exe` – GitHub leitet automatisch
auf das jeweils neueste Release weiter. Damit der Link immer funktioniert, muss
jedes neue Release ein Asset mit **genau diesem Namen** enthalten.

## Deployment

GitHub Pages: *Settings → Pages* → Branch `main`, Ordner `/` (root).
Jeder Push auf `main` veröffentlicht neu (~30 s).
