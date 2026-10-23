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
          const autoWord = words[0] || 'apple';
          startDrawingPhase(room, autoWord);
        }
      }
    }, 1000);

    activeTimers.set(room.id, selectTimer);
  }

  function startDrawingPhase(room: Room, word: string) {
    clearRoomTimer(room.id);
    room.game.setChosenWord(word);

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
  }

  function endRound(room: Room, reason: 'timeout' | 'all_guessed' | 'drawer_left') {
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

  io.on('connection', (socket: TypedSocket) => {
    // Ping check
    socket.on('ping_check', (timestamp, callback) => {
      if (typeof callback === 'function') {
        callback(timestamp);
      }
    });

    // 1. Create Room
    socket.on('create_room', ({ hostName, avatar, settings }, callback) => {
      try {
        const playerId = `p_${socket.id.substring(0, 6)}`;
        const host = new Player(playerId, socket.id, hostName || 'Player 1', avatar || 'avatar_1', true);
        const room = roomManager.createRoom(host, settings);

        socket.join(room.id);

        if (typeof callback === 'function') {
          callback({ success: true, roomId: room.id });
        }

        socket.emit('room_settings_updated', room.settings);
        io.to(room.id).emit('player_joined', {
          player: host.toJSON(),
          players: room.getPlayersList()
        });
        emitGameState(room);
      } catch (err: any) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message || 'Failed to create room' });
        }
      }
    });

    // 2. Join Room
    socket.on('join_room', ({ roomId, playerName, avatar }, callback) => {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room not found. Check the code and try again.' });
        }
        return;
      }

      if (room.players.size >= room.settings.maxPlayers) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room is full.' });
        }
        return;
      }

      const playerId = `p_${socket.id.substring(0, 6)}`;
      const player = new Player(playerId, socket.id, playerName || `Player ${room.players.size + 1}`, avatar || 'avatar_1', false);

      const added = room.addPlayer(player);
      if (!added) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Could not join room.' });
        }
        return;
      }

      socket.join(room.id);

      if (typeof callback === 'function') {
        callback({
          success: true,
          room: {
            id: room.id,
            settings: room.settings,
            players: room.getPlayersList()
          }
        });
      }

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
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

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
    socket.on('start_game', () => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (!player.isHost) return;
      if (room.players.size < 2) {
        socket.emit('error_message', { message: 'Need at least 2 players to start!' });
        return;
      }

      room.game.initGame(Array.from(room.players.values()));
      startTurn(room);
    });

    // 6. Word Chosen (Drawer only)
    socket.on('word_chosen', ({ word }) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'word_select') return;
      if (room.game.drawerId !== player.id) return;

      startDrawingPhase(room, word);
    });

    // 7. Drawing Events
    let currentStroke: DrawStroke | null = null;

    socket.on('draw_start', (data) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) return;

      currentStroke = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tool: data.tool || 'brush',
        color: data.color || '#000000',
        size: data.size || 4,
        points: [{ x: data.x, y: data.y }]
      };

      room.addStroke(currentStroke);
      socket.to(room.id).emit('draw_start', data);
    });

    socket.on('draw_move', (data) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) return;

      if (currentStroke) {
        currentStroke.points.push({ x: data.x, y: data.y });
      }

      socket.to(room.id).emit('draw_move', data);
    });

    socket.on('draw_end', () => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) return;

      if (currentStroke) {
        io.to(room.id).emit('draw_data', currentStroke);
        currentStroke = null;
      }
      socket.to(room.id).emit('draw_end');
    });

    socket.on('canvas_clear', () => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) return;

      room.clearCanvas();
      io.to(room.id).emit('canvas_clear');
    });

    socket.on('draw_undo', () => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      if (room.game.phase !== 'drawing' || room.game.drawerId !== player.id) return;

      room.undoStroke();
      io.to(room.id).emit('canvas_sync', room.strokes);
    });

    // 8. Chat & Guessing Engine
    socket.on('guess', ({ text }) => {
      const found = roomManager.findRoomBySocketId(socket.id);
      if (!found) return;
      const { room, player } = found;

      const trimmed = (text || '').trim();
      if (!trimmed) return;

      // If NOT in drawing phase, treat strictly as chat
      if (room.game.phase !== 'drawing') {
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        };
        io.to(room.id).emit('chat_message', msg);
        return;
      }

      // If sender is Drawer: drawer cannot guess!
      if (player.id === room.game.drawerId) {
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        };
        io.to(room.id).emit('chat_message', msg);
        return;
      }

      // If player already guessed the word in this round:
      if (player.hasGuessed) {
        // Broadcast only to other players who have also already guessed
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        };
        socket.emit('chat_message', msg);
        return;
      }

      // Check guess against target word
      const check = room.game.checkWord(trimmed);

      if (check.isCorrect) {
        // Correct guess! (Ensure points awarded only once per round)
        player.hasGuessed = true;
        const guesserPoints = room.game.calculateGuessPoints();
        player.addScore(guesserPoints);

        // Award drawer points
        const drawer = room.game.drawerId ? room.players.get(room.game.drawerId) : null;
        if (drawer) {
          drawer.addScore(Math.round(guesserPoints / 2));
        }

        // Notify room of correct guess without leaking the secret word text
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

        // If everyone has guessed, finish round immediately!
        if (room.allGuessedExceptDrawer()) {
          endRound(room, 'all_guessed');
        }
      } else if (check.isClose) {
        // Send private "close" notification to player
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
        // Normal incorrect guess broadcasted to chat
        io.to(room.id).emit('chat_message', {
          id: `msg_${Date.now()}`,
          playerId: player.id,
          playerName: player.name,
          text: trimmed,
          type: 'chat',
          timestamp: Date.now()
        });
      }
    });

    // 9. Disconnect handling
    socket.on('disconnect', () => {
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
        } else if (wasDrawing && room.game.phase === 'drawing') {
          // Drawer left during round -> advance to next round
          endRound(room, 'drawer_left');
        }
      }
    });
  });
}
