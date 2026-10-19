const test = require('node:test');
const assert = require('node:assert');
const { Game } = require('../server/game');
const { createCreature, battleTurn, grantXp, computeDamage } = require('../server/battle');
const { effectiveness } = require('../server/creatures');
const world = require('../server/world');

function client(game) {
  const inbox = [];
  const conn = game.connect((m) => inbox.push(m));
  return { conn, inbox, send: (m) => game.handle(conn, m), last: (t) => inbox.filter((m) => m.t === t).pop() };
}

test('efetividade de tipos', () => {
  assert.strictEqual(effectiveness('Fogo', 'Planta'), 2);
  assert.strictEqual(effectiveness('Eletrico', 'Terra'), 0);
  assert.strictEqual(effectiveness('Normal', 'Fogo'), 1);
});

test('dano super eficaz é maior que normal', () => {
  const a = createCreature('brasito', 10);
  const planta = createCreature('brotim', 10);
  const agua = createCreature('gotim', 10);
  const r = () => 0.5;
  assert.ok(computeDamage(a, planta, 'brasa', r).damage > computeDamage(a, agua, 'brasa', r).damage);
});

test('subir de nível e evoluir', () => {
  const c = createCreature('brasito', 15);
  const log = grantXp(c, 2000);
  assert.strictEqual(c.species, 'brasador');
  assert.ok(c.level >= 16);
  assert.ok(log.some((l) => l.includes('evoluiu')));
});

test('vencer uma batalha', () => {
  const player = { team: [createCreature('brasito', 30)], items: { orb: 1, potion: 0 } };
  const battle = { wild: createCreature('ratolho', 2), activeIndex: 0, over: false };
  let res;
  for (let i = 0; i < 10 && !res?.result; i++) res = battleTurn(player, battle, { type: 'attack', index: 0 }, () => 0.1);
  assert.strictEqual(res.result, 'win');
});

test('registo, login e password errada', () => {
  const game = new Game();
  const a = client(game);
  a.send({ t: 'register', user: 'ana', pass: 'segredo' });
  assert.ok(a.last('welcome'));
  const b = client(game);
  b.send({ t: 'login', user: 'ana', pass: 'errada' });
  assert.ok(b.last('error'));
  assert.ok(!b.last('welcome'));
});

test('escolher inicial, andar e encontrar criatura', () => {
  let t = 0;
  const game = new Game({ rand: () => 0, now: () => (t += 1000) });
  const a = client(game);
  a.send({ t: 'register', user: 'rui', pass: '1234' });
  a.send({ t: 'choose_starter', species: 'gotim' });
  assert.strictEqual(game.player('rui').team[0].species, 'gotim');

  // teleporta para junto da relva e anda para dentro dela
  Object.assign(game.player('rui'), { x: 4, y: 1 });
  assert.strictEqual(world.tileAt(5, 1), 'g');
  a.send({ t: 'move', dir: 'right' });
  assert.ok(a.last('battle'), 'deveria começar uma batalha');
  a.send({ t: 'battle_action', action: 'run' });
});

test('alianças: fundar, entrar, chat e sair', () => {
  const game = new Game();
  const a = client(game);
  const b = client(game);
  a.send({ t: 'register', user: 'lider', pass: '1234' });
  b.send({ t: 'register', user: 'membro', pass: '1234' });
  a.send({ t: 'alliance_create', name: 'Dragoes' });
  b.send({ t: 'alliance_join', name: 'dragoes' });
  assert.strictEqual(game.player('membro').alliance, 'Dragoes');

  b.send({ t: 'chat', channel: 'alliance', text: 'olá equipa' });
  assert.ok(a.inbox.some((m) => m.t === 'chat' && m.text === 'olá equipa'));

  a.send({ t: 'alliance_leave' });
  assert.strictEqual(game.store.data.alliances.dragoes.leader, 'membro');
  b.send({ t: 'alliance_leave' });
  assert.strictEqual(game.store.data.alliances.dragoes, undefined);
});
