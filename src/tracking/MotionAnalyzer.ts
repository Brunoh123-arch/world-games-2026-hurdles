/**
 * World Games 2026 — Motion Analyzer (High-Responsiveness Real-Time Engine)
 * Translates body pose landmarks into instantaneous runner velocity and hurdle jumps.
 */
import type { MotionState, CalibrationData } from '../types';
import { KEYPOINT } from '../types';

export class MotionAnalyzer {
  private calibration: CalibrationData | null = null;

  // ── Running oscillation tracking ──
  private lastOscillationTime = 0;
  private oscillationCount = 0;
  private lastVerticalDir: 'up' | 'down' | null = null;
  private prevTorsoY = 0;
  private lastKneeDiff = 0;
  private recentCadenceSteps: number[] = [];
  private currentSpeed = 0;

  // ── Jump detection ──
  private baselineWindow: number[] = [];
  private lastJumpTime = 0;

  constructor() {}

  public setCalibration(data: CalibrationData): void {
    this.calibration = data;
    this.prevTorsoY = data.baselineShoulderY;
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
    };

    if (!landmarks || landmarks.length < 25) {
      // Natural speed decay if tracking drops
      this.currentSpeed = Math.max(0, this.currentSpeed * 0.9);
      state.speedFactor = this.currentSpeed;
      return state;
    }

    const lShoulder = landmarks[KEYPOINT.LEFT_SHOULDER];
    const rShoulder = landmarks[KEYPOINT.RIGHT_SHOULDER];
    const lHip = landmarks[KEYPOINT.LEFT_HIP];
    const rHip = landmarks[KEYPOINT.RIGHT_HIP];
    const lWrist = landmarks[KEYPOINT.LEFT_WRIST];
    const rWrist = landmarks[KEYPOINT.RIGHT_WRIST];
    const lKnee = landmarks[KEYPOINT.LEFT_KNEE];
    const rKnee = landmarks[KEYPOINT.RIGHT_KNEE];

    const confS = (((lShoulder as any)?.visibility ?? 1.0) + ((rShoulder as any)?.visibility ?? 1.0)) / 2;
    state.confidence = confS;

    if (confS < 0.25) {
      this.currentSpeed = Math.max(0, this.currentSpeed * 0.9);
      state.speedFactor = this.currentSpeed;
      return state;
    }

    // Current torso center Y (lower number = higher on screen)
    const currentTorsoY = (lShoulder.y + rShoulder.y + (lHip?.y ?? lShoulder.y) + (rHip?.y ?? rShoulder.y)) / 4;

    // ── 1. REAL-TIME JUMP DETECTION ────────────────────────────
    this.detectJump(currentTorsoY, timestamp, state);

    // ── 2. REAL-TIME RUNNING CADENCE ───────────────────────────
    this.detectRunning(landmarks, currentTorsoY, timestamp, state);

    // ── 3. CELEBRATION (Arms Raised) ───────────────────────────
    if (lWrist && rWrist && lShoulder && rShoulder) {
      if ((lWrist.visibility ?? 1) > 0.4 && (rWrist.visibility ?? 1) > 0.4) {
        if (lWrist.y < lShoulder.y && rWrist.y < rShoulder.y) {
          state.armsRaised = true;
        }
      }
    }

