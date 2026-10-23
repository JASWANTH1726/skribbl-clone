import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../Player.js';
import { Game } from '../Game.js';
import { Room } from '../Room.js';
import { RoomManager } from '../RoomManager.js';
import { WordManager } from '../WordManager.js';

describe('Player Model', () => {
  it('should initialize player with correct properties', () => {
    const player = new Player('p1', 'socket-1', 'Alice', 'avatar_1', true);
    assert.equal(player.id, 'p1');
    assert.equal(player.name, 'Alice');
    assert.equal(player.isHost, true);
    assert.equal(player.isReady, true);
    assert.equal(player.score, 0);
  });

  it('should allow the configured maximum of five hints', () => {
    const game = new Game({ hints: 5 });
    game.phase = 'word_select';
    game.wordOptions = ['watermelon'];
    assert.equal(game.setChosenWord('watermelon'), true);

    for (let i = 0; i < 5; i++) {
      assert.equal(game.revealHint(), true);
    }
    assert.equal(game.revealedIndices.size, 5);
    assert.equal(game.revealHint(), false);
  });

  it('should update score and reset round state correctly', () => {
    const player = new Player('p1', 'socket-1', 'Alice');
    player.addScore(150);
    player.hasGuessed = true;
    player.isDrawing = true;

    assert.equal(player.score, 150);
    player.resetRoundState();
    assert.equal(player.hasGuessed, false);
    assert.equal(player.isDrawing, false);
  });
});

describe('Game Model', () => {
  it('rejects unoffered words and words chosen outside the selection phase atomically', () => {
    const game = new Game();
    game.wordOptions = ['elephant'];
    game.timeLeft = 15;

    assert.equal(game.setChosenWord('not offered'), false);
    assert.equal(game.phase, 'lobby');
    assert.equal(game.currentWord, null);
    assert.equal(game.timeLeft, 15);

    game.phase = 'word_select';
    assert.equal(game.setChosenWord('not offered'), false);
    assert.equal(game.phase, 'word_select');
    assert.equal(game.currentWord, null);
    assert.equal(game.timeLeft, 15);
  });

  it('should initialize game rounds and manage turns', () => {
    const p1 = new Player('p1', 's1', 'P1');
    const p2 = new Player('p2', 's2', 'P2');
    const playersMap = new Map([['p1', p1], ['p2', p2]]);

    const game = new Game({ rounds: 2, drawTime: 60, hints: 2 });
    game.initGame([p1, p2]);

    assert.equal(game.phase, 'word_select');
    assert.equal(game.currentRound, 1);

    const turn1 = game.nextTurn(playersMap);
    assert.equal(turn1.hasNext, true);
    assert.equal(turn1.drawer?.id, 'p1');
    assert.equal(p1.isDrawing, true);

    game.wordOptions = ['elephant'];
    assert.equal(game.setChosenWord('elephant'), true);
    assert.equal(game.phase, 'drawing');
    assert.equal(game.currentWord, 'elephant');
    assert.equal(game.maskedWord, '_ _ _ _ _ _ _ _');

    // Hint revelation
    const revealed = game.revealHint();
    assert.equal(revealed, true);
    assert.match(game.maskedWord, /[a-z]/i);

    // Word guessing check
    const checkCorrect = game.checkWord('elephant');
    assert.equal(checkCorrect.isCorrect, true);

    const checkClose = game.checkWord('elephan');
    assert.equal(checkClose.isCorrect, false);
    assert.equal(checkClose.isClose, true);
  });

  it('should respect hints disabled (hints = 0)', () => {
    const game = new Game({ hints: 0 });
    game.phase = 'word_select';
    game.wordOptions = ['sunshine'];
    assert.equal(game.setChosenWord('sunshine'), true);
    assert.equal(game.maskedWord, '_ _ _ _ _ _ _ _');

    // revealHint should strictly return false and reveal no letters
    const revealed = game.revealHint();
    assert.equal(revealed, false);
    assert.equal(game.maskedWord, '_ _ _ _ _ _ _ _');
  });

  it('should enforce hint clamping within 0 to 5', () => {
    const gameMin = new Game({ hints: -5 });
    assert.equal(gameMin.maxHints, 0);

    const gameMax = new Game({ hints: 10 });
    assert.equal(gameMax.maxHints, 5);
  });
});

