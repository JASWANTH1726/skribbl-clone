import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { createServer, Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { io as createClient, Socket as ClientSocket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@skribbl/shared';
import { RoomManager } from './models/RoomManager.js';
import { setupSocketHandlers, TypedServer } from './socket.js';

type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;
type TestServer = TypedServer;
type RoundStart = Parameters<ServerToClientEvents['round_start']>[0];
type RoundEnd = Parameters<ServerToClientEvents['round_end']>[0];
type ErrorMessage = Parameters<ServerToClientEvents['error_message']>[0];
type SelectedWord = Parameters<ServerToClientEvents['word_selected']>[0];
type GuessResult = Parameters<ServerToClientEvents['guess_result']>[0];

let httpServer: HttpServer;
let socketServer: TestServer;
let serverUrl: string;
const clients: TestClient[] = [];

function waitForEvent<T>(
  socket: TestClient,
  event: 'round_start' | 'round_end' | 'error_message' | 'word_selected',
  timeoutMs = 2000,
  predicate: (data: T) => boolean = () => true
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let lastReceived: T | undefined;
    const timeout = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`Timed out waiting for ${event}; last received: ${JSON.stringify(lastReceived)}.`));
    }, timeoutMs);
    const handler = (data: T) => {
      lastReceived = data;
      if (!predicate(data)) return;
      clearTimeout(timeout);
      socket.off(event, handler as never);
      resolve(data);
    };
    socket.on(event, handler as never);
  });
}

function waitForErrors(socket: TestClient, count: number): Promise<ErrorMessage[]> {
  return new Promise((resolve, reject) => {
    const errors: ErrorMessage[] = [];
    const timeout = setTimeout(() => {
      socket.off('error_message', handler);
      reject(new Error(`Timed out waiting for ${count} error messages.`));
    }, 2000);
    const handler = (message: ErrorMessage) => {
      errors.push(message);
      if (errors.length === count) {
        clearTimeout(timeout);
        socket.off('error_message', handler);
        resolve(errors);
      }
    };
    socket.on('error_message', handler);
  });
}

function waitForGuessResult(socket: TestClient): Promise<GuessResult> {
  return new Promise(resolve => socket.once('guess_result', resolve));
}

function delay(ms = 30): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectClient(): Promise<TestClient> {
  const client = createClient(serverUrl, { forceNew: true, transports: ['websocket'] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connection timed out.')), 2000);
    client.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    client.once('connect_error', reject);
  });
  return client;
}

async function createTestRoom(playerCount = 2): Promise<{
  roomId: string;
  host: TestClient;
  players: TestClient[];
  room: NonNullable<ReturnType<RoomManager['getRoom']>>;
}> {
  const host = await connectClient();
  const createResult = await new Promise<{ success: boolean; roomId?: string; error?: string }>(resolve => {
    host.emit('create_room', { hostName: 'Host', avatar: '🦊' }, resolve);
  });
  assert.equal(createResult.success, true, createResult.error);
  const roomId = createResult.roomId;
  if (typeof roomId !== 'string') throw new Error('Room creation did not return an ID.');

  const players = [host];
  for (let index = 1; index < playerCount; index++) {
    const player = await connectClient();
    const joinResult = await new Promise<{ success: boolean; error?: string }>(resolve => {
      player.emit('join_room', {
        roomId,
        playerName: `Player${index}`,
        avatar: '🐱'
      }, resolve);
    });
    assert.equal(joinResult.success, true, joinResult.error);
    players.push(player);
  }

  const room = RoomManager.getInstance().getRoom(roomId);
  if (!room) throw new Error(`Created room ${roomId} was not found.`);
  return { roomId, host, players, room };
}

async function startRound(host: TestClient): Promise<RoundStart> {
  const roundStart = waitForEvent<RoundStart>(host, 'round_start');
  host.emit('start_game');
  const result = await roundStart;
  assert.ok(result.wordOptions && result.wordOptions.length > 0);
  return result;
}

async function startDrawing(
  host: TestClient,
  roundStart: RoundStart,
  observer: TestClient
): Promise<SelectedWord> {
  const selectedWord = waitForEvent<SelectedWord>(observer, 'word_selected');
  host.emit('word_chosen', { word: roundStart.wordOptions![0] });
  return selectedWord;
}

before(async () => {
  httpServer = createServer();
  socketServer = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    transports: ['websocket']
  });
  setupSocketHandlers(socketServer);
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await delay();
});

after(async () => {
  await new Promise<void>(resolve => socketServer.close(() => resolve()));
});

