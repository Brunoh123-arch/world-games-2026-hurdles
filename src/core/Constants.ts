/**
 * World Games 2026 — Hurdles Race
 * Game constants, tuning parameters, and country definitions
 */
import type { Country } from '../types';

/* ── Track & Hurdles ──────────────────────────────────────── */
export const TRACK_LENGTH_M = 100;             // 100m race
export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.2;                 // meters between lane centers
export const FIRST_HURDLE_M = 13.72;           // distance to first hurdle
export const HURDLE_SPACING_M = 9.14;          // spacing between hurdles
export const HURDLE_COUNT = 10;                // total hurdles per lane
export const HURDLE_HEIGHT = 1.0;              // visual height in 3D units
export const HURDLE_WIDTH = 1.6;               // width of hurdle bar

/* ── Physics / Speed ──────────────────────────────────────── */
export const MIN_SPEED = 0;
export const JOG_SPEED = 5.0;                  // m/s at low cadence
export const SPRINT_SPEED = 8.5;               // m/s at moderate cadence
export const MAX_SPEED = 11.0;                 // m/s at max cadence
export const TURBO_SPEED = 12.5;               // m/s turbo mode
export const SPEED_DRAG = 0.96;                // per-frame speed decay when idle
export const SPEED_LERP = 0.20;                // smooth and responsive speed transition

/* ── Jump ─────────────────────────────────────────────────── */
export const JUMP_DURATION = 0.55;             // seconds in air
export const JUMP_HEIGHT = 2.0;                // peak height in 3D units
export const JUMP_COOLDOWN = 0.6;              // min seconds between jumps
export const HURDLE_JUMP_ZONE = 2.5;           // meters before hurdle to register jump

/* ── Stumble ──────────────────────────────────────────────── */
export const STUMBLE_DURATION = 0.8;           // seconds of stumble
export const STUMBLE_SPEED_PENALTY = 0.4;      // multiply speed by this during stumble

/* ── Motion Detection ─────────────────────────────────────── */
export const POSE_FPS = 30;                    // run pose detection at 30 FPS
export const CADENCE_WINDOW_S = 1.0;           // rolling window for step counting
export const MIN_OSCILLATION_AMP = 0.012;      // minimum shoulder displacement to count
export const JUMP_THRESHOLD = 0.15;            // % of body height for jump detection
export const JUMP_VELOCITY_THRESHOLD = 0.04;   // velocity threshold to avoid false positives

/* ── Calibration ──────────────────────────────────────────── */
export const CALIBRATION_STABLE_FRAMES = 40;   // ~2s at 20fps = stable for calibration
export const CALIBRATION_CONFIDENCE = 0.6;     // min keypoint confidence
export const CALIBRATION_VARIANCE = 0.015;     // max allowed position variance

/* ── AI Runner ────────────────────────────────────────────── */
export const AI_BASE_SPEED_MIN = 6.5;          // m/s minimum AI speed (mais lento)
export const AI_BASE_SPEED_MAX = 8.5;          // m/s maximum AI speed (mais lento)
export const AI_STUMBLE_CHANCE = 0.20;         // 20% chance to hit hurdle (tropeçam mais)
export const AI_RUBBER_BAND_STRENGTH = 0.5;    // como aggressively AI matches player (maior)
export const AI_RUBBER_BAND_RANGE = 12;        // meter range for rubber-banding (mais amplo)
export const AI_JUMP_REACTION_MIN = 0.3;       // seconds before hurdle
export const AI_JUMP_REACTION_MAX = 0.6;       // seconds before hurdle

/* ── Camera / 3D ──────────────────────────────────────────── */
export const CAMERA_OFFSET_Y = 2.2;            // altura mais baixa e próxima (visão ampliada)
export const CAMERA_OFFSET_Z = -4.0;           // mais perto do corredor (atleta ampliado na tela)
export const CAMERA_LERP = 0.08;               // follow smoothness mais ágil e direto
export const CAMERA_SHAKE_INTENSITY = 0.12;    // at max speed

/* ── Stadium Geometry ─────────────────────────────────────── */
export const TRACK_VISUAL_WIDTH = 12;
export const TRACK_VISUAL_LENGTH = 120;
export const STADIUM_STANDS_HEIGHT = 15;
export const STADIUM_STANDS_DEPTH = 25;

/* ── Timing ───────────────────────────────────────────────── */
export const COUNTDOWN_SECONDS = 3;
export const SLOW_MO_DURATION = 0.5;           // seconds of slow motion on hurdle clear
export const SLOW_MO_FACTOR = 0.3;             // time scale during slow-mo

/* ── Country Definitions ──────────────────────────────────── */
export const COUNTRIES: Country[] = [
  { id: 'br', name: 'Brazil',   flag: '🇧🇷', jerseyColor: 0x009c3b, shortsColor: 0x002776, accentColor: 0xffdf00 },
  { id: 'us', name: 'USA',      flag: '🇺🇸', jerseyColor: 0x002868, shortsColor: 0xbf0a30, accentColor: 0xffffff },
  { id: 'jm', name: 'Jamaica',  flag: '🇯🇲', jerseyColor: 0x009b3a, shortsColor: 0x000000, accentColor: 0xfed100 },
  { id: 'jp', name: 'Japan',    flag: '🇯🇵', jerseyColor: 0xffffff, shortsColor: 0xbc002d, accentColor: 0xbc002d },
  { id: 'gb', name: 'Britain',  flag: '🇬🇧', jerseyColor: 0x012169, shortsColor: 0xc8102e, accentColor: 0xffffff },
  { id: 'ke', name: 'Kenya',    flag: '🇰🇪', jerseyColor: 0xbb0000, shortsColor: 0x006600, accentColor: 0xffffff },
  { id: 'au', name: 'Australia',flag: '🇦🇺', jerseyColor: 0x00843d, shortsColor: 0xffcd00, accentColor: 0xffffff },
  { id: 'de', name: 'Germany',  flag: '🇩🇪', jerseyColor: 0x000000, shortsColor: 0xdd0000, accentColor: 0xffcc00 },
];

/* ── AI Country Picks (for opponents) ─────────────────────── */
export const AI_COUNTRIES = ['jm', 'ke', 'us', 'gb', 'jp', 'au'];