describe('Room Model', () => {
  it('should manage players, settings, and stroke history', () => {
    const host = new Player('h1', 's-host', 'HostUser', 'avatar_1', true);
    const room = new Room('TEST01', host, { maxPlayers: 2 });

    assert.equal(room.players.size, 1);
    assert.equal(room.hostId, 'h1');

    const guest1 = new Player('g1', 's-guest1', 'Guest1');
    const added1 = room.addPlayer(guest1);
    assert.equal(added1, true);
    assert.equal(room.players.size, 2);

    // Max players limit reached
    const guest2 = new Player('g2', 's-guest2', 'Guest2');
    const added2 = room.addPlayer(guest2);
    assert.equal(added2, false);

    // Strokes management
    room.addStroke({
      id: 'stroke-1',
      tool: 'brush',
      color: '#000000',
      size: 4,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
    });
    assert.equal(room.strokes.length, 1);

    const undone = room.undoStroke();
    assert.equal(undone?.id, 'stroke-1');
    assert.equal(room.strokes.length, 0);

    // Host removal & migration
    const removeResult = room.removePlayer('h1');
    assert.equal(removeResult.removed, true);
    assert.equal(removeResult.newHost?.id, 'g1');
    assert.equal(room.hostId, 'g1');
  });

  it('should normalize custom words and validate room settings', () => {
    const host = new Player('h1', 's-host', 'HostGuy', 'avatar_1', true);
    const room = new Room('TEST02', host, {
      maxPlayers: 20,
      rounds: 10,
      hints: 0,
      customWords: ['  PIZZA  ', 'super-hero']
    });

    assert.equal(room.settings.maxPlayers, 20);
    assert.equal(room.settings.rounds, 10);
    assert.equal(room.settings.hints, 0);
    assert.deepEqual(room.settings.customWords, ['pizza', 'super-hero']);

    assert.throws(() => new Room('INVALID', host, { hints: -1 }), /hints must be an integer/);
    assert.throws(() => new Room('INVALID', host, { rounds: 2.5 }), /rounds must be an integer/);
    assert.throws(() => new Room('INVALID', host, { wordMode: 'invalid' as any }), /wordMode must be/);
    assert.throws(() => new Room('INVALID', host, { isPrivate: 'true' as any }), /isPrivate must be a boolean/);

    // Prevent settings change when game is in progress
    room.game.phase = 'drawing';
    room.updateSettings({ rounds: 5 });
    assert.equal(room.settings.rounds, 10); // Remains 10
  });

  it('should validate settings before updating a lobby room', () => {
    const host = new Player('h1', 's-host', 'HostGuy', 'avatar_1', true);
    const room = new Room('TEST03', host);

    assert.throws(() => room.updateSettings({ customWords: ['cat', ' CAT '] }), /Duplicate custom word/);
    assert.throws(() => room.updateSettings({ customWords: ['cat', ''] }), /empty entries/);
    assert.throws(() => room.updateSettings({ customWords: ['x'.repeat(31)] }), /2-30 characters/);
    assert.throws(() => room.updateSettings({ customWords: Array(201).fill('word') }), /maximum of 200/);
    assert.throws(() => room.updateSettings({ customWords: ['cat', 'bad<script>'] }), /2-30 characters/);

    room.updateSettings({ hints: 5, customWords: ['  Rocket Ship ', 'space-craft'] });
    assert.equal(room.settings.hints, 5);
    assert.deepEqual(room.settings.customWords, ['rocket ship', 'space-craft']);
  });
});

describe('WordManager', () => {
  it('should validate and normalize custom words', () => {
    const sanitized = WordManager.sanitizeCustomWords(['  Laptop  ', 'space-craft', 'rocket ship']);
    assert.equal(sanitized.length, 3);
    assert.ok(sanitized.includes('laptop'));
    assert.ok(sanitized.includes('space-craft'));
    assert.ok(sanitized.includes('rocket ship'));

    assert.throws(() => WordManager.sanitizeCustomWords(['cat', ' CAT ']), /Duplicate custom word/);
    assert.throws(() => WordManager.sanitizeCustomWords(['cat', '']), /empty entries/);
    assert.throws(() => WordManager.sanitizeCustomWords(['x']), /2-30 characters/);
    assert.throws(() => WordManager.sanitizeCustomWords(['<svg/onload=alert(1)>']), /2-30 characters/);
  });

  it('should prioritize custom words and fallback to default dictionary if needed', () => {
    const wordManager = new WordManager();
    const custom = ['starship', 'quasar'];

    // Request 3 words with only 2 custom words available
    const words = wordManager.getRandomWords(3, undefined, custom);
    assert.equal(words.length, 3);
    assert.ok(words.includes('starship'));
    assert.ok(words.includes('quasar'));

    // Request default words when no custom words provided
    const defaultWords = wordManager.getRandomWords(3);
    assert.equal(defaultWords.length, 3);
    defaultWords.forEach(w => assert.ok(typeof w === 'string' && w.length > 0));
  });
});

describe('RoomManager', () => {
  it('should create and retrieve rooms by ID', () => {
    const manager = RoomManager.getInstance();
    const host = new Player('h1', 's1', 'HostGuy');
    const room = manager.createRoom(host);

    assert.ok(room.id);
    const found = manager.getRoom(room.id);
    assert.equal(found?.id, room.id);

    const bySocket = manager.findRoomBySocketId('s1');
    assert.equal(bySocket?.room.id, room.id);
    assert.equal(bySocket?.player.id, 'h1');
  });
});
