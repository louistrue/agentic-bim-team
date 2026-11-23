// Generator für workspace/design_v2.json – deterministisch, keine Zufallswerte.
// v2: Keys aus v1 bleiben; Änderungen siehe design_v2_notes.md.
// Grundriss je Geschoss identisch: Wohnung A (West, 4.5 Zi) | Treppenkern | Wohnung B (Ost, 3.5 Zi)
import { writeFileSync } from 'node:fs';

const DX = 2.0;                       // Verschiebung des ganzen Grundrisses nach Osten (Raster-x + DX)
const X = (x) => Math.round((x + DX) * 1000) / 1000;
const P = (x, y) => [X(x), y];
const R = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];

const H = 2.95;
const storeys = ['EG', 'OG1', 'OG2'].map((k, i) => ({ key: k, name: k, elevation: Math.round(i * H * 1000) / 1000, height: H }));

// Aussenhülle (Rasterkoordinaten, vor DX): aussen x -16..5, y -5..7; Wandachse 0.20 innen
const AW_MAT = { Name: 'Holzrahmenbau Aussenwand hinterlüftet, Brandsperre Stahlblech je Geschossdecke', Layers: [
  { Name: 'Gipsfaserplatte', Thickness: 0.015 }, { Name: 'Installationsebene gedämmt', Thickness: 0.04 },
  { Name: 'OSB-Platte (Luftdichtung, aussteifende Beplankung)', Thickness: 0.015 }, { Name: 'Holzrahmen / Mineralwolle', Thickness: 0.22 },
  { Name: 'Holzfaserdämmplatte', Thickness: 0.06 }, { Name: 'Hinterlüftung / Lattung', Thickness: 0.03 },
  { Name: 'Holzschalung', Thickness: 0.02 } ] };
const AWK_MAT = { Name: 'Stahlbeton Treppenkern, Aussendämmung hinterlüftet, thermisch getrennte Konsolen', Layers: [
  { Name: 'Stahlbeton', Thickness: 0.20 }, { Name: 'Mineralwolle λ 0.031', Thickness: 0.21 },
  { Name: 'Hinterlüftung / Lattung', Thickness: 0.02 }, { Name: 'Holzschalung', Thickness: 0.02 } ] };
const CORE_MAT = { Name: 'Stahlbeton', Layers: [{ Name: 'Stahlbeton', Thickness: 0.25 }] };
const PARTY_MAT = { Name: 'Wohnungstrennwand Holzrahmen doppelt', Layers: [
  { Name: 'Gipsfaserplatte 2-lagig', Thickness: 0.03 }, { Name: 'Holzrahmen / Mineralwolle', Thickness: 0.08 },
  { Name: 'Trennfuge Mineralwolle', Thickness: 0.03 }, { Name: 'Holzrahmen / Mineralwolle', Thickness: 0.08 },
  { Name: 'Gipsfaserplatte 2-lagig', Thickness: 0.03 } ] };
const IWT_MAT = { Name: 'Brettsperrholz-Wandscheibe tragend', Layers: [
  { Name: 'Gipsfaserplatte 2-lagig', Thickness: 0.03 }, { Name: 'Brettsperrholz', Thickness: 0.14 }, { Name: 'Gipsfaserplatte 2-lagig', Thickness: 0.03 } ] };
const SH_MAT = { Name: 'Schachtwand Holzständer, Gipsfaser EI 60', Layers: [
  { Name: 'Gipsfaserplatte 2-lagig', Thickness: 0.03 }, { Name: 'Holzständer / Mineralwolle', Thickness: 0.06 }, { Name: 'Gipsfaserplatte', Thickness: 0.01 } ] };
const IW_MAT = { Name: 'Leichtbauwand Holzständer', Layers: [
  { Name: 'Gipsfaserplatte', Thickness: 0.0125 }, { Name: 'Holzständer / Mineralwolle', Thickness: 0.075 }, { Name: 'Gipsfaserplatte', Thickness: 0.0125 } ] };

const walls = [], openings = [], slabs = [], spaces = [], stairs = [];

