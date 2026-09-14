/**
 * World Games 2026 — Typed Event Bus
 * Decoupled communication between game subsystems
 */
import type { GameEvent } from '../types';

type EventHandler = (event: GameEvent) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  /** Subscribe to a specific event type */
  on(eventType: GameEvent['type'], handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  /** Subscribe to ALL events */
  onAny(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  /** Emit an event to all matching subscribers */
  emit(event: GameEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (e) {
          console.error(`[EventBus] Error in handler for ${event.type}:`, e);
        }
      }
    }
    for (const handler of this.globalHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error(`[EventBus] Error in global handler:`, e);
      }
    }
  }

  /** Remove all listeners */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}
