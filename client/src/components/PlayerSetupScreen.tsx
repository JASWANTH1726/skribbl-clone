import React, { useState } from 'react';
import { ArrowRight, UserRound } from 'lucide-react';

const AVATARS = ['🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🐵', '🦄'];
const MAX_PLAYER_NAME_LENGTH = 16;

interface PlayerSetupScreenProps {
  onContinue: (name: string, avatar: string) => void;
}

export const PlayerSetupScreen: React.FC<PlayerSetupScreenProps> = ({ onContinue }) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Enter a player name to continue.');
      return;
    }
    if (trimmedName.length > MAX_PLAYER_NAME_LENGTH) {
      setError(`Keep your player name to ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`);
      return;
    }
    if (/[\u0000-\u001f\u007f]/.test(trimmedName)) {
      setError('Player names cannot contain control characters.');
      return;
    }

    onContinue(trimmedName, avatar);
  };

  return (
    <main className="player-setup-screen landing-shell startup-screen-enter relative isolate">
      <div className="landing-glow landing-glow-one" aria-hidden="true" />
      <div className="landing-glow landing-glow-two" aria-hidden="true" />
      <form
        onSubmit={handleContinue}
        className="player-setup-card relative w-full max-w-xl min-w-0 rounded-[2rem] border border-white/10 bg-[#151f35]/95 p-5 shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-9"
        noValidate
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-3xl shadow-inner">
            <UserRound className="h-7 w-7 text-amber-200" aria-hidden="true" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-300">Before the first sketch</p>
          <h1 className="mt-2 font-fredoka text-3xl font-bold text-white sm:text-4xl">Set up your player</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a name and an animal avatar for the game.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="player-name" className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Player name
            </label>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. DoodleMaster"
              maxLength={32}
              autoComplete="nickname"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'player-name-error' : 'player-name-help'}
              className="w-full rounded-xl border border-white/10 bg-[#0b1325] px-4 py-3.5 text-sm font-bold text-white outline-none transition placeholder:font-medium placeholder:text-slate-600 focus:border-sky-300/70 focus:ring-4 focus:ring-sky-300/10"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p id="player-name-help" className="min-w-0 text-xs text-slate-500">Use 1–16 characters. You can change it next time.</p>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{name.trim().length}/16</span>
            </div>
          </div>

          <fieldset>
            <legend className="mb-3 block text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Choose your avatar
            </legend>
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
              {AVATARS.map((animal) => (
                <button
                  key={animal}
                  type="button"
                  onClick={() => setAvatar(animal)}
                  aria-label={`Choose ${animal} avatar`}
                  aria-pressed={avatar === animal}
                  className={`flex aspect-square items-center justify-center rounded-2xl border text-3xl transition duration-200 hover:-translate-y-0.5 sm:text-4xl ${
                    avatar === animal
                      ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_0_2px_rgba(125,211,252,0.18),0_10px_30px_rgba(56,189,248,0.12)]'
                      : 'border-white/[0.08] bg-[#0b1325] hover:border-white/20 hover:bg-slate-800'
                  }`}
                >
                  {animal}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {error && (
          <p id="player-name-error" role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm font-semibold text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 px-5 py-3.5 font-extrabold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200/30"
        >
          Continue <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </main>
  );
};
