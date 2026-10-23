import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ChatMessage,
  ClientToServerEvents,
  DrawStroke,
  GameState,
  LeaderboardEntry,
  ServerToClientEvents
} from '@skribbl/shared';
import { RoomManager } from './models/RoomManager.js';
import { Player } from './models/Player.js';
import { Room } from './models/Room.js';
import { WordManager } from './models/WordManager.js';

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

const wordManager = new WordManager();
const activeTimers: Map<string, NodeJS.Timeout> = new Map();
const rateLimits = new Map<string, Map<string, { windowStartedAt: number; count: number }>>();
const ROOM_ID_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const PLAYER_NAME_MAX_LENGTH = 16;
const MESSAGE_MAX_LENGTH = 50;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const AVATARS = new Set(['🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🐵', '🦄']);
const MAX_STROKE_POINTS = 1000;
const MAX_ROOM_STROKES = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function isValidName(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= PLAYER_NAME_MAX_LENGTH
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidAvatar(value: unknown): value is string {
  return value === undefined || (typeof value === 'string' && AVATARS.has(value));
}

function isValidPoint(value: unknown): value is { x: number; y: number } {
  return isRecord(value)
    && hasOnlyKeys(value, ['x', 'y'])
    && typeof value.x === 'number'
    && Number.isFinite(value.x)
    && value.x >= 0
    && value.x <= 1
    && typeof value.y === 'number'
    && Number.isFinite(value.y)
    && value.y >= 0
    && value.y <= 1;
}

function consumeRateLimit(socketId: string, event: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let socketLimits = rateLimits.get(socketId);
  if (!socketLimits) {
    socketLimits = new Map();
    rateLimits.set(socketId, socketLimits);
  }

  const current = socketLimits.get(event);
  if (!current || now - current.windowStartedAt >= windowMs) {
    socketLimits.set(event, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

function clearRoomTimer(roomId: string) {
  const existing = activeTimers.get(roomId);
  if (existing) {
    clearInterval(existing);
    activeTimers.delete(roomId);
  }
}

export function setupSocketHandlers(io: TypedServer): void {
  const roomManager = RoomManager.getInstance();

  function startTurn(room: Room) {
    clearRoomTimer(room.id);
    room.clearCanvas();
    io.to(room.id).emit('canvas_clear');

    const { hasNext, drawer } = room.game.nextTurn(room.players);

    if (!hasNext || !drawer) {
      endGame(room);
      return;
    }

    const words = wordManager.getRandomWords(room.settings.wordCount || 3, undefined, room.settings.customWords);
    room.game.wordOptions = words;
    room.game.phase = 'word_select';
    room.game.timeLeft = 15; // 15s to choose a word

    // Emit round_start with word options ONLY to drawer
    const drawerSocket = io.sockets.sockets.get(drawer.socketId);
    if (drawerSocket) {
      drawerSocket.emit('round_start', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        drawTime: room.game.drawTime,
        wordOptions: words
      });
    }

    // Emit round_start without word options to guessers
    drawerSocket?.to(room.id).emit('round_start', {
      drawerId: drawer.id,
      drawerName: drawer.name,
      round: room.game.currentRound,
      totalRounds: room.game.totalRounds,
      drawTime: room.game.drawTime
    });

    emitGameState(room);
    io.to(room.id).emit('players_updated', room.getPlayersList());

    // 15-second timer for drawer word selection
    let selectSeconds = 15;
    const selectTimer = setInterval(() => {
      selectSeconds--;
      room.game.timeLeft = selectSeconds;
      emitGameState(room);

      if (selectSeconds <= 0) {
        clearInterval(selectTimer);
        // Auto-select first word if drawer didn't pick
        if (room.game.phase === 'word_select') {
          const autoWord = words[0];
          if (!autoWord || !startDrawingPhase(room, autoWord)) endRound(room, 'drawer_left');
        }
      }
    }, 1000);

    activeTimers.set(room.id, selectTimer);
  }

  function startDrawingPhase(room: Room, word: string): boolean {
    const drawerId = room.game.drawerId;
    const drawer = drawerId ? room.players.get(drawerId) : undefined;
    if (room.game.phase !== 'word_select'
      || !drawer
      || !io.sockets.sockets.has(drawer.socketId)) {
      return false;
    }
    if (!room.game.setChosenWord(word)) return false;
    clearRoomTimer(room.id);

    // Notify all players of word length and masked representation
    io.to(room.id).emit('word_selected', {
      drawerId: room.game.drawerId || '',
      wordLength: word.length,
      maskedWord: room.game.maskedWord
    });

    emitGameState(room);

    // Start drawing round countdown timer
    const totalTime = room.game.drawTime;
    let nextHintNumber = 1;

    const roundTimer = setInterval(() => {
      room.game.timeLeft--;

      if (room.settings.hints > 0) {
        const elapsedTime = totalTime - room.game.timeLeft;
        while (nextHintNumber <= room.settings.hints
          && elapsedTime >= totalTime * nextHintNumber / (room.settings.hints + 1)) {
          if (!room.game.revealHint()) {
            nextHintNumber = room.settings.hints + 1;
            break;
          }
          nextHintNumber++;
        }
      }

      emitGameState(room);

      if (room.game.timeLeft <= 0) {
        endRound(room, 'timeout');
      }
    }, 1000);

    activeTimers.set(room.id, roundTimer);
    return true;
  }

  function endRound(room: Room, reason: 'timeout' | 'all_guessed' | 'drawer_left') {
    if (room.game.phase !== 'word_select' && room.game.phase !== 'drawing') return;
    clearRoomTimer(room.id);
    room.game.phase = 'round_end';

    const scoresRecord: Record<string, number> = {};
    room.players.forEach(p => {
      scoresRecord[p.id] = p.score;
    });

    const targetWord = room.game.currentWord || '';

    io.to(room.id).emit('round_end', {
      word: targetWord,
      scores: scoresRecord,
      reason
    });

    emitGameState(room);
    io.to(room.id).emit('players_updated', room.getPlayersList());

    // 4 seconds preview, then next turn
    const pauseTimer = setTimeout(() => {
      startTurn(room);
    }, 4000);

    activeTimers.set(room.id, pauseTimer);
  }

  function endGame(room: Room) {
    clearRoomTimer(room.id);
    room.game.phase = 'game_over';

    const leaderboard = room.game.getLeaderboard(room.players);
    const winner = leaderboard[0] || {
      playerId: '',
      name: 'Nobody',
      avatar: 'avatar_1',
      score: 0,
      rank: 1
    };

    io.to(room.id).emit('game_over', {
      winner,
      leaderboard
    });

    emitGameState(room);
  }

  function emitGameState(room: Room) {
    io.to(room.id).emit('game_state', room.game.toJSON(room.id, room.players));
  }

  function reject(socket: TypedSocket, message: string): void {
    socket.emit('error_message', { message });
  }

  io.on('connection', (socket: TypedSocket) => {
    // Ping check
    socket.on('ping_check', (timestamp, callback) => {
      if (typeof timestamp === 'number' && Number.isFinite(timestamp) && typeof callback === 'function') {
        callback(timestamp);
      }
    });

    // 1. Create Room
    socket.on('create_room', (payload, callback) => {
      if (!isRecord(payload)
        || !hasOnlyKeys(payload, ['hostName', 'avatar', 'settings'])
        || !isValidName(payload.hostName)
        || !isValidAvatar(payload.avatar)
        || (payload.settings !== undefined && !isRecord(payload.settings))) {
        callback?.({ success: false, error: 'Invalid room creation details.' });
        return;
      }
      if (roomManager.findRoomBySocketId(socket.id)) {
        callback?.({ success: false, error: 'Leave your current room before creating another.' });
        return;
      }

      try {
        const playerId = `p_${socket.id.substring(0, 6)}`;
        const host = new Player(playerId, socket.id, payload.hostName.trim(), payload.avatar || '🦊', true);
        const room = roomManager.createRoom(host, payload.settings);

        socket.join(room.id);

        callback?.({ success: true, roomId: room.id });

        socket.emit('room_settings_updated', room.settings);
        io.to(room.id).emit('player_joined', {
          player: host.toJSON(),
          players: room.getPlayersList()
        });
        emitGameState(room);
      } catch {
        callback?.({ success: false, error: 'Invalid room creation details.' });
      }
    });

    // 2. Join Room
    socket.on('join_room', (payload, callback) => {
      if (!isRecord(payload)
        || !hasOnlyKeys(payload, ['roomId', 'playerName', 'avatar'])
        || typeof payload.roomId !== 'string'
        || !ROOM_ID_PATTERN.test(payload.roomId)
        || !isValidName(payload.playerName)
        || !isValidAvatar(payload.avatar)) {
        callback?.({ success: false, error: 'Invalid room join details.' });
        return;
      }
      if (roomManager.findRoomBySocketId(socket.id)) {
        callback?.({ success: false, error: 'Leave your current room before joining another.' });
        return;
      }
      const room = roomManager.getRoom(payload.roomId);
      if (!room) {
        callback?.({ success: false, error: 'Room not found. Check the code and try again.' });
        return;
      }

      if (room.players.size >= room.settings.maxPlayers) {
        callback?.({ success: false, error: 'Room is full.' });
        return;
      }

      const playerId = `p_${socket.id.substring(0, 6)}`;
      const player = new Player(playerId, socket.id, payload.playerName.trim(), payload.avatar || '🦊', false);

      const added = room.addPlayer(player);
      if (!added) {
        callback?.({ success: false, error: 'Could not join room.' });
        return;
      }

      socket.join(room.id);

      callback?.({
        success: true,
        room: {
          id: room.id,
          settings: room.settings,
          players: room.getPlayersList()
        }
      });

      io.to(room.id).emit('player_joined', {
        player: player.toJSON(),
        players: room.getPlayersList()
      });

      emitGameState(room);

      // Synchronize existing drawing strokes to late joiner
      if (room.strokes.length > 0) {
        socket.emit('canvas_sync', room.strokes);
      }
    });

    // 3. Ready Toggle
    socket.on('set_ready', (isReady) => {
      if (typeof isReady !== 'boolean') {
        reject(socket, 'Ready status must be a boolean.');
        return;
      }
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'lobby') {
        reject(socket, 'Ready status can only be changed in the lobby.');
        return;
      }
      player.isReady = isReady;
      io.to(room.id).emit('players_updated', room.getPlayersList());
    });

    // 4. Update Settings (Host only)
    socket.on('update_settings', (newSettings) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.hostId !== player.id) {
        socket.emit('error_message', { message: 'Only the room host can modify settings.' });
        return;
      }
      if (room.game.phase !== 'lobby' || !isRecord(newSettings)) {
        reject(socket, 'Room settings can only be changed in the lobby.');
        return;
      }
      try {
        room.updateSettings(newSettings);
        io.to(room.id).emit('room_settings_updated', room.settings);
      } catch (err) {
        socket.emit('error_message', {
          message: err instanceof Error ? err.message : 'Invalid room settings.'
        });
      }
    });

    // 5. Start Game (Host only)
    socket.on('start_game', (payload?: unknown) => {
      if (payload !== undefined) {
        reject(socket, 'Invalid game start request.');
        return;
      }
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.hostId !== player.id) {
        reject(socket, 'Only the room host can start the game.');
        return;
      }
      if (room.game.phase !== 'lobby') {
        reject(socket, 'The game has already started.');
        return;
      }
      if (room.players.size < 2) {
        reject(socket, 'Need at least 2 players to start!');
        return;
      }

      room.game.initGame(Array.from(room.players.values()));
      startTurn(room);
    });

    // 6. Word Chosen (Drawer only)
    socket.on('word_chosen', (payload) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (!isRecord(payload) || !hasOnlyKeys(payload, ['word']) || typeof payload.word !== 'string') {
        reject(socket, 'Invalid word selection.');
        return;
      }
      if (room.game.phase !== 'word_select') {
        reject(socket, 'Words can only be selected during word selection.');
        return;
      }
      if (room.game.drawerId !== player.id) {
        reject(socket, 'Only the active drawer can select a word.');
        return;
      }
      const word = payload.word.trim().toLowerCase();
      if (payload.word.length > 30 || word.length === 0 || !room.game.wordOptions.includes(word)) {
        reject(socket, 'Select one of the words offered by the server.');
        return;
      }

      if (!startDrawingPhase(room, word)) reject(socket, 'The word selection is no longer valid.');
    });

    // 7. Drawing Events
    let currentStroke: DrawStroke | null = null;

    socket.on('draw_start', (data) => {
      if (!consumeRateLimit(socket.id, 'draw_start', 30, 1000)) return;
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (!isRecord(data)
        || !hasOnlyKeys(data, ['x', 'y', 'color', 'size', 'tool'])
        || !isValidPoint({ x: data.x, y: data.y })
        || typeof data.color !== 'string'
        || !HEX_COLOR_PATTERN.test(data.color)
        || typeof data.size !== 'number'
        || ![3, 6, 12, 24].includes(data.size)
        || (data.tool !== undefined && data.tool !== 'brush' && data.tool !== 'eraser')) {
        reject(socket, 'Invalid drawing stroke.');
        return;
      }
      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) {
        reject(socket, 'Only the active drawer can draw.');
        return;
      }
      if (room.strokes.length >= MAX_ROOM_STROKES) {
        reject(socket, 'The drawing has reached its stroke limit.');
        return;
      }

      currentStroke = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tool: data.tool || 'brush',
        color: data.color,
        size: data.size,
        points: [{ x: data.x, y: data.y }]
      };

      room.addStroke(currentStroke);
      socket.to(room.id).emit('draw_start', data);
    });

    socket.on('draw_move', (data) => {
      if (!consumeRateLimit(socket.id, 'draw_move', 120, 1000)) return;
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (!isValidPoint(data)) {
        reject(socket, 'Invalid drawing coordinates.');
        return;
      }
      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id || !currentStroke) {
        reject(socket, 'Only the active drawer can draw.');
        return;
      }

      if (currentStroke.points.length >= MAX_STROKE_POINTS) {
        reject(socket, 'The stroke has reached its point limit.');
        return;
      }

      currentStroke.points.push({ x: data.x, y: data.y });
      socket.to(room.id).emit('draw_move', data);
    });

    socket.on('draw_end', (payload?: unknown) => {
      if (!consumeRateLimit(socket.id, 'draw_control', 30, 1000)) return;
      if (payload !== undefined) {
        reject(socket, 'Invalid stroke completion request.');
        return;
      }
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) {
        reject(socket, 'Only the active drawer can finish a stroke.');
        return;
      }

      if (currentStroke) {
        io.to(room.id).emit('draw_data', currentStroke);
        currentStroke = null;
      }
      socket.to(room.id).emit('draw_end');
    });

    socket.on('canvas_clear', (payload?: unknown) => {
      if (!consumeRateLimit(socket.id, 'draw_control', 30, 1000)) return;
      if (payload !== undefined) {
        reject(socket, 'Invalid canvas clear request.');
        return;
      }
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) {
        reject(socket, 'Only the active drawer can clear the canvas.');
        return;
      }

      room.clearCanvas();
      currentStroke = null;
      io.to(room.id).emit('canvas_clear');
    });

    socket.on('draw_undo', (payload?: unknown) => {
      if (!consumeRateLimit(socket.id, 'draw_control', 30, 1000)) return;
      if (payload !== undefined) {
        reject(socket, 'Invalid undo request.');
        return;
      }
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) {
        reject(socket, 'Only the active drawer can undo strokes.');
        return;
      }

      currentStroke = null;
      room.undoStroke();
      io.to(room.id).emit('canvas_sync', room.strokes);
    });

    // 8. Chat & Guessing Engine
    function receiveTextMessage(payload: unknown, isChat: boolean): void {
      if (!consumeRateLimit(socket.id, 'text_message', 10, 5000)) return;
      if (!isRecord(payload)
        || !hasOnlyKeys(payload, ['text'])
        || typeof payload.text !== 'string'
        || payload.text.length > MESSAGE_MAX_LENGTH
        || payload.text.trim().length === 0
        || payload.text.trim().length > MESSAGE_MAX_LENGTH
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(payload.text)) {
        reject(socket, 'Messages must contain 1 to 50 valid characters.');
        return;
      }

      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;
      const trimmed = payload.text.trim();

      if (room.game.phase === 'drawing') {
        if (player.id === room.game.drawerId) {
          reject(socket, 'The drawer cannot chat or guess during their turn.');
          return;
        }
        if (room.game.checkWord(trimmed).isCorrect) {
          if (isChat || player.hasGuessed) {
            reject(socket, 'Submit the word as a guess.');
            return;
          }
        }
      }

      if (isChat || room.game.phase !== 'drawing' || player.hasGuessed) {
        const message: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        };
        if (room.game.phase === 'drawing' && player.hasGuessed) socket.emit('chat_message', message);
        else io.to(room.id).emit('chat_message', message);
        return;
      }

      const check = room.game.checkWord(trimmed);
      if (check.isCorrect) {
        player.hasGuessed = true;
        const guesserPoints = room.game.calculateGuessPoints();
        player.addScore(guesserPoints);

        const drawer = room.game.drawerId ? room.players.get(room.game.drawerId) : null;
        if (drawer) drawer.addScore(Math.round(guesserPoints / 2));

        io.to(room.id).emit('guess_result', {
          correct: true,
          playerId: player.id,
          playerName: player.name,
          points: guesserPoints
        });
        io.to(room.id).emit('chat_message', {
          id: `sys_${Date.now()}`,
          text: `${player.name} guessed the word!`,
          type: 'correct',
          timestamp: Date.now()
        });
        io.to(room.id).emit('players_updated', room.getPlayersList());
        emitGameState(room);

        if (room.allGuessedExceptDrawer()) endRound(room, 'all_guessed');
      } else if (check.isClose) {
        socket.emit('guess_result', {
          correct: false,
          isClose: true,
          playerId: player.id,
          playerName: player.name
        });
        io.to(room.id).emit('chat_message', {
          id: `msg_${Date.now()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'guess',
          timestamp: Date.now()
        });
      } else {
        io.to(room.id).emit('chat_message', {
          id: `msg_${Date.now()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        });
      }
    }

    socket.on('guess', payload => receiveTextMessage(payload, false));
    socket.on('chat', payload => receiveTextMessage(payload, true));

    // 9. Disconnect handling
    socket.on('disconnect', () => {
      rateLimits.delete(socket.id);
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      const wasDrawing = room.game.drawerId === player.id;
      const result = room.removePlayer(player.id);

      if (result.removed) {
        socket.leave(room.id);
        io.to(room.id).emit('player_left', {
          playerId: player.id,
          players: room.getPlayersList()
        });

        if (result.newHost) {
          io.to(room.id).emit('chat_message', {
            id: `sys_${Date.now()}`,
            text: `${result.newHost.name} is now the host.`,
            type: 'system',
            timestamp: Date.now()
          });
        }

        if (room.isEmpty()) {
          clearRoomTimer(room.id);
          roomManager.removeRoom(room.id);
        } else if (wasDrawing && (room.game.phase === 'word_select' || room.game.phase === 'drawing')) {
          currentStroke = null;
          endRound(room, 'drawer_left');
        }
      }
    });
  });
}
