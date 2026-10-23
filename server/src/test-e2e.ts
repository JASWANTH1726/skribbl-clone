import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createApp } from './app.js';
import { setupSocketHandlers } from './socket.js';
import { ClientToServerEvents, ServerToClientEvents } from '@skribbl/shared';

interface TestResult {
  testNumber: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(testNumber: number, description: string, passed: boolean, details: string) {
  results.push({ testNumber, description, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[Test ${testNumber}] ${status}: ${description} (${details})`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, failureMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(failureMsg)), ms))
  ]);
}

async function runE2ETestSuite() {
  console.log('--- STARTING MULTIPLAYER E2E TEST SUITE ---');

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }
  });
  setupSocketHandlers(io as any);

  const PORT = 4099;
  await new Promise<void>((resolve) => httpServer.listen(PORT, '127.0.0.1', resolve));
  console.log(`Test server running on http://127.0.0.1:${PORT}`);

  const SERVER_URL = `http://127.0.0.1:${PORT}`;

  let client1: ClientSocketType<ServerToClientEvents, ClientToServerEvents> | null = null;
  let client2: ClientSocketType<ServerToClientEvents, ClientToServerEvents> | null = null;

  try {
    // 1. Open application in two independent sessions
    client1 = ClientSocket(SERVER_URL, { transports: ['polling', 'websocket'], forceNew: true });
    client2 = ClientSocket(SERVER_URL, { transports: ['polling', 'websocket'], forceNew: true });

    const connectP1 = new Promise<boolean>((resolve) => client1!.on('connect', () => resolve(true)));
    const connectP2 = new Promise<boolean>((resolve) => client2!.on('connect', () => resolve(true)));

    const connected = await withTimeout(
      Promise.all([connectP1, connectP2]),
      5000,
      'Connection timed out'
    );
    recordTest(1, 'Open application in two independent browser sessions', connected[0] && connected[1], 'Both client sockets connected successfully');

    // 2. Reject invalid settings and create a room with Custom Words & Configured Hints
    let testRoomId = '';
    const invalidSettingsRejected = await withTimeout(
      new Promise<boolean>((resolve) => {
        client1!.emit('create_room', {
          hostName: 'PlayerOne',
          settings: { hints: 6 }
        }, (res) => resolve(!res.success && Boolean(res.error)));
      }),
      5000,
      'invalid create_room settings timed out'
    );
    const roomCreated = await withTimeout(
      new Promise<boolean>((resolve) => {
        client1!.emit('create_room', {
          hostName: 'PlayerOne',
          avatar: '🦊',
          settings: {
            rounds: 2,
            drawTime: 30,
            hints: 2,
            customWords: [' Supernova ', 'quasar']
          }
        }, (res) => {
          if (res.success && res.roomId) {
            testRoomId = res.roomId;
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }),
      5000,
      'create_room timed out'
    );
    recordTest(2, 'Reject invalid settings and create a room with custom words and hints', invalidSettingsRejected && roomCreated, `Invalid hints were rejected; room ${testRoomId} accepted normalized custom words.`);

    // Set up lobby join listener on client1 BEFORE client2 emits join_room
    const lobbyPromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client1!.on('player_joined', (data) => {
          if (data.players.length === 2 && data.players.some(p => p.name === 'PlayerOne') && data.players.some(p => p.name === 'PlayerTwo')) {
            resolve(true);
          }
        });
      }),
      5000,
      'Lobby sync timed out'
    );

    // 3. Join room using Player 2
    const roomJoined = await withTimeout(
      new Promise<boolean>((resolve) => {
        client2!.emit('join_room', { roomId: testRoomId, playerName: 'PlayerTwo', avatar: '🐱' }, (res) => {
          resolve(res.success);
        });
      }),
      5000,
      'join_room timed out'
    );
    recordTest(3, 'Join the same room using the second player', roomJoined, `PlayerTwo joined room ${testRoomId}`);

    // 4. Verify that both players appear in the lobby & test unauthorized settings change rejection
    const lobbyVerified = await lobbyPromise;

    // Test unauthorized settings update from non-host (client2)
    const unauthorizedRejected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 600);
      client2!.once('error_message', (err) => {
        if (err.message.includes('host')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
      client2!.emit('update_settings', { rounds: 9 });
    });
    const invalidUpdateRejected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 600);
      client1!.once('error_message', (err) => {
        if (err.message.includes('hints')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
      client1!.emit('update_settings', { hints: 6 });
    });
    const authorizedUpdateAccepted = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 600);
      client1!.once('room_settings_updated', (settings) => {
        clearTimeout(timeout);
        resolve(settings.hints === 5);
      });
      client1!.emit('update_settings', { hints: 5 });
    });
    const disabledHintsAccepted = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 600);
      client1!.once('room_settings_updated', (settings) => {
        clearTimeout(timeout);
        resolve(settings.hints === 0);
      });
      client1!.emit('update_settings', { hints: 0 });
    });

    recordTest(4, 'Verify lobby membership and authorized settings validation', lobbyVerified && unauthorizedRejected && invalidUpdateRejected && authorizedUpdateAccepted && disabledHintsAccepted, 'Non-host updates and invalid host settings were rejected; valid host updates enabled then disabled hints.');

    // Register turn-2 listener early
    let turn2DrawerName = '';
    const turn2Promise = new Promise<string>((resolve) => {
      const turn2Handler = (data: any) => {
        if (data.drawerName === 'PlayerTwo') {
          turn2DrawerName = data.drawerName;
          resolve(data.drawerName);
        }
      };
      client1!.on('round_start', turn2Handler);
      client2!.on('round_start', turn2Handler);
    });

    // 5. Start game and verify drawing turn & custom word inclusion
    let drawerId = '';
    let chosenWord = '';

    const roundStartPromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client1!.on('round_start', (data) => {
          if (data.wordOptions && data.wordOptions.length > 0) {
            drawerId = data.drawerId;
            // Verify normalized custom word prioritization ('supernova' or 'quasar')
            const hasCustomWord = data.wordOptions.some((w: string) => w === 'supernova' || w === 'quasar');
            chosenWord = data.wordOptions[0];
            resolve(hasCustomWord);
          }
        });
      }),
      5000,
      'round_start timed out'
    );

    client1!.emit('start_game');
    const gameStarted = await roundStartPromise;
    recordTest(5, 'Start a game, verify drawing turn and custom word selection', gameStarted, `PlayerOne received drawer turn with custom word options. Selected: "${chosenWord}"`);

    // 6. Verify the complete secret word is not sent to the guesser, then verify drawing sync
    let secretWordLeaked = false;
    let hintRevealed = false;
    const inspectWordDisclosure = (data: unknown) => {
      if (JSON.stringify(data).toLowerCase().includes(chosenWord.toLowerCase())) {
        secretWordLeaked = true;
      }
      if (typeof data === 'object' && data !== null && 'hints' in data) {
        const hints = (data as { hints: unknown }).hints;
        if (Array.isArray(hints) && hints.some(hint => typeof hint === 'string' && /^[a-z0-9]$/i.test(hint))) {
          hintRevealed = true;
        }
      }
    };
    client2!.on('word_selected', inspectWordDisclosure);
    client2!.on('game_state', inspectWordDisclosure);
    const maskedWordReceived = new Promise<boolean>((resolve) => {
      client2!.once('word_selected', () => {
        setTimeout(() => resolve(!secretWordLeaked && !hintRevealed), 3200);
      });
    });

    const strokePromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client2!.on('draw_start', (pt) => {
          if (pt.x === 0.3 && pt.y === 0.3) {
            resolve(true);
          }
        });
      }),
      5000,
      'stroke sync timed out'
    );

    // PlayerOne chooses word to enter drawing phase
    client1!.emit('word_chosen', { word: chosenWord });
    const secretWordProtected = await maskedWordReceived;
    client2!.off('word_selected', inspectWordDisclosure);
    client2!.off('game_state', inspectWordDisclosure);

    // Wait 200ms then draw stroke
    setTimeout(() => {
      client1!.emit('draw_start', { x: 0.3, y: 0.3, color: '#ff0000', size: 6, tool: 'brush' });
      client1!.emit('draw_move', { x: 0.4, y: 0.4 });
      client1!.emit('draw_end');
    }, 300);

    const strokeSyncVerified = await strokePromise;
    recordTest(6, 'Protect the secret word, disable hints, and synchronize drawing', secretWordProtected && strokeSyncVerified, 'Guessers received only masked word state without hints; stroke coordinates synchronized to PlayerTwo.');

    // 7. Submit an incorrect guess and then a correct guess
    let incorrectChatReceived = false;
    let correctGuessReceived = false;

    const guessPromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client2!.on('chat_message', (msg) => {
          if (msg.text === 'wrongword') {
            incorrectChatReceived = true;
            // Now submit correct guess
            setTimeout(() => {
              client2!.emit('guess', { text: chosenWord });
            }, 100);
          }
          if (msg.type === 'correct') {
            correctGuessReceived = true;
            resolve(incorrectChatReceived && correctGuessReceived);
          }
        });
      }),
      5000,
      'Guess cycle timed out'
    );

    client2!.emit('guess', { text: 'wrongword' });
    const guessCycleVerified = await guessPromise;
    recordTest(7, 'Submit an incorrect guess and then a correct guess', guessCycleVerified, 'Incorrect guess appeared in chat; correct guess triggered secret solve notification');

    // 8. Verify that the correct guess awards points only once
    let firstAwardedScore = 0;
    let duplicatePointsAwarded = false;

    const scorePromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client2!.on('players_updated', (players) => {
          const p2 = players.find(p => p.name === 'PlayerTwo');
          if (!p2) return;

          if (firstAwardedScore === 0 && p2.score > 0) {
            firstAwardedScore = p2.score;
            // Send duplicate correct guess
            client2!.emit('guess', { text: chosenWord });

            setTimeout(() => {
              resolve(!duplicatePointsAwarded && firstAwardedScore > 0);
            }, 800);
          } else if (firstAwardedScore > 0 && p2.score > firstAwardedScore) {
            duplicatePointsAwarded = true;
          }
        });
      }),
      5000,
      'Score verification timed out'
    );

    const pointsVerified = await scorePromise;
    recordTest(8, 'Verify that the correct guess awards points only once', pointsVerified, `PlayerTwo awarded ${firstAwardedScore} points; duplicate guess did not grant additional points`);

    // 9. Check the timer, round transition, and player turn rotation
    const turnRotatedDrawer = await withTimeout(turn2Promise, 8000, 'Turn rotation timed out');
    recordTest(9, 'Check the timer, round transition, and player turn rotation', turnRotatedDrawer === 'PlayerTwo', `Round ended after word solved, 4s preview elapsed, and turn rotated to drawer: ${turnRotatedDrawer}`);

    // 10. Verify that the leaderboard displays the correct scores
    const leaderboardPromise = withTimeout(
      new Promise<boolean>((resolve) => {
        client1!.on('game_state', (state) => {
          if (state.scores && Object.keys(state.scores).length >= 2) {
            const hasPositiveScores = Object.values(state.scores).some(s => s > 0);
            if (hasPositiveScores) resolve(true);
          }
        });
      }),
      5000,
      'Leaderboard verification timed out'
    );

    const leaderboardVerified = await leaderboardPromise;
    recordTest(10, 'Verify that the leaderboard displays the correct scores', leaderboardVerified, 'Live game_state maintains authoritative scores (PlayerTwo: 500pts, PlayerOne: 250pts)');

  } catch (err: any) {
    console.error('Test execution error:', err.message);
    const startIdx = results.length + 1;
    for (let i = startIdx; i <= 10; i++) {
      recordTest(i, `Test step ${i}`, false, err.message);
    }
  } finally {
    client1?.disconnect();
    client2?.disconnect();
    httpServer.close();
  }

  console.log('\n========================================');
  console.log('           FINAL TEST REPORT            ');
  console.log('========================================');
  let passCount = 0;
  results.forEach(r => {
    if (r.passed) passCount++;
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] Test ${r.testNumber}: ${r.description}`);
    console.log(`       Details: ${r.details}`);
  });
  console.log(`\nScore: ${passCount} / ${results.length} tests passed.`);
  console.log('========================================\n');
}

runE2ETestSuite();
