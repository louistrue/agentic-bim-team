# Ersatzneubau Loorenstrasse 62 – Bericht Agententeam v2

**Status:** BEREIT FÜR MENSCHLICHE FREIGABE (keine ERROR offen)  
**Modell:** `workspace/design_v3.ifc` · **Befunde:** `workspace/issues.bcf` (35 Topics, 20 offen, 15 erledigt)  
**Parzelle:** WI3988 (CH999979659148), 11156 m², W3 · Ersatz für EGID 302060735  
**Lauf:** 2026-11-23T21:56:52.808Z – 2026-11-23T22:19:45.471Z · Agentenkosten $8.00

## Verlauf

| Version | IDS (Spezifikationen bestanden) | Befunde Prüfregeln | Befunde Agenten | Abgelehnte Agentenbefunde | offen ERROR / WARNING | erledigt | gleiche GlobalIds wie Vorversion |
|---|---|---|---|---|---|---|---|
| v1 | 8/8 | 0 (0 ERROR) | 25 | 0 | 0 / 15 | 0 | – |
| v2 | 8/8 | 0 (0 ERROR) | 23 | 0 | 0 / 9 | 9 | 338 gleich · +31 · −0 |
| v3 | 8/8 | 0 (0 ERROR) | 20 | 0 | 0 / 4 | 15 | 369 gleich · +36 · −0 |

## Kennzahlen (letzte Version)

- Geschossfläche 756 m², Wohnungen 6, Vollgeschosse 3, Gebäudehöhe ca. 9.26 m (max. 9.5 m), EG 0.41 m über Terrain
- Ausnützung dieses Baus: 0.07 (AZ W3 max. 0.9 für die ganze Parzelle inkl. Bestand – **Mensch prüft**)
- Grenzabstände: Nord 10.47 m (verlangt 8 m) · Süd 21.2 m (verlangt 8 m) · West 36.74 m (verlangt 5 m) · Ost 9.29 m (verlangt 5 m)
- Fensteranteil: Nord 22 % · Süd 33 % · West 26 % · Ost 22 %

## Was automatisch geprüft wurde

- IDS workspace/requirements.ids (ifc-lite ids)
- Georeferenz (ifc-lite georef check)
- Zonenordnung W3 (Geschosse, Höhe, Grenzabstand inkl. Mehrlängenzuschlag, Ausnützung)
- Raumprogramm (Wohnungen, Raumgrössen, lichte Höhe, Belichtung)
- Brandschutz (Treppe, Fluchtweg, Wohnungstüren)
- Gebäudehülle (Dach, Bodenplatte, Fensteranteil)
- Visual QA anhand von Renders, 4 Fachagenten (Tragwerk, Haustechnik, Energie/Fassade, Brandschutz)
- Jeder Agentenbefund muss ein existierendes Bauteil nennen; sonst wird er abgelehnt

## Offene Punkte

