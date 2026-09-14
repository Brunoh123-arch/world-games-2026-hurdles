/**
 * World Games 2026 — Post-Race Podium / Results Screen
 */
import { EventBus } from '../core/EventBus';
import type { RaceResult } from '../types';

export class PodiumScreen {
  private container: HTMLElement;
  private events: EventBus;
  private medalEl: HTMLElement;
  private titleEl: HTMLElement;
  private timeEl: HTMLElement;
  private statsEl: HTMLElement;

  constructor(parent: HTMLElement, events: EventBus) {
    this.events = events;

    this.container = document.createElement('div');
    this.container.className = 'screen screen-podium hidden';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'podium-title';
    this.titleEl.textContent = 'RACE FINISHED!';
    this.container.appendChild(this.titleEl);

    this.medalEl = document.createElement('div');
    this.medalEl.className = 'podium-medal';
    this.container.appendChild(this.medalEl);

    this.timeEl = document.createElement('div');
    this.timeEl.className = 'podium-time';
    this.container.appendChild(this.timeEl);

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'podium-stats';
    this.container.appendChild(this.statsEl);

    const btn = document.createElement('button');
    btn.className = 'play-again-btn';
    btn.textContent = 'PLAY AGAIN';
    btn.addEventListener('click', () => {
      this.events.emit({ type: 'PLAY_AGAIN' });
    });
    this.container.appendChild(btn);

    parent.appendChild(this.container);
  }

  show(result: RaceResult): void {
    const medals = ['🥇', '🥈', '🥉'];
    const suffixes = ['st', 'nd', 'rd'];

    this.medalEl.textContent = medals[result.place - 1] || '🏅';
    this.titleEl.textContent = `${result.place}${suffixes[result.place - 1]} Place!`;
    this.timeEl.textContent = `${result.time.toFixed(3)}s`;

    this.statsEl.innerHTML = `
      <div class="podium-stat">
        <div class="podium-stat-value">${result.hurdlesCleared}/${result.hurdlesTotal}</div>
        <div class="podium-stat-label">Hurdles Cleared</div>
      </div>
      <div class="podium-stat">
        <div class="podium-stat-value">${Math.round(result.topCadence)}</div>
        <div class="podium-stat-label">Top Cadence SPM</div>
      </div>
      <div class="podium-stat">
        <div class="podium-stat-value">${result.country.flag}</div>
        <div class="podium-stat-label">${result.country.name}</div>
      </div>
    `;

    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
  }
}
