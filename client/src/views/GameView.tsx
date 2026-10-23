import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { GameState, LeaderboardEntry, PlayerData, ServerToClientEvents } from '@skribbl/shared';
import { Canvas } from '../components/canvas/Canvas';
import { ChatBox } from '../components/chat/ChatBox';
import { WordSelectModal } from '../components/modals/WordSelectModal';
import { RoundEndModal } from '../components/modals/RoundEndModal';
import { GameOverModal } from '../components/modals/GameOverModal';
import { Clock, Paintbrush, CheckCircle2, Crown, Trophy } from 'lucide-react';

interface GameViewProps {
  roomId: string;
  players: PlayerData[];
  initialGameState: GameState | null;
  initialWordOptions: string[];
  onPlayAgain: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ roomId, players, initialGameState, initialWordOptions, onPlayAgain }) => {
  const { socket, socketId } = useSocket();

  const [gameState, setGameState] = useState<GameState>(initialGameState ?? {
    roomId,
    phase: 'word_select',
    round: 1,
    totalRounds: 3,
    drawerId: null,
    drawerName: null,
    hints: [],
    timeLeft: 80,
    totalTime: 80,
    scores: {}
  });

  const [wordOptions, setWordOptions] = useState<string[]>(initialWordOptions);
  const [roundEndData, setRoundEndData] = useState<{ word: string; scores: Record<string, number> } | null>(null);
  const [gameOverData, setGameOverData] = useState<{ winner: LeaderboardEntry; leaderboard: LeaderboardEntry[] } | null>(null);

  // Identify current player
  const myPlayer = players.find(p => p.id.includes(socketId?.substring(0, 6) || ''));
  const isDrawer = gameState.drawerId ? myPlayer?.id === gameState.drawerId : false;

  useEffect(() => {
    if (!socket) return;

    const handleGameState = (state: GameState) => {
      setGameState(state);
      if (state.phase !== 'round_end') {
        setRoundEndData(null);
      }
    };

    const handleRoundStart = (data: Parameters<ServerToClientEvents['round_start']>[0]) => {
      if (data.wordOptions) {
        setWordOptions(data.wordOptions);
      } else {
        setWordOptions([]);
      }
      setRoundEndData(null);
    };

    const handleRoundEnd = (data: Parameters<ServerToClientEvents['round_end']>[0]) => {
      setWordOptions([]);
      setRoundEndData({ word: data.word, scores: data.scores });
    };

    const handleGameOver = (data: Parameters<ServerToClientEvents['game_over']>[0]) => {
      setGameOverData(data);
    };

    socket.on('game_state', handleGameState);
    socket.on('round_start', handleRoundStart);
    socket.on('round_end', handleRoundEnd);
    socket.on('game_over', handleGameOver);
    socket.emit('request_game_state');

    return () => {
      socket.off('game_state', handleGameState);
      socket.off('round_start', handleRoundStart);
      socket.off('round_end', handleRoundEnd);
      socket.off('game_over', handleGameOver);
    };
  }, [socket]);

  // Sort players for leaderboard
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = gameState.scores[a.id] ?? a.score;
    const scoreB = gameState.scores[b.id] ?? b.score;
    return scoreB - scoreA;
  });
  const timerUrgent = gameState.timeLeft <= 10;
  const timeProgress = gameState.totalTime > 0
    ? Math.max(0, Math.min(100, (gameState.timeLeft / gameState.totalTime) * 100))
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-3 py-3 xl:h-[calc(100dvh-65px)] xl:min-h-0 xl:flex-none xl:px-5 xl:py-4">
      {/* Top Game Bar */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141f34]/95 px-3 py-3 shadow-xl shadow-black/10 md:px-5">
        {/* Left: Round & Timer */}
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <div className="whitespace-nowrap rounded-lg border border-sky-200/10 bg-sky-200/[0.06] px-2 py-1.5 text-[10px] font-extrabold text-sky-200 md:px-3 md:text-xs">
            Round {gameState.round} of {gameState.totalRounds}
          </div>
          <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-xs font-extrabold tabular-nums md:px-3 md:text-sm ${
            timerUrgent
              ? 'animate-pulse border-rose-300/30 bg-rose-300/10 text-rose-200'
              : 'border-amber-200/10 bg-amber-200/[0.05] text-amber-100'
          }`}>
            <Clock className={`h-3.5 w-3.5 ${timerUrgent ? 'text-rose-300' : 'text-amber-300'}`} />
            <span>{gameState.timeLeft}<span className="hidden md:inline">s</span></span>
          </div>
        </div>

        {/* Center: Masked Word / Hints */}
        <div className="min-w-0 px-1">
          {isDrawer ? (
            <div className="text-center leading-tight">
              <span className="mb-0.5 block text-[8px] font-extrabold uppercase tracking-[0.16em] text-slate-500 md:text-[10px]">You are drawing</span>
              <span className="block truncate text-xs font-extrabold tracking-wider text-amber-200 md:text-base">
                {gameState.hints.length > 0 ? gameState.hints.join(' ') : 'Choosing word...'}
              </span>
            </div>
          ) : (
            <div className="text-center leading-tight">
              <span className="mb-0.5 block truncate text-[8px] font-extrabold uppercase tracking-[0.16em] text-slate-500 md:text-[10px]">
                {gameState.drawerName ? `${gameState.drawerName} is drawing` : 'Guess the word'}
              </span>
              <span className="block truncate font-mono text-sm font-black tracking-[0.12em] text-white md:text-lg md:tracking-widest">
                {gameState.hints.length > 0
                  ? gameState.hints.join(' ')
                  : gameState.wordLength
                  ? '_ '.repeat(gameState.wordLength).trim()
                  : '_ _ _ _'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Drawer Status */}
        <div className="flex min-w-0 justify-end">
          <div className="flex max-w-full items-center gap-1.5 truncate rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[10px] font-bold text-slate-300 md:px-3 md:text-xs">
            <Paintbrush className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="truncate">{gameState.drawerName || 'Waiting…'}</span>
          </div>
        </div>
        <div className="col-span-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${timerUrgent ? 'bg-rose-300' : 'bg-gradient-to-r from-emerald-300 via-sky-300 to-amber-200'}`}
            style={{ width: `${timeProgress}%` }}
            role="progressbar"
            aria-label="Time remaining"
            aria-valuenow={gameState.timeLeft}
            aria-valuemin={0}
            aria-valuemax={gameState.totalTime}
          />
        </div>
      </div>

      {/* Main Gameplay Layout */}
      <div className="grid flex-1 grid-cols-1 gap-3 xl:min-h-0 xl:grid-cols-12">
        {/* Left: Player Leaderboard (2 cols) */}
        <div className="flex h-28 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121c30]/80 p-2.5 xl:col-span-2 xl:h-full xl:p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            <span>Players <span className="text-slate-600">· {players.length}</span></span>
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:pr-1">
            {sortedPlayers.map((p, index) => {
              const currentScore = gameState.scores[p.id] ?? p.score;
              const isCurrentDrawer = p.id === gameState.drawerId;
              const hasSolved = p.hasGuessed;

              return (
                <div
                  key={p.id}
                  className={`flex min-w-[160px] items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs transition xl:min-w-0 ${
                    isCurrentDrawer
                      ? 'border-sky-300/25 bg-sky-300/[0.08] text-sky-100'
                      : hasSolved
                      ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'
                      : 'border-white/[0.06] bg-[#0b1325]/70 text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="w-3 text-[10px] font-bold text-slate-500">#{index + 1}</span>
                    <span className="text-sm">{p.avatar || '🦊'}</span>
                    <div className="truncate font-bold">
                      {p.name}
                      {p.isHost && <Crown className="w-2.5 h-2.5 inline ml-1 text-amber-400" />}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center space-x-1 font-mono font-bold tabular-nums text-amber-200">
                    {hasSolved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {isCurrentDrawer && <Paintbrush className="w-3.5 h-3.5 text-sky-400 animate-pulse" />}
                    <span>{currentScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Canvas (7 cols) */}
        <div className="flex h-[min(75vh,680px)] min-h-[560px] min-w-0 flex-col xl:col-span-7 xl:h-full xl:min-h-0">
          <Canvas isDrawer={isDrawer} drawerName={gameState.drawerName} />
        </div>

        {/* Right: Chat & Guess Feed (3 cols) */}
        <div className="flex h-[360px] min-h-[300px] min-w-0 flex-col xl:col-span-3 xl:h-full xl:min-h-0">
          <ChatBox isDrawer={isDrawer} hasGuessed={!!myPlayer?.hasGuessed} />
        </div>
      </div>

      {/* Overlays / Modals */}
      {gameState.phase === 'word_select' && isDrawer && wordOptions.length > 0 && (
        <WordSelectModal words={wordOptions} timeLeft={gameState.timeLeft} />
      )}

      {gameState.phase === 'round_end' && roundEndData && (
        <RoundEndModal
          word={roundEndData.word}
          players={players}
          scores={roundEndData.scores}
        />
      )}

      {gameState.phase === 'game_over' && gameOverData && (
        <GameOverModal
          winner={gameOverData.winner}
          leaderboard={gameOverData.leaderboard}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
};
