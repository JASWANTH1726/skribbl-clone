import React, { useEffect, useState } from 'react';
import { PencilLine } from 'lucide-react';

interface LogoSplashProps {
  onComplete: () => void;
}

const SPLASH_VISIBLE_MS = 1650;
const SPLASH_FADE_OUT_MS = 350;

export const LogoSplash: React.FC<LogoSplashProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState<boolean>(false);

  useEffect(() => {
    let fadeOutTimer: number;
    const visibleTimer = window.setTimeout(() => {
      setIsExiting(true);
      fadeOutTimer = window.setTimeout(onComplete, SPLASH_FADE_OUT_MS);
    }, SPLASH_VISIBLE_MS);

    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(fadeOutTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`logo-splash${isExiting ? ' logo-splash--exiting' : ''}`}
      role="status"
      aria-label="Skribbl.io"
    >
      <div className="logo-splash__glow" aria-hidden="true" />
      <div className="logo-splash__brand" aria-hidden="true">
        <span className="logo-splash__wordmark">
          <span>skribbl</span>
          <span className="logo-splash__suffix">.io</span>
        </span>
        <PencilLine className="logo-splash__pencil" />
      </div>
    </div>
  );
};
