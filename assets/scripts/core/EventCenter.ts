type EventHandler<T = unknown> = (payload: T) => void;

export class EventCenter {
  private static handlers = new Map<string, Set<EventHandler>>();

  static on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler as EventHandler);
  }

  static off<T>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  static emit<T>(event: string, payload: T): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  static clear(): void {
    this.handlers.clear();
  }
}