const ext = (s, k, a, b, mat = AW_MAT, fire = 'REI 60', u = 0.15, t = 0.40) =>
  walls.push({ key: `${s}-AW-${k}`, storey: s, start: P(...a), end: P(...b), thickness: t, type: 'external', loadBearing: true, fireRating: fire, uValue: u, material: mat });
const core = (s, k, a, b) =>
  walls.push({ key: `${s}-TK-${k}`, storey: s, start: P(...a), end: P(...b), thickness: 0.25, type: 'core', loadBearing: true, fireRating: 'REI 90', material: CORE_MAT });
const party = (s, k, a, b) =>
  walls.push({ key: `${s}-WT-${k}`, storey: s, start: P(...a), end: P(...b), thickness: 0.25, type: 'party', loadBearing: true, fireRating: 'REI 60', material: PARTY_MAT, unitA: `${s}-A`, unitB: `${s}-B` });
const iwt = (s, k, a, b) =>
  walls.push({ key: `${s}-${k}`, storey: s, start: P(...a), end: P(...b), thickness: 0.20, type: 'partition', loadBearing: true, fireRating: 'REI 60', material: IWT_MAT });
const shw = (s, k, a, b) =>
  walls.push({ key: `${s}-${k}`, storey: s, start: P(...a), end: P(...b), thickness: 0.10, type: 'partition', loadBearing: false, fireRating: 'EI 60', material: SH_MAT });
const iw = (s, k, a, b) =>
  walls.push({ key: `${s}-${k}`, storey: s, start: P(...a), end: P(...b), thickness: 0.10, type: 'partition', loadBearing: false, material: IW_MAT });

// Fensterlagen unten sind von West→Ost bzw. Süd→Nord angegeben; bei umgekehrt laufenden Wänden umrechnen
const REV = { 'AW-S2': 8.5, 'AW-E': 11.2 };
const win = (s, k, wall, offset, width, height, sill, space, name) =>
  openings.push({ key: `${s}-${k}`, ...(name ? { name } : {}), kind: 'window', wall: `${s}-${wall}`, offset: REV[wall] ? Math.round((REV[wall] - offset - width) * 1000) / 1000 : offset, width, height, sill, space: `${s}-${space}`, uValue: 0.8, gValue: 0.5, reference: 'Fenster' });
const door = (s, k, wall, offset, width, height = 2.1) =>
  openings.push({ key: `${s}-${k}`, kind: 'door', wall: `${s}-${wall}`, offset, width, height, sill: 0, reference: 'Innentuer' });
const space = (s, k, unit, usage, longName, poly) =>
  spaces.push({ key: `${s}-${k}`, storey: s, usage, unit, longName, polygon: poly });
// Mittelwand IW1 jetzt 0.20 m: Flächen nördlich ab y 3.15, südlich bis y 2.95
const YN = 3.15, YS = 2.95;

const FOOT = R(-16, -5, 5, 7);