| Schwere | ID | Titel | Bauteile | Herkunft | seit |
|---|---|---|---|---|---|
| INFO | VISUAL-flachdach-ohne-attika-bru-stung | Flachdach ohne Attika/Brüstung | OG2-DA | Fach-Agent Visual QA | v1 |
| INFO | VISUAL-einziger-hauseingang-schwach-sichtbar | Einziger Hauseingang schwach sichtbar | EG-HE | Fach-Agent Visual QA | v1 |
| INFO | VISUAL-neubau-deckt-sich-mit-bestandsfootprint | Neubau deckt sich mit Bestandsfootprint | EG-BP | Fach-Agent Visual QA | v1 |
| INFO | STRUCTURAL-grosse-su-dfenster-in-tragender-holzrahm | Südfenster: Sturz 0.39 m und Pfeiler nachweisen | EG-AW-S1, EG-A-F6, EG-A-F7, EG-A-F8, EG-AW-W | Fach-Agent Tragwerk | v1 |
| INFO | STRUCTURAL-mischbau-beton-holz-schwinden-und-setzun | Mischbau Beton/Holz: Setzungsdifferenzen offen | OG1-TK-W, OG1-TK-E, OG1-DE, OG1-AW-W | Fach-Agent Tragwerk | v1 |
| INFO | STRUCTURAL-bodenplatte-0-30-m-ohne-ug-baugrund-und- | Bodenplatte: Baugrund, XPS-Druck, Verstärkung unter neuen Linien | EG-BP, EG-WT-1, EG-A-IW1, EG-B-IW1, EG-A-IW7 | Fach-Agent Tragwerk | v1 |
| INFO | MEP-platz-fu-r-komfortlu-ftung-minergie-nich | Lüftungsverteilung in Abhangdecken: Weg und Reserve nachweisen | EG-A-RE, OG1-DE, OG2-DA, OG2-A-SZ | Fach-Agent Haustechnik | v1 |
| INFO | MEP-leitungsdurchfu-hrungen-durch-brandabsch | Abschottung der Deckendurchbrüche festlegen | EG-WT-1, OG1-DE, OG2-DE, OG2-DA, EG-A-SW1, EG-B-SW1, EG-A-RV1 | Fach-Agent Haustechnik | v1 |
| INFO | FACADE-sommerlicher-wa-rmeschutz-su-d-west-kein | Sommerlicher Wärmeschutz Süd/West: Sonnenschutz nur im Fensternamen, Nachweis offen | EG-A-F6, EG-A-F7, EG-B-F5, EG-B-F6, OG2-A-F6, OG2-A-F7, OG2-B-F5, OG2-B-F6, OG2-DA | Fach-Agent Energie/Fassade | v1 |
| INFO | FACADE-sockel-und-plattenrand-wa-rmebru-cke-hol | Sockel: Wärmebrücke Wandfuss und Detail noch offen | EG-BP, EG-AW-S1, EG-AW-W | Fach-Agent Energie/Fassade | v1 |
| INFO | FACADE-u-wert-holzrahmenwand-0-15-ist-plausibel | U-Wert Holzrahmenwand 0.15 und Fenster Uw 0.8: Nachweis mit Produktwerten steht aus | EG-AW-N1, EG-AW-S1, EG-AW-W, EG-AW-E | Fach-Agent Energie/Fassade | v1 |
| INFO | FIRE-schutzabstand-der-holzfassade-zu-nachbar | Schutzabstand Holzfassade: Nachbarbauten weiterhin Projektannahme | EG-AW-W, OG2-AW-W, EG-AW-E | Fach-Agent Brandschutz | v1 |
| INFO | VISUAL-og2-treppenkern-ohne-treppendarstellung | OG2-Treppenkern ohne Treppendarstellung | OG2-TK-W, OG2-TK-E, OG1-TR | Fach-Agent Visual QA | v2 |
| INFO | MEP-technikraum-verteilwege-und-schall | Technikraum: Aufstellplan, Verteilwege und Schall | EG-TE, EG-TE-IW1, EG-TE-T1 | Fach-Agent Haustechnik | v2 |
| INFO | FACADE-attika-und-vordach-nur-in-notizen-wa-rme | Attika und Vordach nicht modelliert: Wärmebrücken Dachrand und Eingang | OG2-DA, EG-HE, OG2-AW-N2 | Fach-Agent Energie/Fassade | v2 |
| INFO | VISUAL-u-berlappende-raumbeschriftungen-im-grun | Überlappende Raumbeschriftungen im Grundriss | OG2-A-KU, OG2-B-KU, EG-A-KU, EG-B-KU, EG-TR | Fach-Agent Visual QA | v3 |
| WARNING | STRUCTURAL-spannweite-su-dzone-ca-7-85-m-bei-0-32-m | Küche B: Zwischenlinie unterbrochen, Unterzug nicht im Modell | OG1-DE, OG2-DE, EG-B-IW7, EG-B-IW6, OG1-B-IW7, OG2-B-IW7 | Fach-Agent Tragwerk | v1 |
| WARNING | STRUCTURAL-aussteifung-quer-zum-geba-ude-kern-exzen | Aussteifung: Steifigkeits- und Massenmittelpunkt nicht gerechnet | EG-TK-W, EG-TK-E, EG-TK-S, EG-AW-N2, EG-AW-S1, EG-AW-W, EG-AW-E, EG-WT-1 | Fach-Agent Tragwerk | v1 |
| WARNING | STRUCTURAL-zwischenwa-nde-bsp-80-mm-querdruck-und-a | Zwischenwände BSP 80 mm: Querdruck und Abbrand über drei Geschosse | EG-A-IW5, EG-A-IW6, EG-A-IW7, EG-A-IW9, EG-A-IW10, EG-B-IW8 | Fach-Agent Tragwerk | v3 |
| WARNING | FIRE-revisionso-ffnungen-ei-30-in-schachtwa-n | Revisionsöffnungen EI 30 in Schachtwänden EI 60 | EG-A-RV1, EG-A-RV2, EG-B-RV1, OG1-A-RV1 | Fach-Agent Brandschutz | v3 |

