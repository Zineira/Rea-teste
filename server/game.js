// Estado do jogo e tratamento das mensagens dos clientes (independente do transporte).
const { Store } = require('./store');
const { SPECIES, MOVES, STARTERS } = require('./creatures');
const { createCreature, battleTurn } = require('./battle');
const world = require('./world');

const MAX_TEAM = 6;
const MAX_ALLIANCE_MEMBERS = 20;
const MOVE_COOLDOWN_MS = 120;
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const ALLIANCE_RE = /^[A-Za-z0-9 _-]{3,24}$/;

class Game {
  constructor({ store = new Store(null), rand = Math.random, now = Date.now } = {}) {
    this.store = store;
    this.rand = rand;
    this.now = now;
    this.sessions = new Map(); // nome -> { send, battle, lastMove }
  }

  // ---------- utilitários ----------
  player(name) {
    return this.store.data.players[name];
  }

  publicPlayer(p) {
    return { name: p.name, x: p.x, y: p.y, alliance: p.alliance };
  }

  privatePlayer(p) {
    const { pass, ...rest } = p;
    return rest;
  }

  sendState(name) {
    const s = this.sessions.get(name);
    if (s) s.send({ t: 'state', player: this.privatePlayer(this.player(name)) });
  }

  broadcast(msg, filter = () => true) {
    for (const [name, s] of this.sessions) if (filter(name)) s.send(msg);
  }

  broadcastPlayers() {
    const list = [...this.sessions.keys()].map((n) => this.publicPlayer(this.player(n)));
    this.broadcast({ t: 'players', list });
  }

  // ---------- ligação ----------
  connect(send) {
    return { name: null, send };
  }

  disconnect(conn) {
    if (conn.name && this.sessions.get(conn.name)?.send === conn.send) {
      this.sessions.delete(conn.name);
      this.store.save();
      this.broadcastPlayers();
    }
  }

  handle(conn, msg) {
    const reply = (m) => conn.send(m);
    if (!msg || typeof msg.t !== 'string') return reply({ t: 'error', msg: 'Mensagem inválida.' });

    if (msg.t === 'register' || msg.t === 'login') return this.auth(conn, msg);
    if (!conn.name) return reply({ t: 'error', msg: 'Faz login primeiro.' });

    const p = this.player(conn.name);
    const session = this.sessions.get(conn.name);
    const handlers = {
      choose_starter: () => this.chooseStarter(p, msg, reply),
      move: () => this.move(p, session, msg, reply),
      battle_action: () => this.battleAction(p, session, msg, reply),
      team_swap: () => this.teamSwap(p, msg, reply),
      alliance_create: () => this.allianceCreate(p, msg, reply),
      alliance_join: () => this.allianceJoin(p, msg, reply),
      alliance_leave: () => this.allianceLeave(p, reply),
      alliance_list: () => reply({ t: 'alliances', list: this.allianceRanking() }),
      chat: () => this.chat(p, msg, reply),
    };
    const h = handlers[msg.t];
    if (!h) return reply({ t: 'error', msg: 'Ação desconhecida.' });
    h();
    this.store.markDirty();
  }

  auth(conn, msg) {
    const reply = (m) => conn.send(m);
    const name = String(msg.user || '');
    const pass = String(msg.pass || '');
    if (!NAME_RE.test(name)) return reply({ t: 'error', msg: 'Nome: 3-16 letras, números ou _.' });
    if (pass.length < 4) return reply({ t: 'error', msg: 'Palavra-passe com pelo menos 4 caracteres.' });

    const players = this.store.data.players;
    if (msg.t === 'register') {
      if (players[name]) return reply({ t: 'error', msg: 'Esse nome já existe.' });
      players[name] = {
        name, pass: Store.hashPassword(pass), ...world.SPAWN,
        team: [], storage: [], items: { orb: 5, potion: 3 },
        alliance: null, wins: 0, captures: 0,
      };
      this.store.markDirty();
      this.store.save();
    } else if (!players[name] || !Store.verifyPassword(pass, players[name].pass)) {
      return reply({ t: 'error', msg: 'Nome ou palavra-passe errados.' });
    }

    const old = this.sessions.get(name);
    if (old) old.send({ t: 'error', msg: 'Sessão aberta noutro sítio.', kick: true });
    conn.name = name;
    this.sessions.set(name, { send: conn.send, battle: null, lastMove: 0 });

    reply({
      t: 'welcome',
      player: this.privatePlayer(players[name]),
      map: world.MAP,
      species: SPECIES,
      moves: MOVES,
      starters: STARTERS,
    });
    this.broadcastPlayers();
  }

