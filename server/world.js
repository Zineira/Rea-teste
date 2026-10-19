// Mapa do mundo. Legenda:
//  # árvore (bloqueia)   ~ água (bloqueia)   . caminho
//  g relva baixa (zona 1) G relva alta (zona 2)   H centro de cura
const MAP = [
  '##############################',
  '#....gggg.......~~~~~~.......#',
  '#....gggg.......~~~~~~..GGG..#',
  '#..H.gggg.......~~~~~~..GGG..#',
  '#...............~~~~~~..GGG..#',
  '#.......#####..........GGGG..#',
  '#..ggg..#####..........GGGG..#',
  '#..ggg.................GGGG..#',
  '#..ggg.......####............#',
  '#............####....H.......#',
  '#....~~~~....................#',
  '#....~~~~.....ggggg....###...#',
  '#.............ggggg....###...#',
  '#..GGGG.......ggggg..........#',
  '#..GGGG......................#',
  '#..GGGG.........#####...ggg..#',
  '#...............#####...ggg..#',
  '#.......................ggg..#',
  '#............................#',
  '##############################',
];

const WIDTH = MAP[0].length;
const HEIGHT = MAP.length;
const SPAWN = { x: 4, y: 4 };

const ENCOUNTERS = {
  g: { rate: 0.15, minLevel: 2, maxLevel: 6, species: ['ratolho', 'ratolho', 'ventilho', 'faiscol', 'pedrusco'] },
  G: { rate: 0.2, minLevel: 6, maxLevel: 12, species: ['faiscol', 'pedrusco', 'ventilho', 'brasito', 'gotim', 'brotim'] },
};

function tileAt(x, y) {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return '#';
  return MAP[y][x];
}

function isWalkable(x, y) {
  const t = tileAt(x, y);
  return t !== '#' && t !== '~';
}

// Devolve { species, level } ou null.
function rollEncounter(x, y, rand = Math.random) {
  const zone = ENCOUNTERS[tileAt(x, y)];
  if (!zone || rand() >= zone.rate) return null;
  const species = zone.species[Math.floor(rand() * zone.species.length)];
  const level = zone.minLevel + Math.floor(rand() * (zone.maxLevel - zone.minLevel + 1));
  return { species, level };
}

module.exports = { MAP, WIDTH, HEIGHT, SPAWN, tileAt, isWalkable, rollEncounter };
