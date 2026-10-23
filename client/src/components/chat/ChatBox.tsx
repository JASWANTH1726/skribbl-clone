import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { ChatMessage } from '@skribbl/shared';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChatBoxProps {
  isDrawer: boolean;
  hasGuessed: boolean;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ isDrawer, hasGuessed }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [closeAlert, setCloseAlert] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-100), msg]);
    };

    const handleGuessResult = (res: any) => {
      if (res.isClose) {
        setCloseAlert('You are so close!');
        setTimeout(() => setCloseAlert(null), 3000);
      }
    };

    socket.on('chat_message', handleChatMessage);
    socket.on('guess_result', handleGuessResult);

    return () => {
      socket.off('chat_message', handleChatMessage);
      socket.off('guess_result', handleGuessResult);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, closeAlert]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !inputText.trim()) return;

    socket.emit('guess', { text: inputText.trim() });
    setInputText('');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121c30] shadow-xl shadow-black/10">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-4 py-3">
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-[0.14em] text-slate-200">Live chat</span>
          <span className="mt-0.5 block text-[10px] text-slate-500">Guess the word or cheer them on</span>
        </div>
        {hasGuessed && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Word Solved!
          </span>
        )}
      </div>

      {/* Messages Feed */}
      <div aria-live="polite" className="flex-1 space-y-2 overflow-y-auto p-3 text-sm font-sans">
        {messages.length === 0 && (
          <div className="flex h-full min-h-24 flex-col items-center justify-center px-4 text-center">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-300/[0.08] text-lg">💬</span>
            <p className="text-xs font-bold text-slate-300">The chat is all yours</p>
            <p className="mt-1 max-w-[190px] text-[11px] leading-relaxed text-slate-500">
              {isDrawer ? 'Your friends are guessing — keep drawing!' : 'Send a guess when you think you know it.'}
            </p>
          </div>
        )}
        {messages.map((m) => {
          if (m.type === 'correct') {
            return (
              <div
                key={m.id}
                className="flex items-center space-x-1.5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-2.5 text-xs font-bold text-emerald-100"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{m.text}</span>
              </div>
            );
          }

          if (m.type === 'system') {
            return (
              <div key={m.id} className="py-1 text-center text-xs italic text-slate-500">
                {m.text}
              </div>
            );
          }

          return (
            <div key={m.id} className="break-words rounded-lg px-2 py-1 leading-relaxed transition hover:bg-white/[0.025]">
              <span className="font-extrabold text-sky-200">{m.playerName}: </span>
              <span className="text-slate-200">{m.text}</span>
            </div>
          );
        })}

        {closeAlert && (
          <div className="flex animate-bounce items-center space-x-1.5 rounded-xl border border-amber-200/20 bg-amber-200/[0.08] p-2.5 text-xs font-semibold text-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{closeAlert}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-white/[0.07] bg-white/[0.025] p-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isDrawer
              ? 'You are drawing (cannot guess)'
              : hasGuessed
              ? 'You guessed the word!'
              : 'Type your guess here...'
          }
          disabled={isDrawer || hasGuessed}
          maxLength={50}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1325] px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/60 disabled:cursor-not-allowed disabled:opacity-45"
        />
        <button
          type="submit"
          disabled={isDrawer || hasGuessed || !inputText.trim()}
          aria-label="Send guess"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-sky-300 px-3 py-2 text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
