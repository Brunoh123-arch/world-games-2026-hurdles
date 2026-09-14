/**
 * World Games 2026 — Hurdles Race
 * Application entry point
 *
 * Bootstraps the game: shows loading screen, initializes all subsystems,
 * then transitions to country selection.
 */
import './style.css';
import { GameManager } from './core/GameManager';
import { GameState } from './types';

async function main(): Promise<void> {
  /* ── Loading Screen ─────────────────────────────────── */
  const overlay = document.getElementById('ui-overlay')!;

  const loadingScreen = document.createElement('div');
  loadingScreen.className = 'screen screen-title';
  loadingScreen.innerHTML = `
    <div class="title-logo">WORLD GAMES<br/>2026</div>
    <div class="title-subtitle">100M HURDLES</div>
    <div class="loading-bar-container">
      <div class="loading-bar" id="loading-bar"></div>
    </div>
    <div class="loading-text" id="loading-text">Initializing...</div>
  `;
  overlay.appendChild(loadingScreen);

  const loadingBar = document.getElementById('loading-bar')!;
  const loadingText = document.getElementById('loading-text')!;

  /* ── Initialize Game ────────────────────────────────── */
  const container = document.getElementById('game-canvas')!;
  const game = new GameManager(container);

  try {
    await game.init((msg, pct) => {
      loadingBar.style.width = `${pct}%`;
      loadingText.textContent = msg;
    });
  } catch (error) {
    console.error('Failed to initialize game:', error);
    loadingText.textContent = 'Error loading game. Please refresh.';
    loadingText.style.color = '#ef4444';
    return;
  }

  /* ── Start Game Loop ────────────────────────────────── */
  game.start();

  // Brief pause on loading screen then transition
  await new Promise((r) => setTimeout(r, 800));
  loadingScreen.classList.add('hidden');
  setTimeout(() => loadingScreen.remove(), 500);

  // Go to country select
  game.transitionTo(GameState.COUNTRY_SELECT);

  // Expose for debugging
  (window as any).__game = game;
}

// ── Boot ──
main().catch(console.error);
