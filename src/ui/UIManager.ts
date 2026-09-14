/**
 * World Games 2026 — UI Manager
 * Lightweight overlay container coordinator.
 * Individual UI components (HUD, CountrySelector, etc.) are created
 * and managed by GameManager directly.
 */
export class UIManager {
  private overlay: HTMLElement;

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
  }

  /** Get the overlay container */
  getOverlay(): HTMLElement {
    return this.overlay;
  }

  /** Hide all direct screen children */
  hideAll(): void {
    this.overlay.querySelectorAll('.screen').forEach((el) => {
      el.classList.add('hidden');
    });
  }
}
