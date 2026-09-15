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
    private calibrationCanvas: HTMLCanvasElement | null = null;
    private calibrationCtx: CanvasRenderingContext2D | null = null;
    private isPiPVisible = false;

    public setCalibrationCanvas(canvas: HTMLCanvasElement | null): void {
        this.calibrationCanvas = canvas;
        this.calibrationCtx = canvas ? canvas.getContext('2d') : null;
    }

    public async startCamera(): Promise<HTMLVideoElement> {
        if (this.video && this.stream && this.stream.active) {
            return this.video;
        }

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('API de câmera não suportada no navegador. Certifique-se de acessar via HTTPS ou localhost.');
            }

            // Tenta constraints ideais (640x480 landscape padrão em webcams de notebook/desktop)
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: false
                });
            } catch (constraintErr) {
                console.warn('Falha nas constraints de webcam específicas, tentando fallback simples { video: true }:', constraintErr);
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            if (!this.video) {
                this.video = document.createElement('video');
                this.video.playsInline = true;
                this.video.setAttribute('webkit-playsinline', 'true');
                this.video.muted = true;
                this.video.autoplay = true;
                this.video.style.display = 'none';
                document.body.appendChild(this.video);
            }
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
            this.pipContainer.style.width = '140px';
            this.pipContainer.style.height = '180px';
            this.pipContainer.style.borderRadius = '12px';
            this.pipContainer.style.overflow = 'hidden';
            this.pipContainer.style.zIndex = '1000';
            this.pipContainer.style.boxShadow = '0 8px 25px rgba(0,0,0,0.6), 0 0 12px rgba(0,229,255,0.6)';
            this.pipContainer.style.border = '2px solid #00e5ff';
            this.pipContainer.style.display = this.isPiPVisible ? 'block' : 'none';
            document.body.appendChild(this.pipContainer);
        }

        if (!this.pipCanvas) {
            this.pipCanvas = document.createElement('canvas');
            this.pipCanvas.width = 140;
            this.pipCanvas.height = 180;
            this.pipCanvas.style.width = '100%';
            this.pipCanvas.style.height = '100%';
            this.pipCanvas.style.objectFit = 'cover';
            this.pipCanvas.style.transform = 'scaleX(-1)'; // Espelha a imagem
            this.pipCtx = this.pipCanvas.getContext('2d');
            this.pipContainer.innerHTML = '';
            this.pipContainer.appendChild(this.pipCanvas);
        }
    }

    public drawPiP(
        landmarks?: { x: number, y: number, visibility?: number }[],
        isJumping: boolean = false,
        isRunning: boolean = false,
        cadence: number = 0,
        kneesTracked: boolean = false
    ): void {
        if (!this.video) return;

        // 1. Desenha no PiP se visível
        if (this.pipCanvas && this.pipCtx && this.isPiPVisible) {
            this.renderToCanvas(this.pipCtx, this.pipCanvas.width, this.pipCanvas.height, landmarks, isJumping, isRunning, cadence, kneesTracked);
        }

        // 2. Desenha no canvas de calibração se ativo
        if (this.calibrationCanvas && this.calibrationCtx) {
            this.renderToCanvas(this.calibrationCtx, this.calibrationCanvas.width, this.calibrationCanvas.height, landmarks, isJumping, isRunning, cadence, kneesTracked);
        }
    }

    private renderToCanvas(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        landmarks?: { x: number, y: number, visibility?: number }[],
        isJumping: boolean = false,
        isRunning: boolean = false,
        cadence: number = 0,
        kneesTracked: boolean = false
    ): void {
        if (!this.video) return;

        // ── Fundo preto (NÃO mostra o rosto/corpo da câmera) ──
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        // Grid sutil de fundo estilo sci-fi
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
        ctx.lineWidth = 0.5;
        const gridSize = 20;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Desenha o esqueleto brilhante da IA
        if (landmarks && landmarks.length >= 17) {
            ctx.save();

            // ── Linhas dos ossos (Glow Neon) ──
            const lineColor = isJumping ? '#00ff88' : '#00e5ff';
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = Math.max(3, Math.round(w * 0.022));
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = 14;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (const [i1, i2] of POSE_CONNECTIONS) {
                const p1 = landmarks[i1];
                const p2 = landmarks[i2];
                if (!p1 || !p2) continue;

                if ((p1.visibility ?? 1) > 0.25 && (p2.visibility ?? 1) > 0.25) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * w, p1.y * h);
                    ctx.lineTo(p2.x * w, p2.y * h);
                    ctx.stroke();
                }
            }

            // ── Linha da espinha (centro dos ombros → centro do quadril) ──
            const ls = landmarks[11], rs = landmarks[12];
            const lh = landmarks[23], rh = landmarks[24];
            if (ls && rs && lh && rh &&
                (ls.visibility ?? 1) > 0.25 && (rs.visibility ?? 1) > 0.25 &&
                (lh.visibility ?? 1) > 0.20 && (rh.visibility ?? 1) > 0.20) {
                const midShoulderX = (ls.x + rs.x) / 2;
                const midShoulderY = (ls.y + rs.y) / 2;
                const midHipX = (lh.x + rh.x) / 2;
                const midHipY = (lh.y + rh.y) / 2;
                ctx.beginPath();
                ctx.moveTo(midShoulderX * w, midShoulderY * h);
                ctx.lineTo(midHipX * w, midHipY * h);
                ctx.stroke();
            }

            // ── Pontos das articulações (Dourado neon) ──
            const jointRadius = Math.max(3, Math.round(w * 0.025));
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 8;

            for (let i = 11; i < Math.min(landmarks.length, 29); i++) {
                const lm = landmarks[i];
                if (!lm || (lm.visibility ?? 1) <= 0.25) continue;

                const cx = lm.x * w;
                const cy = lm.y * h;
                ctx.beginPath();
                ctx.arc(cx, cy, jointRadius, 0, 2 * Math.PI);
                ctx.fill();
            }

            // ── Cabeça (círculo neon ao redor da face) ──
            const nose = landmarks[0];
            const headRadius = Math.max(12, Math.round(w * 0.085));
            if (nose && (nose.visibility ?? 1) > 0.25) {
                // Círculo da cabeça
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = Math.max(2, Math.round(w * 0.018));
                ctx.shadowColor = lineColor;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(nose.x * w, nose.y * h, headRadius, 0, 2 * Math.PI);
                ctx.stroke();

                // Ponto central
                ctx.fillStyle = '#ff3366';
                ctx.shadowColor = '#ff3366';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(nose.x * w, nose.y * h, Math.max(3, headRadius * 0.25), 0, 2 * Math.PI);
                ctx.fill();

                // Conexão pescoço (base da cabeça → centro dos ombros)
                if (ls && rs && (ls.visibility ?? 1) > 0.25 && (rs.visibility ?? 1) > 0.25) {
                    const neckX = (ls.x + rs.x) / 2;
                    const neckY = (ls.y + rs.y) / 2;
                    ctx.strokeStyle = lineColor;
                    ctx.beginPath();
                    ctx.moveTo(nose.x * w, nose.y * h + headRadius);
                    ctx.lineTo(neckX * w, neckY * h);
                    ctx.stroke();
                }
            }

            // ── Status de Movimento no Rodapé do PiP ──
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-w, 0);

            let statusText = '⏸️ PARADO';
            let subText = 'Corra no lugar';
            let badgeBg = 'rgba(0, 0, 0, 0.75)';
            let badgeBorder = 'rgba(0, 229, 255, 0.4)';
            let textColor = '#00e5ff';

            if (isJumping) {
                statusText = '🦘 SALTO!';
                subText = 'Transpondo';
                badgeBg = 'rgba(0, 255, 136, 0.35)';
                badgeBorder = '#00ff88';
                textColor = '#00ff88';
            } else if (isRunning && cadence >= 1.0) {
                statusText = '🏃 CORRENDO!';
                subText = `${cadence.toFixed(1)} p/s`;
                badgeBg = 'rgba(0, 255, 136, 0.25)';
                badgeBorder = '#00ff88';
                textColor = '#00ff88';
            } else if (!kneesTracked) {
                statusText = '⚠️ MOSTRE AS PERNAS';
                subText = 'Dê 1-2 passos para trás';
                badgeBg = 'rgba(255, 140, 0, 0.30)';
                badgeBorder = '#ff9900';
                textColor = '#ffaa33';
            }

            const barHeight = Math.max(20, Math.round(h * 0.14));
            const barY = h - barHeight - 4;
            const barW = w - 10;
            const barX = 5;

            ctx.fillStyle = badgeBg;
            ctx.strokeStyle = badgeBorder;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barHeight, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = textColor;
            ctx.font = `bold ${Math.max(10, Math.round(w * 0.072))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${statusText} • ${subText}`, w / 2, barY + barHeight / 2);

            ctx.restore();

            ctx.restore();
        } else {
            // Sem landmarks → mensagem com texto desespelhado (legível da esquerda pra direita)
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-w, 0);

            ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🦴 Rastreando esqueleto...', w / 2, h / 2 - 6);
            ctx.font = '11px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText('Dê 1 a 2 passos para trás', w / 2, h / 2 + 14);
            ctx.restore();
        }
    }

    public showPiP(): void {
        this.isPiPVisible = true;
        if (this.pipContainer) {
            this.pipContainer.style.display = 'block';
        }
    }

    public hidePiP(): void {
        this.isPiPVisible = false;
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
