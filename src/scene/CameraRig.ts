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

        const heightOffset = (this.slowMoActive && this.slowMoTimer > 0) ? 2.3 : CAMERA_OFFSET_Y;
        const distOffset = (this.slowMoActive && this.slowMoTimer > 0) ? -4.5 : CAMERA_OFFSET_Z;

        this.targetPosition.set(targetX, heightOffset, targetZ + distOffset);
        
        this.camera.position.lerp(this.targetPosition, CAMERA_LERP * currentDt * 60);

        // Dynamic FOV expansion at high speeds (Arcade rush feel)
        const targetFov = 58 + Math.min(1.0, speed / MAX_SPEED) * 14;
        this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        this.camera.updateProjectionMatrix();

        // Camera shake at sprint
        if (speed > MAX_SPEED * 0.75) {
            const intensity = CAMERA_SHAKE_INTENSITY * ((speed - MAX_SPEED * 0.75) / (MAX_SPEED * 0.25));
            this.camera.position.x += (Math.random() - 0.5) * intensity;
            this.camera.position.y += (Math.random() - 0.5) * intensity;
            this.camera.position.z += (Math.random() - 0.5) * intensity;
        }
        
        this.camera.lookAt(targetX, 1.1, targetZ + 5.5);
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }
}
