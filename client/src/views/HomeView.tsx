import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { RoomSettings } from '@skribbl/shared';
import { Plus, Sliders, ArrowRight, Sparkles, LoaderCircle } from 'lucide-react';

interface HomeViewProps {
  playerName: string;
  playerAvatar: string;
  onRoomJoined: (roomId: string, playerName: string, isHost: boolean, settings?: RoomSettings) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ playerName, playerAvatar, onRoomJoined }) => {
  const { socket, isConnected } = useSocket();

  const [joinCode, setJoinCode] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [customWordsText, setCustomWordsText] = useState<string>('');

  const getCustomWords = (): string[] => {
    if (!customWordsText.trim()) return [];
    if (customWordsText.length > 1000) {
      throw new Error('Custom words must fit within 1,000 characters.');
    }

    const entries = customWordsText.split(/[\n,]/);
    if (entries.length > 200) {
      throw new Error('You can enter at most 200 custom words.');
    }

    const words = new Set<string>();
    for (const entry of entries) {
      const word = entry.trim().toLowerCase();
      if (!word) {
        throw new Error('Custom words cannot contain empty entries.');
      }
      if (word.length < 2 || word.length > 30 || !/^[a-z0-9]+([ -][a-z0-9]+)*$/.test(word)) {
        throw new Error('Each custom word must be 2-30 characters and use letters, numbers, spaces, or hyphens.');
      }
      if (words.has(word)) {
        throw new Error(`Duplicate custom word: ${word}.`);
      }
      words.add(word);
    }

    return Array.from(words);
  };

  // Room creation settings
  const [settings, setSettings] = useState<RoomSettings>({
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    wordMode: 'normal',
    isPrivate: false,
    customWords: []
  });

  // Auto-fill room code from URL query param if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCode(roomParam.toUpperCase());
    }
  }, []);

  const handleCreateRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket) {
      setError('The game server is not connected yet. Please try again shortly.');
      return;
    }

    let parsedCustomWords: string[];
    try {
      parsedCustomWords = getCustomWords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid custom words.');
      return;
    }

    setLoading(true);
    setError(null);
    const payloadSettings: RoomSettings = {
      ...settings,
      customWords: parsedCustomWords
    };

    socket.emit('create_room', { hostName: playerName, avatar: playerAvatar, settings: payloadSettings }, (res) => {
      setLoading(false);
      if (res.success && res.roomId) {
        onRoomJoined(res.roomId, playerName, true);
      } else {
        setError(res.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) {
      setError('The game server is not connected yet. Please try again shortly.');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a 6-letter room code');
      return;
    }

    setLoading(true);
    setError(null);

    const targetRoomId = joinCode.trim().toUpperCase();

    socket.emit('join_room', { roomId: targetRoomId, playerName, avatar: playerAvatar }, (res) => {
      setLoading(false);
      if (res.success) {
        onRoomJoined(targetRoomId, playerName, false, res.room?.settings);
      } else {
        setError(res.error || 'Could not join room');
      }
    });
  };

  return (
    <div className="landing-shell relative isolate flex-1 overflow-hidden px-4 py-5 sm:px-6 md:flex md:items-center md:px-8 md:py-6">
      <div className="landing-glow landing-glow-one" aria-hidden="true" />
      <div className="landing-glow landing-glow-two" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-7 md:grid-cols-[1fr_0.95fr] md:gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section className="landing-intro min-w-0 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1.5 text-[11px] font-bold text-emerald-200 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
            The party game for creative minds
          </div>
          <div className="space-y-3">
            <h1 className="font-fredoka text-5xl font-bold leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Draw it.
              <br />
              <span className="text-amber-300">Guess it.</span>
              <br />
              <span className="text-sky-300">Laugh.</span>
            </h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-slate-300 sm:text-base sm:leading-7 md:mx-0">
              Quick sketches, wild guesses, and your favorite people. Make a room and let the doodle chaos begin.
            </p>
          </div>
          <div className="landing-preview mx-auto flex max-w-sm items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-xl shadow-slate-950/20 md:mx-0 md:justify-start">
            <div className="flex -space-x-3" aria-hidden="true">
              {['🦊', '🐼', '🐸'].map((emoji, index) => (
                <div key={emoji} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#101a30] bg-slate-800 text-xl" style={{ zIndex: 3 - index }}>
                  {emoji}
                </div>
              ))}
            </div>
            <div className="min-w-0 text-left">
              <div className="text-xs font-extrabold text-white sm:text-sm">Bring your crew together</div>
              <div className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">No downloads. Just good drawings.</div>
            </div>
            <Sparkles className="ml-auto h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          </div>
        </section>

        <section className="mx-auto w-full min-w-0 max-w-lg rounded-[1.75rem] border border-white/10 bg-[#151f35]/90 p-4 shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-300">Ready to play</p>
              <h2 className="mt-1 font-fredoka text-2xl font-semibold text-white sm:text-3xl">Make your move</h2>
            </div>
            <div className="flex min-w-0 max-w-[45%] items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0b1325] px-2.5 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-200/10 text-xl" aria-hidden="true">{playerAvatar}</span>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">Playing as</p>
                <p className="truncate text-xs font-bold text-white sm:text-sm">{playerName}</p>
              </div>
            </div>
          </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-left text-sm font-semibold text-rose-200">
            <span className="mt-0.5">!</span>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateRoom()}
              disabled={loading || !isConnected}
              className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-4 py-3.5 font-extrabold text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              <span>{loading ? 'Creating room…' : 'Create a room'}</span>
              {!loading && <ArrowRight className="ml-auto h-4 w-4 opacity-70" />}
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-200 transition hover:border-sky-300/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/15"
              title="Room Settings"
              aria-label="Room Settings"
            >
              <Sliders className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Join a friend</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={6}
              aria-label="Room code"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1325] px-4 py-3.5 text-center font-mono text-sm font-bold tracking-[0.2em] text-amber-200 outline-none transition placeholder:text-slate-600 focus:border-amber-200/60 focus:ring-4 focus:ring-amber-200/10"
            />
            <button
              type="submit"
              disabled={loading || !isConnected || !joinCode.trim()}
              className="flex min-w-24 items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-extrabold text-sky-100 transition hover:bg-sky-300/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Join <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="text-center text-[11px] text-slate-500">
            {isConnected ? 'Ready when you are — games are better together.' : 'Connecting to the game server…'}
          </p>
        </div>

        {/* Modal: Room Settings */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
            <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-white/10 bg-[#151f35] p-5 shadow-2xl shadow-black/50 sm:p-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-300">Make it yours</p>
                  <h3 id="settings-title" className="mt-1 font-fredoka text-2xl font-semibold text-white">Room settings</h3>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close room settings"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Players Limit:</span>
                    <span className="font-extrabold text-sky-200">{settings.maxPlayers} players</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={settings.maxPlayers}
                    onChange={(e) => setSettings({ ...settings, maxPlayers: Number(e.target.value) })}
                    className="w-full accent-sky-300"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Draw Time:</span>
                    <span className="font-extrabold text-sky-200">{settings.drawTime}s</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="240"
                    step="5"
                    value={settings.drawTime}
                    onChange={(e) => setSettings({ ...settings, drawTime: Number(e.target.value) })}
                    className="w-full accent-sky-300"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Total Rounds:</span>
                    <span className="font-extrabold text-sky-200">{settings.rounds} rounds</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={settings.rounds}
                    onChange={(e) => setSettings({ ...settings, rounds: Number(e.target.value) })}
                    className="w-full accent-sky-300"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Word Choices:</span>
                    <span className="font-extrabold text-sky-200">{settings.wordCount} choices</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={settings.wordCount}
                    onChange={(e) => setSettings({ ...settings, wordCount: Number(e.target.value) })}
                    className="w-full accent-sky-300"
                  />
                </div>

                {/* Hints Slider */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Hints:</span>
                    <span className="font-extrabold text-sky-200">
                      {settings.hints === 0 ? 'Disabled' : `${settings.hints} hints`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={settings.hints}
                    onChange={(e) => setSettings({ ...settings, hints: Number(e.target.value) })}
                    className="w-full accent-sky-300"
                  />
                </div>

                {/* Custom Words Input */}
                <div>
                  <div className="flex justify-between font-semibold text-slate-300 mb-1">
                    <span>Custom Words:</span>
                    <span className="text-slate-400 text-[10px]">Optional · up to 200 words</span>
                  </div>
                  <textarea
                    rows={3}
                    value={customWordsText}
                    onChange={(e) => setCustomWordsText(e.target.value)}
                    placeholder="e.g. superhero, laser, pancake"
                    maxLength={1000}
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1325] p-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300/60"
                  />
                  {customWordsText.trim() && (
                    <div className="mt-1 text-[10px] text-sky-200">
                      {customWordsText.split(/[\n,]+/).filter(w => w.trim()).length} word(s) detected
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full rounded-xl bg-sky-300 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-sky-200"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
};
