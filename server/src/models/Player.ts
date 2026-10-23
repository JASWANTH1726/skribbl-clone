import { PlayerData } from '@skribbl/shared';

export class Player {
  public readonly id: string;
  public name: string;
  public avatar: string;
  public score: number = 0;
  public isHost: boolean = false;
  public isReady: boolean = false;
  public hasGuessed: boolean = false;
  public isDrawing: boolean = false;
  public socketId: string;

  constructor(id: string, socketId: string, name: string, avatar: string = 'avatar_1', isHost: boolean = false) {
    this.id = id;
    this.socketId = socketId;
    this.name = name.trim();
    this.avatar = avatar;
    this.isHost = isHost;
    this.isReady = isHost; // Host is automatically ready
  }

  public resetRoundState(): void {
    this.hasGuessed = false;
    this.isDrawing = false;
  }

  public addScore(points: number): void {
    if (points > 0) {
      this.score += points;
    }
  }

  public toJSON(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      score: this.score,
      isHost: this.isHost,
      isReady: this.isReady,
      hasGuessed: this.hasGuessed,
      isDrawing: this.isDrawing
    };
  }
}
