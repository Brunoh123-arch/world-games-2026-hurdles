/**
 * World Games 2026 — AI Runner Logic
 * Note: AI logic is currently handled inline by GameManager.
 * This module provides the AI personality definitions.
 */
import type { Country } from '../types';
import {
  AI_BASE_SPEED_MIN, AI_BASE_SPEED_MAX,
  AI_STUMBLE_CHANCE, AI_RUBBER_BAND_STRENGTH,
  AI_JUMP_REACTION_MIN, AI_JUMP_REACTION_MAX,
} from '../core/Constants';

export interface AIPersonality {
  name: string;
  baseSpeed: number;
  speedVariance: number;
  aggressiveness: number;
}

/** Steady AI: Consistent pace, fewer mistakes */
export const AI_STEADY: AIPersonality = {
  name: 'Steady',
  baseSpeed: 8.2,
  speedVariance: 0.3,
  aggressiveness: 0.4,
};

/** Explosive AI: Bursts of speed, more errors */
export const AI_EXPLOSIVE: AIPersonality = {
  name: 'Explosive',
  baseSpeed: 8.0,
  speedVariance: 1.0,
  aggressiveness: 0.8,
};
