# Ersatzneubau Loorenstrasse 62 – Entwurf v1 (Notizen Architektur)

## Offene Issues
Keine (erste Version). Selbstprüfung `check.mjs 1`: 0 ERROR, 0 WARNING; IDS R01–R08 bestanden. R09 (Georeferenz EPSG:2056/LN02) ohne Befund.

## Situierung
- Kompakter Riegel 21.0 × 12.0 m (aussen), lokal x −14.0…7.0 / y −5.0…7.0, Ausrichtung orthogonal (rotationDeg 0).
- Gegenüber dem Bestand (EGID 302060735, x −14.3…13.3) liegt der Neubau rund 6 m weiter westlich, deshalb kommt er von der Ostgrenze weg.
- Grenzabstände laut check.mjs (zur Grenze vor der Fassade):
  - Nord: Länge 21 m, verlangt 8.0 m (5 m + ⅓ × 9 m), vorhanden 10.47 m.
  - Ost: Länge 11.2 m, verlangt 5.0 m, vorhanden 9.29 m.
  - Süd: vorhanden 21.2 m. West: vorhanden 36.7 m.
- Abstand zu Bestandesbauten, die stehen bleiben (Hüllrechtecke): EGID 302060736 7.1 m, 302060734 8.4 m, 302060733 11.9 m, 158322 14.7 m. Alle liegen über der Projektannahme von 5 m.
- Höhe: OK fertiger Boden EG ±0.00 = 600.00 m ü.M. Das liegt 0.41 m über dem Terrain von 599.59 m (zulässig 1.0 m). Die Dachoberkante liegt auf +8.85 m, die Gebäudehöhe beträgt damit ca. 9.26 m (zulässig 9.5 m). Vereinfachung des Checks: Gemessen wird die Dachoberkante, ohne Brüstung oder Attika.
- Geschossfläche 756 m² (3 × 252 m²). Bei 11 156 m² Parzelle ergibt das eine Ausnützung von 0.07 nur für diesen Bau. Die übrigen Bauten auf der Parzelle sind nicht eingerechnet.

## Geschosse und Konstruktion
- Es gibt 3 Vollgeschosse EG/OG1/OG2 mit je 2.95 m Geschosshöhe. Kein UG und kein Attika.
- Die Geschossdecken sind 0.32 m dick, die lichte Höhe beträgt 2.63 m. Das Dach im OG2 ist 0.40 m dick, die lichte Höhe dort 2.55 m (verlangt ≥ 2.40 m).
- Aussenwände: Holzrahmenbau 0.40 m, hinterlüftete Holzschalung, U = 0.15 W/m²K, REI 60, tragend.
- Treppenkern:
  - Fassadenwand Nord (AW-N2): Stahlbeton mit Aussendämmung, U = 0.16, REI 90.
  - Kernwände TK-W/E/S: Stahlbeton 0.25 m, REI 90.
- Wohnungstrennwand WT-1: doppelter Holzrahmen 0.25 m, REI 60, tragend.
- Tragende Innenwand je Wohnung (A-IW1, B-IW1): Holzrahmen 0.15 m, REI 60. Die übrigen Innenwände sind nicht tragend (0.10 m).
- Bodenplatte EG-BP: Stahlbeton, U = 0.20. Geschossdecken: Brettsperrholz, REI 60. Flachdach OG2-DA: U = 0.12, REI 60.
- Fenster: U = 0.8, g = 0.5 (Dreifachverglasung, Minergie).

## Erschliessung
- Hauseingang EG-HE liegt in der Nordfassade, im Kern.
- Treppe: eine gerade Treppe je Geschoss, 17 × 17.35 cm, Auftritt 27 cm, Laufbreite 1.20 m. Die Läufe wechseln die Richtung:
  - EG-TR: in der Westspur nach Süden.
  - OG1-TR: in der Ostspur nach Norden.
  - Im OG2 kommt man am Nordpodest an und erreicht das Südpodest über die geschlossene Westspur.
- Deckenaussparungen liegen in OG1-DE und OG2-DE über dem jeweiligen Lauf.
- Alle Wohnungstüren ({G}-A-WT, {G}-B-WT) liegen am Südpodest. Sie sind EI 30 und selbstschliessend.

## Wohnungen (je Geschoss identisch, Nettoflächen aus den Raumpolygonen)
- {G}-A, West, 4.5 Zimmer, 107.9 m²:
  - Wohnen/Essen 35.2 m² und Küche 10.0 m², offen, mit Fenstern nach Süd und West.
  - Zimmer 1: 11.6 m² (Nord und West). Zimmer 2: 12.3 m² (Nord). Zimmer 3: 10.1 m² (West).
  - Bad 7.2 m² mit Fenster nach Norden, Dusche/WC 4.1 m², Reduit 2.9 m², Entree/Korridor 14.5 m².
- {G}-B, Ost, 3.5 Zimmer, 86.0 m²:
  - Wohnen/Essen 33.8 m² nach Süd und Ost, Küche 5.8 m² mit Fenster nach Osten.
  - Zimmer 1: 13.3 m² (Nord). Zimmer 2: 14.1 m² (Nord und Ost).
  - Bad 5.1 m² (innenliegend, mechanisch gelüftet), Reduit 2.4 m², Entree/Korridor 11.5 m².
- Belichtung: Alle Wohnräume, Zimmer und Küchen liegen zwischen 20 % und 45 % (Fensterfläche zu Bodenfläche). Jede Wohnung hat Fenster an drei Fassaden.

## Annahmen und offene Punkte (nicht geprüft)
- Statik: Die Decken spannen bis ca. 7.6 m (Südzone, von der tragenden Mittelwand bis zur Südfassade). Ich gehe von einer Brettsperrholz-Beton-Verbunddecke oder einem Unterzug aus. Das muss die Tragwerksplanung prüfen.
- Kellerabteile, Veloraum und Technik fehlen, weil kein UG geplant ist. Für v2 sind ein Nebengebäude oder ein Teil-UG zu klären.
- Die Lage zur Strasse und Zufahrt ist aus den Daten nicht ersichtlich. Den Hauseingang auf der Nordseite habe ich angenommen. Die kommunale Verkehrsbaulinie (ÖREB) habe ich nicht gegen den Fussabdruck geprüft.
- Die Abstände zu den Nachbarn beruhen auf Hüllrechtecken (swissBUILDINGS3D), nicht auf echten Grundrissen.
- Nicht geprüft habe ich SIA 500, SIA 181, Haustechnik und Kosten.
- Ich habe einen Generator `workspace/design_gen_v1.mjs` verwendet. Er ist deterministisch. Die Wände AW-S2 und AW-E laufen Ost→West bzw. Nord→Süd.
