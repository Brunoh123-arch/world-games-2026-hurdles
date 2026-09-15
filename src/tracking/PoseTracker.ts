import { PoseLandmarker, GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FingerCurls {
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
}

export interface HandGestureState {
    gesture: string;
    curls: FingerCurls;
    wristPosition: { x: number; y: number };
}

export interface HandGesturesResult {
    leftHand?: HandGestureState;
    rightHand?: HandGestureState;
}

export class PoseTracker {
    private poseLandmarker: PoseLandmarker | null = null;
    private gestureRecognizer: GestureRecognizer | null = null;
    private lastResult: any = null; // PoseLandmarkerResult
    private lastDetectionTime = 0;
    private latestHandGestures: HandGesturesResult = {};

    public async init(): Promise<void> {
        try {
            let vision;
            try {
                vision = await FilesetResolver.forVisionTasks('/wasm');
                console.log('MediaPipe FilesetResolver carregado localmente (/wasm)');
            } catch (localErr) {
                console.warn('WASM local falhou, tentando CDN jsdelivr:', localErr);
                vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
                );
            }
            
            const modelPaths = [
                '/models/pose_landmarker_lite.task',
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
            ];

            let loaded = false;
            for (const modelPath of modelPaths) {
                try {
                    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: modelPath,
                            delegate: 'GPU'
                        },
                        runningMode: 'VIDEO',
                        numPoses: 1
                    });
                    console.log(`PoseLandmarker GPU carregado com sucesso de: ${modelPath}`);
                    loaded = true;
                    break;
                } catch (gpuErr) {
                    console.warn(`GPU delegate falhou para ${modelPath}, tentando CPU:`, gpuErr);
                    try {
                        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                            baseOptions: {
                                modelAssetPath: modelPath,
                                delegate: 'CPU'
                            },
                            runningMode: 'VIDEO',
                            numPoses: 1
                        });
                        console.log(`PoseLandmarker CPU carregado com sucesso de: ${modelPath}`);
                        loaded = true;
                        break;
                    } catch (cpuErr) {
                        console.warn(`CPU falhou para ${modelPath}:`, cpuErr);
                    }
                }
            }

            if (!loaded) {
                throw new Error('Não foi possível carregar o modelo de pose em nenhum delegate ou caminho.');
            }

            // ── Inicialização do Gesture Recognizer (Detecção de dedos, joinha 👍, pitoco 🖕, etc.) ──
            const gestureModelPaths = [
                '/models/gesture_recognizer.task',
                'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
            ];

            for (const gPath of gestureModelPaths) {
                try {
                    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: gPath,
                            delegate: 'GPU'
                        },
                        runningMode: 'VIDEO',
                        numHands: 2,
                        minHandDetectionConfidence: 0.30,
                        minHandPresenceConfidence: 0.30,
                        minTrackingConfidence: 0.30
                    });
                    console.log(`GestureRecognizer GPU carregado com sucesso de: ${gPath}`);
                    break;
                } catch (gGpuErr) {
                    console.warn(`Gesture GPU falhou para ${gPath}, tentando CPU:`, gGpuErr);
                    try {
                        this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                            baseOptions: {
                                modelAssetPath: gPath,
                                delegate: 'CPU'
                            },
                            runningMode: 'VIDEO',
                            numHands: 2,
                            minHandDetectionConfidence: 0.30,
                            minHandPresenceConfidence: 0.30,
                            minTrackingConfidence: 0.30
                        });
                        console.log(`GestureRecognizer CPU carregado com sucesso de: ${gPath}`);
                        break;
                    } catch (gCpuErr) {
                        console.warn(`Gesture CPU falhou para ${gPath}:`, gCpuErr);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to initialize tracking models:', error);
            throw error;
        }
    }

    public isReady(): boolean {
        return this.poseLandmarker !== null;
    }

    private lastVideoTime = -1;

    public detect(video: HTMLVideoElement, timestamp: number): any | null {
        if (!this.poseLandmarker || !video || video.readyState < 2 || video.videoWidth === 0) {
            return this.lastResult;
        }

        // Executa imediatamente quando um novo frame da webcam fica pronto (Zero Delay / Real-Time)
        if (video.currentTime !== this.lastVideoTime && timestamp > this.lastDetectionTime) {
            try {
                const result = this.poseLandmarker.detectForVideo(video, timestamp);
                this.lastVideoTime = video.currentTime;
                this.lastDetectionTime = timestamp;
                if (result && result.landmarks && result.landmarks.length > 0) {
                    this.lastResult = result;
                }
            } catch (error) {
                // Fallback gracioso sem travar o loop
            }

            // Executa o reconhecedor de gestos e dedos
            if (this.gestureRecognizer) {
                try {
                    const gestRes = this.gestureRecognizer.recognizeForVideo(video, timestamp);
                    this.processHandGestures(gestRes);
                } catch (gErr) {
                    // Ignora graciosamente sem travar o loop
                }
            }
        }

        return this.lastResult;
    }

    public getHandGestures(): HandGesturesResult {
        return this.latestHandGestures;
    }

    private processHandGestures(gestRes: any): void {
        if (!gestRes || !gestRes.landmarks || gestRes.landmarks.length === 0) {
            return;
        }

        const poseLW = this.getKeypoint('left_wrist');
        const poseRW = this.getKeypoint('right_wrist');

        const result: HandGesturesResult = {};

        for (let i = 0; i < gestRes.landmarks.length; i++) {
            const lms = gestRes.landmarks[i];
            if (!lms || lms.length < 21) continue;

            const wrist = lms[0];
            const rawCategory = gestRes.gestures?.[i]?.[0]?.categoryName || 'None';

            // Curvatura contínua para cada um dos 5 dedos (0 = aberto/esticado, 1 = dobrado/punho)
            const indexCurl = this.calcFingerCurl(8, 6, 5, lms);
            const middleCurl = this.calcFingerCurl(12, 10, 9, lms);
            const ringCurl = this.calcFingerCurl(16, 14, 13, lms);
            const pinkyCurl = this.calcFingerCurl(20, 18, 17, lms);
            const thumbCurl = this.calcThumbCurl(lms);

            let gestureName = 'Custom';
            let curls: FingerCurls = {
                thumb: thumbCurl,
                index: indexCurl,
                middle: middleCurl,
                ring: ringCurl,
                pinky: pinkyCurl
            };

            // ── RECONHECIMENTO DE GESTOS ESPECIAIS ──
            // 1. PITOCO / DEDO DO MEIO (Middle Finger) 🖕
            // Dedo médio bem esticado (middleCurl < 0.38) enquanto indicador, anelar e mindinho estão dobrados
            const isMiddleExtended = middleCurl < 0.38;
            const areOthersFolded = indexCurl > 0.52 && ringCurl > 0.52 && pinkyCurl > 0.52;

            if (isMiddleExtended && areOthersFolded) {
                gestureName = 'Middle_Finger';
                curls = {
                    thumb: 0.85,
                    index: 1.0,
                    middle: 0.0, // Reto e esticado em destaque
                    ring: 1.0,
                    pinky: 1.0
                };
            } else if (rawCategory === 'Thumb_Up' || (thumbCurl < 0.30 && indexCurl > 0.55 && middleCurl > 0.55 && ringCurl > 0.55 && pinkyCurl > 0.55 && lms[4].y < lms[0].y)) {
                // 2. BELEZA / JOINHA (Thumb Up) 👍
                gestureName = 'Thumb_Up';
                curls = {
                    thumb: 0.0, // Polegar erguido
                    index: 1.0,
                    middle: 1.0,
                    ring: 1.0,
                    pinky: 1.0
                };
            } else if (rawCategory === 'Victory' || (indexCurl < 0.35 && middleCurl < 0.35 && ringCurl > 0.55 && pinkyCurl > 0.55)) {
                // 3. VITÓRIA / PAZ E AMOR ✌️
                gestureName = 'Victory';
                curls = {
                    thumb: 0.8,
                    index: 0.0,
                    middle: 0.0,
                    ring: 1.0,
                    pinky: 1.0
                };
            } else if (rawCategory === 'Pointing_Up' || (indexCurl < 0.35 && middleCurl > 0.55 && ringCurl > 0.55 && pinkyCurl > 0.55)) {
                // 4. APONTAR ☝️
                gestureName = 'Pointing_Up';
                curls = {
                    thumb: 0.8,
                    index: 0.0,
                    middle: 1.0,
                    ring: 1.0,
                    pinky: 1.0
                };
            } else if (indexCurl < 0.35 && pinkyCurl < 0.35 && middleCurl > 0.55 && ringCurl > 0.55) {
                // 5. ROCK 🤘
                gestureName = 'Rock';
                curls = {
                    thumb: 0.8,
                    index: 0.0,
                    middle: 1.0,
                    ring: 1.0,
                    pinky: 0.0
                };
            } else if (thumbCurl < 0.35 && pinkyCurl < 0.35 && indexCurl > 0.55 && middleCurl > 0.55 && ringCurl > 0.55) {
                // 6. HANG LOOSE 🤙
                gestureName = 'Hang_Loose';
                curls = {
                    thumb: 0.0,
                    index: 1.0,
                    middle: 1.0,
                    ring: 1.0,
                    pinky: 0.0
                };
            } else if (rawCategory === 'Closed_Fist' || (indexCurl > 0.65 && middleCurl > 0.65 && ringCurl > 0.65 && pinkyCurl > 0.65)) {
                // 7. PUNHO FECHADO ✊
                gestureName = 'Closed_Fist';
                curls = {
                    thumb: 1.0,
                    index: 1.0,
                    middle: 1.0,
                    ring: 1.0,
                    pinky: 1.0
                };
            } else if (rawCategory === 'Open_Palm' || (indexCurl < 0.35 && middleCurl < 0.35 && ringCurl < 0.35 && pinkyCurl < 0.35 && thumbCurl < 0.40)) {
                // 8. MÃO ABERTA 🖐️
                gestureName = 'Open_Palm';
                curls = {
                    thumb: 0.0,
                    index: 0.0,
                    middle: 0.0,
                    ring: 0.0,
                    pinky: 0.0
                };
            }

            // Determina se a mão pertence ao braço esquerdo ou direito do jogador
            let isPlayerLeftArm = false;
            if (poseLW && poseRW) {
                const distL = Math.hypot(wrist.x - poseLW.x, wrist.y - poseLW.y);
                const distR = Math.hypot(wrist.x - poseRW.x, wrist.y - poseRW.y);
                isPlayerLeftArm = distL < distR;
            } else {
                isPlayerLeftArm = wrist.x < 0.5;
            }

            const state: HandGestureState = {
                gesture: gestureName,
                curls,
                wristPosition: { x: wrist.x, y: wrist.y }
            };

            if (isPlayerLeftArm) {
                result.leftHand = state;
            } else {
                result.rightHand = state;
            }
        }

        this.latestHandGestures = result;
    }

    private calcFingerCurl(tipIdx: number, pipIdx: number, mcpIdx: number, lms: any[]): number {
        const wrist = lms[0];
        const tip = lms[tipIdx];
        const mcp = lms[mcpIdx];
        if (!wrist || !tip || !mcp) return 0;
        const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const dMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
        if (dMcp < 0.001) return 0;
        const ratio = dTip / dMcp;
        const curl = (1.75 - ratio) / 0.75;
        return Math.max(0, Math.min(1, curl));
    }

    private calcThumbCurl(lms: any[]): number {
        const tip = lms[4];
        const indexMcp = lms[5];
        const pinkyMcp = lms[17];
        if (!tip || !indexMcp || !pinkyMcp) return 0;
        const handWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
        if (handWidth < 0.001) return 0;
        const dTip = Math.hypot(tip.x - indexMcp.x, tip.y - indexMcp.y);
        const curl = (0.75 - (dTip / handWidth)) / 0.45;
        return Math.max(0, Math.min(1, curl));
    }

    public getKeypoint(name: string): { x: number, y: number, z: number, visibility: number } | null {
        if (!this.lastResult || !this.lastResult.landmarks || this.lastResult.landmarks.length === 0) {
            return null;
        }
        
        const landmarks = this.lastResult.landmarks[0];
        
        // Map common names to mediapipe indices
        const indices: Record<string, number> = {
            'nose': 0,
            'left_eye_inner': 1, 'left_eye': 2, 'left_eye_outer': 3,
            'right_eye_inner': 4, 'right_eye': 5, 'right_eye_outer': 6,
            'left_ear': 7, 'right_ear': 8,
            'mouth_left': 9, 'mouth_right': 10,
            'left_shoulder': 11, 'right_shoulder': 12,
            'left_elbow': 13, 'right_elbow': 14,
            'left_wrist': 15, 'right_wrist': 16,
            'left_pinky': 17, 'right_pinky': 18,
            'left_index': 19, 'right_index': 20,
            'left_thumb': 21, 'right_thumb': 22,
            'left_hip': 23, 'right_hip': 24,
            'left_knee': 25, 'right_knee': 26,
            'left_ankle': 27, 'right_ankle': 28,
            'left_heel': 29, 'right_heel': 30,
            'left_foot_index': 31, 'right_foot_index': 32
        };

        const index = indices[name];
        if (index !== undefined && landmarks[index]) {
            const lm = landmarks[index];
            return {
                x: lm.x,
                y: lm.y,
                z: lm.z,
                visibility: lm.visibility || 0
            };
        }

        return null;
    }

    public dispose(): void {
        if (this.poseLandmarker) {
            this.poseLandmarker.close();
            this.poseLandmarker = null;
        }
        if (this.gestureRecognizer) {
            this.gestureRecognizer.close();
            this.gestureRecognizer = null;
        }
        this.lastResult = null;
        this.latestHandGestures = {};
    }
}
