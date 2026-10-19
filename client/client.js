// Cliente do jogo: liga-se ao servidor por WebSocket e desenha o mundo num canvas.
(() => {
  const TILE = 24;
  const COLORS = { '#': '#1f5a2e', '~': '#2a5ea8', '.': '#c9b98a', g: '#6fbf4f', G: '#3f8f35', H: '#e05a7a' };

  const $ = (id) => document.getElementById(id);
  const canvas = $('map');
  const ctx = canvas.getContext('2d');

  let ws;
  let me = null;
  let map = [];
  let species = {};
  let moves = {};
  let others = new Map();
  let battle = null;

  // ---------- rede ----------
  function connect(onOpen) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = onOpen;
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      if (me) toast('Ligação perdida. Atualiza a página.');
    };
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function onMessage(m) {
    switch (m.t) {
      case 'welcome':
        me = m.player; map = m.map; species = m.species; moves = m.moves;
        $('login').classList.add('hidden');
        $('game').classList.remove('hidden');
        canvas.width = map[0].length * TILE;
        canvas.height = map.length * TILE;
        if (me.team.length === 0) showStarters(m.starters);
        renderSide();
        break;
      case 'state':
        me = m.player; renderSide(); if (battle) renderBattle();
        break;
      case 'players':
        others = new Map(m.list.map((p) => [p.name, p]));
        break;
      case 'player_moved':
        others.set(m.player.name, m.player);
        break;
      case 'battle':
        if (!battle) $('b-log').innerHTML = '';
        battle = m.battle; renderBattle(); appendLog($('b-log'), m.log);
        break;
      case 'battle_end':
        appendLog($('b-log'), m.log);
        toast(m.log[m.log.length - 1]);
        battle = null;
        setTimeout(() => { if (!battle) $('battle').classList.add('hidden'); }, 1500);
        disableBattleButtons();
        break;
      case 'alliances':
        $('alliance-rank').innerHTML = m.list
          .map((a) => `<li>${esc(a.name)} — ${a.points} pts (${a.members} membros)</li>`).join('') || '<li>Sem alianças.</li>';
        break;
      case 'chat': {
        const tag = m.channel === 'alliance' ? '[A] ' : '';
        appendLog($('chat-log'), [`${tag}${m.from}: ${m.text}`]);
        break;
      }
      case 'info':
        toast(m.msg);
        break;
      case 'error':
        if (!me) $('login-error').textContent = m.msg; else toast(m.msg);
        if (m.kick) ws.close();
        break;
    }
  }

  // ---------- login ----------
  function auth(type) {
    const msg = { t: type, user: $('user').value.trim(), pass: $('pass').value };
    if (ws && ws.readyState === WebSocket.OPEN) send(msg);
    else connect(() => send(msg));
  }
  $('btn-login').onclick = () => auth('login');
  $('btn-register').onclick = () => auth('register');
  $('pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') auth('login'); });

  function showStarters(list) {
    const box = $('starter-list');
    box.innerHTML = '';
    for (const id of list) {
      const s = species[id];
      const b = document.createElement('button');
      b.innerHTML = `<strong>${s.name}</strong><span class="type t-${s.type}">${s.type}</span>`;
      b.onclick = () => { send({ t: 'choose_starter', species: id }); $('starter').classList.add('hidden'); };
      box.appendChild(b);
    }
    $('starter').classList.remove('hidden');
  }

  // ---------- movimento ----------
  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
  };
  const held = new Set();
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const dir = KEYS[e.key];
    if (dir) { held.add(dir); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => held.delete(KEYS[e.key]));
  setInterval(() => {
    if (!me || battle || held.size === 0) return;
    send({ t: 'move', dir: [...held].pop() });
  }, 140);

  // ---------- desenho ----------
  function draw() {
    requestAnimationFrame(draw);
    if (!map.length) return;
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const t = map[y][x];
        ctx.fillStyle = COLORS[t] || '#000';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (t === 'H') {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText('H', x * TILE + 7, y * TILE + 18);
        } else if (t === 'g' || t === 'G') {
          ctx.fillStyle = 'rgba(0,0,0,.15)';
          ctx.fillRect(x * TILE + 6, y * TILE + 10, 3, 8);
          ctx.fillRect(x * TILE + 14, y * TILE + 6, 3, 8);
        }
      }
    }
    for (const p of others.values()) drawPlayer(p, p.name === me?.name);
  }

  function drawPlayer(p, isMe) {
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE / 2.6, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? '#ffd23f' : (p.alliance && p.alliance === me?.alliance ? '#7fe0ff' : '#f0f0f0');
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const label = p.alliance ? `${p.name} [${p.alliance}]` : p.name;
    ctx.fillStyle = '#000';
    ctx.fillText(label, cx + 1, cy - TILE / 2 - 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy - TILE / 2 - 2);
    ctx.textAlign = 'start';
  }
  requestAnimationFrame(draw);

  // ---------- painel lateral ----------
  function creatureLine(c) {
    const s = species[c.species];
    const pct = Math.round((c.hp / c.maxHp) * 100);
    return `<strong>${s.name}</strong><span class="type t-${s.type}">${s.type}</span> nv.${c.level}
      <div>${c.hp}/${c.maxHp} PV</div><div class="hpbar"><div style="width:${pct}%"></div></div>`;
  }

  function renderSide() {
    $('me-name').textContent = `${me.name} · ${me.wins} vitórias · ${me.captures} capturas`;
    $('items').textContent = `Orbes: ${me.items.orb} · Poções: ${me.items.potion} · Armazém: ${me.storage.length}`;
    $('team').innerHTML = '';
    me.team.forEach((c, i) => {
      const li = document.createElement('li');
      li.innerHTML = creatureLine(c);
      if (i > 0) {
        const b = document.createElement('button');
        b.textContent = 'Pôr à frente';
        b.onclick = () => send({ t: 'team_swap', from: i, to: 0 });
        li.appendChild(b);
      }
      $('team').appendChild(li);
    });
    const inAlliance = !!me.alliance;
    $('alliance-info').textContent = inAlliance ? `Membro de: ${me.alliance}` : 'Sem aliança.';
    $('alliance-actions').classList.toggle('hidden', inAlliance);
    $('btn-a-leave').classList.toggle('hidden', !inAlliance);
  }

  $('btn-a-create').onclick = () => send({ t: 'alliance_create', name: $('alliance-name').value });
  $('btn-a-join').onclick = () => send({ t: 'alliance_join', name: $('alliance-name').value });
  $('btn-a-leave').onclick = () => send({ t: 'alliance_leave' });
  $('btn-a-rank').onclick = () => send({ t: 'alliance_list' });

  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    send({ t: 'chat', channel: $('chat-channel').value, text: e.target.value });
    e.target.value = '';
  });

  // ---------- batalha ----------
  function renderBattle() {
    $('battle').classList.remove('hidden');
    const mine = me.team[battle.activeIndex];
    $('b-me').innerHTML = creatureLine(mine);
    $('b-wild').innerHTML = creatureLine(battle.wild);

    const fainted = mine.hp === 0;
    const mv = $('b-moves');
    mv.innerHTML = '';
    mine.moves.forEach((id, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${moves[id].name}<span class="type t-${moves[id].type}">${moves[id].type}</span>`;
      b.disabled = fainted;
      b.onclick = () => send({ t: 'battle_action', action: 'attack', index: i });
      mv.appendChild(b);
    });
    document.querySelectorAll('#battle [data-act]').forEach((b) => {
      b.disabled = fainted;
      b.onclick = () => send({ t: 'battle_action', action: b.dataset.act });
    });

    const sw = $('b-switch');
    sw.innerHTML = '';
    me.team.forEach((c, i) => {
      if (i === battle.activeIndex || c.hp === 0) return;
      const b = document.createElement('button');
      b.textContent = `Trocar: ${species[c.species].name}`;
      b.onclick = () => send({ t: 'battle_action', action: 'switch', index: i });
      sw.appendChild(b);
    });
  }

  function disableBattleButtons() {
    document.querySelectorAll('#battle button').forEach((b) => { b.disabled = true; });
  }

  // ---------- util ----------
  function appendLog(el, lines) {
    for (const l of lines) {
      const div = document.createElement('div');
      div.textContent = l;
      el.appendChild(div);
    }
    el.scrollTop = el.scrollHeight;
  }

  let toastTimer;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }
})();
