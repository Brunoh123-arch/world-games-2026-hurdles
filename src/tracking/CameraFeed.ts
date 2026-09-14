// Body joint connections for skeleton visualization
const POSE_CONNECTIONS: [number, number][] = [
    // Torso
    [11, 12], // left shoulder to right shoulder
    [11, 23], // left shoulder to left hip
    [12, 24], // right shoulder to right hip
    [23, 24], // left hip to right hip
    // Left arm
    [11, 13], // left shoulder to elbow
    [13, 15], // left elbow to wrist
    // Right arm
    [12, 14], // right shoulder to elbow
    [14, 16], // right elbow to wrist
    // Left leg
    [23, 25], // left hip to knee
    [25, 27], // left knee to ankle
    // Right leg
    [24, 26], // right hip to knee
    [26, 28], // right knee to ankle
];

export class CameraFeed {
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private pipContainer: HTMLElement | null = null;
    private pipCanvas: HTMLCanvasElement | null = null;
    private pipCtx: CanvasRenderingContext2D | null = null;

    public async startCamera(): Promise<HTMLVideoElement> {
        if (this.video) {
            return this.video;
        }

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera API not available. Ensure you are on HTTPS or localhost.');
            }
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 480 },
                    height: { ideal: 640 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            });

            this.video = document.createElement('video');
            this.video.playsInline = true;
            this.video.setAttribute('webkit-playsinline', 'true');
            this.video.muted = true;
            this.video.autoplay = true;
            this.video.style.display = 'none';
            document.body.appendChild(this.video);
            this.video.srcObject = this.stream;

            await this.video.play().catch(e => console.warn('Video auto-play catch:', e));

            this.initPiP();

            return new Promise((resolve) => {
                if (!this.video) return;
                if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
                    resolve(this.video);
                    return;
                }
                this.video.onloadeddata = () => {
                    this.video?.play().catch(() => {});
                    resolve(this.video!);
                };
            });
        } catch (error) {
            console.error('Error starting camera:', error);
            throw error;
        }
    }

    private initPiP(): void {
        this.pipContainer = document.getElementById('pip-container');
        if (!this.pipContainer) {
            this.pipContainer = document.createElement('div');
            this.pipContainer.id = 'pip-container';
            this.pipContainer.style.position = 'fixed';
            this.pipContainer.style.bottom = '20px';
            this.pipContainer.style.right = '20px';
            this.pipContainer.style.width = '120px';
            this.pipContainer.style.height = '160px';
            this.pipContainer.style.borderRadius = '8px';
            this.pipContainer.style.overflow = 'hidden';
            this.pipContainer.style.zIndex = '1000';
            this.pipContainer.style.display = 'none';
            document.body.appendChild(this.pipContainer);
        }

        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 120;
        this.pipCanvas.height = 160;
        this.pipCanvas.style.width = '100%';
        this.pipCanvas.style.height = '100%';
        this.pipCanvas.style.transform = 'scaleX(-1)'; // Mirror the canvas
        this.pipCtx = this.pipCanvas.getContext('2d');
        this.pipContainer.innerHTML = '';
        this.pipContainer.appendChild(this.pipCanvas);
    }



    public drawPiP(landmarks?: { x: number, y: number, visibility?: number }[], isJumping: boolean = false): void {
        if (!this.video || !this.pipCanvas || !this.pipCtx) return;

        const ctx = this.pipCtx;
        const w = this.pipCanvas.width;
        const h = this.pipCanvas.height;

        // Draw video frame
        ctx.drawImage(this.video, 0, 0, w, h);

        // Draw glowing skeleton
        if (landmarks && landmarks.length >= 25) {
            ctx.save();

            // Bone lines (Neon glow)
            const lineColor = isJumping ? '#00ff88' : '#00e5ff';
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = 6;
            ctx.lineCap = 'round';

            for (const [i1, i2] of POSE_CONNECTIONS) {
                const p1 = landmarks[i1];
                const p2 = landmarks[i2];
                if (!p1 || !p2) continue;

                // Only draw if both points are reasonably confident
                if ((p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * w, p1.y * h);
                    ctx.lineTo(p2.x * w, p2.y * h);
                    ctx.stroke();
                }
            }

            // Joint nodes (Gold dots)
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 4;

            for (let i = 11; i < Math.min(landmarks.length, 29); i++) {
                const lm = landmarks[i];
                if (!lm || (lm.visibility ?? 1) <= 0.4) continue;

                const cx = lm.x * w;
                const cy = lm.y * h;
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Head / Nose node
            const nose = landmarks[0];
            if (nose && (nose.visibility ?? 1) > 0.4) {
                ctx.fillStyle = '#ff3366';
                ctx.beginPath();
                ctx.arc(nose.x * w, nose.y * h, 3.5, 0, 2 * Math.PI);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    public showPiP(): void {
        if (this.pipContainer) {
            this.pipContainer.style.display = 'block';
        }
    }

    public hidePiP(): void {
        if (this.pipContainer) {
            this.pipContainer.style.display = 'none';
        }
    }

    public stopCamera(): void {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
            this.video = null;
        }

        if (this.pipContainer && this.pipContainer.parentNode) {
            this.pipContainer.parentNode.removeChild(this.pipContainer);
            this.pipContainer = null;
            this.pipCanvas = null;
            this.pipCtx = null;
        }
    }

    public getVideo(): HTMLVideoElement | null {
        return this.video;
    }
}
