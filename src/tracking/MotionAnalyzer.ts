/**
 * World Games 2026 — Motion Analyzer (High-Responsiveness Real-Time Engine)
 * Translates body pose landmarks into instantaneous runner velocity and hurdle jumps.
 */
import type { MotionState, CalibrationData } from '../types';
import { KEYPOINT } from '../types';

export class MotionAnalyzer {
  private calibration: CalibrationData | null = null;

  // ── Histórico de movimento ──
  private prevPoints: { x: number; y: number }[] = [];
  private prevTorsoY = 0;
  private prevTorsoDir: 'up' | 'down' | null = null;
  private prevKneeSign = 0; // -1: perna direita alta, +1: perna esquerda alta, 0: neutro
  private prevArmSign = 0;  // -1: braço direito alto, +1: braço esquerdo alto, 0: neutro

  private recentSteps: number[] = [];
  private lastStepTime = 0;
  private currentSpeedFactor = 0;
  private currentInstantCadence = 0;

  // ── Jump ──
  private baselineYWindow: number[] = [];
  private lastJumpTime = 0;

  constructor() {}

  public setCalibration(data: CalibrationData): void {
    this.calibration = data;
    this.prevTorsoY = data.baselineShoulderY || 0.35;
  }

  public update(
    landmarks: { x: number; y: number; visibility?: number }[],
    timestamp: number
  ): MotionState {
    const state: MotionState = {
      cadence: 0,
      isRunning: false,
      speedFactor: 0.0,
      jumpDetected: false,
      armsRaised: false,
      confidence: 0,
      kneesTracked: false,
    };

    if (!landmarks || landmarks.length < 17) {
      this.currentSpeedFactor = 0;
      this.recentSteps = [];
      state.speedFactor = 0;
      state.isRunning = false;
      return state;
    }

    const nose = landmarks[KEYPOINT.NOSE];
    const lShoulder = landmarks[KEYPOINT.LEFT_SHOULDER];
    const rShoulder = landmarks[KEYPOINT.RIGHT_SHOULDER];
    const lWrist = landmarks[KEYPOINT.LEFT_WRIST];
    const rWrist = landmarks[KEYPOINT.RIGHT_WRIST];
    const lKnee = landmarks[KEYPOINT.LEFT_KNEE];
    const rKnee = landmarks[KEYPOINT.RIGHT_KNEE];

    const confS = (((lShoulder as any)?.visibility ?? 1.0) + ((rShoulder as any)?.visibility ?? 1.0)) / 2;
    state.confidence = confS;

    // Altura de referência do tronco superior (cabeça + ombros)
    const upperY = (nose.y + lShoulder.y + rShoulder.y) / 3;

    // ── 1. DETECÇÃO DE PULO (Físico real OU os 2 braços acima da cabeça) ──
    this.detectJump(upperY, lWrist, rWrist, lShoulder, rShoulder, nose, timestamp, state);

    // ── 2. VERIFICAÇÃO RIGOROSA DAS PERNAS / JOELHOS ─────────────
    // O boneco SO anda se as pernas estiverem visíveis e o jogador correr no lugar!
    const lKneeVis = (lKnee?.visibility ?? 0) > 0.30;
    const rKneeVis = (rKnee?.visibility ?? 0) > 0.30;
    const kneesTracked = !!(lKnee && rKnee && lKneeVis && rKneeVis && lKnee.y < 0.95 && rKnee.y < 0.95);
    state.kneesTracked = kneesTracked;

    let stepDetected = false;

    if (kneesTracked) {
      // Diferença vertical entre joelhos (y = 0 topo, y = 1 chão)
      // Quando a perna esquerda levanta, lKnee.y diminui (sobe na tela) -> kneeDiff positivo
      const kneeDiff = rKnee.y - lKnee.y;

      if (kneeDiff > 0.038 && this.prevKneeSign !== 1) {
        // Joelho esquerdo levantou na passada
        this.prevKneeSign = 1;
        stepDetected = true;
      } else if (kneeDiff < -0.038 && this.prevKneeSign !== -1) {
        // Joelho direito levantou na passada
        this.prevKneeSign = -1;
        stepDetected = true;
      }
    } else {
      // Se as pernas NÃO estão visíveis (jogador sentado ou perto demais):
      // Zera o histórico imediatamente para que o boneco NÃO ANDE NUNCA SOZINHO!
      this.recentSteps = [];
      this.currentSpeedFactor = 0;
      this.prevKneeSign = 0;
    }

    // ── 3. REGISTRO DE PASSADAS E CÁLCULO DE CADÊNCIA EM TEMPO REAL ─────────
    if (stepDetected) {
      const stepDelta = timestamp - this.lastStepTime;
      if (stepDelta >= 110) { // Max ~9 passos/s
        this.recentSteps.push(timestamp);
        // Cadência instantânea entre passos alternados consecutivos (Zero Delay)
        if (stepDelta < 600) {
          this.currentInstantCadence = Math.min(5.5, 1000 / stepDelta);
        } else {
          // Primeira passada vindo do repouso: resposta imediata
          this.currentInstantCadence = 2.4;
        }
        this.lastStepTime = timestamp;
      }
    }

    // Janela deslizante de 1.0s para estabilidade
    while (this.recentSteps.length > 0 && timestamp - this.recentSteps[0] > 1000) {
      this.recentSteps.shift();
    }

    // Se ficar mais de 380ms sem dar passada, o jogador parou de correr no lugar
    const timeSinceLastStep = timestamp - this.lastStepTime;
    let cadenceHz = 0;
    if (kneesTracked && timeSinceLastStep <= 380) {
      cadenceHz = Math.max(this.currentInstantCadence, this.recentSteps.length);
    } else {
      cadenceHz = 0;
      this.currentInstantCadence = 0;
      this.recentSteps = [];
    }
    state.cadence = cadenceHz;

    // ── 4. VELOCIDADE ESTRITAMENTE VINCULADA À CADÊNCIA DOS JOELHOS ──
    let targetSpeed = 0.0;
    if (cadenceHz >= 3.5) {
      // Sprint máximo / Turbo (4+ passos por segundo)
      targetSpeed = 1.0;
    } else if (cadenceHz >= 2.5) {
      // Corrida rápida (85%)
      targetSpeed = 0.85;
    } else if (cadenceHz >= 1.8) {
      // Corrida moderada (65%)
      targetSpeed = 0.65;
    } else if (cadenceHz >= 1.0) {
      // Trote leve inicial (45%)
      targetSpeed = 0.45;
    } else {
      // PARADO ABSOLUTO (Sem movimento ou pernas não visíveis)
      targetSpeed = 0.0;
    }

    // Aceleração ultrarrápida (0.65) e parada direta (0.50) sem delay
    if (targetSpeed > this.currentSpeedFactor) {
      this.currentSpeedFactor += (targetSpeed - this.currentSpeedFactor) * 0.65;
    } else {
      this.currentSpeedFactor += (targetSpeed - this.currentSpeedFactor) * 0.50;
      if (this.currentSpeedFactor < 0.03) {
        this.currentSpeedFactor = 0.0;
      }
    }

    state.speedFactor = this.currentSpeedFactor;
    state.isRunning = this.currentSpeedFactor > 0.05 && cadenceHz >= 1.0;

    return state;
  }