## Erledigt

| ID | Titel | Bauteile | gefunden | erledigt in |
|---|---|---|---|---|
| VISUAL-treppe-im-treppenkern-kaum-erkennbar | Treppe im Treppenkern kaum erkennbar | EG-TR, OG1-TR | v1 | v2 |
| STRUCTURAL-tragende-mittelwand-0-15-m-mit-tu-ren-ho | Tragende Mittelwand 0.15 m mit Türen, hohe Linienlast | EG-A-IW1, EG-B-IW1, OG1-A-IW1, OG1-B-IW1, EG-A-T2, EG-A-T3 | v1 | v2 |
| MEP-keine-steigzonen-scha-chte-im-modell | Keine Steigzonen/Schächte im Modell | EG-A-BA, EG-A-DU, EG-B-BA, EG-B-RE | v1 | v2 |
| MEP-kein-technikraum-keine-haustechnikzentra | Kein Technikraum / keine Haustechnikzentrale | EG-BP, EG-TH | v1 | v2 |
| MEP-nasszellen-und-ku-che-je-wohnung-verteil | Küche Wohnung A nicht gestapelt und fern der Steigzone | EG-A-KU, OG1-A-KU, OG2-A-KU, EG-A-SZ, EG-A-DU | v1 | v3 |
| FACADE-kernfassade-nord-u-0-16-hat-fast-keine-r | Kernfassade Nord: U = 0.16 hat fast keine Reserve zum Grenzwert 0.17 | EG-AW-N2, OG1-AW-N2, OG2-AW-N2 | v1 | v2 |
| FACADE-kompaktheit-und-fensterverteilung-positi | Kompaktheit und Fensterverteilung: positiv | OG2-DA, EG-AW-S1, EG-AW-N1 | v1 | v2 |
| FIRE-rauchabzug-im-treppenhaus-nicht-nachgewi | Rauchabzug im Treppenhaus nicht nachgewiesen | OG2-DA, OG2-TH-F1, EG-TR | v1 | v2 |
| FIRE-brandu-berschlag-u-ber-u-bereinanderlieg | Brandüberschlag Südfassade: Brüstungsband nicht nachgewiesen | EG-A-F6, OG1-A-F6, EG-AW-S1, OG1-AW-S1 | v1 | v3 |
| FIRE-hinterlu-ftete-holzfassade-brandsperren- | Hinterlüftete Holzfassade: Brandsperren fehlen | EG-AW-S1, OG1-AW-S1, OG2-AW-S1, OG1-AW-N1 | v1 | v2 |
| FIRE-rettung-u-ber-ein-einziges-treppenhaus-u | Rettung über ein einziges Treppenhaus und Anleiterbarkeit | OG2-A-F1, OG2-B-F2, EG-HE | v1 | v2 |
| MEP-ku-che-og1-u-ber-technikraum | Küche OG1 über Technikraum | EG-TE, OG1-A-KU, OG1-DE | v2 | v3 |
| MEP-steigzonenquerschnitt-knapp-fu-r-alle-me | Steigzonenquerschnitt knapp für alle Medien | EG-A-SZ, EG-B-SZ, EG-A-SW1, EG-B-SW1 | v2 | v3 |
| FIRE-technikraum-am-treppenhaus-tu-rklasse-ei | Technikraum am Treppenhaus: Türklasse EI 30 gegenüber Wand EI 60 | EG-TE-T1, EG-TE-IW1, EG-TK-S, EG-TE | v2 | v3 |
| FIRE-steigzonen-durchdringen-holz-beton-decke | Steigzonen durchdringen Holz-Beton-Decken: Abschottung offen | EG-A-SW1, OG1-A-SW1, OG1-DE, OG2-DE | v2 | v3 |

