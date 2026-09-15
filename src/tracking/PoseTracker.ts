import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export class PoseTracker {
    private poseLandmarker: PoseLandmarker | null = null;
    private lastResult: any = null; // PoseLandmarkerResult
    private lastDetectionTime = 0;
    // Assuming POSE_FPS is exported from Constants, but we will define it here or import.
    // For standalone completeness without Constants if missing:
    private readonly POSE_FPS = 30; 
    private readonly FRAME_INTERVAL = 1000 / 30;

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
        } catch (error) {
            console.error('Failed to initialize PoseLandmarker:', error);
            throw error;
        }
    }

    public isReady(): boolean {
        return this.poseLandmarker !== null;
    }

    public detect(video: HTMLVideoElement, timestamp: number): any | null {
        if (!this.poseLandmarker || !video || video.readyState < 2 || video.videoWidth === 0) {
            return this.lastResult;
        }

        if (timestamp - this.lastDetectionTime >= this.FRAME_INTERVAL) {
            try {
                const result = this.poseLandmarker.detectForVideo(video, timestamp);
                if (result && result.landmarks && result.landmarks.length > 0) {
                    this.lastResult = result;
                    this.lastDetectionTime = timestamp;
                }
            } catch (error) {
                console.warn('Error during pose detection:', error);
                return null;
            }
        }

        return this.lastResult;
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
        this.lastResult = null;
    }
}