for (const st of storeys) {
  const s = st.key; const eg = s === 'EG';
  // ── Aussenwände (Achse), Nord/Süd über die Ecken, West/Ost zwischen den Innenseiten
  ext(s, 'N1', [-16.0, 6.8], [-6.3, 6.8]);
  ext(s, 'N2', [-6.3, 6.775], [-3.5, 6.775], AWK_MAT, 'REI 90', 0.15, 0.45);  // Aussenseite bündig y 7.0
  ext(s, 'N3', [-3.5, 6.8], [5.0, 6.8]);
  ext(s, 'S1', [-16.0, -4.8], [-3.5, -4.8]);
  ext(s, 'S2', [5.0, -4.8], [-3.5, -4.8]);   // läuft Ost→West (Ecke SO als Startpunkt)
  ext(s, 'W', [-15.8, -4.6], [-15.8, 6.6]);
  ext(s, 'E', [4.8, 6.6], [4.8, -4.6]);      // läuft Nord→Süd (Ecke NO als Startpunkt)
  // ── Treppenkern Stahlbeton (innen x -6.175..-3.625, y -0.9..6.6)
  core(s, 'W', [-6.3, -1.15], [-6.3, 6.6]);
  core(s, 'E', [-3.5, -1.15], [-3.5, 6.6]);
  core(s, 'S', [-6.175, -1.025], [-3.625, -1.025]);
  // ── Wohnungstrennwand südlich des Kerns
  party(s, '1', [-3.5, -1.15], [-3.5, -4.6]);

  // ── Wohnung A (West, 4.5 Zimmer)
  iwt(s, 'A-IW1', [-15.6, 3.05], [-6.425, 3.05]);         // tragende Mittelwand (Zimmerzeile Nord)
  iw(s, 'A-IW2', [-12.2, YN], [-12.2, 6.6]);           // Zimmer 1 | Zimmer 2
  iw(s, 'A-IW3', [-8.55, YN], [-8.55, 6.6]);           // Zimmer 2 | Bad
  iw(s, 'A-IW4', [-15.6, 2.0], [-8.45, 2.0]);             // Korridor | Zimmer 3, Dusche, Reduit
  iw(s, 'A-IW5', [-15.6, -1.1], [-12.15, -1.1]);          // Zimmer 3 | Wohnen
  iw(s, 'A-IW6', [-12.2, -1.15], [-12.2, 1.95]);          // Zimmer 3 | Dusche / Essen
  iw(s, 'A-IW7', [-12.15, -0.05], [-8.45, -0.05]);        // Dusche, Reduit | Essen
  iw(s, 'A-IW8', [-10.2, 0.0], [-10.2, 1.95]);            // Reduit | Dusche (v2 getauscht: Dusche an die Steigzone)
  iw(s, 'A-IW9', [-8.4, -1.15], [-8.4, 2.05]);            // Entree | Reduit, Essen
  iw(s, 'A-IW10', [-8.45, -1.1], [-6.425, -1.1]);         // Entree | Wohnen

  if (!eg) {
    space(s, 'A-WO', `${s}-A`, 'Wohnen/Essen', 'Wohnen/Essen', [P(-15.6, -4.6), P(-6.525, -4.6), P(-6.525, -1.15), P(-8.45, -1.15), P(-8.45, -0.1), P(-12.15, -0.1), P(-12.15, -1.15), P(-15.6, -1.15)]);
    space(s, 'A-KU', `${s}-A`, 'Kochen', 'Küche', R(-6.525, -4.6, -3.625, -1.15));
  } else {
    // EG: Technikraum südlich des Kerns, Küche rückt nach Westen in den Wohnbereich (offen)
    space(s, 'A-WO', `${s}-A`, 'Wohnen/Essen', 'Wohnen/Essen', [P(-15.6, -4.6), P(-9.0, -4.6), P(-9.0, -0.1), P(-12.15, -0.1), P(-12.15, -1.15), P(-15.6, -1.15)]);
    space(s, 'A-KU', `${s}-A`, 'Kochen', 'Küche', [P(-9.0, -4.6), P(-6.675, -4.6), P(-6.675, -1.15), P(-8.45, -1.15), P(-8.45, -0.1), P(-9.0, -0.1)]);
    space(s, 'TE', '-', 'Technik', 'Technik / Hausanschlüsse', R(-6.525, -4.6, -3.625, -1.15));
    walls.push({ key: 'EG-TE-IW1', storey: s, start: P(-6.6, -4.6), end: P(-6.6, -1.15), thickness: 0.15, type: 'partition', loadBearing: false, fireRating: 'EI 60', material: SH_MAT });
    openings.push({ key: 'EG-TE-T1', kind: 'door', wall: 'EG-TK-S', offset: 0.9, width: 0.9, height: 2.1, sill: 0, reference: 'Technik', fireRating: 'EI 30', selfClosing: true });
  }
  space(s, 'A-Z1', `${s}-A`, 'Zimmer', 'Zimmer 1', R(-15.6, YN, -12.25, 6.6));
  space(s, 'A-Z2', `${s}-A`, 'Zimmer', 'Zimmer 2', R(-12.15, YN, -8.6, 6.6));
  space(s, 'A-Z3', `${s}-A`, 'Zimmer', 'Zimmer 3', R(-15.6, -1.05, -12.25, 1.95));
  space(s, 'A-BA', `${s}-A`, 'Bad', 'Bad', R(-8.5, YN, -6.425, 6.6));
  space(s, 'A-DU', `${s}-A`, 'Bad', 'Dusche/WC', R(-10.15, 0.0, -8.45, 1.95));
  space(s, 'A-RE', `${s}-A`, 'Reduit', 'Reduit / Lüftungsgerät', R(-12.15, 0.0, -10.25, 1.95));
  space(s, 'A-EN', `${s}-A`, 'Entree', 'Entree/Korridor', [P(-6.425, -1.05), P(-6.425, 2.25), P(-7.1, 2.25), P(-7.1, YS), P(-15.6, YS), P(-15.6, 2.05), P(-8.35, 2.05), P(-8.35, -1.05)]);
  // Steigzone A (Sanitär, Lüftung, Elektro) an Kern und Mittelwand, zwischen Bad, Dusche und Küche
  shw(s, 'A-SW1', [-7.05, 2.2], [-7.05, YS]);
  shw(s, 'A-SW2', [-7.0, 2.25], [-6.425, 2.25]);
  space(s, 'A-SZ', `${s}-A`, 'Technik', 'Steigzone', R(-7.0, 2.3, -6.425, YS));

  door(s, 'A-T1', 'A-IW1', 1.6, 0.8);   // Zimmer 1
  door(s, 'A-T2', 'A-IW1', 5.6, 0.8);   // Zimmer 2
  door(s, 'A-T3', 'A-IW1', 7.4, 0.8);   // Bad
  door(s, 'A-T4', 'A-IW4', 1.6, 0.8);   // Zimmer 3
  door(s, 'A-T5', 'A-IW4', 6.0, 0.7);   // Dusche/WC
  door(s, 'A-T6', 'A-IW4', 4.0, 0.7);   // Reduit
  door(s, 'A-T7', 'A-IW10', 0.5, 0.9);  // Entree → Wohnen

  // ── Wohnung B (Ost, 3.5 Zimmer)
  iwt(s, 'B-IW1', [-3.375, 3.05], [4.6, 3.05]);           // tragende Mittelwand (Zimmerzeile Nord)
  iw(s, 'B-IW2', [0.5, YN], [0.5, 6.6]);               // Zimmer 1 | Zimmer 2
  iw(s, 'B-IW3', [-1.45, 2.0], [2.65, 2.0]);              // Korridor | Bad, Reduit
  iw(s, 'B-IW4', [-1.4, -1.15], [-1.4, 1.95]);            // Entree | Bad, Wohnen
  iw(s, 'B-IW5', [1.0, 0.0], [1.0, 1.95]);                // Bad | Reduit
  iw(s, 'B-IW6', [2.65, -0.05], [2.65, YS]);           // Reduit, Korridor | Küche
  iw(s, 'B-IW7', [-1.35, -0.05], [2.6, -0.05]);           // Bad, Reduit | Wohnen
  iw(s, 'B-IW8', [-3.375, -1.1], [-1.35, -1.1]);          // Entree | Wohnen

  space(s, 'B-WO', `${s}-B`, 'Wohnen/Essen', 'Wohnen/Essen', [P(-3.375, -4.6), P(4.6, -4.6), P(4.6, -0.1), P(-1.35, -0.1), P(-1.35, -1.15), P(-3.375, -1.15)]);
  space(s, 'B-KU', `${s}-B`, 'Kochen', 'Küche', R(2.7, -0.1, 4.6, YS));
  space(s, 'B-Z1', `${s}-B`, 'Zimmer', 'Zimmer 1', R(-3.375, YN, 0.45, 6.6));
  space(s, 'B-Z2', `${s}-B`, 'Zimmer', 'Zimmer 2', R(0.55, YN, 4.6, 6.6));
  space(s, 'B-BA', `${s}-B`, 'Bad', 'Bad', R(-1.35, 0.0, 0.95, 1.95));
  space(s, 'B-RE', `${s}-B`, 'Reduit', 'Reduit / Lüftungsgerät', [P(1.7, 0.0), P(2.6, 0.0), P(2.6, 1.95), P(1.05, 1.95), P(1.05, 0.65), P(1.7, 0.65)]);
  space(s, 'B-EN', `${s}-B`, 'Entree', 'Entree/Korridor', [P(-3.375, -1.05), P(-1.45, -1.05), P(-1.45, 2.05), P(2.6, 2.05), P(2.6, YS), P(-3.375, YS)]);
  // Steigzone B zwischen Bad und Reduit, 1.2 m von der Küche
  shw(s, 'B-SW1', [1.65, 0.0], [1.65, 0.6]);
  shw(s, 'B-SW2', [1.05, 0.6], [1.7, 0.6]);
  space(s, 'B-SZ', `${s}-B`, 'Technik', 'Steigzone', R(1.05, 0.0, 1.6, 0.55));

  door(s, 'B-T1', 'B-IW1', 0.775, 0.8); // Zimmer 1
  door(s, 'B-T2', 'B-IW1', 4.375, 0.8); // Zimmer 2
  door(s, 'B-T3', 'B-IW3', 0.85, 0.8);  // Bad
  door(s, 'B-T4', 'B-IW3', 3.05, 0.7);  // Reduit
  door(s, 'B-T5', 'B-IW8', 0.5, 0.9);   // Entree → Wohnen

  // ── Treppenhaus
  space(s, 'TH', '-', 'Treppenhaus', 'Treppenhaus', R(-6.175, -0.9, -3.625, 6.6));
  // Wohnungstüren am Südpodest (y -0.8..0.2)
  for (const [u, wall] of [['A', 'TK-W'], ['B', 'TK-E']])
    openings.push({ key: `${s}-${u}-WT`, kind: 'door', wall: `${s}-${wall}`, offset: 0.35, width: 1.0, height: 2.1, sill: 0,
      reference: 'Wohnungstuer', unit: `${s}-${u}`, fireRating: 'EI 30', selfClosing: true });
  if (s === 'EG') openings.push({ key: 'EG-HE', kind: 'door', wall: 'EG-AW-N2', offset: 1.4, width: 1.2, height: 2.3, sill: 0, reference: 'Hauseingang', uValue: 1.0 });
  else win(s, 'TH-F1', 'AW-N2', 0.8, 1.2, 1.4, 1.0, 'TH');

  // ── Fenster Wohnung A
  win(s, 'A-F1', 'AW-N1', 1.2, 1.8, 1.5, 0.8, 'A-Z1', eg ? undefined : 'Fenster Zimmer 1 (anleiterbar, 2. Rettungsweg)');
  win(s, 'A-F2', 'AW-W', 8.6, 1.6, 1.5, 0.8, 'A-Z1');
  win(s, 'A-F3', 'AW-N1', 4.7, 1.8, 1.5, 0.8, 'A-Z2');
  win(s, 'A-F4', 'AW-N1', 8.0, 0.9, 1.0, 1.3, 'A-BA');
  win(s, 'A-F5', 'AW-W', 4.35, 1.6, 1.5, 0.8, 'A-Z3');
  // Grosse Öffnungen: EG Fenstertür (Brüstung 0.1, OK 2.2), OG Brüstung 0.5 (OK 2.2) → Fassadenband ≥ 1.25 m zwischen den Geschossen
  const [bs, bh] = eg ? [0.1, 2.1] : [0.5, 1.7];
  win(s, 'A-F6', 'AW-S1', 1.3, 2.2, bh, bs, 'A-WO');
  win(s, 'A-F7', 'AW-S1', 4.7, 2.2, bh, bs, 'A-WO');
  win(s, 'A-F8', 'AW-W', 1.0, 2.0, bh, bs, 'A-WO');
  win(s, 'A-F9', 'AW-S1', 10.1, 1.8, 1.4, 0.9, eg ? 'TE' : 'A-KU');
  if (eg) win(s, 'A-F10', 'AW-S1', 7.3, 1.6, 1.3, 0.9, 'A-KU');
  // ── Fenster Wohnung B
  win(s, 'B-F1', 'AW-N3', 1.3, 1.8, 1.5, 0.8, 'B-Z1');
  win(s, 'B-F2', 'AW-N3', 5.3, 1.6, 1.5, 0.8, 'B-Z2', eg ? undefined : 'Fenster Zimmer 2 (anleiterbar, 2. Rettungsweg)');
  win(s, 'B-F3', 'AW-E', 8.9, 1.2, 1.5, 0.8, 'B-Z2');
  win(s, 'B-F4', 'AW-E', 5.2, 1.2, 1.4, 0.9, 'B-KU');
  win(s, 'B-F5', 'AW-S2', 1.0, 2.2, bh, bs, 'B-WO');
  win(s, 'B-F6', 'AW-S2', 4.6, 2.2, bh, bs, 'B-WO');
  win(s, 'B-F7', 'AW-E', 1.0, 2.0, bh, bs, 'B-WO');
}

