/**
 * World Games 2026 — Hurdles Race
 * GameManager: Central state machine orchestrating all subsystems
 */
import * as THREE from 'three';
import { GameState, type Country, type MotionState, type CalibrationData, type RaceResult, type RunnerData } from '../types';
import { EventBus } from './EventBus';
import {
  COUNTDOWN_SECONDS, COUNTRIES, AI_COUNTRIES,
  MAX_SPEED, TURBO_SPEED, JOG_SPEED, SPRINT_SPEED,
  TRACK_LENGTH_M, JUMP_DURATION, JUMP_COOLDOWN,
  STUMBLE_DURATION, STUMBLE_SPEED_PENALTY, SPEED_DRAG, SPEED_LERP,
  FIRST_HURDLE_M, HURDLE_SPACING_M, HURDLE_COUNT, LANE_WIDTH,
  AI_BASE_SPEED_MIN, AI_BASE_SPEED_MAX, AI_STUMBLE_CHANCE,
  AI_RUBBER_BAND_STRENGTH, AI_RUBBER_BAND_RANGE,
  AI_JUMP_REACTION_MIN, AI_JUMP_REACTION_MAX,
  SLOW_MO_DURATION, SLOW_MO_FACTOR,
} from './Constants';
import { SceneManager } from '../scene/SceneManager';
import { StadiumBuilder } from '../scene/StadiumBuilder';
import { AvatarBuilder, type AvatarParts } from '../scene/AvatarBuilder';
import { AvatarAnimator, type AnimState } from '../scene/AvatarAnimator';
import { HurdleSystem } from '../scene/HurdleSystem';
import { CameraRig } from '../scene/CameraRig';
import { ParticleSystem } from '../scene/ParticleSystem';
import { CameraFeed } from '../tracking/CameraFeed';
import { PoseTracker } from '../tracking/PoseTracker';
import { CalibrationScreen } from '../tracking/CalibrationScreen';
import { MotionAnalyzer } from '../tracking/MotionAnalyzer';
import { AudioManager } from '../audio/AudioManager';
import { SoundEffects } from '../audio/SoundEffects';
import { UIManager } from '../ui/UIManager';
import { CountrySelector } from '../ui/CountrySelector';
import { HUD } from '../ui/HUD';
import { PopupSystem } from '../ui/PopupSystem';
import { PodiumScreen } from '../ui/PodiumScreen';

/** All avatar data needed for a runner in the scene */
interface RunnerSceneData {
  group: THREE.Group;
  parts: AvatarParts;
  animState: AnimState;
  data: RunnerData;
}

export class GameManager {
  /* ── State ────────────────────────────────────────────── */
  private state: GameState = GameState.LOADING;
  readonly events = new EventBus();

  /* ── Sub-systems ──────────────────────────────────────── */
  private sceneManager!: SceneManager;
  private stadium!: StadiumBuilder;
  private avatarBuilder!: AvatarBuilder;
  private avatarAnimator!: AvatarAnimator;
  private hurdleSystem!: HurdleSystem;
  private cameraRig!: CameraRig;
  private particles!: ParticleSystem;

  private cameraFeed!: CameraFeed;
  private poseTracker!: PoseTracker;
  private calibrationScreen!: CalibrationScreen;
  private motionAnalyzer!: MotionAnalyzer;

  private audioManager!: AudioManager;
  private sfx!: SoundEffects;

  private uiManager!: UIManager;
  private countrySelector!: CountrySelector;
  private hud!: HUD;
  private popups!: PopupSystem;
  private podiumScreen!: PodiumScreen;

  /* ── Race State ───────────────────────────────────────── */
  private runners: RunnerSceneData[] = [];
  private selectedCountry: Country = COUNTRIES[0];
  private calibrationData: CalibrationData | null = null;
  private raceTime = 0;
  private countdownTimer = 0;
  private countdownCount = 0;
  private slowMoTimer = 0;
  private timeScale = 1;
  private turboTriggered = false;
  private finishedRunners = 0;
  private raceFinished = false;

