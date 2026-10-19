// Dados do jogo: tipos, golpes e espécies (todos originais).

const TYPES = ['Fogo', 'Agua', 'Planta', 'Eletrico', 'Terra', 'Vento', 'Normal'];

// EFFECTIVENESS[atacante][defensor] -> multiplicador (omisso = 1)
const EFFECTIVENESS = {
  Fogo: { Planta: 2, Vento: 2, Agua: 0.5, Terra: 0.5 },
  Agua: { Fogo: 2, Terra: 2, Planta: 0.5, Eletrico: 0.5 },
  Planta: { Agua: 2, Terra: 2, Fogo: 0.5, Vento: 0.5 },
  Eletrico: { Agua: 2, Vento: 2, Terra: 0, Planta: 0.5 },
  Terra: { Eletrico: 2, Fogo: 2, Vento: 0, Planta: 0.5 },
  Vento: { Planta: 2, Terra: 2, Eletrico: 0.5 },
  Normal: {},
};

function effectiveness(attackType, defenderType) {
  const row = EFFECTIVENESS[attackType] || {};
  return row[defenderType] ?? 1;
}

const MOVES = {
  investida: { name: 'Investida', type: 'Normal', power: 35, accuracy: 95 },
  arranhao: { name: 'Arranhão', type: 'Normal', power: 40, accuracy: 100 },
  brasa: { name: 'Brasa', type: 'Fogo', power: 40, accuracy: 100 },
  labareda: { name: 'Labareda', type: 'Fogo', power: 75, accuracy: 90 },
  jato: { name: 'Jato de Água', type: 'Agua', power: 40, accuracy: 100 },
  mare: { name: 'Maré Alta', type: 'Agua', power: 75, accuracy: 90 },
  folha: { name: 'Folha Navalha', type: 'Planta', power: 40, accuracy: 100 },
  raiz: { name: 'Raiz Forte', type: 'Planta', power: 75, accuracy: 90 },
  faisca: { name: 'Faísca', type: 'Eletrico', power: 40, accuracy: 100 },
  trovao: { name: 'Trovão', type: 'Eletrico', power: 80, accuracy: 85 },
  pedra: { name: 'Pedrada', type: 'Terra', power: 45, accuracy: 95 },
  sismo: { name: 'Sismo', type: 'Terra', power: 80, accuracy: 85 },
  rajada: { name: 'Rajada', type: 'Vento', power: 40, accuracy: 100 },
  ciclone: { name: 'Ciclone', type: 'Vento', power: 75, accuracy: 90 },
};

// learnset: [nível, golpe]
const SPECIES = {
  brasito: {
    name: 'Brasito', type: 'Fogo', base: { hp: 45, atk: 55, def: 40, spd: 60 },
    catchRate: 0.35, baseXp: 60, evolves: { at: 16, into: 'brasador' },
    learnset: [[1, 'arranhao'], [1, 'brasa'], [12, 'labareda']],
  },
  brasador: {
    name: 'Brasador', type: 'Fogo', base: { hp: 70, atk: 85, def: 65, spd: 80 },
    catchRate: 0.1, baseXp: 140,
    learnset: [[1, 'arranhao'], [1, 'brasa'], [12, 'labareda'], [20, 'pedra']],
  },
  gotim: {
    name: 'Gotim', type: 'Agua', base: { hp: 50, atk: 45, def: 55, spd: 50 },
    catchRate: 0.35, baseXp: 60, evolves: { at: 16, into: 'marejo' },
    learnset: [[1, 'investida'], [1, 'jato'], [12, 'mare']],
  },
  marejo: {
    name: 'Marejo', type: 'Agua', base: { hp: 80, atk: 70, def: 85, spd: 65 },
    catchRate: 0.1, baseXp: 140,
    learnset: [[1, 'investida'], [1, 'jato'], [12, 'mare'], [20, 'rajada']],
  },
  brotim: {
    name: 'Brotim', type: 'Planta', base: { hp: 55, atk: 50, def: 50, spd: 45 },
    catchRate: 0.35, baseXp: 60, evolves: { at: 16, into: 'florasco' },
    learnset: [[1, 'investida'], [1, 'folha'], [12, 'raiz']],
  },
  florasco: {
    name: 'Florasco', type: 'Planta', base: { hp: 85, atk: 75, def: 75, spd: 60 },
    catchRate: 0.1, baseXp: 140,
    learnset: [[1, 'investida'], [1, 'folha'], [12, 'raiz'], [20, 'pedra']],
  },
  faiscol: {
    name: 'Faiscol', type: 'Eletrico', base: { hp: 40, atk: 55, def: 35, spd: 80 },
    catchRate: 0.45, baseXp: 55,
    learnset: [[1, 'investida'], [3, 'faisca'], [14, 'trovao']],
  },
  pedrusco: {
    name: 'Pedrusco', type: 'Terra', base: { hp: 60, atk: 60, def: 75, spd: 25 },
    catchRate: 0.45, baseXp: 55,
    learnset: [[1, 'investida'], [3, 'pedra'], [15, 'sismo']],
  },
  ventilho: {
    name: 'Ventilho', type: 'Vento', base: { hp: 40, atk: 45, def: 35, spd: 75 },
    catchRate: 0.5, baseXp: 50,
    learnset: [[1, 'arranhao'], [3, 'rajada'], [14, 'ciclone']],
  },
  ratolho: {
    name: 'Ratolho', type: 'Normal', base: { hp: 35, atk: 45, def: 35, spd: 60 },
    catchRate: 0.6, baseXp: 40,
    learnset: [[1, 'investida'], [5, 'arranhao']],
  },
};

const STARTERS = ['brasito', 'gotim', 'brotim'];

module.exports = { TYPES, EFFECTIVENESS, effectiveness, MOVES, SPECIES, STARTERS };
