# Schub-Tagebuch 💗

Ein Tagebuch für Schübe bei Multipler Sklerose, als Space für die [Chameloon](https://chameloon.com)-App auf dem iPhone.

- **Schübe festhalten:** Beginn, Stärke, möglicher Auslöser, Symptome (auch eigene) und eine ausführliche Beschreibung
- **Verlauf:** jeden Tag kurz die Stärke eintragen, als Kurve sehen, Schub beenden
- **Tagesform:** Stimmung und Energie, mit Verlauf über 14 und 30 Tage
- **Für den Arzttermin:** alles auf einer Seite, Fragen für den nächsten Termin, als Text teilen
- **Widget:** „Ist der Schub noch da?“, dazu Aktionen für Kontrollzentrum, Sperrbildschirm, Action Button und Siri
- **Optional mit Face ID geschützt**

Alle Daten bleiben auf dem iPhone. Der Space hat keinen Server und sendet nichts weg.

## Installieren

In Chameloon (ab Version 1.2): **Space hinzufügen** → `github.com/fHpro0/schub-tagebuch` eingeben.
Die App nimmt die `.chameloon`-Datei aus dem neuesten Release und holt sich Updates von hier.

## Hinweis

Das Tagebuch ersetzt keine ärztliche Beratung. Bei neuen oder deutlich stärkeren Beschwerden, die länger als
24 Stunden anhalten, sprich mit deiner Neurologin oder deinem Neurologen.

## Entwickeln

`space.json` beschreibt den Space (Datenbank, Widget, Aktionen), `app/` ist die Web-App, `pages/widget.oui` das Widget.
Prüfen und packen mit dem Chameloon-SDK:

```sh
chameloon-check .
chameloon-app pack . --out-dir out
```

Lizenz: MIT