  chooseStarter(p, msg, reply) {
    if (p.team.length > 0) return reply({ t: 'error', msg: 'Já tens uma criatura inicial.' });
    if (!STARTERS.includes(msg.species)) return reply({ t: 'error', msg: 'Inicial inválido.' });
    p.team.push(createCreature(msg.species, 5));
    reply({ t: 'info', msg: `Escolheste ${SPECIES[msg.species].name}! Boa aventura.` });
    this.sendState(p.name);
  }

  // ---------- mundo ----------
  move(p, session, msg, reply) {
    if (p.team.length === 0) return reply({ t: 'error', msg: 'Escolhe primeiro a tua criatura inicial.' });
    if (session.battle) return;
    const t = this.now();
    if (t - session.lastMove < MOVE_COOLDOWN_MS) return;
    session.lastMove = t;

    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[msg.dir];
    if (!d) return;
    const nx = p.x + d[0];
    const ny = p.y + d[1];
    if (!world.isWalkable(nx, ny)) return;
    p.x = nx;
    p.y = ny;

    if (world.tileAt(nx, ny) === 'H') {
      this.healAll(p);
      reply({ t: 'info', msg: 'As tuas criaturas foram curadas e recebeste Orbes.' });
    }
    this.broadcast({ t: 'player_moved', player: this.publicPlayer(p) });

    if (p.team.some((c) => c.hp > 0)) {
      const enc = world.rollEncounter(nx, ny, this.rand);
      if (enc) this.startBattle(p, session, enc, reply);
    }
    this.sendState(p.name);
  }

  healAll(p) {
    for (const c of [...p.team, ...p.storage]) c.hp = c.maxHp;
    p.items.orb = Math.max(p.items.orb, 5);
    p.items.potion = Math.max(p.items.potion, 3);
  }

  // ---------- batalhas ----------
  startBattle(p, session, enc, reply) {
    const activeIndex = p.team.findIndex((c) => c.hp > 0);
    session.battle = { wild: createCreature(enc.species, enc.level), activeIndex, over: false };
    reply({
      t: 'battle',
      battle: session.battle,
      log: [`Um ${SPECIES[enc.species].name} selvagem (nv. ${enc.level}) apareceu!`],
    });
  }

  battleAction(p, session, msg, reply) {
    const battle = session.battle;
    if (!battle) return reply({ t: 'error', msg: 'Não estás em batalha.' });
    const action = { type: String(msg.action), index: Number(msg.index) };
    const { log, result } = battleTurn(p, battle, action, this.rand);

    if (!result) {
      reply({ t: 'battle', battle, log });
      this.sendState(p.name);
      return;
    }

    session.battle = null;
    if (result === 'captured') {
      p.captures += 1;
      if (p.team.length < MAX_TEAM) p.team.push(battle.wild);
      else {
        p.storage.push(battle.wild);
        log.push('A equipa está cheia — foi enviado para o armazém.');
      }
      this.addAlliancePoints(p, 3);
    } else if (result === 'win') {
      p.wins += 1;
      this.addAlliancePoints(p, 1);
    } else if (result === 'lose') {
      Object.assign(p, world.SPAWN);
      this.healAll(p);
      log.push('Acordaste no centro de cura.');
      this.broadcast({ t: 'player_moved', player: this.publicPlayer(p) });
    }
    reply({ t: 'battle_end', result, log });
    this.sendState(p.name);
  }

