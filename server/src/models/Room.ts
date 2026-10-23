import { DrawStroke, RoomSettings } from '@skribbl/shared';
import { Player } from './Player.js';
import { Game } from './Game.js';
import { WordManager } from './WordManager.js';

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  isPrivate: false,
  customWords: []
};

const ROOM_SETTING_KEYS = new Set([
  'maxPlayers',
  'rounds',
  'drawTime',
  'wordCount',
  'hints',
  'wordMode',
  'isPrivate',
  'customWords'
]);

function validateRoomSettings(settings: unknown): Partial<RoomSettings> {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new Error('Room settings must be an object.');
  }

  const input = settings as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!ROOM_SETTING_KEYS.has(key)) {
      throw new Error(`Unknown room setting: ${key}.`);
    }
  }

  const validated: Partial<RoomSettings> = {};
  const boundedInteger = (key: string, minimum: number, maximum: number): number | undefined => {
    const value = input[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value;
  };

  const maxPlayers = boundedInteger('maxPlayers', 2, 20);
  const rounds = boundedInteger('rounds', 2, 10);
  const drawTime = boundedInteger('drawTime', 15, 240);
  const wordCount = boundedInteger('wordCount', 1, 5);
  const hints = boundedInteger('hints', 0, 5);
  if (maxPlayers !== undefined) validated.maxPlayers = maxPlayers;
  if (rounds !== undefined) validated.rounds = rounds;
  if (drawTime !== undefined) validated.drawTime = drawTime;
  if (wordCount !== undefined) validated.wordCount = wordCount;
  if (hints !== undefined) validated.hints = hints;

  if (input.wordMode !== undefined) {
    if (input.wordMode !== 'normal' && input.wordMode !== 'hidden' && input.wordMode !== 'combination') {
      throw new Error('wordMode must be normal, hidden, or combination.');
    }
    validated.wordMode = input.wordMode;
  }
  if (input.isPrivate !== undefined) {
    if (typeof input.isPrivate !== 'boolean') {
      throw new Error('isPrivate must be a boolean.');
    }
    validated.isPrivate = input.isPrivate;
  }
  if (input.customWords !== undefined) {
    validated.customWords = WordManager.sanitizeCustomWords(input.customWords);
  }

  return validated;
}

export class Room {
  public readonly id: string;
  public settings: RoomSettings;
  public hostId: string;
  public players: Map<string, Player> = new Map();
  public game: Game;
  public strokes: DrawStroke[] = [];
  public createdAt: number = Date.now();

  constructor(id: string, hostPlayer: Player, settings?: Partial<RoomSettings>) {
    this.id = id;
    this.hostId = hostPlayer.id;
    const validatedSettings = validateRoomSettings(settings ?? {});
    this.settings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...validatedSettings
    };
    this.game = new Game(this.settings);
    this.addPlayer(hostPlayer);
  }

  public addPlayer(player: Player): boolean {
    if (this.players.size >= this.settings.maxPlayers) {
      return false;
    }
    this.players.set(player.id, player);
    if (!this.hostId || !this.players.has(this.hostId)) {
      this.hostId = player.id;
      player.isHost = true;
    }
    return true;
  }

  public removePlayer(playerId: string): { removed: boolean; newHost: Player | null } {
    const player = this.players.get(playerId);
    if (!player) return { removed: false, newHost: null };

    this.players.delete(playerId);
    let newHost: Player | null = null;

    if (this.hostId === playerId && this.players.size > 0) {
      const remaining = Array.from(this.players.values());
      newHost = remaining[0];
      this.hostId = newHost.id;
      newHost.isHost = true;
    }

    return { removed: true, newHost };
  }

  public getPlayerBySocketId(socketId: string): Player | undefined {
    return Array.from(this.players.values()).find(p => p.socketId === socketId);
  }

  public updateSettings(newSettings: Partial<RoomSettings>): void {
    const validatedSettings = validateRoomSettings(newSettings);
    if (this.game.phase !== 'lobby') return; // Cannot modify settings once game starts

    this.settings = {
      ...this.settings,
      ...validatedSettings
    };
    this.game = new Game(this.settings);
  }

  public addStroke(stroke: DrawStroke): void {
    this.strokes.push(stroke);
  }

  public undoStroke(): DrawStroke | undefined {
    return this.strokes.pop();
  }

  public clearCanvas(): void {
    this.strokes = [];
  }

  public allGuessedExceptDrawer(): boolean {
    let guessers = 0;
    let correct = 0;
    this.players.forEach(p => {
      if (!p.isDrawing) {
        guessers++;
        if (p.hasGuessed) correct++;
      }
    });
    return guessers > 0 && correct === guessers;
  }

  public getPlayersList() {
    return Array.from(this.players.values()).map(p => p.toJSON());
  }

  public isEmpty(): boolean {
    return this.players.size === 0;
  }
}
