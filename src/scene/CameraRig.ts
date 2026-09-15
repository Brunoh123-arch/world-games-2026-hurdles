import * as THREE from 'three';
import { CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, CAMERA_LERP, CAMERA_SHAKE_INTENSITY, MAX_SPEED } from '../core/Constants';

export class CameraRig {
    private camera: THREE.PerspectiveCamera;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private slowMoActive: boolean = false;
    private slowMoTimer: number = 0;

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }

    public setSlowMo(active: boolean) {
        this.slowMoActive = active;
        if (active) {
            this.slowMoTimer = 0.5;
        }
    }

    public update(targetX: number, targetZ: number, speed: number, dt: number) {
        let currentDt = dt;
        if (this.slowMoActive && this.slowMoTimer > 0) {
            currentDt *= 0.2; // time scale
            this.slowMoTimer -= dt;
            if (this.slowMoTimer <= 0) {
                this.slowMoActive = false;
            }
        }

        const aspect = window.innerWidth / window.innerHeight;
        const isPortrait = aspect < 1.0;

        // Configurações ampliadas de câmera (Mobile Portrait vs Desktop Landscape)
        let baseHeight = isPortrait ? 2.0 : CAMERA_OFFSET_Y;
        let baseDist = isPortrait ? -3.6 : CAMERA_OFFSET_Z;

        if (this.slowMoActive && this.slowMoTimer > 0) {
            baseHeight = 1.7;
            baseDist = -3.0;
        }

        this.targetPosition.set(targetX, baseHeight, targetZ + baseDist);
        this.camera.position.lerp(this.targetPosition, CAMERA_LERP * currentDt * 60);

        // Dynamic FOV: no modo vertical usamos FOV mais aberto para a pista esticar até o topo da tela
        const defaultFov = isPortrait ? 72 : 58;
        const targetFov = defaultFov + Math.min(1.0, speed / MAX_SPEED) * 12;
        this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        this.camera.updateProjectionMatrix();

        // Camera shake at sprint
        if (speed > MAX_SPEED * 0.75) {
            const intensity = CAMERA_SHAKE_INTENSITY * ((speed - MAX_SPEED * 0.75) / (MAX_SPEED * 0.25));
            this.camera.position.x += (Math.random() - 0.5) * intensity;
            this.camera.position.y += (Math.random() - 0.5) * intensity;
            this.camera.position.z += (Math.random() - 0.5) * intensity;
        }
        
        // Ponto focal: olha para a pista à frente
        const lookY = isPortrait ? 1.4 : 1.15;
        const lookAheadZ = isPortrait ? 6.5 : 5.5;
        this.camera.lookAt(targetX, lookY, targetZ + lookAheadZ);
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }
}
