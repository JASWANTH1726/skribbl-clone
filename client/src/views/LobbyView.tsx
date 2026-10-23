import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { PlayerData, RoomSettings } from '@skribbl/shared';
import { Copy, Check, Crown, Play, CheckCircle2, Circle, Users, ArrowLeft } from 'lucide-react';

interface LobbyViewProps {
  roomId: string;
  players: PlayerData[];
  settings: RoomSettings;
  isHost: boolean;
  onLeaveRoom: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomId,
  players,
  settings,
  isHost,
  onLeaveRoom
}) => {
  const { socket } = useSocket();
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const copiedTimeout = useRef<number | null>(null);

  useEffect(() => () => {
    if (copiedTimeout.current !== null) {
      window.clearTimeout(copiedTimeout.current);
    }
  }, []);

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}?room=${roomId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyError(null);
      setCopied(true);
      if (copiedTimeout.current !== null) {
        window.clearTimeout(copiedTimeout.current);
      }
      copiedTimeout.current = window.setTimeout(() => {
        copiedTimeout.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
      setCopyError(`Couldn't copy the invite link. Share room code ${roomId} instead.`);
    }
  };

  const handleToggleReady = () => {
    if (!socket) return;
    const nextReady = !isReady;
    setIsReady(nextReady);
    socket.emit('set_ready', nextReady);
  };

  const handleStartGame = () => {
    if (!socket || !isHost) return;
    socket.emit('start_game');
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-8">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#18243b] to-[#121c30] p-5 shadow-2xl shadow-black/20 md:p-7">
        <div className="flex items-center space-x-4">
          <button
            onClick={onLeaveRoom}
            className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Leave Room"
            aria-label="Leave room"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Your room code</div>
            <div className="font-fredoka text-3xl font-bold tracking-[0.12em] text-amber-300 md:text-4xl">
              {roomId}
            </div>
          </div>
        </div>

        {/* Copy Invite Link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center space-x-2 rounded-xl border border-sky-200/20 bg-sky-200/10 px-4 py-3 text-xs font-extrabold text-sky-100 transition hover:bg-sky-200/15"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
        </button>
        {copyError && (
          <p role="alert" className="basis-full text-right text-xs font-semibold text-rose-200">
            {copyError}
          </p>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid flex-1 grid-cols-1 gap-5 md:grid-cols-[1.6fr_1fr] md:gap-6">
        {/* Players List (2 columns wide) */}
        <div className="flex min-h-[320px] flex-col rounded-3xl border border-white/[0.08] bg-[#121c30]/80 p-4 shadow-xl shadow-black/10 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <Users className="w-4 h-4 text-sky-300" />
              <span>Players in Lobby ({players.length}/{settings.maxPlayers})</span>
            </div>
            {players.length < 2 && (
              <span className="rounded-full border border-amber-200/15 bg-amber-200/[0.06] px-2.5 py-1 text-[10px] font-bold text-amber-200 sm:text-xs">
                Invite a friend to start
              </span>
            )}
          </div>

          {/* Player Cards */}
          <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
            {players.map((p) => (
              <div
                key={p.id}
                className="group relative flex min-h-36 flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#0b1325]/80 p-4 text-center transition hover:border-sky-200/20 hover:bg-[#0d182c]"
              >
                {p.isHost && (
                  <div className="absolute top-2 right-2 text-amber-400" title="Host">
                    <Crown className="w-4 h-4" />
                  </div>
                )}
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04] text-4xl">{p.avatar || '🦊'}</div>
                <div className="max-w-[140px] truncate text-sm font-extrabold text-white">
                  {p.name}
                </div>
                <div className="mt-1 flex items-center space-x-1">
                  {p.isReady ? (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
                      <Circle className="w-2.5 h-2.5" /> Waiting
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Room Info & Controls */}
        <div className="flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-[#121c30]/80 p-5 shadow-xl shadow-black/10 md:p-6">
          <div className="space-y-4">
            <h3 className="border-b border-white/[0.08] pb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">
              Game settings
            </h3>
            <div className="space-y-0 text-sm">
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Total Rounds:</span>
                <span className="font-bold text-white">{settings.rounds}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Draw Time:</span>
                <span className="font-bold text-white">{settings.drawTime}s</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Word Choices:</span>
                <span className="font-bold text-white">{settings.wordCount} words</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Hints:</span>
                <span className="font-bold text-white">
                  {settings.hints === 0 ? 'Disabled' : `${settings.hints} hints`}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Word Pool:</span>
                <span className="font-bold text-sky-400">
                  {settings.customWords && settings.customWords.length > 0
                    ? `${settings.customWords.length} custom words`
                    : 'Default dictionary'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-3">
                <span className="text-slate-400">Word Mode:</span>
                <span className="font-bold text-white capitalize">{settings.wordMode}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Room Access:</span>
                <span className="font-bold text-white">{settings.isPrivate ? 'Private' : 'Public'}</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6">
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 py-4 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Game</span>
              </button>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`w-full py-4 font-extrabold rounded-xl shadow-xl flex items-center justify-center space-x-2 text-sm transition ${
                  isReady
                    ? 'bg-amber-300 text-slate-950 hover:bg-amber-200'
                      : 'bg-emerald-300 text-slate-950 hover:bg-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isReady ? 'Cancel Ready' : 'Ready Up!'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
