/**
 * Real-time User Presence Tracker
 * Keeps track of connected sockets per user to support multiple browser tabs
 */
class PresenceTracker {
  // Map of userId -> Set of socketIds
  private userSockets: Map<string, Set<string>> = new Map();
  // Map of socketId -> userId for fast lookup during disconnect
  private socketToUser: Map<string, string> = new Map();

  public add(userId: string, socketId: string): { isNewUser: boolean; onlineCount: number } {
    this.socketToUser.set(socketId, userId);
    
    let sockets = this.userSockets.get(userId);
    const isNewUser = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);

    return {
      isNewUser,
      onlineCount: this.getOnlineCount(),
    };
  }

  public remove(socketId: string): { isUserOffline: boolean; userId?: string; onlineCount: number } {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return { isUserOffline: false, onlineCount: this.getOnlineCount() };
    }

    this.socketToUser.delete(socketId);
    const sockets = this.userSockets.get(userId);

    let isUserOffline = false;
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        isUserOffline = true;
      }
    }

    return {
      isUserOffline,
      userId,
      onlineCount: this.getOnlineCount(),
    };
  }

  public isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  public getOnlineCount(): number {
    return this.userSockets.size;
  }

  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }
}

export const presenceTracker = new PresenceTracker();