  teamSwap(p, msg, reply) {
    const i = Number(msg.from);
    const j = Number(msg.to);
    if (this.sessions.get(p.name).battle) return reply({ t: 'error', msg: 'Não durante uma batalha.' });
    if (!p.team[i] || !p.team[j]) return;
    [p.team[i], p.team[j]] = [p.team[j], p.team[i]];
    this.sendState(p.name);
  }

  // ---------- alianças ----------
  alliance(name) {
    return name ? this.store.data.alliances[name.toLowerCase()] : null;
  }

  addAlliancePoints(p, pts) {
    const a = this.alliance(p.alliance);
    if (a) a.points += pts;
  }

  allianceRanking() {
    return Object.values(this.store.data.alliances)
      .map((a) => ({ name: a.name, leader: a.leader, members: a.members.length, points: a.points }))
      .sort((a, b) => b.points - a.points);
  }

  allianceCreate(p, msg, reply) {
    const name = String(msg.name || '').trim();
    if (p.alliance) return reply({ t: 'error', msg: 'Já pertences a uma aliança.' });
    if (!ALLIANCE_RE.test(name)) return reply({ t: 'error', msg: 'Nome da aliança: 3-24 caracteres.' });
    if (this.alliance(name)) return reply({ t: 'error', msg: 'Essa aliança já existe.' });
    this.store.data.alliances[name.toLowerCase()] = { name, leader: p.name, members: [p.name], points: 0 };
    p.alliance = name;
    reply({ t: 'info', msg: `Fundaste a aliança ${name}!` });
    this.afterAllianceChange(p);
  }

  allianceJoin(p, msg, reply) {
    if (p.alliance) return reply({ t: 'error', msg: 'Sai primeiro da tua aliança atual.' });
    const a = this.alliance(String(msg.name || '').trim());
    if (!a) return reply({ t: 'error', msg: 'Aliança não encontrada.' });
    if (a.members.length >= MAX_ALLIANCE_MEMBERS) return reply({ t: 'error', msg: 'Aliança cheia.' });
    a.members.push(p.name);
    p.alliance = a.name;
    this.broadcastAlliance(a.name, { t: 'chat', channel: 'alliance', from: '★', text: `${p.name} entrou na aliança.` });
    this.afterAllianceChange(p);
  }

  allianceLeave(p, reply) {
    const a = this.alliance(p.alliance);
    if (!a) return reply({ t: 'error', msg: 'Não estás numa aliança.' });
    a.members = a.members.filter((m) => m !== p.name);
    p.alliance = null;
    if (a.members.length === 0) delete this.store.data.alliances[a.name.toLowerCase()];
    else {
      if (a.leader === p.name) a.leader = a.members[0];
      this.broadcastAlliance(a.name, { t: 'chat', channel: 'alliance', from: '★', text: `${p.name} saiu da aliança.` });
    }
    reply({ t: 'info', msg: `Saíste da aliança ${a.name}.` });
    this.afterAllianceChange(p);
  }

  afterAllianceChange(p) {
    this.sendState(p.name);
    this.broadcast({ t: 'player_moved', player: this.publicPlayer(p) });
  }

  broadcastAlliance(allianceName, msg) {
    this.broadcast(msg, (n) => this.player(n).alliance === allianceName);
  }

  // ---------- chat ----------
  chat(p, msg, reply) {
    const text = String(msg.text || '').trim().slice(0, 200);
    if (!text) return;
    if (msg.channel === 'alliance') {
      if (!p.alliance) return reply({ t: 'error', msg: 'Não estás numa aliança.' });
      this.broadcastAlliance(p.alliance, { t: 'chat', channel: 'alliance', from: p.name, text });
    } else {
      this.broadcast({ t: 'chat', channel: 'global', from: p.name, text });
    }
  }
}

module.exports = { Game, MAX_TEAM };
