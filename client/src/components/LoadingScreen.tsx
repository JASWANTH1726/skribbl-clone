import React, { useEffect, useState } from 'react';
import { LoaderCircle, PencilLine } from 'lucide-react';

interface LoadingScreenProps {
  isConnected: boolean;
  isSocketReady: boolean;
  retryCount: number;
  onReady: () => void;
  onRetry: () => void;
}

const CONNECTION_TIMEOUT_MS = 10000;
const READY_TRANSITION_MS = 300;

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isConnected,
  isSocketReady,
  retryCount,
  onReady,
  onRetry
}) => {
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);

  useEffect(() => {
    let timer: number;

    setHasTimedOut(false);
    setIsExiting(false);

    if (isConnected) {
      setIsExiting(true);
      timer = window.setTimeout(onReady, READY_TRANSITION_MS);
    } else {
      timer = window.setTimeout(() => setHasTimedOut(true), CONNECTION_TIMEOUT_MS);
    }

    return () => window.clearTimeout(timer);
  }, [isConnected, retryCount, onReady]);

  return (
    <main
      className={`startup-loading${isExiting ? ' startup-loading--exiting' : ''}`}
      role={hasTimedOut ? 'alert' : 'status'}
      aria-live={hasTimedOut ? 'assertive' : 'polite'}
    >
      <div className="startup-loading__glow" aria-hidden="true" />
      <div className="startup-loading__content">
        <div className="startup-loading__brand" aria-label="skribbl.io">
          <span>skribbl</span>
          <span className="startup-loading__suffix">.io</span>
          <PencilLine className="startup-loading__pencil" aria-hidden="true" />
        </div>

        <p className="startup-loading__message">Preparing your drawing room...</p>

        {hasTimedOut ? (
          <div className="startup-loading__error">
            <p>We couldn't connect to the game server. Check your connection and try again.</p>
            <button type="button" onClick={onRetry} className="startup-loading__retry">
              Try again
            </button>
          </div>
        ) : (
          <div className="startup-loading__progress" aria-label="Connecting to game server">
            <LoaderCircle className="startup-loading__spinner" aria-hidden="true" />
            <span>{isSocketReady ? 'Connecting to game server' : 'Starting game services'}</span>
          </div>
        )}
      </div>
    </main>
  );
};
