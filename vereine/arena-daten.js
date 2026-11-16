/* Praxistest: Antworten der KI-Modelle, ungekürzt und unverändert.
   Neues Modell ergänzen: Block in "modelle" kopieren, Name und Antworten eintragen.
   Neue Aufgabe ergänzen: Block in "aufgaben" kopieren und bei jedem Modell die Antwort unter derselben id eintragen. */
window.VEREIN_ARENA = {
  "aufgaben": [
    {
      "id": "a",
      "titel": "Einladung zur Versammlung",
      "prompt": "Schreibe eine Einladung zur Jahreshauptversammlung des TV Musterstadt 1912 e.V. am 12. März 2027 um 19:30 Uhr im Vereinsheim. Tagesordnung: Berichte von Vorstand und Kassenwart, Entlastung, Neuwahl des 2. Vorsitzenden, Beitragserhöhung von 60 auf 72 Euro im Jahr, Verschiedenes. Ton: freundlich und verbindlich. Maximal 180 Wörter.",
      "maxWoerter": 180,
      "fazit": "Alle drei halten die Länge ein und nennen den richtigen Wochentag. Der Unterschied liegt im Detail: Zwei Modelle ergänzen Tagesordnungspunkte, eines erfindet eine Frist. Deshalb jede Einladung mit der Satzung abgleichen."
    },
    {
      "id": "b",
      "titel": "Instagram-Beitrag",
      "prompt": "Schreibe einen Instagram-Post für unseren Handballverein: Wir suchen Trainerinnen und Trainer für die E-Jugend (8 bis 10 Jahre), Training dienstags und donnerstags um 17 Uhr, keine Lizenz nötig. Locker, maximal 80 Wörter, mit 5 Hashtags.",
      "maxWoerter": 80,
      "hashtags": 5,
      "fazit": "Alle drei treffen Länge und Hashtag-Zahl. Stil und Emojis unterscheiden sich deutlich. Hier entscheidet, was zum eigenen Verein passt."
    },
    {
      "id": "c",
      "titel": "Excel-Formel",
      "prompt": "In unserer Mitgliederliste steht in Spalte C das Geburtsdatum. Gib mir eine Excel-Formel (deutsche Excel-Version) für Zelle D2, die die Beitragsklasse ausgibt: unter 18 Jahre \"Jugend\", 18 bis 64 \"Erwachsene\", ab 65 \"Senioren\". Erkläre sie in maximal 3 Sätzen.",
      "fazit": "Alle drei liefern dieselbe Kernformel. Vor dem Einsatz an ein paar Beispielzeilen von Hand nachrechnen."
    }
  ],
  "modelle": [
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "antworten": {
        "a": "Liebe Mitglieder des TV Musterstadt 1912 e.V.,\n\nwir laden Sie herzlich zur Jahreshauptversammlung ein.\n\nTermin: Freitag, 12. März 2027, 19:30 Uhr\nOrt: Vereinsheim\n\nTagesordnung:\n1. Begrüßung und Feststellung der Beschlussfähigkeit\n2. Bericht des Vorstands\n3. Bericht des Kassenwarts\n4. Entlastung des Vorstands\n5. Neuwahl des 2. Vorsitzenden\n6. Anhebung des Jahresbeitrags von 60 auf 72 Euro\n7. Verschiedenes\n\nDer Vorstand freut sich auf einen lebhaften Austausch mit Ihnen. Über Ihr Kommen würden wir uns sehr freuen. Falls Sie verhindert sind, geben Sie uns bitte kurz Bescheid.\n\nMit sportlichen Grüßen\nDer Vorstand\nTV Musterstadt 1912 e.V.",
        "b": "Du hast Lust, Kinder für Handball zu begeistern? Wir suchen Trainerinnen und Trainer für unsere E-Jugend (8 bis 10 Jahre)! Trainiert wird dienstags und donnerstags um 17 Uhr. Eine Lizenz brauchst du nicht, Spaß am Umgang mit Kids und am Handball reicht völlig. Du bist neu dabei? Kein Problem, wir helfen dir beim Einstieg. Schreib uns einfach eine DM oder komm vorbei!\n\n#Handball #Trainergesucht #EJugend #Vereinsleben #Handballtraining",
        "c": "=WENN(DATEDIF(C2;HEUTE();\"Y\")<18;\"Jugend\";WENN(DATEDIF(C2;HEUTE();\"Y\")<65;\"Erwachsene\";\"Senioren\"))\n\nDATEDIF(C2;HEUTE();\"Y\") berechnet das volle Alter in Jahren am heutigen Datum. Die äußere WENN-Funktion gibt \"Jugend\" aus, wenn das Alter unter 18 liegt. Die innere WENN-Funktion gibt \"Erwachsene\" aus, wenn das Alter unter 65 liegt, sonst \"Senioren\"."
      },
      "beobachtung": {
        "a": "Siezt die Mitglieder. Ergänzt den Punkt „Begrüßung und Feststellung der Beschlussfähigkeit“, der nicht vorgegeben war.",
        "b": "Ein Absatz ohne Emojis. Ergänzt das Angebot, beim Einstieg zu helfen.",
        "c": "Formel wie verlangt, Erklärung in drei Sätzen."
      }
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "antworten": {
        "a": "Liebe Mitglieder des TV Musterstadt 1912 e.V.,\n\nhiermit laden wir euch herzlich zur Jahreshauptversammlung ein.\n\nDatum: Freitag, 12. März 2027\nUhrzeit: 19:30 Uhr\nOrt: Vereinsheim\n\nTagesordnung:\n1. Berichte von Vorstand und Kassenwart\n2. Entlastung des Vorstands\n3. Neuwahl des 2. Vorsitzenden\n4. Beitragserhöhung von 60 auf 72 Euro im Jahr\n5. Verschiedenes\n\nEure Meinung ist uns wichtig, besonders bei der Neuwahl und der Beitragserhöhung. Bitte nehmt daher zahlreich teil, denn nur so können wir gemeinsam verbindliche Beschlüsse fassen. Anträge zur Tagesordnung reicht bitte bis eine Woche vor der Versammlung schriftlich beim Vorstand ein.\n\nWir freuen uns auf euch und einen schönen Abend im Verein!\n\nMit sportlichen Grüßen\nDer Vorstand\nTV Musterstadt 1912 e.V.",
        "b": "Du hast Lust auf Handball und Kids? 🤾\nFür unsere E-Jugend (8 bis 10 Jahre) suchen wir Trainerinnen und Trainer! Training ist dienstags und donnerstags um 17 Uhr. Eine Lizenz brauchst du nicht, nur Spaß an Bewegung und gute Laune. Dich erwartet ein tolles Team und ganz viel strahlende Kinderaugen. Melde dich per DM oder komm einfach beim Training vorbei!\n\n#Handball #EJugend #Trainergesucht #Ehrenamt #Vereinsleben",
        "c": "=WENN(DATEDIF(C2;HEUTE();\"Y\")<18;\"Jugend\";WENN(DATEDIF(C2;HEUTE();\"Y\")<65;\"Erwachsene\";\"Senioren\"))\n\nDATEDIF berechnet mit \"Y\" die vollendeten Lebensjahre zwischen dem Geburtsdatum in C2 und dem heutigen Datum. Die verschachtelte WENN-Funktion gibt bei unter 18 \"Jugend\" aus, bei unter 65 \"Erwachsene\" und sonst \"Senioren\". Die Formel kannst du nach unten ziehen und sie aktualisiert sich automatisch jeden Tag."
      },
      "beobachtung": {
        "a": "Bleibt bei den fünf vorgegebenen Punkten. Setzt aber eine Antragsfrist von einer Woche, die nicht vorgegeben war. Mit der Satzung abgleichen.",
        "b": "Ein Emoji. Verspricht ein „tolles Team“, das nicht in der Aufgabe stand.",
        "c": "Gleiche Formel wie Haiku. Hinweis, dass sich das Ergebnis täglich aktualisiert."
      }
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "antworten": {
        "a": "Einladung zur Jahreshauptversammlung 2027\n\nLiebe Mitglieder des TV Musterstadt 1912 e.V.,\n\nhiermit laden wir euch herzlich zu unserer Jahreshauptversammlung ein:\n\nFreitag, 12. März 2027, 19:30 Uhr\nVereinsheim des TV Musterstadt\n\nTagesordnung:\n1. Begrüßung und Feststellung der Beschlussfähigkeit\n2. Bericht des Vorstands\n3. Bericht des Kassenwarts\n4. Entlastung des Vorstands\n5. Neuwahl des 2. Vorsitzenden\n6. Beschluss über die Erhöhung des Mitgliedsbeitrags von 60 € auf 72 € pro Jahr\n7. Verschiedenes\n\nAnträge zur Tagesordnung reicht bitte bis zum [Datum] schriftlich beim Vorstand ein.\n\nZur geplanten Beitragserhöhung erläutern wir euch auf der Versammlung gern die Hintergründe und beantworten eure Fragen. Da wichtige Entscheidungen für die Zukunft unseres Vereins anstehen, freuen wir uns über eine rege Teilnahme. Jede Stimme zählt!\n\nIm Anschluss laden wir euch noch zu einem gemütlichen Beisammensein ein.\n\nSportliche Grüße\n\n[Name]\n1. Vorsitzende/r\nTV Musterstadt 1912 e.V.",
        "b": "Trainer*innen gesucht! 🤾\n\nDu hast Lust auf Handball und Spaß mit Kids? Unsere E-Jugend (8–10 Jahre) braucht Verstärkung an der Seitenlinie!\n\n📅 Dienstags & donnerstags um 17 Uhr\n✅ Keine Lizenz nötig – Begeisterung und Zuverlässigkeit reichen\n💪 Wir unterstützen dich beim Einstieg\n\nNeugierig? Schreib uns einfach eine DM oder komm direkt beim Training vorbei!\n\n#Handball #EJugend #TrainerGesucht #Ehrenamt #Jugendhandball",
        "c": "Formel für D2:\n\n=WENN(C2=\"\";\"\";WENN(DATEDIF(C2;HEUTE();\"Y\")<18;\"Jugend\";WENN(DATEDIF(C2;HEUTE();\"Y\")<65;\"Erwachsene\";\"Senioren\")))\n\nErklärung: DATEDIF(C2;HEUTE();\"Y\") berechnet das aktuelle Alter in vollen Jahren aus dem Geburtsdatum in C2. Die verschachtelten WENN-Abfragen ordnen dann zu: unter 18 wird \"Jugend\", unter 65 (also 18 bis 64) wird \"Erwachsene\", alles ab 65 wird \"Senioren\". Die erste Abfrage lässt D2 leer, wenn kein Geburtsdatum eingetragen ist, und du kannst die Formel einfach nach unten ziehen (tipp DATEDIF komplett von Hand ein, Excel schlägt die Funktion nicht automatisch vor)."
      },
      "beobachtung": {
        "a": "Lässt Platzhalter für Antragsfrist und Namen, statt Angaben zu erfinden. Ergänzt einen Begrüßungspunkt und ein Beisammensein, die nicht vorgegeben waren.",
        "b": "Gegliedert mit Emojis, kürzeste Antwort. Nutzt den Genderstern.",
        "c": "Fängt zusätzlich leere Zellen ab und weist darauf hin, dass Excel die Funktion DATEDIF nicht vorschlägt."
      }
    }
  ],
  "stand": "16. November 2026"
};