// ── Decken: Bodenplatte EG (Stahlbeton), Geschossdecken Brettsperrholz, Dach
slabs.push({ key: 'EG-BP', storey: 'EG', kind: 'base', thickness: 0.30, polygon: FOOT, fireRating: 'REI 90', uValue: 0.17, material: 'Stahlbeton 300 mm, unterseitig XPS 200 mm, Randdämmung XPS 120 mm am Plattenrand bis UK Schwelle' });
// Treppe EG: westliche Spur, läuft vom Nordpodest nach Süden; Treppe OG1: östliche Spur, vom Südpodest nach Norden
const RUN = 17 * 0.27;
// Steigzonen: Deckenaussparungen deckungsgleich in allen Decken und im Dach (Fortluft/Strangentlüftung)
const SHAFTS = [{ x: X(-7.0), y: 2.3, w: 0.575, d: 0.65 }, { x: X(1.05), y: 0.0, w: 0.55, d: 0.55 }];
const HBV = 'Holz-Beton-Verbunddecke: Brettsperrholz 160 mm, Überbeton 120 mm (Lüftungsverteilung eingelegt), Trittschall 20 mm, Unterlagsboden 60 mm';
slabs.push({ key: 'OG1-DE', storey: 'OG1', kind: 'floor', thickness: 0.36, polygon: FOOT, fireRating: 'REI 60', material: HBV,
  openings: [{ x: X(-6.175), y: 0.61, w: 1.2, d: RUN }, ...SHAFTS] });
