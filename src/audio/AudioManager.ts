export class AudioManager {
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private crowdGain: GainNode | null = null;

    // Persistent crowd loop nodes
    private crowdSource: AudioBufferSourceNode | null = null;
    private crowdFilter: BiquadFilterNode | null = null;
    private crowdVolumeNode: GainNode | null = null;
    private isCrowdPlaying = false;

    constructor() {
        // Context is lazy initialized to comply with browser autoplay policies
    }

    private initContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            this.masterGain = this.context.createGain();
            this.masterGain.gain.setValueAtTime(0.9, this.context.currentTime);
            this.masterGain.connect(this.context.destination);
            
            this.sfxGain = this.context.createGain();
            this.sfxGain.gain.setValueAtTime(1.0, this.context.currentTime);
            this.sfxGain.connect(this.masterGain);
            
            this.musicGain = this.context.createGain();
            this.musicGain.gain.setValueAtTime(0.7, this.context.currentTime);
            this.musicGain.connect(this.masterGain);
            
            this.crowdGain = this.context.createGain();
            this.crowdGain.gain.setValueAtTime(0.0, this.context.currentTime);
            this.crowdGain.connect(this.masterGain);
        }
    }

    resume(): void {
        this.initContext();
        if (this.context && this.context.state === 'suspended') {
            this.context.resume().catch(console.warn);
        }
    }

    getContext(): AudioContext {
        this.initContext();
        return this.context!;
    }

    getMasterGain(): GainNode {
        this.initContext();
        return this.masterGain!;
    }

    getSfxGain(): GainNode {
        this.initContext();
        return this.sfxGain!;
    }

    /* ── Persistent Crowd Roar (Zero Allocations Per Frame) ────── */
    startCrowdLoop(): void {
        if (this.isCrowdPlaying) return;
        this.initContext();
        const ctx = this.context!;

        // 3 seconds of precomputed pink/filtered noise for a rich stadium ambient
        const bufferSize = ctx.sampleRate * 3;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        this.crowdSource = ctx.createBufferSource();
        this.crowdSource.buffer = noiseBuffer;
        this.crowdSource.loop = true;

        this.crowdFilter = ctx.createBiquadFilter();
        this.crowdFilter.type = 'lowpass';
        this.crowdFilter.frequency.setValueAtTime(900, ctx.currentTime);

        this.crowdVolumeNode = ctx.createGain();
        this.crowdVolumeNode.gain.setValueAtTime(0.01, ctx.currentTime);

        this.crowdSource.connect(this.crowdFilter);
        this.crowdFilter.connect(this.crowdVolumeNode);
        this.crowdVolumeNode.connect(this.crowdGain!);

        this.crowdSource.start();
        this.isCrowdPlaying = true;
    }

    setCrowdIntensity(intensity: number): void {
        if (!this.isCrowdPlaying || !this.crowdVolumeNode || !this.crowdFilter || !this.context) {
            this.startCrowdLoop();
        }
        if (this.crowdVolumeNode && this.crowdFilter && this.context) {
            const clamped = Math.max(0.05, Math.min(1.0, intensity));
            const targetGain = 0.08 + clamped * 0.45;
            const targetCutoff = 800 + clamped * 1800; // brighter & louder as tension builds
            this.crowdVolumeNode.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.08);
            this.crowdFilter.frequency.setTargetAtTime(targetCutoff, this.context.currentTime, 0.08);
        }
    }

    stopCrowdLoop(): void {
        if (!this.isCrowdPlaying || !this.crowdVolumeNode || !this.context) return;
        this.crowdVolumeNode.gain.setTargetAtTime(0.001, this.context.currentTime, 0.3);
        setTimeout(() => {
            if (this.crowdSource) {
                try { this.crowdSource.stop(); } catch {}
                this.crowdSource.disconnect();
                this.crowdSource = null;
            }
            this.isCrowdPlaying = false;
        }, 350);
    }

    /* ── Starter Gun & SFX Generators ──────────────────────────── */
    playStarterGun(): void {
        this.initContext();
        const ctx = this.context!;
        const now = ctx.currentTime;

        // 1. High frequency explosive crack
        const crackBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
        const crackData = crackBuffer.getChannelData(0);
        for (let i = 0; i < crackData.length; i++) {
            crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
        }
        const crack = ctx.createBufferSource();
        crack.buffer = crackBuffer;
        const crackFilter = ctx.createBiquadFilter();
        crackFilter.type = 'highpass';
        crackFilter.frequency.value = 1200;
        const crackGain = ctx.createGain();
        crackGain.gain.setValueAtTime(0.7, now);
        crackGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        crack.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(this.sfxGain!);
        crack.start(now);

        // 2. Low-end gunshot thump (80Hz punch)
        const boomOsc = ctx.createOscillator();
        boomOsc.type = 'sine';
        boomOsc.frequency.setValueAtTime(140, now);
        boomOsc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
        const boomGain = ctx.createGain();
        boomGain.gain.setValueAtTime(0.8, now);
        boomGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        boomOsc.connect(boomGain);
        boomGain.connect(this.sfxGain!);
        boomOsc.start(now);
        boomOsc.stop(now + 0.35);
    }

    createOscillator(freq: number, type: OscillatorType, duration: number, volume: number): void {
        const ctx = this.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    createNoise(duration: number, volume: number, filterFreq: number): void {
        const ctx = this.getContext();
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain!);

        noise.start();
        noise.stop(ctx.currentTime + duration);
    }
}
