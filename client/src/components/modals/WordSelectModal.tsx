import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { Clock } from 'lucide-react';

interface WordSelectModalProps {
  words: string[];
  timeLeft: number;
}

export const WordSelectModal: React.FC<WordSelectModalProps> = ({ words, timeLeft }) => {
  const { socket } = useSocket();

  const handleSelectWord = (word: string) => {
    if (!socket) return;
    socket.emit('word_chosen', { word });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-md animate-in rounded-3xl border border-white/10 bg-[#151f35] p-6 text-center shadow-2xl shadow-black/50 fade-in zoom-in duration-200 sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.07] px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-100">
          <Clock className="h-4 w-4 text-amber-300" />
          <span>Choose a word · {timeLeft}s</span>
        </div>
        <h2 className="mb-2 font-fredoka text-3xl font-semibold text-white">What will you draw?</h2>
        <p className="mb-6 text-sm text-slate-400">Pick one — your friends will see only the clues.</p>

        <div className="grid grid-cols-1 gap-3">
          {words.map((word) => (
            <button
              key={word}
              onClick={() => handleSelectWord(word)}
              className="rounded-xl border border-sky-200/15 bg-sky-200/[0.07] px-4 py-3.5 text-base font-extrabold text-sky-100 transition hover:-translate-y-0.5 hover:border-sky-200/30 hover:bg-sky-200/[0.12] active:translate-y-0"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
