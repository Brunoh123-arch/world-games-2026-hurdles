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
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 60, min: 30 }
                    },
                    audio: false
                });
            } catch (constraintErr) {
                console.warn('Falha nas constraints de webcam específicas, tentando fallback simples { video: true }:', constraintErr);
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
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

        // ── ESQUELETO PROFISSIONAL DE BIOMECÂNICA OLÍMPICA ──
        if (landmarks && landmarks.length >= 17) {
            ctx.save();

            const isEmerald = isJumping;
            const primaryColor = isEmerald ? '#00ff88' : '#00f0ff';
            const coreColor = '#ffffff';
            const boneThickness = Math.max(3.5, Math.round(w * 0.024));

            // 1. LINHAS DOS OSSOS — Camada Dupla: Laser Core Branco + Brilho Neon Holográfico
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Passada 1: Brilho Neon Externo
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = boneThickness;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 16;

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

            // Linha da espinha (coluna vertebral biomecânica)
            const ls = landmarks[11], rs = landmarks[12];
            const lh = landmarks[23], rh = landmarks[24];
            let spineMidTopX = 0, spineMidTopY = 0, spineMidBotX = 0, spineMidBotY = 0;
            const hasSpine = ls && rs && lh && rh &&
                (ls.visibility ?? 1) > 0.25 && (rs.visibility ?? 1) > 0.25 &&
                (lh.visibility ?? 1) > 0.20 && (rh.visibility ?? 1) > 0.20;

            if (hasSpine) {
                spineMidTopX = (ls.x + rs.x) / 2;
                spineMidTopY = (ls.y + rs.y) / 2;
                spineMidBotX = (lh.x + rh.x) / 2;
                spineMidBotY = (lh.y + rh.y) / 2;

                ctx.beginPath();
                ctx.moveTo(spineMidTopX * w, spineMidTopY * h);
                ctx.lineTo(spineMidBotX * w, spineMidBotY * h);
                ctx.stroke();
            }

            // Passada 2: Núcleo Laser Branco Central (Aspecto High-Tech Profissional)
            ctx.strokeStyle = coreColor;
            ctx.lineWidth = Math.max(1.5, Math.round(boneThickness * 0.35));
            ctx.shadowBlur = 4;
            ctx.shadowColor = coreColor;

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
            if (hasSpine) {
                ctx.beginPath();
                ctx.moveTo(spineMidTopX * w, spineMidTopY * h);
                ctx.lineTo(spineMidBotX * w, spineMidBotY * h);
                ctx.stroke();
            }

            // 2. ARTICULAÇÕES BIOMÉTRICAS (Anéis Concêntricos Radar + Núcleo Dourado)
            const jointRadius = Math.max(4, Math.round(w * 0.024));
            for (let i = 11; i < Math.min(landmarks.length, 33); i++) {
                const lm = landmarks[i];
                if (!lm || (lm.visibility ?? 1) <= 0.25) continue;

                const cx = lm.x * w;
                const cy = lm.y * h;

                // Anel externo radar
                ctx.strokeStyle = primaryColor;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = primaryColor;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(cx, cy, jointRadius * 1.5, 0, 2 * Math.PI);
                ctx.stroke();

                // Núcleo interno neon (Dourado de Campeão Olímpico)
                ctx.fillStyle = '#ffdf00';
                ctx.shadowColor = '#ffdf00';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(cx, cy, jointRadius * 0.7, 0, 2 * Math.PI);
                ctx.fill();

                // Destaque para pulsos e joelhos
                if (i === 15 || i === 16 || i === 25 || i === 26) {
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(cx, cy, jointRadius * 0.35, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }

            // 3. RETÍCULO HUD DA CABEÇA (Brackets Angulares de Mira Profissional)
            const nose = landmarks[0];
            const headR = Math.max(14, Math.round(w * 0.09));
            if (nose && (nose.visibility ?? 1) > 0.25) {
                const nx = nose.x * w;
                const ny = nose.y * h;

                // Brackets angulares estilo mira biométrica [ ]
                const bSize = headR * 1.15;
                const bLen = headR * 0.45;
                ctx.strokeStyle = primaryColor;
                ctx.lineWidth = 2;
                ctx.shadowColor = primaryColor;
                ctx.shadowBlur = 10;

                // Top-Left
                ctx.beginPath();
                ctx.moveTo(nx - bSize, ny - bSize + bLen);
                ctx.lineTo(nx - bSize, ny - bSize);
                ctx.lineTo(nx - bSize + bLen, ny - bSize);
                ctx.stroke();

                // Top-Right
                ctx.beginPath();
                ctx.moveTo(nx + bSize - bLen, ny - bSize);
                ctx.lineTo(nx + bSize, ny - bSize);
                ctx.lineTo(nx + bSize, ny - bSize + bLen);
                ctx.stroke();

                // Bottom-Left
                ctx.beginPath();
                ctx.moveTo(nx - bSize, ny + bSize - bLen);
                ctx.lineTo(nx - bSize, ny + bSize);
                ctx.lineTo(nx - bSize + bLen, ny + bSize);
                ctx.stroke();

                // Bottom-Right
                ctx.beginPath();
                ctx.moveTo(nx + bSize - bLen, ny + bSize);
                ctx.lineTo(nx + bSize, ny + bSize);
                ctx.lineTo(nx + bSize, ny + bSize - bLen);
                ctx.stroke();

                // Mira central
                ctx.fillStyle = isEmerald ? '#00ff88' : '#ff0055';
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(nx, ny, 3.5, 0, 2 * Math.PI);
                ctx.fill();

                // Tag de telemetria
                ctx.font = 'bold 9px monospace';
                ctx.fillStyle = primaryColor;
                ctx.textAlign = 'center';
                ctx.fillText('AI RUNNER #26', nx, ny - bSize - 4);

                // Conexão do pescoço com a coluna
                if (hasSpine) {
                    ctx.strokeStyle = primaryColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(nx, ny + headR * 0.8);
                    ctx.lineTo(spineMidTopX * w, spineMidTopY * h);
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
