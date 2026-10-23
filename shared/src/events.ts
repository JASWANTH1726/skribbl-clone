import {
  ChatMessage,
  DrawMovePayload,
  DrawStartPayload,
  DrawStroke,
  GameState,
  LeaderboardEntry,
  PlayerData,
  RoomSettings
} from './types.js';

export interface ClientToServerEvents {
  // Room & Lobby
  create_room: (
    data: { hostName: string; avatar?: string; settings?: Partial<RoomSettings> },
    callback?: (res: { success: boolean; roomId?: string; error?: string }) => void
  ) => void;
  join_room: (
    data: { roomId: string; playerName: string; avatar?: string },
    callback?: (res: { success: boolean; error?: string; room?: any }) => void
  ) => void;
  leave_room: () => void;
  set_ready: (isReady: boolean) => void;
  update_settings: (settings: Partial<RoomSettings>) => void;
  start_game: () => void;
  request_game_state: () => void;

  // Drawing
  draw_start: (data: DrawStartPayload) => void;
  draw_move: (data: DrawMovePayload) => void;
  draw_end: () => void;
  canvas_clear: () => void;
  draw_undo: () => void;

  // Word selection
  word_chosen: (data: { word: string }) => void;

  // Chat & Guessing
  guess: (data: { text: string }) => void;
  chat: (data: { text: string }) => void;

  // Connection
  ping_check: (timestamp: number, callback: (timestamp: number) => void) => void;
}

export interface ServerToClientEvents {
  // Room & Lobby
  player_joined: (data: { player: PlayerData; players: PlayerData[] }) => void;
  player_left: (data: { playerId: string; players: PlayerData[] }) => void;
  room_settings_updated: (settings: RoomSettings) => void;
  players_updated: (players: PlayerData[]) => void;

  // Game State
  game_state: (data: GameState) => void;
  round_start: (data: {
    drawerId: string;
    drawerName: string;
    round: number;
    totalRounds: number;
    drawTime: number;
    wordOptions?: string[]; // Only sent to drawer
  }) => void;
  word_selected: (data: { drawerId: string; wordLength: number; maskedWord: string }) => void;
  round_end: (data: {
    word: string;
    scores: Record<string, number>;
    nextDrawer?: string | null;
    reason?: 'timeout' | 'all_guessed' | 'drawer_left';
  }) => void;
  game_over: (data: {
    winner: LeaderboardEntry;
    leaderboard: LeaderboardEntry[];
  }) => void;

  // Drawing
  draw_start: (data: DrawStartPayload) => void;
  draw_move: (data: DrawMovePayload) => void;
  draw_end: () => void;
  draw_data: (data: DrawStroke) => void;
  canvas_clear: () => void;
  draw_undo: () => void;
  canvas_sync: (strokes: DrawStroke[]) => void;

  // Chat & Guessing
  guess_result: (data: {
    correct: boolean;
    playerId: string;
    playerName: string;
    points?: number;
    isClose?: boolean;
  }) => void;
  chat_message: (message: ChatMessage) => void;

  // Error / Alert
  error_message: (data: { message: string }) => void;
}
