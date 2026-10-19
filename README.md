# Aliança das Criaturas

RPG online de captura de criaturas com alianças entre jogadores — servidor próprio, conteúdo 100% original.

## Como correr

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Variáveis opcionais: `PORT` (porta, padrão 3000) e `DB_FILE` (ficheiro de dados, padrão `data/db.json`).

Para jogares com amigos na mesma rede, abre `http://<IP-do-teu-PC>:3000`.

## O que já existe

- Contas com palavra-passe (guardada com hash scrypt) e progresso guardado em JSON.
- Mapa partilhado multijogador em tempo real (vês os outros jogadores a andar).
- 10 criaturas originais, 7 tipos com vantagens/desvantagens, 14 golpes.
- Batalhas por turnos contra criaturas selvagens: atacar, trocar, poção, Orbe (captura) e fugir.
- XP, subida de nível, novos golpes e evolução (nível 16 nos iniciais).
- Centros de cura (H).
- **Alianças**: fundar, entrar, sair, chat da aliança e ranking por pontos
  (vitórias +1, capturas +3 para a aliança).
- Chat global.

## Estrutura

```
server/creatures.js  tipos, golpes, espécies
server/battle.js     cálculo de dano, XP, captura, ronda de batalha
server/world.js      mapa e encontros
server/game.js       lógica do servidor (contas, movimento, alianças, chat)
server/store.js      persistência
server/index.js      HTTP + WebSocket
client/              cliente web (canvas)
test/                testes
```

## Próximos passos sugeridos

PvP entre jogadores, guerras entre alianças, loja/moedas, sprites, mais mapas, trocas de criaturas.
