// Lógica de criaturas e batalhas (pura, sem rede — fácil de testar).
const { MOVES, SPECIES, effectiveness } = require('./creatures');

let nextUid = 1;

function calcStats(species, level) {
  const b = SPECIES[species].base;
  return {
    maxHp: Math.floor((b.hp * 2 * level) / 100) + level + 10,
    atk: Math.floor((b.atk * 2 * level) / 100) + 5,
    def: Math.floor((b.def * 2 * level) / 100) + 5,
    spd: Math.floor((b.spd * 2 * level) / 100) + 5,
  };
}

function movesFor(species, level) {
  const known = SPECIES[species].learnset.filter(([lvl]) => lvl <= level).map(([, m]) => m);
  return known.slice(-4);
}

function xpForLevel(level) {
  return level * level * level;
}

function createCreature(species, level) {
  if (!SPECIES[species]) throw new Error(`Espécie desconhecida: ${species}`);
  const stats = calcStats(species, level);
  return {
    uid: `${Date.now().toString(36)}-${nextUid++}`,
    species,
    level,
    xp: xpForLevel(level),
    hp: stats.maxHp,
    ...stats,
    moves: movesFor(species, level),
  };
}

function refreshStats(c) {
  const ratio = c.maxHp ? c.hp / c.maxHp : 1;
  Object.assign(c, calcStats(c.species, c.level));
  c.hp = Math.max(c.hp > 0 ? 1 : 0, Math.round(c.maxHp * ratio));
  c.moves = movesFor(c.species, c.level);
}

function computeDamage(attacker, defender, moveId, rand = Math.random) {
  const move = MOVES[moveId];
  const attackerType = SPECIES[attacker.species].type;
  const defenderType = SPECIES[defender.species].type;
  if (rand() * 100 >= move.accuracy) return { damage: 0, missed: true, eff: 1 };
  const eff = effectiveness(move.type, defenderType);
  const stab = move.type === attackerType ? 1.5 : 1;
  const base = (((2 * attacker.level) / 5 + 2) * move.power * (attacker.atk / defender.def)) / 50 + 2;
  const variance = 0.85 + rand() * 0.15;
  const damage = eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * variance));
  return { damage, missed: false, eff };
}

function effText(eff) {
  if (eff === 0) return ' Não teve efeito...';
  if (eff > 1) return ' É super eficaz!';
  if (eff < 1) return ' Não é muito eficaz.';
  return '';
}

function doAttack(attacker, defender, moveId, log, rand) {
  const aName = SPECIES[attacker.species].name;
  const r = computeDamage(attacker, defender, moveId, rand);
  if (r.missed) {
    log.push(`${aName} usou ${MOVES[moveId].name}, mas falhou!`);
    return;
  }
  defender.hp = Math.max(0, defender.hp - r.damage);
  log.push(`${aName} usou ${MOVES[moveId].name} (${r.damage} de dano).${effText(r.eff)}`);
  if (defender.hp === 0) log.push(`${SPECIES[defender.species].name} desmaiou!`);
}

function randomMove(c, rand) {
  return c.moves[Math.floor(rand() * c.moves.length)];
}

// Dá XP a uma criatura; devolve mensagens sobre subidas de nível/evolução.
function grantXp(c, amount) {
  const log = [];
  c.xp += amount;
  log.push(`${SPECIES[c.species].name} ganhou ${amount} XP.`);
  while (c.level < 100 && c.xp >= xpForLevel(c.level + 1)) {
    c.level += 1;
    const evo = SPECIES[c.species].evolves;
    if (evo && c.level >= evo.at) {
      log.push(`${SPECIES[c.species].name} evoluiu para ${SPECIES[evo.into].name}!`);
      c.species = evo.into;
    }
    refreshStats(c);
    log.push(`${SPECIES[c.species].name} subiu para o nível ${c.level}!`);
  }
  return log;
}

