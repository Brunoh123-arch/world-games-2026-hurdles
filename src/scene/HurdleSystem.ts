import * as THREE from 'three';
import { LANE_WIDTH, FIRST_HURDLE_M, HURDLE_SPACING_M, HURDLE_COUNT, LANE_COUNT, HURDLE_HEIGHT, HURDLE_WIDTH } from '../core/Constants';

interface HurdleData {
    mesh: THREE.Group;
    knocked: boolean;
    angularVelocity: number;
}

export class HurdleSystem {
    private container: THREE.Group = new THREE.Group();
    private hurdles: HurdleData[][] = []; 
    private geometries: THREE.BufferGeometry[] = [];
    private materials: THREE.Material[] = [];

    public createHurdles(): THREE.Group {
        this.container = new THREE.Group();
        this.hurdles = Array.from({ length: LANE_COUNT }, () => []);

        const postGeo = new THREE.CylinderGeometry(0.035, 0.035, HURDLE_HEIGHT, 12);
        this.geometries.push(postGeo);
        
        // Shiny aluminum metal post material
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.85,
            roughness: 0.25
        });
        this.materials.push(postMat);

        // Hurdle feet (L-shaped base on track)
        const footGeo = new THREE.BoxGeometry(0.06, 0.04, 0.65);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
        this.geometries.push(footGeo);
        this.materials.push(footMat);

        const barGeo = new THREE.BoxGeometry(HURDLE_WIDTH, 0.12, 0.04);
        this.geometries.push(barGeo);

        const barCanvas = document.createElement('canvas');
        barCanvas.width = 512; barCanvas.height = 64;
        const bCtx = barCanvas.getContext('2d');
        if (bCtx) {
            bCtx.fillStyle = '#ffffff';
            bCtx.fillRect(0, 0, 512, 64);
            bCtx.fillStyle = '#000000';
            for (let i = 0; i < 512; i += 64) {
                bCtx.fillRect(i, 0, 32, 64);
            }
        }
        const barTex = new THREE.CanvasTexture(barCanvas);
        const barMat = new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.5 });
        this.materials.push(barMat);

        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const laneX = (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
            for (let i = 0; i < HURDLE_COUNT; i++) {
                const z = FIRST_HURDLE_M + i * HURDLE_SPACING_M;
                
                const hurdleGroup = new THREE.Group();
                const pivot = new THREE.Group();
                pivot.position.set(laneX, 0, z);
                
                // Left post & foot
                const leftPost = new THREE.Mesh(postGeo, postMat);
                leftPost.position.set(-HURDLE_WIDTH / 2 + 0.08, HURDLE_HEIGHT / 2, 0);
                leftPost.castShadow = true;
                const leftFoot = new THREE.Mesh(footGeo, footMat);
                leftFoot.position.set(-HURDLE_WIDTH / 2 + 0.08, 0.02, 0.25);
                leftFoot.castShadow = true;
                hurdleGroup.add(leftPost, leftFoot);

                // Right post & foot
                const rightPost = new THREE.Mesh(postGeo, postMat);
                rightPost.position.set(HURDLE_WIDTH / 2 - 0.08, HURDLE_HEIGHT / 2, 0);
                rightPost.castShadow = true;
                const rightFoot = new THREE.Mesh(footGeo, footMat);
                rightFoot.position.set(HURDLE_WIDTH / 2 - 0.08, 0.02, 0.25);
                rightFoot.castShadow = true;
                hurdleGroup.add(rightPost, rightFoot);

                // Crossbar
                const bar = new THREE.Mesh(barGeo, barMat);
                bar.position.set(0, HURDLE_HEIGHT - 0.06, 0);
                bar.castShadow = true;
                hurdleGroup.add(bar);

                pivot.add(hurdleGroup);
                this.container.add(pivot);

                this.hurdles[lane].push({
                    mesh: pivot,
                    knocked: false,
                    angularVelocity: 0
                });
            }
        }

        return this.container;
    }

    public knockHurdle(laneIndex: number, hurdleIndex: number) {
        if (!this.hurdles[laneIndex] || !this.hurdles[laneIndex][hurdleIndex]) return;
        const hurdle = this.hurdles[laneIndex][hurdleIndex];
        if (!hurdle.knocked) {
            hurdle.knocked = true;
            hurdle.angularVelocity = 5.0; // Initial rotation speed
        }
    }

    public update(dt: number) {
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            for (let i = 0; i < HURDLE_COUNT; i++) {
                const hurdle = this.hurdles[lane][i];
                if (hurdle.knocked && hurdle.angularVelocity > 0) {
                    hurdle.mesh.rotation.x += hurdle.angularVelocity * dt;
                    hurdle.angularVelocity -= 15.0 * dt; // Gravity / friction simulation
                    if (hurdle.mesh.rotation.x >= Math.PI / 2) {
                        hurdle.mesh.rotation.x = Math.PI / 2;
                        hurdle.angularVelocity = 0;
                    }
                }
            }
        }
    }

    public getHurdlePosition(laneIndex: number, hurdleIndex: number): number {
        return FIRST_HURDLE_M + hurdleIndex * HURDLE_SPACING_M;
    }

    public resetAll() {
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            for (let i = 0; i < HURDLE_COUNT; i++) {
                const hurdle = this.hurdles[lane][i];
                hurdle.knocked = false;
                hurdle.angularVelocity = 0;
                hurdle.mesh.rotation.x = 0;
            }
        }
    }

    public dispose() {
        this.geometries.forEach(g => g.dispose());
        this.materials.forEach(m => {
            m.dispose();
            if ('map' in m && (m as any).map) (m as any).map.dispose();
        });
        this.geometries = [];
        this.materials = [];
        this.container.clear();
    }
}
