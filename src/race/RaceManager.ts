/**
 * World Games 2026 — Race Manager
 * Note: Race logic is currently handled inline by GameManager.
 * This module provides utility types and could be extended for standalone race logic.
 */
import type { RunnerData, MotionState } from '../types';
import {
  TRACK_LENGTH_M, FIRST_HURDLE_M, HURDLE_SPACING_M, HURDLE_COUNT,
  MAX_SPEED, JOG_SPEED, SPRINT_SPEED,
  JUMP_DURATION, STUMBLE_DURATION, STUMBLE_SPEED_PENALTY,
} from '../core/Constants';

/** Compute all hurdle positions for a lane */
export function getHurdlePositions(): number[] {
  const positions: number[] = [];
  for (let i = 0; i < HURDLE_COUNT; i++) {
    positions.push(FIRST_HURDLE_M + i * HURDLE_SPACING_M);
  }
  return positions;
}

/** Map a speed factor (0-1) to actual m/s */
export function mapSpeedFactor(factor: number): number {
  if (factor <= 0) return 0;
  if (factor < 0.3) return JOG_SPEED * (factor / 0.3);
  if (factor < 0.7) return JOG_SPEED + (SPRINT_SPEED - JOG_SPEED) * ((factor - 0.3) / 0.4);
  return SPRINT_SPEED + (MAX_SPEED - SPRINT_SPEED) * ((factor - 0.7) / 0.3);
}
