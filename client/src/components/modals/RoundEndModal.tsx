import React from 'react';
import { Award, CheckCircle2 } from 'lucide-react';
import { PlayerData } from '@skribbl/shared';

interface RoundEndModalProps {
  word: string;
  players: PlayerData[];
  scores: Record<string, number>;
}

export const RoundEndModal: React.FC<RoundEndModalProps> = ({ word, players, scores }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-md animate-in rounded-3xl border border-white/10 bg-[#151f35] p-6 text-center shadow-2xl shadow-black/50 fade-in zoom-in duration-200 sm:p-8">
        <div className="mb-4 inline-flex items-center space-x-1.5 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-xs font-extrabold text-amber-100">
          <Award className="w-4 h-4" />
          <span>Round Ended</span>
        </div>

        <h3 className="text-sm font-semibold text-slate-400">The answer was</h3>
        <div className="my-2 break-words font-fredoka text-4xl font-semibold uppercase tracking-wider text-sky-200 drop-shadow md:text-5xl">
          {word}
        </div>

        <div className="mt-6 border-t border-white/[0.08] pt-4 text-left">
          <h4 className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Round scoreboard</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="flex items-center space-x-2">
                  {p.hasGuessed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-700 inline-block" />
                  )}
                  <span className="text-sm font-bold text-white">{p.name}</span>
                </div>
                <span className="font-mono text-xs font-bold text-amber-200">
                  {scores[p.id] ?? p.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