function xpReward(defeated) {
  return Math.max(1, Math.floor((SPECIES[defeated.species].baseXp * defeated.level) / 5));
}

function captureChance(wild) {
  const hpFactor = 1 - (2 / 3) * (wild.hp / wild.maxHp);
  return Math.min(0.95, SPECIES[wild.species].catchRate * hpFactor * 2);
}

/**
 * Executa uma ronda de batalha contra uma criatura selvagem.
 * battle: { wild, activeIndex, over }
 * action: { type: 'attack'|'capture'|'run'|'switch'|'potion', index }
 * Devolve { log, result } onde result ∈ null | 'win' | 'lose' | 'captured' | 'fled'.
 */
function battleTurn(player, battle, action, rand = Math.random) {
  const log = [];
  const wild = battle.wild;
  let me = player.team[battle.activeIndex];
  const wildName = SPECIES[wild.species].name;

  const enemyActs = () => {
    if (wild.hp > 0 && me.hp > 0) doAttack(wild, me, randomMove(wild, rand), log, rand);
  };

  const mustSwitch = me.hp === 0;
  if (mustSwitch && action.type !== 'switch') {
    return { log: ['A tua criatura desmaiou — escolhe outra.'], result: null };
  }

  switch (action.type) {
    case 'attack': {
      const moveId = me.moves[action.index];
      if (!moveId) return { log: ['Golpe inválido.'], result: null };
      const first = me.spd >= wild.spd ? 'me' : 'wild';
      if (first === 'me') {
        doAttack(me, wild, moveId, log, rand);
        enemyActs();
      } else {
        enemyActs();
        if (me.hp > 0) doAttack(me, wild, moveId, log, rand);
      }
      break;
    }
    case 'switch': {
      const target = player.team[action.index];
      if (!target || target.hp === 0 || action.index === battle.activeIndex) {
        return { log: ['Não podes trocar para essa criatura.'], result: null };
      }
      battle.activeIndex = action.index;
      me = target;
      log.push(`Vai, ${SPECIES[me.species].name}!`);
      if (!mustSwitch) enemyActs();
      break;
    }
    case 'potion': {
      if ((player.items.potion || 0) <= 0) return { log: ['Não tens poções.'], result: null };
      player.items.potion -= 1;
      me.hp = Math.min(me.maxHp, me.hp + 30);
      log.push(`Usaste uma Poção em ${SPECIES[me.species].name}.`);
      enemyActs();
      break;
    }
    case 'capture': {
      if ((player.items.orb || 0) <= 0) return { log: ['Não tens Orbes.'], result: null };
      player.items.orb -= 1;
      log.push('Lançaste um Orbe...');
      if (rand() < captureChance(wild)) {
        log.push(`Apanhaste ${wildName}!`);
        battle.over = true;
        return { log, result: 'captured' };
      }
      log.push(`${wildName} escapou do Orbe!`);
      enemyActs();
      break;
    }
    case 'run': {
      if (rand() < 0.5 + (me.spd - wild.spd) / 100) {
        log.push('Fugiste em segurança.');
        battle.over = true;
        return { log, result: 'fled' };
      }
      log.push('Não conseguiste fugir!');
      enemyActs();
      break;
    }
    default:
      return { log: ['Ação desconhecida.'], result: null };
  }

  if (wild.hp === 0) {
    log.push(...grantXp(me, xpReward(wild)));
    battle.over = true;
    return { log, result: 'win' };
  }
  if (player.team.every((c) => c.hp === 0)) {
    log.push('Todas as tuas criaturas desmaiaram...');
    battle.over = true;
    return { log, result: 'lose' };
  }
  if (me.hp === 0) log.push('Escolhe outra criatura.');
  return { log, result: null };
}

module.exports = {
  calcStats, createCreature, computeDamage, grantXp, xpForLevel, xpReward,
  captureChance, battleTurn, refreshStats,
};
