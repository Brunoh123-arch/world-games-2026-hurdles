/**
 * World Games 2026 — Pre-Race Body Calibration
 * Detects when the user is at proper distance with shoulders + hips visible,
 * then measures baseline body proportions for motion analysis.
 */
import type { CalibrationData } from '../types';
import { KEYPOINT } from '../types';
import { EventBus } from '../core/EventBus';
import { CALIBRATION_STABLE_FRAMES, CALIBRATION_CONFIDENCE, CALIBRATION_VARIANCE } from '../core/Constants';

export class CalibrationScreen {
  private events: EventBus;
  private overlay: HTMLElement;
  private textEl: HTMLElement;
  private statusEl: HTMLElement;

  private calibrated = false;
  private stableFrames = 0;
  private shoulderYHistory: number[] = [];
  private hipYHistory: number[] = [];

  private data: CalibrationData = {
    baselineShoulderY: 0,
    baselineHipY: 0,
    bodyHeight: 0,
    isCalibrated: false,
    stableFrames: 0,
  };

  constructor(events: EventBus) {
    this.events = events;

    // Create overlay UI
    this.overlay = document.createElement('div');
    this.overlay.className = 'screen screen-calibration hidden';

    const silhouette = document.createElement('div');
    silhouette.className = 'calibration-silhouette';
    silhouette.innerHTML = '<div style="font-size:3rem;">🏃</div>';
    this.overlay.appendChild(silhouette);

    this.textEl = document.createElement('div');
    this.textEl.className = 'calibration-text';
    this.textEl.textContent = 'Step back ~1.5m so your upper body fits the outline';
    this.overlay.appendChild(this.textEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'calibration-status';
    this.statusEl.textContent = '';
    this.overlay.appendChild(this.statusEl);

    // UI Buttons
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.flexDirection = 'column';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '20px';
    btnContainer.style.alignItems = 'center';

    const quickStartBtn = document.createElement('button');
    quickStartBtn.className = 'start-race-btn';
    quickStartBtn.style.fontSize = '0.9rem';
    quickStartBtn.style.padding = '12px 28px';
    quickStartBtn.textContent = '⚡ ENTRAR NA PISTA AGORA';
    quickStartBtn.addEventListener('click', () => {
      this.finalize();
    });

    const tipText = document.createElement('div');
    tipText.style.fontSize = '0.75rem';
    tipText.style.color = '#94a3b8';
    tipText.style.textAlign = 'center';
    tipText.style.maxWidth = '280px';
    tipText.textContent = '💡 Dica: Sem câmera? Use Espaço para pular e Setas para correr, ou toque na tela!';

    btnContainer.appendChild(quickStartBtn);
    btnContainer.appendChild(tipText);
    this.overlay.appendChild(btnContainer);

    document.getElementById('ui-overlay')!.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.classList.remove('hidden');
    this.reset();
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  setNotice(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.style.color = '#f59e0b';
  }

  private reset(): void {
    this.calibrated = false;
    this.stableFrames = 0;
    this.shoulderYHistory = [];
    this.hipYHistory = [];
    this.data = {
      baselineShoulderY: 0,
      baselineHipY: 0,
      bodyHeight: 0,
      isCalibrated: false,
      stableFrames: 0,
    };
    this.textEl.textContent = 'Posicione-se em frente à câmera para calibrar o corpo';
    this.statusEl.textContent = '📸 Detectando corredor...';
  }

  update(landmarks: { x: number; y: number; visibility?: number }[]): void {
    if (this.calibrated || !landmarks || landmarks.length < 13) return;

    const lShoulder = landmarks[KEYPOINT.LEFT_SHOULDER];
    const rShoulder = landmarks[KEYPOINT.RIGHT_SHOULDER];
    if (!lShoulder || !rShoulder) return;

    const conf = (pt: any) => (pt && typeof pt.visibility === 'number' ? pt.visibility : 1.0);
    const shouldersVisible = conf(lShoulder) > 0.3 && conf(rShoulder) > 0.3;

    if (!shouldersVisible) {
      this.shoulderYHistory = [];
      this.hipYHistory = [];
      this.stableFrames = 0;
      this.textEl.textContent = 'Dê um passo atrás para que seu tronco fique visível';
      this.statusEl.textContent = '⚠️ Buscando corredor na câmera...';
      return;
    }

    const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const lHip = landmarks[KEYPOINT.LEFT_HIP];
    const rHip = landmarks[KEYPOINT.RIGHT_HIP];
    const avgHipY = (lHip && rHip) ? (lHip.y + rHip.y) / 2 : avgShoulderY + 0.35;

    this.shoulderYHistory.push(avgShoulderY);
    this.hipYHistory.push(avgHipY);

    if (this.shoulderYHistory.length > 20) {
      this.shoulderYHistory.shift();
      this.hipYHistory.shift();
    }

    if (this.shoulderYHistory.length >= 10) {
      this.stableFrames++;
      const pct = Math.min(100, Math.round((this.stableFrames / 15) * 100));
      this.statusEl.textContent = `✅ Calibrando corpo... (${pct}%)`;

      if (this.stableFrames >= 15) {
        this.finalize();
      }
    } else {
      this.textEl.textContent = 'Ótimo! Fique na posição para largada...';
      this.statusEl.textContent = `📸 Pronto para calibrar (${this.shoulderYHistory.length}/10)`;
    }
  }

  private finalize(): void {
    if (this.calibrated) return;
    this.calibrated = true;

    const meanShoulderY = this.shoulderYHistory.length > 0
      ? this.shoulderYHistory.reduce((a, b) => a + b, 0) / this.shoulderYHistory.length
      : 0.35;
    const meanHipY = this.hipYHistory.length > 0
      ? this.hipYHistory.reduce((a, b) => a + b, 0) / this.hipYHistory.length
      : 0.65;
    const bodyHeight = Math.max(0.2, Math.abs(meanShoulderY - meanHipY));

    this.data = {
      baselineShoulderY: meanShoulderY,
      baselineHipY: meanHipY,
      bodyHeight,
      isCalibrated: true,
      stableFrames: Math.max(20, this.stableFrames),
    };

    this.textEl.textContent = '✅ Calibração Concluída!';
    this.statusEl.textContent = 'Indo para a pista de atletismo...';

    setTimeout(() => {
      this.events.emit({ type: 'CALIBRATION_COMPLETE', data: this.data });
    }, 500);
  }

  isCalibrated(): boolean {
    return this.calibrated;
  }

  getData(): CalibrationData {
    return this.data;
  }
}
