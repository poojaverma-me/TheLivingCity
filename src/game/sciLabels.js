// Scientific overlay labels for examine mode: real structure names pinned to the city analogy.
import * as THREE from 'three';
import { NUCLEUS, RER, SER, GOLGI, MITO, LYSO, VACUOLES, VESICLES, GATES } from '../world/layout.js';
import { membranePoint } from '../world/membrane.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const N = NUCLEUS, PH = NUCLEUS.plinthH;

function mitoLocal(m, lx, y, lz) {
  // capsule long axis is local +X rotated by m.rot about Y (three.js convention)
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  return v(m.x + lx * c + lz * s, y, m.z - lx * s + lz * c);
}

export function sciLabelsFor(id, anchors = {}) {
  const A = (k, fb) => (Array.isArray(anchors[k]) ? v(...anchors[k]) : fb);
  const port = membranePoint(GATES.find((g) => g.id === 'portFR').angle, 0);
  switch (id) {
    case 'nucleus': return [
      { tag: 'NE', text: 'Nuclear envelope · double membrane', pos: v(N.x - N.r * 0.75, PH + N.r * 0.75, N.z + N.r * 0.3) },
      { tag: 'NPC', text: 'Nuclear pore complexes', pos: v(N.x + N.r * 0.6, PH + N.r * 0.85, N.z - 1) },
      { tag: 'DNA', text: 'Chromatin (DNA + histones)', pos: v(N.x, PH + 2.4, N.z + 1.2) },
      { tag: '→', text: 'mRNA exported via pores', pos: v(N.x + 4.5, PH + 2.0, N.z - 2) },
    ];
    case 'nucleolus': return [
      { tag: 'rRNA', text: 'rRNA transcription (RNA Pol I)', pos: v(N.nucleolus.x, N.nucleolus.y + 2.0, N.nucleolus.z) },
      { tag: '40S/60S', text: 'Ribosomal subunits assembled', pos: v(N.nucleolus.x + 2.2, N.nucleolus.y - 0.6, N.nucleolus.z + 0.8) },
    ];
    case 'ribosomes': return [
      { tag: '80S', text: 'Ribosome · ~25 nm', pos: v(N.x - 9, 2.6, N.z + 20.5) },
      { tag: 'SRP', text: 'Signal recognition → Sec61 translocon', pos: v(N.x - 6.5, 3.2, N.z + 19) },
    ];
    case 'rer': return [
      { tag: 'RER', text: 'Membrane sheets studded with ribosomes', pos: v(N.x + 9, 4.2, N.z + 15) },
      { tag: 'Lumen', text: 'ER lumen · folding by chaperones (BiP)', pos: v(N.x + 4, 3.0, N.z + 18.5) },
      { tag: '∿', text: 'Continuous with nuclear envelope', pos: v(N.x + 10.5, 5.2, N.z + 6) },
    ];
    case 'ser': return [
      { tag: 'SER', text: 'Tubular ER · no ribosomes', pos: v(SER.x, 4.4, SER.z) },
      { tag: 'P450', text: 'Detox enzymes (cytochrome P450)', pos: A('detox', v(SER.x - 3, 2.6, SER.z + 3)) },
      { tag: 'Ca²⁺', text: 'Calcium store', pos: A('calcium', v(SER.x + 3, 2.6, SER.z - 2)) },
      { tag: 'Lipid', text: 'Phospholipid & steroid synthesis', pos: v(SER.x - 4, 3.3, SER.z - 3) },
    ];
    case 'golgi': return [
      { tag: 'cis', text: 'cis face · receives from ER', pos: A('golgiReceiving', v(GOLGI.x - 7, 3, GOLGI.z - 2)) },
      { tag: 'trans', text: 'trans face · ships out', pos: A('golgiLoadingDock', v(GOLGI.x + 6, 3, GOLGI.z + 3)) },
      { tag: 'Glyco', text: 'Cisternae modify & tag proteins', pos: v(GOLGI.x, 7.2, GOLGI.z) },
      { tag: 'Bud', text: 'Vesicle budding', pos: A('golgiBudding', v(GOLGI.x + 3, 6, GOLGI.z + 1)) },
    ];
    case 'vesicles': return [
      { tag: 'Bilayer', text: 'Lipid-bilayer shell', pos: v(VESICLES[0].x, 3.0, VESICLES[0].z) },
      { tag: 'Exo', text: 'Exocytosis: fuses with membrane', pos: v(port.x, 4.4, port.z) },
      { tag: 'MT', text: 'Carried by kinesin/dynein on microtubules', pos: v(VESICLES[0].x - 4, 1.6, VESICLES[0].z - 3) },
    ];
    case 'mitochondria': return [
      { tag: 'OMM', text: 'Outer membrane', pos: mitoLocal(MITO[0], -MITO[0].len * 0.42, 2.6, MITO[0].wid * 0.5) },
      { tag: 'Cristae', text: 'Inner membrane folds', pos: mitoLocal(MITO[0], -2, 2.2, 0) },
      { tag: 'F₀F₁', text: 'ATP synthase · ~100 turns/s', pos: A('synthase', mitoLocal(MITO[0], 3, 2.2, 1)) },
      { tag: 'Matrix', text: 'Krebs cycle · mtDNA', pos: mitoLocal(MITO[0], 5.5, 1.4, -1.5) },
    ];
    case 'lysosomes': return [
      { tag: 'pH 4.5', text: 'Acidic lumen · proton pumps', pos: v(LYSO[1].x, 4.2, LYSO[1].z) },
      { tag: 'Hydrolases', text: '~60 digestive enzymes', pos: v(LYSO[1].x + 1.8, 2.4, LYSO[1].z + 1.2) },
    ];
    case 'vacuoles': return [
      { tag: 'Store', text: 'Water, ions, nutrients, waste', pos: v(VACUOLES[0].x, 3.5, VACUOLES[0].z) },
      { tag: 'Animal', text: 'Small & numerous in animal cells', pos: v(VACUOLES[1].x, 3.0, VACUOLES[1].z) },
    ];
    case 'membrane': return [
      { tag: 'Bilayer', text: 'Phospholipid bilayer · ~5 nm', pos: v(port.x - port.nx * 0.5, 5.6, port.z - port.nz * 0.5 - 3) },
      { tag: 'Channel', text: 'Transport protein (channel)', pos: v(port.x, 3.3, port.z) },
      { tag: 'Pump', text: 'Na⁺/K⁺-ATPase pumps', pos: v(port.x - port.nx * 2 - 4, 2.6, port.z - port.nz * 2) },
    ];
    default: return [];
  }
}