    return state;
  }

  /**
   * Ultra-responsive jump detection:
   * Compares current torso height against the rolling running baseline.
   * If the body suddenly rises upward by > 4% of body frame, triggers JUMP immediately!
   */
  private detectJump(currentY: number, timestamp: number, state: MotionState): void {
    // Keep a rolling baseline of recent vertical position (~400ms = ~12 frames)
    this.baselineWindow.push(currentY);
    if (this.baselineWindow.length > 12) {
      this.baselineWindow.shift();
    }

    // Minimum cooldown between jumps (600ms)
    if (timestamp - this.lastJumpTime < 600) {
      return;
    }

    if (this.baselineWindow.length >= 6) {
      // Average height over recent moments
      const avgBaseline = this.baselineWindow.reduce((a, b) => a + b, 0) / this.baselineWindow.length;
      
      // Moving UP means currentY is LESS than baseline (0 is top of screen)
      const upwardDisplacement = avgBaseline - currentY;

      // Sensitivity threshold (lowered from 0.15 to 0.035 for instant responsive hops)
      const bodyScale = this.calibration ? this.calibration.bodyHeight : 0.35;
      const threshold = Math.max(0.025, bodyScale * 0.10);

      if (upwardDisplacement > threshold) {
        state.jumpDetected = true;
        this.lastJumpTime = timestamp;
        // Reset baseline window after jump
        this.baselineWindow = [currentY];
      }
    }
  }

  /**
   * Ultra-responsive running detection:
   * Uses both knee alternate lifting AND vertical bouncing of the torso.
   */
  private detectRunning(
    landmarks: { x: number; y: number; visibility?: number }[],
    torsoY: number,
    timestamp: number,
    state: MotionState
  ): void {
    let stepDetected = false;

    // A. Knee-based step detection (if legs are visible)
    const lKnee = landmarks[KEYPOINT.LEFT_KNEE];
    const rKnee = landmarks[KEYPOINT.RIGHT_KNEE];
    const kneesVisible = lKnee && rKnee && (lKnee.visibility ?? 0) > 0.4 && (rKnee.visibility ?? 0) > 0.4;

    if (kneesVisible) {
      const kneeDiff = lKnee.y - rKnee.y; // positive when right knee is higher
      // Detect transition when alternating knees pass each other with amplitude
      if (Math.abs(kneeDiff) > 0.04) {
        if ((kneeDiff > 0 && this.lastKneeDiff <= 0) || (kneeDiff < 0 && this.lastKneeDiff >= 0)) {
          stepDetected = true;
          this.lastKneeDiff = kneeDiff;
        }
      }
    }

    // B. Vertical torso bounce (works even when knees are not in frame)
    if (!stepDetected && this.prevTorsoY > 0) {
      const deltaY = torsoY - this.prevTorsoY;
      // If moving with sufficient vertical speed (running bounce)
      if (Math.abs(deltaY) > 0.008) {
        const currentDir = deltaY < 0 ? 'up' : 'down';
        if (this.lastVerticalDir && currentDir !== this.lastVerticalDir) {
          // Direction reversal at bottom or top of bounce = half step!
          stepDetected = true;
          this.lastVerticalDir = currentDir;
        } else if (!this.lastVerticalDir) {
          this.lastVerticalDir = currentDir;
        }
      }
    }
    this.prevTorsoY = torsoY;

    // Record step timestamp
    if (stepDetected) {
      // Debounce steps (no faster than 8 steps/sec = 125ms)
      if (timestamp - this.lastOscillationTime > 110) {
        this.recentCadenceSteps.push(timestamp);
        this.lastOscillationTime = timestamp;
      }
    }

    // Keep steps from the last 1.2 seconds
    while (this.recentCadenceSteps.length > 0 && timestamp - this.recentCadenceSteps[0] > 1200) {
      this.recentCadenceSteps.shift();
    }

    // Calculate Cadence (steps per second)
    const stepsInWindow = this.recentCadenceSteps.length;
    const sps = (stepsInWindow / 1.2);
    state.cadence = sps;

    // Responsive speed mapping:
    // 0 steps -> 0
    // 1 step/sec -> 0.45 (solid jog)
    // 2 steps/sec -> 0.80 (fast sprint)
    // 3+ steps/sec -> 1.0 (MAX TURBO SPEED)
    let targetSpeed = 0.0;
    if (sps >= 3.0) {
      targetSpeed = 1.0;
    } else if (sps >= 2.0) {
      targetSpeed = 0.75 + ((sps - 2.0) / 1.0) * 0.25;
    } else if (sps >= 1.0) {
      targetSpeed = 0.40 + ((sps - 1.0) / 1.0) * 0.35;
    } else if (sps >= 0.4) {
      targetSpeed = 0.25;
    } else {
      targetSpeed = 0.0;
    }

    // High responsiveness: accelerate fast (0.35), decelerate smoothly (0.12)
    const lerpRate = targetSpeed > this.currentSpeed ? 0.35 : 0.12;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * lerpRate;

    state.speedFactor = this.currentSpeed;
    state.isRunning = this.currentSpeed > 0.15;
  }

  public reset(): void {
    this.recentCadenceSteps = [];
    this.baselineWindow = [];
    this.currentSpeed = 0;
    this.lastJumpTime = 0;
    this.lastOscillationTime = 0;
    this.lastVerticalDir = null;
    this.lastKneeDiff = 0;
    this.prevTorsoY = 0;
  }
}
