// Servidor HTTP (ficheiros do cliente) + WebSocket (jogo).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');
const { Store } = require('./store');

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const store = new Store(DB_FILE);
const game = new Game({ store });

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(CLIENT_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(CLIENT_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': `${MIME[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
wss.on('connection', (ws) => {
  const conn = game.connect((m) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  });
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      game.handle(conn, msg);
    } catch (e) {
      console.error('Erro ao tratar mensagem:', e);
    }
  });
  ws.on('close', () => game.disconnect(conn));
});

setInterval(() => store.save(), 10_000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.markDirty();
    store.save();
    process.exit(0);
  });
}

server.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));