  /* ── Loop ─────────────────────────────────────────────── */
  private clock = new THREE.Clock();
  private rafId = 0;
  private lastMotion: MotionState = {
    cadence: 0,
    isRunning: false,
    speedFactor: 0,
    jumpDetected: false,
    armsRaised: false,
    confidence: 0,
    kneesTracked: false,
  };

  /* ── Hurdle tracking ──────────────────────────────────── */
  private nextHurdleIndex: number[] = [0, 0, 0]; // per lane
  private jumpCooldownTimers: number[] = [0, 0, 0];

  constructor(private container: HTMLElement) {}

  /* ═══════════════════════════════════════════════════════ *
   *  INITIALIZATION                                        *
   * ═══════════════════════════════════════════════════════ */
  async init(onProgress?: (msg: string, pct: number) => void): Promise<void> {
    // ── 3D Scene ──
    onProgress?.('Initializing renderer...', 10);
    this.sceneManager = new SceneManager(this.container);

    onProgress?.('Building stadium...', 20);
    this.stadium = new StadiumBuilder();
    const stadiumGroup = this.stadium.build();
    this.sceneManager.scene.add(stadiumGroup);

    this.avatarBuilder = new AvatarBuilder();
    this.avatarAnimator = new AvatarAnimator();

    onProgress?.('Placing hurdles...', 30);
    this.hurdleSystem = new HurdleSystem();
    const hurdlesGroup = this.hurdleSystem.createHurdles();
    this.sceneManager.scene.add(hurdlesGroup);

    this.cameraRig = new CameraRig(this.sceneManager.camera);

    this.particles = new ParticleSystem();
    this.sceneManager.scene.add(this.particles.getGroup());

    // ── Tracking ──
    onProgress?.('Loading pose model...', 40);
    this.cameraFeed = new CameraFeed();
    this.poseTracker = new PoseTracker();

    try {
      await this.poseTracker.init();
      onProgress?.('Pose model loaded', 60);
    } catch (e) {
      console.warn('Pose tracker init failed, game will run in demo mode:', e);
    }

    this.calibrationScreen = new CalibrationScreen(this.events);
    this.motionAnalyzer = new MotionAnalyzer();

    // ── Audio ──
    onProgress?.('Initializing audio...', 70);
    this.audioManager = new AudioManager();
    this.sfx = new SoundEffects(this.audioManager);

    // ── UI ──
    onProgress?.('Building UI...', 80);
    const overlay = document.getElementById('ui-overlay')!;
    this.uiManager = new UIManager(overlay);
    this.countrySelector = new CountrySelector(overlay, this.events);
    this.hud = new HUD(overlay);
    this.popups = new PopupSystem(overlay);
    this.podiumScreen = new PodiumScreen(overlay, this.events);

    // ── Event wiring ──
    this.wireEvents();

    onProgress?.('Ready!', 100);
  }

