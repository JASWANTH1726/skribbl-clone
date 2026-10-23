import { Room } from './Room.js';
import { Player } from './Player.js';
import { RoomSettings } from '@skribbl/shared';

export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, Room> = new Map();

  private constructor() {}

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  public createRoom(hostPlayer: Player, settings?: Partial<RoomSettings>): Room {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, hostPlayer, settings);
    this.rooms.set(roomId, room);
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  public findRoomBySocketId(socketId: string): { room: Room; player: Player } | undefined {
    for (const room of this.rooms.values()) {
      const player = room.getPlayerBySocketId(socketId);
      if (player) {
        return { room, player };
      }
    }
    return undefined;
  }

  public removeRoom(roomId: string): boolean {
    return this.rooms.delete(roomId.toUpperCase());
  }

  public cleanEmptyRooms(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.isEmpty()) {
        room.game.stopTimer();
        this.rooms.delete(roomId);
      }
    }
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  private generateRoomId(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    do {
      result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(result));
    return result;
  }
}
