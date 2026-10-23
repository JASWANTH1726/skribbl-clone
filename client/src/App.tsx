import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './context/SocketContext';
import { LogoSplash } from './components/LogoSplash';
import { LoadingScreen } from './components/LoadingScreen';
import { PlayerSetupScreen } from './components/PlayerSetupScreen';
import { HomeView } from './views/HomeView';
import { LobbyView } from './views/LobbyView';
import { GameView } from './views/GameView';
import { GamePhase, PlayerData, RoomSettings, ServerToClientEvents } from '@skribbl/shared';

const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  isPrivate: false
};

export const App: React.FC = () => {
  const { socket, isConnected, latency } = useSocket();

  const [startupStage, setStartupStage] = useState<'splash' | 'loading' | 'player-setup' | 'app'>('splash');
  const [loadingRetryCount, setLoadingRetryCount] = useState<number>(0);
  const [playerName, setPlayerName] = useState<string>('');
  const [playerAvatar, setPlayerAvatar] = useState<string>('🦊');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [roundStartData, setRoundStartData] = useState<Parameters<ServerToClientEvents['round_start']>[0] | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (data: { player: PlayerData; players: PlayerData[] }) => {
      setPlayers(data.players);
    };

    const handlePlayerLeft = (data: { playerId: string; players: PlayerData[] }) => {
      setPlayers(data.players);
    };

    const handlePlayersUpdated = (updatedPlayers: PlayerData[]) => {
      setPlayers(updatedPlayers);
    };

    const handleRoomSettingsUpdated = (settings: RoomSettings) => {
      setRoomSettings(settings);
    };

    const handleGameState = (state: any) => {
      setGamePhase(state.phase);
    };

    const handleRoundStart = (data: Parameters<ServerToClientEvents['round_start']>[0]) => {
      setRoundStartData(data);
      setGamePhase('word_select');
    };

    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('players_updated', handlePlayersUpdated);
    socket.on('room_settings_updated', handleRoomSettingsUpdated);
    socket.on('game_state', handleGameState);
    socket.on('round_start', handleRoundStart);

    return () => {
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_left', handlePlayerLeft);
      socket.off('players_updated', handlePlayersUpdated);
      socket.off('room_settings_updated', handleRoomSettingsUpdated);
      socket.off('game_state', handleGameState);
      socket.off('round_start', handleRoundStart);
    };
  }, [socket]);

  const handleRoomJoined = useCallback((roomId: string, _playerName: string, hostFlag: boolean, settings?: RoomSettings) => {
    setRoundStartData(null);
    setCurrentRoomId(roomId);
    setIsHost(hostFlag);
    if (settings) setRoomSettings(settings);
    setGamePhase('lobby');
  }, []);

  const handleLeaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave_room');
    }
    setCurrentRoomId(null);
    setPlayers([]);
    setRoundStartData(null);
    setGamePhase('lobby');
    setIsHost(false);
  }, [socket]);

  const handleSplashComplete = useCallback(() => {
    setStartupStage((stage) => stage === 'splash' ? 'loading' : stage);
  }, []);

  const handleLoadingReady = useCallback(() => {
    setStartupStage((stage) => stage === 'loading' ? 'player-setup' : stage);
  }, []);

  const handlePlayerSetupComplete = useCallback((name: string, avatar: string) => {
    setPlayerName(name);
    setPlayerAvatar(avatar);
    setStartupStage('app');
  }, []);

  const handleRetryConnection = useCallback(() => {
    setLoadingRetryCount((count) => count + 1);
    socket?.connect();
  }, [socket]);

  if (startupStage === 'splash') {
    return <LogoSplash onComplete={handleSplashComplete} />;
  }

  if (startupStage === 'loading') {
    return (
      <LoadingScreen
        isConnected={isConnected}
        isSocketReady={socket !== null}
        retryCount={loadingRetryCount}
        onReady={handleLoadingReady}
        onRetry={handleRetryConnection}
      />
    );
  }

  if (startupStage === 'player-setup') {
    return <PlayerSetupScreen onContinue={handlePlayerSetupComplete} />;
  }

  return (
    <div className="app-shell flex flex-col overflow-hidden bg-[#0a1020] font-sans text-white">
      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#0d1527]/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur md:px-8">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-0.5 font-fredoka text-2xl font-bold tracking-tight text-amber-300 transition hover:opacity-80"
            aria-label="Return to home"
          >
            <span>skribbl</span>
            <span className="text-sky-300">.io</span>
          </button>
          {currentRoomId && (
            <span className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-bold text-slate-300 min-[420px]:inline-flex">
              Room <span className="text-amber-300">{currentRoomId}</span>
            </span>
          )}
        </div>

        {/* Real-time Connection Indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
            {isConnected ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"></span>
                <span className="text-emerald-400 font-semibold">Online</span>
                {latency !== null && (
                  <span className="text-slate-400 font-mono pl-1 border-l border-slate-700">
                    {latency}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300"></span>
                <span className="font-semibold text-amber-200">Connecting</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main View Router */}
      <main
        key={currentRoomId ? (gamePhase === 'lobby' ? 'lobby' : 'game') : 'menu'}
        className="app-view-transition flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {!currentRoomId ? (
          <HomeView
            playerName={playerName}
            playerAvatar={playerAvatar}
            onRoomJoined={handleRoomJoined}
          />
        ) : gamePhase === 'lobby' ? (
          <LobbyView
            roomId={currentRoomId}
            players={players}
            settings={roomSettings}
            isHost={isHost}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <GameView
            roomId={currentRoomId}
            players={players}
            initialWordOptions={roundStartData?.wordOptions ?? []}
            onPlayAgain={handleLeaveRoom}
          />
        )}
      </main>
    </div>
  );
};

export default App;