  private detectJump(
    upperY: number,
    lWrist: any,
    rWrist: any,
    lShoulder: any,
    rShoulder: any,
    nose: any,
    timestamp: number,
    state: MotionState
  ): void {
    // Cooldown entre pulos (600ms)
    if (timestamp - this.lastJumpTime < 600) {
      return;
    }

    // ── 1. SALTO FÍSICO REAL (Estilo Kinect Sports) ──
    // O jogador pula no lugar com o corpo (cabeça/tronco sobem rápido na tela)
    this.baselineYWindow.push(upperY);
    if (this.baselineYWindow.length > 8) {
      this.baselineYWindow.shift();
    }

    if (this.baselineYWindow.length >= 4) {
      const avgY = this.baselineYWindow.reduce((a, b) => a + b, 0) / this.baselineYWindow.length;
      const upwardDelta = avgY - upperY;

      // Subida vertical nítida do corpo (> 3.8% da tela para não confundir com o quique da corrida)
      if (upwardDelta > 0.038) {
        state.jumpDetected = true;
        this.lastJumpTime = timestamp;
        this.baselineYWindow = [upperY];
        return;
      }
    }

    // ── 2. GESTO DE SALTO: OS DOIS BRAÇOS ERGUIDOS JUNTOS ACIMA DA CABEÇA ──
    // Mexer apenas UMA mão, balançar ou dar tchau NUNCA ativa o pulo!
    if (lWrist && rWrist && nose && lShoulder && rShoulder) {
      const lVis = (lWrist.visibility ?? 0) > 0.35;
      const rVis = (rWrist.visibility ?? 0) > 0.35;

      // Os DOIS pulsos precisam estar simultaneamente bem acima da cabeça (nariz)
      const bothArmsRaisedHigh = lVis && rVis &&
        (lWrist.y < nose.y - 0.04) &&
        (rWrist.y < nose.y - 0.04);

      if (bothArmsRaisedHigh) {
        state.jumpDetected = true;
        this.lastJumpTime = timestamp;
        state.armsRaised = true;
      }
    }
  }

  public reset(): void {
    this.recentSteps = [];
    this.baselineYWindow = [];
    this.currentSpeedFactor = 0;
    this.lastJumpTime = 0;
    this.lastStepTime = 0;
    this.prevTorsoDir = null;
    this.prevTorsoY = 0;
    this.prevKneeSign = 0;
    this.prevArmSign = 0;
    this.prevPoints = [];
  }
}
