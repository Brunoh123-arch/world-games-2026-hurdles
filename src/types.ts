/**
 * World Games 2026 — Hurdles Race
 * Shared type definitions and interfaces
 */

/* ── Game State Machine ───────────────────────────────────── */
export enum GameState {
  LOADING = 'LOADING',
  COUNTRY_SELECT = 'COUNTRY_SELECT',
  CALIBRATION = 'CALIBRATION',
  COUNTDOWN = 'COUNTDOWN',
  RACING = 'RACING',
  FINISH = 'FINISH',
  PODIUM = 'PODIUM',
}

/* ── Country / Jersey Selection ───────────────────────────── */
export interface Country {
  id: string;
  name: string;
  flag: string;
  jerseyColor: number;    // Three.js hex color
  shortsColor: number;
  accentColor: number;
}

/* ── Runner Data ──────────────────────────────────────────── */
export interface RunnerData {
  id: number;
  lane: number;              // 0, 1, 2
  position: number;          // distance in meters (0-100)
  speed: number;             // current m/s
  maxSpeed: number;          // peak speed this race
  isJumping: boolean;
  jumpProgress: number;      // 0-1 arc
  isStumbling: boolean;
  stumbleTimer: number;
  hurdlesCleared: number;
  hurdlesHit: number;
  finishTime: number | null;
  isAI: boolean;
  country: Country;
  cadence: number;           // steps per second (player only)
}

/* ── Hurdle State ─────────────────────────────────────────── */
export interface HurdleData {
  laneIndex: number;
  distanceM: number;         // position on track in meters
  isKnocked: boolean;
  knockAngle: number;        // rotation when knocked
}

/* ── Pose Keypoint Indices (BlazePose 33-point) ───────────── */
export const KEYPOINT = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/* ── Motion Analysis Output ───────────────────────────────── */
export interface MotionState {
  cadence: number;           // steps per second
  isRunning: boolean;
  speedFactor: number;       // 0.0 - 1.0 (mapped from cadence)
  jumpDetected: boolean;
  armsRaised: boolean;       // for celebration detection
  confidence: number;        // pose detection confidence
  kneesTracked: boolean;     // true when player's legs are visible in camera
}

/* ── Calibration ──────────────────────────────────────────── */
export interface CalibrationData {
  baselineShoulderY: number;
  baselineHipY: number;
  bodyHeight: number;        // shoulder-to-hip distance in normalized coords
  isCalibrated: boolean;
  stableFrames: number;      // consecutive stable frames
}

/* ── Race Results ─────────────────────────────────────────── */
export interface RaceResult {
  place: 1 | 2 | 3;
  time: number;              // seconds
  hurdlesCleared: number;
  hurdlesTotal: number;
  topCadence: number;        // peak steps/min
  country: Country;
}

/* ── Event Types ──────────────────────────────────────────── */
export type GameEvent =
  | { type: 'STATE_CHANGE'; state: GameState }
  | { type: 'COUNTRY_SELECTED'; country: Country }
  | { type: 'CALIBRATION_COMPLETE'; data: CalibrationData }
  | { type: 'COUNTDOWN_TICK'; count: number }
  | { type: 'RACE_START' }
  | { type: 'JUMP_DETECTED' }
  | { type: 'HURDLE_CLEARED'; runner: number }
  | { type: 'HURDLE_HIT'; runner: number }
  | { type: 'SPEED_CHANGE'; speed: number; runner: number }
  | { type: 'POSITION_UPDATE'; positions: number[] }
  | { type: 'RUNNER_FINISH'; runner: number; time: number }
  | { type: 'RACE_COMPLETE'; results: RaceResult[] }
  | { type: 'POPUP'; text: string; style: 'perfect' | 'stumble' | 'turbo' }
  | { type: 'TURBO_ACTIVATED' }
  | { type: 'PLAY_AGAIN' };