  /** Wire up event bus listeners */
  private wireEvents(): void {
    this.events.on('COUNTRY_SELECTED', (e) => {
      if (e.type === 'COUNTRY_SELECTED') {
        this.selectedCountry = e.country;
        this.transitionTo(GameState.CALIBRATION);
      }
    });

    this.events.on('CALIBRATION_COMPLETE', (e) => {
      if (e.type === 'CALIBRATION_COMPLETE') {
        this.calibrationData = e.data;
        this.motionAnalyzer.setCalibration(e.data);
        this.transitionTo(GameState.COUNTDOWN);
      }
    });

    this.events.on('PLAY_AGAIN', () => {
      this.resetRace();
      this.transitionTo(GameState.COUNTRY_SELECT);
    });

    this.events.on('POPUP', (e) => {
      if (e.type === 'POPUP') {
        this.popups.show(e.text, e.style);
      }
    });

    // ── Unlock Web Audio on first interaction (iOS/Safari requirement) ──
    const resumeAudio = () => {
      this.audioManager.resume();
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
    window.addEventListener('pointerdown', resumeAudio);
    window.addEventListener('keydown', resumeAudio);

    // ── Keyboard Controls (optional for desktop developer testing) ──
    window.addEventListener('keydown', (e) => {
      if (this.state !== GameState.RACING) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.lastMotion.jumpDetected = true;
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS'].includes(e.code)) {
        this.lastMotion.isRunning = true;
        this.lastMotion.speedFactor = Math.min(1.0, this.lastMotion.speedFactor + 0.25);
        this.lastMotion.cadence = Math.min(6, this.lastMotion.cadence + 0.8);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════ *
   *  STATE TRANSITIONS                                     *
   * ═══════════════════════════════════════════════════════ */
  transitionTo(state: GameState): void {
    console.log(`[GameManager] ${this.state} → ${state}`);
    this.state = state;
    this.events.emit({ type: 'STATE_CHANGE', state });

    switch (state) {
      case GameState.COUNTRY_SELECT:
        this.hud.hide();
        this.podiumScreen.hide();
        this.calibrationScreen.hide();
        this.cameraFeed.hidePiP();
        this.cameraFeed.setCalibrationCanvas(null);
        this.countrySelector.show();
        break;

      case GameState.CALIBRATION:
        this.countrySelector.hide();
        this.setupRunners();
        this.cameraFeed.setCalibrationCanvas(this.calibrationScreen.getCanvas());
        this.cameraFeed.hidePiP();
        this.calibrationScreen.show();
        this.startCamera();
        break;

      case GameState.COUNTDOWN:
        this.calibrationScreen.hide();
        this.cameraFeed.setCalibrationCanvas(null);
        this.startCountdown();
        break;

      case GameState.RACING:
        this.hud.show();
        this.cameraFeed.showPiP();
        this.raceTime = 0;
        this.raceFinished = false;
        this.finishedRunners = 0;
        this.turboTriggered = false;
        this.nextHurdleIndex = [0, 0, 0];
        this.jumpCooldownTimers = [0, 0, 0];
        this.sfx.playWhistle();
        this.particles.startFlashbulbs();
        break;

      case GameState.FINISH:
        // Brief delay then podium
        this.particles.burstConfetti();
        this.sfx.playFanfare();
        setTimeout(() => this.transitionTo(GameState.PODIUM), 2500);
        break;

      case GameState.PODIUM:
        this.hud.hide();
        this.cameraFeed.hidePiP();
        this.particles.stopFlashbulbs();
        this.particles.stopWindStreaks();
        this.sfx.stopCrowdRoar();
        this.showPodium();
        break;
    }
  }

  /* ═══════════════════════════════════════════════════════ *
   *  CAMERA & TRACKING                                     *
   * ═══════════════════════════════════════════════════════ */
  private async startCamera(): Promise<void> {
    try {
      this.calibrationScreen.setNotice('📷 Ativando câmera... Permita o acesso no navegador!');
      await this.cameraFeed.startCamera();
      this.calibrationScreen.setNotice('📸 Enquadre seu corpo dentro do contorno...');
    } catch (e: any) {
      console.warn('Camera access denied or unavailable.', e);
      this.calibrationScreen.setNotice('⚠️ Câmera não acessível. Verifique a permissão de câmera no ícone da barra de navegação!');
    }
  }

  /* ═══════════════════════════════════════════════════════ *
   *  RUNNER SETUP                                          *
   * ═══════════════════════════════════════════════════════ */
  private setupRunners(): void {
    // Remove old runners
    for (const r of this.runners) {
      this.sceneManager.scene.remove(r.group);
    }
    this.runners = [];

    // Pick AI countries (different from player)
    const aiCountryIds = AI_COUNTRIES.filter((id) => id !== this.selectedCountry.id);
    const ai1Country = COUNTRIES.find((c) => c.id === aiCountryIds[0]) || COUNTRIES[2];
    const ai2Country = COUNTRIES.find((c) => c.id === aiCountryIds[1]) || COUNTRIES[5];

    const allCountries = [ai1Country, this.selectedCountry, ai2Country];
    const lanes = [0, 1, 2];

    for (let i = 0; i < 3; i++) {
      const country = allCountries[i];
      const { group, parts } = this.avatarBuilder.createAvatar(country);

      const laneX = (lanes[i] - 1) * LANE_WIDTH;
      group.position.set(laneX, 0, 0);
      this.sceneManager.scene.add(group);

      const isAI = i !== 1;
      const runnerData: RunnerData = {
        id: i,
        lane: lanes[i],
        position: 0,
        speed: 0,
        maxSpeed: 0,
        isJumping: false,
        jumpProgress: 0,
        isStumbling: false,
        stumbleTimer: 0,
        hurdlesCleared: 0,
        hurdlesHit: 0,
        finishTime: null,
        isAI,
        country,
        cadence: 0,
      };

      this.runners.push({
        group,
        parts,
        animState: { mode: 'idle', speed: 0, progress: 0 },
        data: runnerData,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════ *
   *  COUNTDOWN                                             *
   * ═══════════════════════════════════════════════════════ */
  private startCountdown(): void {
    this.countdownTimer = 0;
    this.countdownCount = COUNTDOWN_SECONDS;

    // Show countdown UI
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.id = 'countdown-overlay';
    const text = document.createElement('div');
    text.className = 'countdown-text';
    text.textContent = String(this.countdownCount);
    overlay.appendChild(text);
    document.getElementById('ui-overlay')!.appendChild(overlay);
    this.sfx.playCountdownBeep(false);

    const tick = () => {
      this.countdownCount--;
      if (this.countdownCount > 0) {
        text.textContent = String(this.countdownCount);
        text.style.animation = 'none';
        void text.offsetWidth; // reflow
        text.style.animation = 'countdownPop 0.6s ease-out';
        this.sfx.playCountdownBeep(false);
        setTimeout(tick, 1000);
      } else {
        text.textContent = 'GO!';
        text.style.color = '#4ade80';
        text.style.animation = 'none';
        void text.offsetWidth;
        text.style.animation = 'countdownPop 0.6s ease-out';
        this.sfx.playCountdownBeep(true);
        setTimeout(() => {
          overlay.remove();
          this.transitionTo(GameState.RACING);
        }, 600);
      }
    };
    setTimeout(tick, 1000);
  }

  /* ═══════════════════════════════════════════════════════ *
   *  MAIN GAME LOOP                                        *
   * ═══════════════════════════════════════════════════════ */
  start(): void {
    this.clock.start();
    this.loop();
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    let dt = Math.min(this.clock.getDelta(), 0.05); // cap to prevent spiral

    // Slow-mo effect
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      dt *= SLOW_MO_FACTOR;
      this.timeScale = SLOW_MO_FACTOR;
    } else {
      this.timeScale = 1;
    }

    this.updatePoseTracking();

    switch (this.state) {
      case GameState.CALIBRATION:
        this.updateCalibration();
        break;
      case GameState.RACING:
        this.updateRace(dt);
        break;
      case GameState.FINISH:
        this.updateFinish(dt);
        break;
    }

    // Always update animations
    this.updateAnimations(dt);

    // Update particles
    const playerRunner = this.runners[1];
    if (playerRunner) {
      this.particles.update(dt, playerRunner.group.position);
    }

    // Render
    this.sceneManager.render();
  };

  private latestLandmarks: any = null;

  /* ═══════════════════════════════════════════════════════ *
   *  POSE TRACKING UPDATE                                  *
   * ═══════════════════════════════════════════════════════ */
  private updatePoseTracking(): void {
    if (!this.poseTracker.isReady()) {
      this.cameraFeed.drawPiP(undefined, false);
      return;
    }

    const video = this.cameraFeed.getVideo();
    if (!video) return;

    const result = this.poseTracker.detect(video, performance.now());
    if (result && result.landmarks && result.landmarks.length > 0) {
      this.latestLandmarks = result.landmarks[0];

      if (this.state === GameState.CALIBRATION) {
        this.calibrationScreen.update(this.latestLandmarks as any);
      }

      if (this.state === GameState.RACING || this.state === GameState.FINISH) {
        this.lastMotion = this.motionAnalyzer.update(this.latestLandmarks as any, performance.now());
      }
    } else {
      if (this.state === GameState.RACING || this.state === GameState.FINISH) {
        this.lastMotion = this.motionAnalyzer.update([], performance.now());
      }
    }

    // Always render camera video and skeleton smoothly at full display framerate
    const isJumping = this.runners[1]?.data.isJumping ?? false;
    this.cameraFeed.drawPiP(
      this.latestLandmarks,
      isJumping,
      this.lastMotion.isRunning,
      this.lastMotion.cadence,
      this.lastMotion.kneesTracked
    );
  }

  private updateCalibration(): void {
    // Calibration screen handles itself via update() calls
  }

  /* ═══════════════════════════════════════════════════════ *
   *  RACE UPDATE                                           *
   * ═══════════════════════════════════════════════════════ */
  private updateRace(dt: number): void {
    this.raceTime += dt;

    // ── Player update ──
    const player = this.runners[1];
    if (player && player.data.finishTime === null) {
      this.updatePlayerRunner(player, dt);
    }

    // ── AI updates ──
    for (const runner of this.runners) {
      if (runner.data.isAI && runner.data.finishTime === null) {
        this.updateAIRunner(runner, dt);
      }
    }

    // ── Check placements & HUD ──
    const sorted = [...this.runners].sort((a, b) => b.data.position - a.data.position);
    const playerPlace = sorted.findIndex((r) => r.data.id === 1) + 1;

    this.hud.update(
      this.raceTime,
      playerPlace as 1 | 2 | 3,
      player.data.speed,
      MAX_SPEED,
      player.data.position
    );

    // ── Sunlight and sharp shadows track player down the 100m ──
    this.sceneManager.updateLight(player.data.position);

    // ── Camera follow ──
    this.cameraRig.update(
      player.group.position.x,
      player.data.position,
      player.data.speed,
      dt
    );

    // ── Crowd roar intensity increases near finish ──
    const crowdIntensity = Math.min(1, player.data.position / TRACK_LENGTH_M);
    this.sfx.playCrowdRoar(crowdIntensity);

    // ── Check race complete ──
    if (this.finishedRunners >= 3 && !this.raceFinished) {
      this.raceFinished = true;
      this.transitionTo(GameState.FINISH);
    }
  }

  private updatePlayerRunner(runner: RunnerSceneData, dt: number): void {
    const d = runner.data;

    // Speed from motion
    const targetSpeed = this.lastMotion.speedFactor * MAX_SPEED;
    d.speed += (targetSpeed - d.speed) * SPEED_LERP;
    if (d.speed < 0.08) {
      d.speed = 0;
    }

    // Turbo popup & sound
    if (d.speed > MAX_SPEED * 0.9 && !this.turboTriggered) {
      this.turboTriggered = true;
      this.events.emit({ type: 'POPUP', text: '⚡ TURBO SPRINT!', style: 'turbo' });
      this.events.emit({ type: 'TURBO_ACTIVATED' });
      this.particles.startWindStreaks();
      this.sfx.playTurboSound();
    }
    if (d.speed < MAX_SPEED * 0.7) {
      this.turboTriggered = false;
      this.particles.stopWindStreaks();
    }

    // Jump
    this.jumpCooldownTimers[1] = Math.max(0, this.jumpCooldownTimers[1] - dt);
    if (this.lastMotion.jumpDetected) {
      if (!d.isJumping && !d.isStumbling && this.jumpCooldownTimers[1] <= 0) {
        d.isJumping = true;
        d.jumpProgress = 0;
        this.jumpCooldownTimers[1] = JUMP_COOLDOWN;
        this.sfx.playWhoosh();
      }
      this.lastMotion.jumpDetected = false;
    }

    // Natural decay when not actively moving via camera
    if (!this.lastMotion.isRunning) {
      this.lastMotion.speedFactor = Math.max(0, this.lastMotion.speedFactor * 0.80);
      this.lastMotion.cadence = Math.max(0, this.lastMotion.cadence - dt * 4);
      if (d.speed < 0.15) {
        d.speed = 0;
      }
    }

    // Update jump
    if (d.isJumping) {
      d.jumpProgress += dt / JUMP_DURATION;
      if (d.jumpProgress >= 1) {
        d.isJumping = false;
        d.jumpProgress = 0;
      }
    }

    // Stumble
    if (d.isStumbling) {
      d.stumbleTimer -= dt;
      d.speed *= STUMBLE_SPEED_PENALTY;
      if (d.stumbleTimer <= 0) {
        d.isStumbling = false;
      }
    }

    // Hurdle check
    this.checkHurdles(runner, dt);

    // Move
    d.position += d.speed * dt;
    d.maxSpeed = Math.max(d.maxSpeed, d.speed);
    d.cadence = this.lastMotion.cadence;

    // Update 3D position
    const jumpY = d.isJumping ? 4 * 2.0 * d.jumpProgress * (1 - d.jumpProgress) : 0;
    runner.group.position.z = d.position;
    runner.group.position.y = jumpY;

    // Check finish
    if (d.position >= TRACK_LENGTH_M) {
      d.finishTime = this.raceTime;
      d.position = TRACK_LENGTH_M;
      this.finishedRunners++;
      this.events.emit({ type: 'RUNNER_FINISH', runner: d.id, time: this.raceTime });
    }
  }

  private updateAIRunner(runner: RunnerSceneData, dt: number): void {
    const d = runner.data;
    const playerPos = this.runners[1]?.data.position ?? 0;

    // Base speed with variation
    const personality = d.id === 0
      ? { base: 8.2, variance: 0.3 } // Steady
      : { base: 8.0, variance: 1.0 }; // Explosive

    let targetSpeed = personality.base + (Math.random() - 0.5) * personality.variance;

    // Rubber-banding
    const gap = playerPos - d.position;
    if (Math.abs(gap) < AI_RUBBER_BAND_RANGE) {
      targetSpeed += gap * AI_RUBBER_BAND_STRENGTH * 0.1;
    }

    targetSpeed = Math.max(AI_BASE_SPEED_MIN, Math.min(AI_BASE_SPEED_MAX, targetSpeed));
    d.speed += (targetSpeed - d.speed) * 0.05;

    // Stumble
    if (d.isStumbling) {
      d.stumbleTimer -= dt;
      d.speed *= STUMBLE_SPEED_PENALTY;
      if (d.stumbleTimer <= 0) {
        d.isStumbling = false;
      }
    }

    // Jump logic — approach hurdles
    if (!d.isJumping && !d.isStumbling) {
      const nextIdx = this.nextHurdleIndex[d.lane];
      if (nextIdx < HURDLE_COUNT) {
        const hurdleDist = FIRST_HURDLE_M + nextIdx * HURDLE_SPACING_M;
        const distToHurdle = hurdleDist - d.position;
        const reactionDist = d.speed * (AI_JUMP_REACTION_MIN + Math.random() * (AI_JUMP_REACTION_MAX - AI_JUMP_REACTION_MIN));

        if (distToHurdle > 0 && distToHurdle < reactionDist) {
          if (Math.random() > AI_STUMBLE_CHANCE) {
            d.isJumping = true;
            d.jumpProgress = 0;
          }
          // else: will hit the hurdle
        }
      }
    }

    // Update jump
    if (d.isJumping) {
      d.jumpProgress += dt / JUMP_DURATION;
      if (d.jumpProgress >= 1) {
        d.isJumping = false;
        d.jumpProgress = 0;
      }
    }

    // Hurdle check
    this.checkHurdles(runner, dt);

    // Move
    d.position += d.speed * dt;
    d.maxSpeed = Math.max(d.maxSpeed, d.speed);

    // Update 3D position
    const jumpY = d.isJumping ? 4 * 2.0 * d.jumpProgress * (1 - d.jumpProgress) : 0;
    runner.group.position.z = d.position;
    runner.group.position.y = jumpY;

    // Check finish
    if (d.position >= TRACK_LENGTH_M) {
      d.finishTime = this.raceTime;
      d.position = TRACK_LENGTH_M;
      this.finishedRunners++;
      this.events.emit({ type: 'RUNNER_FINISH', runner: d.id, time: this.raceTime });
    }
  }

  /* ═══════════════════════════════════════════════════════ *
   *  HURDLE COLLISION                                      *
   * ═══════════════════════════════════════════════════════ */
  private checkHurdles(runner: RunnerSceneData, _dt: number): void {
    const d = runner.data;
    const idx = this.nextHurdleIndex[d.lane];
    if (idx >= HURDLE_COUNT) return;

    const hurdleDist = FIRST_HURDLE_M + idx * HURDLE_SPACING_M;
    const diff = d.position - hurdleDist;

    // Only check when runner crosses the hurdle zone (zona mais ampla = mais tempo)
    if (diff >= -0.5 && diff <= 0.8) {
      if (d.isJumping && d.jumpProgress > 0.05 && d.jumpProgress < 0.95) {
        // ── CLEARED ──
        d.hurdlesCleared++;
        this.nextHurdleIndex[d.lane]++;
        if (!d.isAI) {
          this.events.emit({ type: 'POPUP', text: '★ PERFECT JUMP! ★', style: 'perfect' });
          this.events.emit({ type: 'HURDLE_CLEARED', runner: d.id });
          this.sfx.playPerfectJump();
          this.sfx.playWhoosh();
          this.cameraRig.setSlowMo(true);
          this.slowMoTimer = SLOW_MO_DURATION;
        }
      } else if (!d.isJumping || d.jumpProgress <= 0.15 || d.jumpProgress >= 0.85) {
        // ── HIT ──
        d.hurdlesHit++;
        d.isStumbling = true;
        d.stumbleTimer = STUMBLE_DURATION;
        d.isJumping = false;
        d.jumpProgress = 0;
        this.nextHurdleIndex[d.lane]++;
        this.hurdleSystem.knockHurdle(d.lane, idx);
        if (!d.isAI) {
          this.events.emit({ type: 'POPUP', text: 'STUMBLE!', style: 'stumble' });
          this.events.emit({ type: 'HURDLE_HIT', runner: d.id });
          this.sfx.playHurdleCrash();
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════ *
   *  ANIMATIONS                                            *
   * ═══════════════════════════════════════════════════════ */
  private updateAnimations(dt: number): void {
    for (const runner of this.runners) {
      const d = runner.data;

      if (d.isStumbling) {
        runner.animState = { mode: 'stumble', speed: d.speed / MAX_SPEED, progress: 1 - (d.stumbleTimer / STUMBLE_DURATION) };
      } else if (d.isJumping) {
        runner.animState = { mode: 'jump', speed: d.speed / MAX_SPEED, progress: d.jumpProgress };
      } else if (d.finishTime !== null && this.state === GameState.PODIUM) {
        runner.animState = { mode: 'celebrate', speed: 0, progress: (this.raceTime % 2) / 2 };
      } else if (d.speed > 0.5) {
        runner.animState = { mode: 'run', speed: d.speed / MAX_SPEED, progress: (this.raceTime * d.speed * 0.5) % 1 };
      } else {
        runner.animState = { mode: 'idle', speed: 0, progress: 0 };
      }

      this.avatarAnimator.update(runner.parts, runner.animState, dt);

      // ── POSE RETARGETING: aplica os landmarks do MediaPipe no avatar do JOGADOR ──
      // O avatar do jogador é sempre o runner[1] (lane do meio).
      // Quando a câmera está ativa e detectou landmarks, o avatar espelha o corpo real.
      if (!d.isAI && this.latestLandmarks && this.latestLandmarks.length >= 17) {
        this.avatarAnimator.applyPoseLandmarks(runner.parts, this.latestLandmarks as any, runner.animState.mode);
      }
    }

    // Update hurdle physics
    this.hurdleSystem.update(dt);
  }

  /* ═══════════════════════════════════════════════════════ *
   *  FINISH & PODIUM                                       *
   * ═══════════════════════════════════════════════════════ */
  private updateFinish(dt: number): void {
    // Keep updating runners that haven't finished
    for (const runner of this.runners) {
      if (runner.data.finishTime === null) {
        if (runner.data.isAI) {
          this.updateAIRunner(runner, dt);
        }
        // Force AI to finish soon
        runner.data.speed = Math.max(runner.data.speed, AI_BASE_SPEED_MIN);
      }
    }

    // Auto finish remaining after 5 seconds
    if (this.raceTime > (this.runners[1]?.data.finishTime ?? 0) + 5) {
      for (const runner of this.runners) {
        if (runner.data.finishTime === null) {
          runner.data.finishTime = this.raceTime;
          runner.data.position = TRACK_LENGTH_M;
          this.finishedRunners++;
        }
      }
    }
  }

  private showPodium(): void {
    const sorted = [...this.runners].sort((a, b) => (a.data.finishTime ?? 999) - (b.data.finishTime ?? 999));
    const playerRank = sorted.findIndex((r) => r.data.id === 1);

    const playerData = this.runners[1].data;
    const result: RaceResult = {
      place: (playerRank + 1) as 1 | 2 | 3,
      time: playerData.finishTime ?? this.raceTime,
      hurdlesCleared: playerData.hurdlesCleared,
      hurdlesTotal: HURDLE_COUNT,
      topCadence: playerData.cadence * 60,
      country: playerData.country,
    };

    this.podiumScreen.show(result);
    this.particles.burstConfetti();
  }

  /* ═══════════════════════════════════════════════════════ *
   *  RESET                                                 *
   * ═══════════════════════════════════════════════════════ */
  private resetRace(): void {
    for (const r of this.runners) {
      this.sceneManager.scene.remove(r.group);
    }
    this.runners = [];
    this.raceTime = 0;
    this.finishedRunners = 0;
    this.raceFinished = false;
    this.turboTriggered = false;
    this.nextHurdleIndex = [0, 0, 0];
    this.jumpCooldownTimers = [0, 0, 0];
    this.lastMotion = {
      cadence: 0, isRunning: false, speedFactor: 0,
      jumpDetected: false, armsRaised: false, confidence: 0,
      kneesTracked: false,
    };
    this.hurdleSystem.resetAll();
    this.particles.stopWindStreaks();
    this.particles.stopFlashbulbs();
    this.calibrationData = null;
    this.motionAnalyzer.reset();
  }

  /* ═══════════════════════════════════════════════════════ *
   *  CLEANUP                                               *
   * ═══════════════════════════════════════════════════════ */
  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.cameraFeed.stopCamera();
    this.poseTracker.dispose();
    this.sceneManager.dispose();
    this.stadium.dispose();
    this.hurdleSystem.dispose();
    this.particles.dispose();
    this.events.clear();
  }
}