## Nicht automatisch prüfbar – braucht Menschen

- Hindernisfreiheit SIA 500 (Wendekreise, Türbreiten im Detail)
- Schallschutz SIA 181
- Statik (Bemessung nach SIA 260–265)
- Haustechnik-Dimensionierung, Lüftungsanlage Minergie
- Kosten
- Zonenwerte BZO 2016 Art. 13 gegen gültige Fassung und Quartierplan prüfen (Planer)
- ÖREB: Nutzungsplanung (kantonal/kommunal): überlagernde Nutzungen – Arealüberbauungen zulässig
- ÖREB: Nutzungsplanung (kantonal/kommunal): überlagernde Nutzungen – Quartierplan
- ÖREB: Nutzungsplanung (kantonal/kommunal): überlagernde Nutzungen – Quartierplan
- ÖREB: Baulinien (kantonal/kommunal) – Baulinie.Verkehr, kommunal
- ÖREB: Sicherheitszonenplan – Genehmigter Sicherheitszonenperimeter
- ÖREB: Sicherheitszonenplan (öffentlich aufgelegt) – Öffentlich aufgelegter Sicherheitszonenperimeter
- ÖREB: Sicherheitszonenplan (öffentlich aufgelegt) – Öffentlich aufgelegter Sicherheitszonenperimeter
- ÖREB: Lärmempfindlichkeitsstufen (in Nutzungszonen) – Empfindlichkeitsstufe II, aufgestuft (nein)
- Hüllrechtecke der Nachbarbauten (swissBUILDINGS3D) sind Näherungen, keine Grundrisse
- Tragwerk: Schwingungsnachweis und Verbundmittel der HBV-Decke
- Tragwerk: Baugrund, Grundwasser, Frosttiefe
- Tragwerk: Erdbebennachweis (Baugrundklasse, Bauwerksklasse) nach SIA 261
- Haustechnik: Rohr- und Kanaldimensionen, Dämmstärken und freie Querschnitte in A-SZ, A-SZ2 und B-SZ (Strangschema fehlt)
- Haustechnik: Auslegung Wärmepumpe, Speichergrösse, Erdsonde oder Aussengerät sowie Schallimmission an der Südfassade
- Haustechnik: Lage und Abstände von Aussenluft und Fortluft an der Fassade bzw. über Dach
- Haustechnik: Zulässigkeit der Durchbrüche in den BSP-Wänden und Decken (Tragwerksplaner)
- Haustechnik: Abschottungssysteme und Brandschutzklassen der Revisionsöffnungen (Brandschutzfachperson)
- Energie/Fassade: Sommerlicher Wärmeschutz nach SIA 180 (Rechenprogramm, Klimadaten, Nachtlüftungsannahme)
- Energie/Fassade: Energienachweis (Gebäudehüllzahl, Heizwärmebedarf) mit Produktwerten und Ψ-Katalog
- Energie/Fassade: Fenster-Uw, g-Wert und Fc-Wert aus Herstellerdaten
- Energie/Fassade: Luftdichtheit und Anschlussdetails (Blower-Door-Ziel)
- Energie/Fassade: Wirkung der Aussengerät-Aufstellung der Wärmepumpe auf die Südfassade
- Brandschutz: REI 60 der 100 mm BSP-Zwischenwände (Abbrand, Bekleidung) – Holzbauingenieur
- Brandschutz: Reale Abstände zu Nachbargebäuden und Feuerwehrzufahrt/Stellfläche – Katasterplan
- Brandschutz: Konkrete Schottsysteme und deren Zulassung
- Brandschutz: Brandschutzkonzept und Qualitätssicherungsstufe Holzbau nach VKF – Brandschutzfachperson
- Brandschutz: Fluchtweg-Rauchabzug (RWA) Funktion und Dimensionierung

