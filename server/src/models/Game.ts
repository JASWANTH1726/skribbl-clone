import { GamePhase, GameState, LeaderboardEntry } from '@skribbl/shared';
import { Player } from './Player.js';

export interface GameOptions {
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
}

export class Game {
  public phase: GamePhase = 'lobby';
  public currentRound: number = 0;
  public totalRounds: number = 3;
  public drawTime: number = 80;
  public wordCount: number = 3;
  public maxHints: number = 2;

  public drawerId: string | null = null;
  public currentWord: string | null = null;
  public wordOptions: string[] = [];
  public maskedWord: string = '';
  public revealedIndices: Set<number> = new Set();

  public timeLeft: number = 0;
  private turnOrder: string[] = [];
  private currentTurnIndex: number = -1;
  private timerInterval: NodeJS.Timeout | null = null;

  constructor(options?: Partial<GameOptions>) {
    if (options?.rounds) this.totalRounds = Math.min(Math.max(options.rounds, 2), 10);
    if (options?.drawTime) this.drawTime = Math.min(Math.max(options.drawTime, 15), 240);
    if (options?.wordCount) this.wordCount = Math.min(Math.max(options.wordCount, 1), 5);
    if (options?.hints !== undefined) this.maxHints = Math.min(Math.max(options.hints, 0), 5);
  }

  public initGame(players: Player[]): void {
    this.phase = 'word_select';
    this.currentRound = 1;
    this.turnOrder = players.map(p => p.id);
    this.currentTurnIndex = -1;
    players.forEach(p => (p.score = 0));
  }

  public nextTurn(players: Map<string, Player>): { hasNext: boolean; drawer: Player | null } {
    this.stopTimer();
    this.currentTurnIndex++;

    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentRound++;
      this.currentTurnIndex = 0;
    }

    if (this.currentRound > this.totalRounds) {
      this.phase = 'game_over';
      return { hasNext: false, drawer: null };
    }

    // Reset player round states
    players.forEach(p => p.resetRoundState());

    const nextDrawerId = this.turnOrder[this.currentTurnIndex];
    const drawer = players.get(nextDrawerId);

    if (!drawer) {
      // Player might have left
      if (this.turnOrder.length > 0) {
        return this.nextTurn(players);
      }
      this.phase = 'game_over';
      return { hasNext: false, drawer: null };
    }

    this.drawerId = drawer.id;
    drawer.isDrawing = true;
    this.phase = 'word_select';
    this.currentWord = null;
    this.maskedWord = '';
    this.revealedIndices.clear();

    return { hasNext: true, drawer };
  }

  public setChosenWord(word: string): void {
    this.currentWord = word.trim().toLowerCase();
    this.phase = 'drawing';
    this.timeLeft = this.drawTime;
    this.revealedIndices.clear();
    this.generateMaskedWord();
  }

  public generateMaskedWord(): string {
    if (!this.currentWord) return '';
    const chars = this.currentWord.split('');
    const masked = chars.map((char, index) => {
      if (char === ' ' || char === '-') return char;
      if (this.revealedIndices.has(index)) return char;
      return '_';
    });
    this.maskedWord = masked.join(' ');
    return this.maskedWord;
  }

  public revealHint(): boolean {
    if (!this.currentWord) return false;
    if (this.revealedIndices.size >= this.maxHints) return false;

    const unrevealed: number[] = [];
    for (let i = 0; i < this.currentWord.length; i++) {
      const char = this.currentWord[i];
      if (char !== ' ' && char !== '-' && !this.revealedIndices.has(i)) {
        unrevealed.push(i);
      }
    }

    if (unrevealed.length <= 1) return false; // Keep at least one hidden letter

    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    this.revealedIndices.add(randomIndex);
    this.generateMaskedWord();
    return true;
  }

  public calculateGuessPoints(): number {
    const timeFraction = Math.max(0, this.timeLeft) / this.drawTime;
    // Max 500 points, min 100 points based on speed
    return Math.round(100 + timeFraction * 400);
  }

  public calculateDrawerPoints(guessersCount: number, totalGuessers: number): number {
    if (totalGuessers <= 0) return 0;
    // Drawer gets points proportionally to how many players guessed the word
    return Math.round((guessersCount / totalGuessers) * 250);
  }

  public checkWord(guess: string): { isCorrect: boolean; isClose: boolean } {
    if (!this.currentWord) return { isCorrect: false, isClose: false };
    const cleaned = guess.trim().toLowerCase();
    if (cleaned === this.currentWord) {
      return { isCorrect: true, isClose: false };
    }

    // Levenshtein / partial match for "close" warning
    const isClose = this.isCloseMatch(cleaned, this.currentWord);
    return { isCorrect: false, isClose };
  }

  private isCloseMatch(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 2) return false;
    if (a.length < 3 || b.length < 3) return false;

    let mismatches = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
        mismatches++;
        if (mismatches > 2) return false;
      }
    }
    return mismatches === 1;
  }

  public stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public getLeaderboard(players: Map<string, Player>): LeaderboardEntry[] {
    const list = Array.from(players.values()).map(p => ({
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      rank: 1
    }));

    list.sort((a, b) => b.score - a.score);
    list.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return list;
  }

  public toJSON(roomId: string, players: Map<string, Player>): GameState {
    const scores: Record<string, number> = {};
    players.forEach(p => {
      scores[p.id] = p.score;
    });

    const drawer = this.drawerId ? players.get(this.drawerId) : null;

    return {
      roomId,
      phase: this.phase,
      round: this.currentRound,
      totalRounds: this.totalRounds,
      drawerId: this.drawerId,
      drawerName: drawer ? drawer.name : null,
      wordLength: this.currentWord ? this.currentWord.length : undefined,
      hints: this.maskedWord ? this.maskedWord.split(' ') : [],
      timeLeft: this.timeLeft,
      totalTime: this.drawTime,
      scores
    };
  }
}
