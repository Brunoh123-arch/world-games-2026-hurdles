import { AudioManager } from './AudioManager';

export class SoundEffects {
    private audio: AudioManager;

    constructor(audioManager: AudioManager) {
        this.audio = audioManager;
    }

    playCountdownBeep(isGo: boolean = false): void {
        if (isGo) {
            this.playStarterGun();
        } else {
            this.audio.createOscillator(520, 'sine', 0.12, 0.35);
        }
    }

    playStarterGun(): void {
        this.audio.playStarterGun();
    }

    playWhistle(): void {
        const ctx = this.audio.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1900, ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.connect(gain);
        gain.connect(this.audio.getSfxGain());

        osc.start();
        osc.stop(ctx.currentTime + 0.45);
    }

    playCrowdRoar(intensity: number): void {
        this.audio.setCrowdIntensity(intensity);
    }

    stopCrowdRoar(): void {
        this.audio.stopCrowdLoop();
    }

    playAirHorn(): void {
        const ctx = this.audio.getContext();
        const now = ctx.currentTime;
        // Two classic stadium air horn pitches: F#4 and A#4
        [370, 466].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gain);
            gain.connect(this.audio.getSfxGain());

            osc.start(now);
            osc.stop(now + 0.4);
        });
    }

    playHurdleCrash(): void {
        // Low clack + high crack
        this.audio.createNoise(0.18, 0.6, 380);
        this.audio.createOscillator(180, 'triangle', 0.12, 0.4);
    }

    playFootstep(): void {
        this.audio.createNoise(0.025, 0.12, 700);
    }

    playWhoosh(): void {
        const ctx = this.audio.getContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.35);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.audio.getSfxGain());

        osc.start(now);
        osc.stop(now + 0.35);
    }

    playTurboSound(): void {
        const ctx = this.audio.getContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audio.getSfxGain());

        osc.start(now);
        osc.stop(now + 0.5);
    }

    playFanfare(): void {
        const ctx = this.audio.getContext();
        const freqs = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
        const now = ctx.currentTime;

        freqs.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            const startTime = now + index * 0.15;
            gain.gain.setValueAtTime(0, now);
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
            
            osc.connect(gain);
            gain.connect(this.audio.getMasterGain());
            
            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });

        // Add airhorn blast after fanfare
        setTimeout(() => this.playAirHorn(), 800);
    }

    playConfettiPop(): void {
        this.audio.createNoise(0.2, 0.45, 2200);
    }

    playPerfectJump(): void {
        const ctx = this.audio.getContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.audio.getMasterGain());

        osc.start();
        osc.stop(now + 0.35);
    }
}