slabs.push({ key: 'OG2-DE', storey: 'OG2', kind: 'floor', thickness: 0.36, polygon: FOOT, fireRating: 'REI 60', material: HBV,
  openings: [{ x: X(-4.825), y: 0.61, w: 1.2, d: RUN }, ...SHAFTS] });
// Rauchabzug (RWA-Lichtkuppel 1.0 × 1.2 m) am höchsten Punkt des Treppenhauses, Auslösung EG und OG2
slabs.push({ key: 'OG2-DA', storey: 'OG2', kind: 'roof', thickness: 0.40, polygon: FOOT, fireRating: 'REI 60', uValue: 0.12,
  material: 'Flachdach: Brettsperrholz-Hohlkastenelement 240 mm (gedämmt), Aufdämmung 140 mm, Abdichtung, extensiv begrünt; RWA-Lichtkuppel über Treppenhaus',
  openings: [{ x: X(-5.4), y: 3.0, w: 1.0, d: 1.2 }, ...SHAFTS] });
stairs.push({ key: 'EG-TR', storey: 'EG', position: P(-6.175, 5.2), directionDeg: 270, risers: 17, riserHeight: 0.1735, tread: 0.27, width: 1.2, fireRating: 'REI 90' });
stairs.push({ key: 'OG1-TR', storey: 'OG1', position: P(-3.625, 0.61), directionDeg: 90, risers: 17, riserHeight: 0.1735, tread: 0.27, width: 1.2, fireRating: 'REI 90' });

const design = {
  name: 'Ersatzneubau Loorenstrasse 62', reference: 'Ersatzneubau',
  placement: { eastings: 2687233, northings: 1246459, height: 600, rotationDeg: 0 },
  storeys, walls, openings, slabs, spaces, stairs, columns: [],
};
writeFileSync(new URL('./design_v2.json', import.meta.url), JSON.stringify(design, null, 1));
console.log(`walls ${walls.length}, openings ${openings.length}, spaces ${spaces.length}`);
