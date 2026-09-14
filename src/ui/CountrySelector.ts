/**
 * World Games 2026 — Country / Jersey Selection Screen
 */
import { COUNTRIES } from '../core/Constants';
import { EventBus } from '../core/EventBus';
import type { Country } from '../types';

export class CountrySelector {
  private container: HTMLElement;
  private events: EventBus;
  private selectedIndex = 0;

  constructor(parent: HTMLElement, events: EventBus) {
    this.events = events;

    this.container = document.createElement('div');
    this.container.className = 'screen screen-country hidden';

    // Title
    const title = document.createElement('div');
    title.className = 'country-title';
    title.textContent = '🏆 SELECT YOUR COUNTRY';
    this.container.appendChild(title);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'country-grid';

    COUNTRIES.forEach((country, index) => {
      const btn = document.createElement('button');
      btn.className = `country-btn${index === 0 ? ' selected' : ''}`;

      const flag = document.createElement('span');
      flag.className = 'country-flag';
      flag.textContent = country.flag;

      const name = document.createElement('span');
      name.textContent = country.name;

      const swatch = document.createElement('div');
      swatch.className = 'country-swatch';
      swatch.style.backgroundColor = `#${country.jerseyColor.toString(16).padStart(6, '0')}`;

      btn.appendChild(flag);
      btn.appendChild(name);
      btn.appendChild(swatch);

      btn.addEventListener('click', () => {
        grid.querySelectorAll('.country-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedIndex = index;
      });

      grid.appendChild(btn);
    });

    this.container.appendChild(grid);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.className = 'start-race-btn';
    startBtn.textContent = 'START RACE';
    startBtn.addEventListener('click', () => {
      this.events.emit({ type: 'COUNTRY_SELECTED', country: COUNTRIES[this.selectedIndex] });
    });
    this.container.appendChild(startBtn);

    parent.appendChild(this.container);
  }

  show(): void {
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
  }
}