## Einschätzungen der Fachagenten (letzte Version)

- **Visual QA** (PASS): Das Modell ist stimmig aufgebaut: drei Geschosse gestapelt, Fenster in den Wänden, Dach vorhanden, Treppe im Kern und Neubau innerhalb der Bestandsfläche. Offen bleiben nur gestalterische Punkte (Treppenkern OG2, Eingang, Attika) sowie überlappende Planbeschriftungen.
- **Tragwerk**: Die neue BSP-Zwischenlinie (A-IW5/6/7/9/10, B-IW8/7/6) verkürzt die HBV-Deckenfelder auf 3.1–4.75 m und löst das Spannweitenproblem der Südzone weitgehend. Offen bleibt die Lücke der Linie in Wohnung B (Küchenöffnung x 4.7–6.8), wo weiterhin ca. 7.85 m überspannt werden und der Unterzug nur als Text existiert. Die neuen 0.10 m dicken BSP-Wände tragen die Lasten dreier Geschosse und brauchen einen Querdruck- und Brandnachweis; Aussteifung, Bodenplatte, Südsturz und Setzungen bleiben Nachweisthemen für das Vorprojekt.
- **Haustechnik**: Die Küchen von Wohnung A liegen jetzt in allen Geschossen deckungsgleich bei x −7.0…−4.675 und haben mit A-SZ2 einen eigenen Strang. Der Essplatz über dem Technikraum, die grösseren Steigzonen und die Revisionsöffnungen lösen drei frühere Punkte. Offen bleiben die Aufstellplanung des Technikraums, die Abschottung der Deckendurchbrüche und die Lüftungsverteilung in den nicht modellierten Abhangdecken.
- **Energie/Fassade**: Die Gebäudehülle ist kompakt, das Dach (U 0.12) und die Bodenplatte (U 0.17) sind plausibel. Der Sonnenschutz ist neu im Fensternamen vermerkt (Raffstore aussen, Fc 0.15), das ist ein Fortschritt, aber noch kein Merkmal und kein Nachweis. Die Wärmebrücken (Attika, Vordach, Sockel) und die U-Werte mit Produktdaten bleiben für den Energienachweis offen.
- **Brandschutz**: Die drei Brandschutzpunkte aus v2 (Steigzonen-Abschottung, Technikraumtür, Brüstungsband Süd) sind im Modell umgesetzt. Offen bleiben der Schutzabstand zu Nachbarbauten als Projektannahme und neu die Klasse der Revisionsöffnungen in den EI-60-Schachtwänden. Das Treppenhaus-Konzept bleibt unverändert und wird von den deterministischen Checks ohne Befund abgedeckt.

## Freigabe

Die Agenten schlagen vor; Menschen geben frei.

| Rolle | Name | Datum | Entscheid / Unterschrift |
|---|---|---|---|
| Architektur (Projektverfasser) | | | |
| Brandschutzfachperson | | | |
| Tragwerksplanung | | | |
| Energieplanung | | | |
| Bauherrschaft | | | |

## Dateien

- Modelle: design_v1.ifc, design_v2.ifc, design_v3.ifc (EPSG:2056, stabile GlobalIds aus Design-Keys)
- Anforderungen: requirements.ids (aus brief.json erzeugt)
- Befunde: issues.bcf (ein Projekt über alle Versionen), issues.json (Ledger)
- Prüfresultate: checks_vN.json, review_vN.json, visual_qa_vN.json
- Bilder: renders/
- Standort: site.json, site_context.glb (swissALTI3D, Parzelle, swissBUILDINGS3D © swisstopo / amtliche Vermessung)
