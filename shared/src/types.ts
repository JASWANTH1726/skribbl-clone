export type GamePhase = 'lobby' | 'word_select' | 'drawing' | 'round_end' | 'game_over';

export type WordMode = 'normal' | 'hidden' | 'combination';

export interface RoomSettings {
  maxPlayers: number;        // 2 - 20
  rounds: number;            // 2 - 10
  drawTime: number;          // 15 - 240 seconds
  wordCount: number;         // 1 - 5 choices
  hints: number;             // 0 - 5 hints
  wordMode: WordMode;        // normal, hidden, combination
  isPrivate: boolean;        // invite link / code only
  customWords?: string[];
}

export interface PlayerData {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasGuessed: boolean;
  isDrawing: boolean;
  rank?: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  drawerId: string | null;
  drawerName?: string | null;
  wordLength?: number;
  hints: string[];           // Array of masked strings, e.g. ['_ ', 'a ', '_ ']
  timeLeft: number;
  totalTime: number;
  scores: Record<string, number>;
}

export interface DrawPoint {
  x: number;
  y: number;
}

export type DrawTool = 'brush' | 'eraser';

export interface DrawStroke {
  id: string;
  tool: DrawTool;
  color: string;
  size: number;
  points: DrawPoint[];
}

export interface DrawStartPayload {
  x: number;
  y: number;
  color: string;
  size: number;
  tool?: DrawTool;
}

export interface DrawMovePayload {
  x: number;
  y: number;
}

export interface ChatMessage {
  id: string;
  playerId?: string;
  playerName?: string;
  text: string;
  type: 'chat' | 'guess' | 'correct' | 'close' | 'system' | 'leave' | 'join';
  timestamp: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
}
