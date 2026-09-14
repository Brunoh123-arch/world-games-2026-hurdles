/**
 * World Games 2026 — In-Race Heads-Up Display
 */
import { TRACK_LENGTH_M } from '../core/Constants';

export class HUD {
  private hudTop: HTMLElement;
  private hudBottom: HTMLElement;
  private timerEl: HTMLElement;
  private positionEl: HTMLElement;
  private speedFillEl: HTMLElement;
  private distanceEl: HTMLElement;

  constructor(parent: HTMLElement) {
    // ── Top HUD (timer + position) ──
    this.hudTop = document.createElement('div');
    this.hudTop.className = 'hud';
    this.hudTop.style.display = 'none';

    this.timerEl = document.createElement('div');
    this.timerEl.className = 'hud-timer';
    this.timerEl.textContent = '00:00.00';

    this.positionEl = document.createElement('div');
    this.positionEl.className = 'hud-position pos-1';
    this.positionEl.textContent = '1st';

    this.hudTop.appendChild(this.timerEl);
    this.hudTop.appendChild(this.positionEl);
    parent.appendChild(this.hudTop);

    // ── Bottom HUD (speed bar + distance) ──
    this.hudBottom = document.createElement('div');
    this.hudBottom.className = 'hud-bottom';
    this.hudBottom.style.display = 'none';

    const speedBar = document.createElement('div');
    speedBar.className = 'hud-speed-bar';
    this.speedFillEl = document.createElement('div');
    this.speedFillEl.className = 'hud-speed-fill';
    speedBar.appendChild(this.speedFillEl);

    this.distanceEl = document.createElement('div');
    this.distanceEl.className = 'hud-distance';
    this.distanceEl.textContent = `0m / ${TRACK_LENGTH_M}m`;

    this.hudBottom.appendChild(speedBar);
    this.hudBottom.appendChild(this.distanceEl);
    parent.appendChild(this.hudBottom);
  }

  update(time: number, position: 1 | 2 | 3, speed: number, maxSpeed: number, distance: number): void {
    // Timer
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    this.timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    // Position badge
    const suffixes = ['st', 'nd', 'rd'];
    this.positionEl.textContent = `${position}${suffixes[position - 1]}`;
    this.positionEl.className = `hud-position pos-${position}`;

    // Speed bar
    const pct = Math.min(100, Math.max(0, (speed / maxSpeed) * 100));
    this.speedFillEl.style.width = `${pct}%`;

    // Distance
    this.distanceEl.textContent = `${Math.floor(distance)}m / ${TRACK_LENGTH_M}m`;
  }

  show(): void {
    this.hudTop.style.display = 'flex';
    this.hudBottom.style.display = 'block';
  }

  hide(): void {
    this.hudTop.style.display = 'none';
    this.hudBottom.style.display = 'none';
  }
}
