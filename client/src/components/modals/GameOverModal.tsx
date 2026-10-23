import React from 'react';
import { LeaderboardEntry } from '@skribbl/shared';
import { Trophy, Crown, RotateCcw } from 'lucide-react';

interface GameOverModalProps {
  winner: LeaderboardEntry;
  leaderboard: LeaderboardEntry[];
  onPlayAgain: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ winner, leaderboard, onPlayAgain }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in rounded-3xl border border-white/10 bg-[#151f35] p-6 text-center shadow-2xl shadow-black/50 fade-in zoom-in duration-300 md:p-8">
        <div className="mb-5 inline-flex items-center space-x-2 rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-amber-100">
          <Trophy className="w-4 h-4" />
          <span>Game Finished</span>
        </div>

        {/* Winner Highlight */}
        <div className="relative mb-6">
          <div className="mb-3 inline-flex rounded-full border border-amber-100/30 bg-gradient-to-tr from-amber-300 to-yellow-100 p-4 shadow-xl shadow-amber-300/15">
            <Crown className="h-11 w-11 text-slate-900" />
          </div>
          <h2 className="font-fredoka text-3xl font-semibold text-white">{winner.name} wins!</h2>
          <p className="mt-1 text-sm font-extrabold text-amber-200">{winner.score} points</p>
        </div>

        {/* Podium List */}
        <div className="mb-6 space-y-2 text-left">
          {leaderboard.map((entry, index) => {
            const isWinner = index === 0;
            return (
              <div
                key={entry.playerId}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  isWinner
                    ? 'border-amber-200/20 bg-amber-200/[0.07]'
                    : 'border-white/[0.06] bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      index === 0
                        ? 'bg-amber-200 text-slate-900'
                        : index === 1
                        ? 'bg-slate-300 text-slate-900'
                        : index === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white/[0.08] text-slate-400'
                    }`}
                  >
                    #{entry.rank}
                  </span>
                  <span className="text-sm font-bold text-white">{entry.name}</span>
                </div>
                <span className="font-mono text-sm font-bold text-amber-200">
                  {entry.score} pts
                </span>
              </div>
            );
          })}
        </div>

        {/* Play Again button */}
        <button
          onClick={onPlayAgain}
          className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:brightness-105"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Back to Home / Play Again</span>
        </button>
      </div>
    </div>
  );
};