describe('Socket input validation and game authorization', () => {
  it('rejects malformed room creation and invalid player names', async () => {
    const client = await connectClient();
    const socketId = client.id;
    if (!socketId) throw new Error('Connected client has no socket ID.');
    const response = await new Promise<{ success: boolean; error?: string }>(resolve => {
      client.emit('create_room', { hostName: '   ', avatar: '🦊' } as never, resolve);
    });
    assert.equal(response.success, false);
    assert.ok(response.error);
    assert.equal(RoomManager.getInstance().findRoomBySocketId(socketId), undefined);

    const invalidJoin = await new Promise<{ success: boolean; error?: string }>(resolve => {
      client.emit('join_room', { roomId: 'INVALID', playerName: 'Player' }, resolve);
    });
    assert.equal(invalidJoin.success, false);
    assert.ok(invalidJoin.error);
  });

  it('accepts an offered word only from the active drawer and does not reveal it to guessers', async () => {
    const { host, players, room } = await createTestRoom();
    const round = await startRound(host);
    const observer = players[1];
    const selectedPromise = waitForEvent<SelectedWord>(observer, 'word_selected');
    host.emit('word_chosen', { word: round.wordOptions![0] });

    const selected = await selectedPromise;
    assert.equal(room.game.phase, 'drawing');
    assert.equal(room.game.currentWord, round.wordOptions![0]);
    assert.equal(selected.wordLength, round.wordOptions![0].length);
    assert.equal('word' in selected, false);
    assert.equal(JSON.stringify(selected).includes(round.wordOptions![0]), false);
  });

  it('rejects a word that was not offered without corrupting selection state', async () => {
    const { host, room } = await createTestRoom();
    const round = await startRound(host);
    const invalidError = waitForEvent<ErrorMessage>(host, 'error_message');
    host.emit('word_chosen', { word: 'not-an-offered-word' });
    assert.match((await invalidError).message, /offered/i);
    assert.equal(room.game.phase, 'word_select');
    assert.equal(room.game.currentWord, null);

    const selectedPromise = waitForEvent<SelectedWord>(host, 'word_selected');
    host.emit('word_chosen', { word: round.wordOptions![0] });
    await selectedPromise;
    assert.equal(room.game.phase, 'drawing');
    assert.equal(room.game.currentWord, round.wordOptions![0]);
  });

  it('rejects word selection by a non-drawer', async () => {
    const { host, players, room } = await createTestRoom();
    const round = await startRound(host);
    const nonDrawer = players[1];
    const error = waitForEvent<ErrorMessage>(nonDrawer, 'error_message');
    nonDrawer.emit('word_chosen', { word: round.wordOptions![0] });
    assert.match((await error).message, /active drawer/i);
    assert.equal(room.game.phase, 'word_select');
    assert.equal(room.game.currentWord, null);
  });

  it('rejects word selection outside the word-select phase without changing the chosen word', async () => {
    const { host, room } = await createTestRoom();
    const round = await startRound(host);
    const observer = waitForEvent<SelectedWord>(host, 'word_selected');
    host.emit('word_chosen', { word: round.wordOptions![0] });
    await observer;
    const chosenWord = room.game.currentWord;

    const error = waitForEvent<ErrorMessage>(host, 'error_message');
    host.emit('word_chosen', { word: round.wordOptions![1] || round.wordOptions![0] });
    assert.match((await error).message, /only be selected/i);
    assert.equal(room.game.phase, 'drawing');
    assert.equal(room.game.currentWord, chosenWord);
  });

  it('ends and advances the turn when the drawer disconnects during word selection', async () => {
    const { host, players, room } = await createTestRoom();
    await startRound(host);
    const survivor = players[1];
    const departingDrawerId = room.game.drawerId;
    const roundEnded = waitForEvent<RoundEnd>(survivor, 'round_end');
    const nextRoundStart = waitForEvent<RoundStart>(
      survivor,
      'round_start',
      6000,
      data => data.drawerId !== departingDrawerId
    );

    host.disconnect();

    assert.equal((await roundEnded).reason, 'drawer_left');
    assert.equal(room.game.phase, 'round_end');
    const nextTurn = await nextRoundStart;
    const remainingPlayer = Array.from(room.players.values())[0];
    assert.ok(remainingPlayer);
    assert.equal(nextTurn.drawerId, remainingPlayer.id);
    assert.equal(room.game.phase, 'word_select');
    assert.equal(room.game.currentWord, null);
  });

  it('ends and advances the turn when the drawer disconnects during drawing', async () => {
    const { host, players, room } = await createTestRoom();
    const round = await startRound(host);
    await startDrawing(host, round, players[1]);
    const survivor = players[1];
    const departingDrawerId = room.game.drawerId;
    let roundEndCount = 0;
    survivor.on('round_end', () => { roundEndCount++; });
    const roundEnded = waitForEvent<RoundEnd>(survivor, 'round_end');
    const nextRoundStart = waitForEvent<RoundStart>(
      survivor,
      'round_start',
      6000,
      data => data.drawerId !== departingDrawerId
    );

    host.disconnect();

    assert.equal((await roundEnded).reason, 'drawer_left');
    assert.equal(room.game.phase, 'round_end');
    const nextTurn = await nextRoundStart;
    await delay();
    const remainingPlayer = Array.from(room.players.values())[0];
    assert.ok(remainingPlayer);
    assert.equal(nextTurn.drawerId, remainingPlayer.id);
    assert.equal(room.game.phase, 'word_select');
    assert.equal(room.game.currentWord, null);
    assert.equal(roundEndCount, 1);
  });

  it('rejects malformed drawing payloads without adding strokes', async () => {
    const { host, room } = await createTestRoom();
    const round = await startRound(host);
    await startDrawing(host, round, host);

    const invalidPayloads = [
      { x: Number.NaN, y: 0.5, color: '#000000', size: 6 },
      { x: 0.5, y: 0.5, color: 'red', size: 6 },
      { x: 0.5, y: 0.5, color: '#000000', size: 5 },
      { x: 0.5, y: 0.5, color: '#000000', size: 6, tool: 'spray' },
      { x: 0.5, y: 0.5, color: '#000000', size: 6, extra: true }
    ];
    const errors = waitForErrors(host, invalidPayloads.length);
    for (const payload of invalidPayloads) host.emit('draw_start', payload as never);
    await errors;
    assert.equal(room.strokes.length, 0);
  });

  it('prevents non-drawers from drawing, undoing, or clearing strokes', async () => {
    const { host, players, room } = await createTestRoom();
    const round = await startRound(host);
    const nonDrawer = players[1];
    await startDrawing(host, round, nonDrawer);

    host.emit('draw_start', { x: 0.1, y: 0.2, color: '#000000', size: 6 });
    host.emit('draw_move', { x: 0.3, y: 0.4 });
    host.emit('draw_end');
    await delay();
    assert.equal(room.strokes.length, 1);
    const strokeBefore = structuredClone(room.strokes[0]);

    const errors = waitForErrors(nonDrawer, 5);
    nonDrawer.emit('draw_start', { x: 0.5, y: 0.5, color: '#000000', size: 6 });
    nonDrawer.emit('draw_move', { x: 0.6, y: 0.6 });
    nonDrawer.emit('draw_end');
    nonDrawer.emit('draw_undo');
    nonDrawer.emit('canvas_clear');
    await errors;

    assert.deepEqual(room.strokes, [strokeBefore]);
  });

  it('rejects oversized guesses and chat messages', async () => {
    const { host, players, room } = await createTestRoom();
    const round = await startRound(host);
    await startDrawing(host, round, host);
    const guesser = players[1];

    const errors = waitForErrors(guesser, 2);
    guesser.emit('guess', { text: 'x'.repeat(51) });
    guesser.emit('chat', { text: 'y'.repeat(51) });
    await errors;
    assert.equal(room.players.get(room.game.drawerId!)?.score, 0);
    assert.equal(room.players.get(Array.from(room.players.keys()).find(id => id !== room.game.drawerId)!)?.score, 0);
    assert.equal(room.players.get(Array.from(room.players.keys()).find(id => id !== room.game.drawerId)!)?.hasGuessed, false);
  });

  it('scores a correct guess once and rejects repeated correct guesses', async () => {
    const { host, players, room } = await createTestRoom(3);
    const round = await startRound(host);
    const firstGuesser = players[1];
    await startDrawing(host, round, firstGuesser);

    const correctResult = waitForGuessResult(firstGuesser);
    firstGuesser.emit('guess', { text: round.wordOptions![0] });
    assert.equal((await correctResult).correct, true);
    const firstPlayerId = Array.from(room.players.values()).find(player => player.socketId === firstGuesser.id)!.id;
    const firstScore = room.players.get(firstPlayerId)!.score;
    assert.ok(firstScore > 0);
    assert.equal(room.players.get(firstPlayerId)!.hasGuessed, true);

    const error = waitForEvent<ErrorMessage>(firstGuesser, 'error_message');
    firstGuesser.emit('guess', { text: round.wordOptions![0] });
    await error;
    assert.equal(room.players.get(firstPlayerId)!.score, firstScore);
  });
});
