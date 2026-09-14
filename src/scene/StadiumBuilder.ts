import * as THREE from 'three';
import { LANE_WIDTH, TRACK_LENGTH_M } from '../core/Constants';

export class StadiumBuilder {
    private geometries: THREE.BufferGeometry[] = [];
    private materials: THREE.Material[] = [];
    private textures: THREE.Texture[] = [];
    private group: THREE.Group = new THREE.Group();

    public build(): THREE.Group {
        this.group = new THREE.Group();

        // ── Pista Olímpica de Tartã (-20m a 145m, total 165m) ──
        const trackLength = 165;
        const trackCenterZ = 62.5; // (-20 + 145) / 2
        const trackWidth = 10.0;

        // Procedural Tartan Texture
        const tartanCanvas = document.createElement('canvas');
        tartanCanvas.width = 512;
        tartanCanvas.height = 512;
        const tCtx = tartanCanvas.getContext('2d');
        if (tCtx) {
            tCtx.fillStyle = '#b33927'; // Olympic red tartan
            tCtx.fillRect(0, 0, 512, 512);
            // Rubber grain noise
            for (let i = 0; i < 25000; i++) {
                const nx = Math.random() * 512;
                const ny = Math.random() * 512;
                const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
                tCtx.fillStyle = shade;
                tCtx.fillRect(nx, ny, 2, 2);
            }
        }
        const tartanTex = new THREE.CanvasTexture(tartanCanvas);
        tartanTex.wrapS = THREE.RepeatWrapping;
        tartanTex.wrapT = THREE.RepeatWrapping;
        tartanTex.repeat.set(4, 30);
        this.textures.push(tartanTex);

        const trackGeo = new THREE.BoxGeometry(trackWidth, 0.15, trackLength);
        const trackMat = new THREE.MeshStandardMaterial({
            map: tartanTex,
            roughness: 0.85,
            metalness: 0.05
        });
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.set(0, 0, trackCenterZ);
        track.receiveShadow = true;
        this.group.add(track);
        this.geometries.push(trackGeo);
        this.materials.push(trackMat);

        // ── White Lane Markings & Curbs ──
        const lineGeo = new THREE.BoxGeometry(0.08, 0.16, trackLength);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.materials.push(lineMat);
        this.geometries.push(lineGeo);

        // 4 lines = 3 lanes
        const laneOffsets = [-1.5 * LANE_WIDTH, -0.5 * LANE_WIDTH, 0.5 * LANE_WIDTH, 1.5 * LANE_WIDTH];
        for (const lx of laneOffsets) {
            const laneLine = new THREE.Mesh(lineGeo, lineMat);
            laneLine.position.set(lx, 0.01, trackCenterZ);
            laneLine.receiveShadow = true;
            this.group.add(laneLine);
        }

        // Side Curbs (white/blue Olympic border curb)
        const curbGeo = new THREE.BoxGeometry(0.3, 0.25, trackLength);
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x0055aa, roughness: 0.6 });
        const leftCurb = new THREE.Mesh(curbGeo, curbMat);
        leftCurb.position.set(-trackWidth / 2 - 0.15, 0.05, trackCenterZ);
        const rightCurb = new THREE.Mesh(curbGeo, curbMat);
        rightCurb.position.set(trackWidth / 2 + 0.15, 0.05, trackCenterZ);
        this.group.add(leftCurb, rightCurb);
        this.geometries.push(curbGeo);
        this.materials.push(curbMat);

        // ── Starting Line at Z = 0 & Starting Blocks ──
        const startLineGeo = new THREE.PlaneGeometry(trackWidth, 0.4);
        const startLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const startLine = new THREE.Mesh(startLineGeo, startLineMat);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(0, 0.09, 0);
        this.group.add(startLine);
        this.geometries.push(startLineGeo);
        this.materials.push(startLineMat);

        // Starting Blocks on each lane
        const blockGeo = new THREE.BoxGeometry(0.4, 0.15, 0.5);
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
        for (let l = -1; l <= 1; l++) {
            const block = new THREE.Mesh(blockGeo, blockMat);
            block.position.set(l * LANE_WIDTH, 0.1, -0.6);
            block.castShadow = true;
            this.group.add(block);
        }
        this.geometries.push(blockGeo);
        this.materials.push(blockMat);

        // ── Distance Markers (25m, 50m, 75m) ──
        [25, 50, 75].forEach((dist) => {
            const mGeo = new THREE.PlaneGeometry(trackWidth, 0.15);
            const mMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true, side: THREE.DoubleSide });
            const mLine = new THREE.Mesh(mGeo, mMat);
            mLine.rotation.x = -Math.PI / 2;
            mLine.position.set(0, 0.085, dist);
            this.group.add(mLine);
            this.geometries.push(mGeo);
            this.materials.push(mMat);
        });

        // ── Official Finish Line at Z = 100m ──
        const finishCanvas = document.createElement('canvas');
        finishCanvas.width = 512;
        finishCanvas.height = 64;
        const fCtx = finishCanvas.getContext('2d');
        if (fCtx) {
            fCtx.fillStyle = '#ffffff';
            fCtx.fillRect(0, 0, 512, 64);
            fCtx.fillStyle = '#000000';
            for (let i = 0; i < 512; i += 32) {
                fCtx.fillRect(i, 0, 16, 32);
                fCtx.fillRect(i + 16, 32, 16, 32);
            }
        }
        const finishTex = new THREE.CanvasTexture(finishCanvas);
        this.textures.push(finishTex);

        const finishLineGeo = new THREE.PlaneGeometry(trackWidth, 1.2);
        const finishLineMat = new THREE.MeshBasicMaterial({ map: finishTex, side: THREE.DoubleSide });
        const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
        finishLine.rotation.x = -Math.PI / 2;
        finishLine.position.set(0, 0.09, TRACK_LENGTH_M); // 100m
        this.group.add(finishLine);
        this.geometries.push(finishLineGeo);
        this.materials.push(finishLineMat);

        // ── Grand Finish Gantry (Truss Arch over 100m) ──
        this.buildFinishGantry(trackWidth);

        // ── Deceleration Foam Mats at Z = 138m ──
        const matGeo = new THREE.BoxGeometry(trackWidth, 0.6, 2.5);
        const matMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.9 });
        const safetyMat = new THREE.Mesh(matGeo, matMat);
        safetyMat.position.set(0, 0.3, 138);
        safetyMat.castShadow = true;
        this.group.add(safetyMat);
        this.geometries.push(matGeo);
        this.materials.push(matMat);

        // ── Green Turf Fields on Sides ──
        const turfGeo = new THREE.PlaneGeometry(120, trackLength + 40);
        const turfCanvas = document.createElement('canvas');
        turfCanvas.width = 256;
        turfCanvas.height = 256;
        const turfCtx = turfCanvas.getContext('2d');
        if (turfCtx) {
            turfCtx.fillStyle = '#1e7b34';
            turfCtx.fillRect(0, 0, 256, 256);
            turfCtx.fillStyle = '#228b3b';
            for (let s = 0; s < 256; s += 32) {
                turfCtx.fillRect(0, s, 256, 16);
            }
        }
        const turfTex = new THREE.CanvasTexture(turfCanvas);
        turfTex.wrapS = THREE.RepeatWrapping;
        turfTex.wrapT = THREE.RepeatWrapping;
        turfTex.repeat.set(6, 20);
        this.textures.push(turfTex);

        const turfMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.95 });
        turfGeo.rotateX(-Math.PI / 2);

        const leftTurf = new THREE.Mesh(turfGeo, turfMat);
        leftTurf.position.set(-trackWidth / 2 - 60, -0.02, trackCenterZ);
        leftTurf.receiveShadow = true;

        const rightTurf = new THREE.Mesh(turfGeo, turfMat);
        rightTurf.position.set(trackWidth / 2 + 60, -0.02, trackCenterZ);
        rightTurf.receiveShadow = true;

        this.group.add(leftTurf, rightTurf);
        this.geometries.push(turfGeo);
        this.materials.push(turfMat);

        // ── Grandstands Covering Whole 165m Track ──
        this.buildGrandstands(trackCenterZ, trackLength);

        // ── Sky Dome ──
        this.buildSky();

        return this.group;
    }

    private buildFinishGantry(trackWidth: number): void {
        const gantryGroup = new THREE.Group();
        gantryGroup.position.set(0, 0, TRACK_LENGTH_M);

        const trussMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
        this.materials.push(trussMat);

        // Left & Right Pillars
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 6.0, 12);
        this.geometries.push(pillarGeo);
        const leftPillar = new THREE.Mesh(pillarGeo, trussMat);
        leftPillar.position.set(-trackWidth / 2 - 0.8, 3.0, 0);
        leftPillar.castShadow = true;

        const rightPillar = new THREE.Mesh(pillarGeo, trussMat);
        rightPillar.position.set(trackWidth / 2 + 0.8, 3.0, 0);
        rightPillar.castShadow = true;

        // Overhead Beam
        const beamGeo = new THREE.BoxGeometry(trackWidth + 2.4, 0.4, 0.4);
        this.geometries.push(beamGeo);
        const beam = new THREE.Mesh(beamGeo, trussMat);
        beam.position.set(0, 5.8, 0);
        beam.castShadow = true;

        // Big Finish Sign
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 1024;
        signCanvas.height = 256;
        const sCtx = signCanvas.getContext('2d');
        if (sCtx) {
            sCtx.fillStyle = '#FFD700'; // Gold banner
            sCtx.fillRect(0, 0, 1024, 256);
            sCtx.fillStyle = '#0a0a1a';
            sCtx.font = 'bold 90px sans-serif';
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillText('★ FINISH LINE ★', 512, 90);
            sCtx.font = 'bold 50px sans-serif';
            sCtx.fillStyle = '#b91c1c';
            sCtx.fillText('WORLD GAMES 2026', 512, 180);
        }
        const signTex = new THREE.CanvasTexture(signCanvas);
        this.textures.push(signTex);

        const signGeo = new THREE.PlaneGeometry(trackWidth, 1.6);
        const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
        this.geometries.push(signGeo);
        this.materials.push(signMat);

        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, 4.7, 0);
        gantryGroup.add(leftPillar, rightPillar, beam, sign);
        this.group.add(gantryGroup);
    }

    private buildGrandstands(trackCenterZ: number, trackLength: number): void {
        const seatGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
        const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
        this.geometries.push(seatGeo);
        this.materials.push(seatMat);

        const rows = 14;
        const cols = 55;
        const seatCount = rows * cols * 2;
        const instancedStands = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);

        const colors = [
            new THREE.Color(0xdc2626), // red
            new THREE.Color(0x2563eb), // blue
            new THREE.Color(0xfacc15), // yellow
            new THREE.Color(0x16a34a), // green
            new THREE.Color(0xffffff)  // white
        ];
        const dummy = new THREE.Object3D();

        let idx = 0;
        for (let side = -1; side <= 1; side += 2) {
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const zPos = (trackCenterZ - trackLength / 2) + (col / cols) * trackLength;
                    dummy.position.set(
                        side * (9.0 + row * 1.4),
                        row * 0.9 + 0.5,
                        zPos
                    );
                    dummy.updateMatrix();
                    instancedStands.setMatrixAt(idx, dummy.matrix);
                    const color = colors[(row * 7 + col * 13) % colors.length];
                    instancedStands.setColorAt(idx, color);
                    idx++;
                }
            }
        }
        instancedStands.instanceMatrix.needsUpdate = true;
        if (instancedStands.instanceColor) instancedStands.instanceColor.needsUpdate = true;
        this.group.add(instancedStands);

        // LED Ribbon Banners along stands
        const ribbonLength = trackLength + 10;
        const ribbonGeo = new THREE.PlaneGeometry(ribbonLength, 1.8);
        this.geometries.push(ribbonGeo);

        const ribbonCanvas = document.createElement('canvas');
        ribbonCanvas.width = 2048;
        ribbonCanvas.height = 128;
        const rCtx = ribbonCanvas.getContext('2d');
        if (rCtx) {
            rCtx.fillStyle = '#090915';
            rCtx.fillRect(0, 0, 2048, 128);
            rCtx.fillStyle = '#00ffff';
            rCtx.font = 'bold 50px sans-serif';
            rCtx.textBaseline = 'middle';
            let x = 40;
            while (x < 2000) {
                rCtx.fillStyle = '#ffd700';
                rCtx.fillText('WORLD GAMES 2026', x, 64);
                rCtx.fillStyle = '#00ffcc';
                rCtx.fillText('⚡ 100M HURDLES ⚡', x + 500, 64);
                x += 1000;
            }
        }
        const ribbonTex = new THREE.CanvasTexture(ribbonCanvas);
        ribbonTex.wrapS = THREE.RepeatWrapping;
        ribbonTex.repeat.set(2, 1);
        this.textures.push(ribbonTex);

        const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.DoubleSide });
        this.materials.push(ribbonMat);

        const leftRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
        leftRibbon.position.set(-8.2, 1.2, trackCenterZ);
        leftRibbon.rotation.y = Math.PI / 2;

        const rightRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
        rightRibbon.position.set(8.2, 1.2, trackCenterZ);
        rightRibbon.rotation.y = -Math.PI / 2;

        this.group.add(leftRibbon, rightRibbon);
    }

    private buildSky(): void {
        const skyGeo = new THREE.SphereGeometry(300, 32, 16);
        const skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, vertexColors: true });

        const skyColors = [];
        const positions = skyGeo.attributes.position;
        const colorTop = new THREE.Color(0x38bdf8); // vibrant sunny sky
        const colorBottom = new THREE.Color(0xffffff);
        for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            const alpha = Math.max(0, Math.min(1, y / 120));
            const c = colorBottom.clone().lerp(colorTop, alpha);
            skyColors.push(c.r, c.g, c.b);
        }
        skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));

        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.group.add(sky);
        this.geometries.push(skyGeo);
        this.materials.push(skyMat);
    }

    public dispose(): void {
        this.geometries.forEach(g => g.dispose());
        this.materials.forEach(m => m.dispose());
        this.textures.forEach(t => t.dispose());
        this.geometries = [];
        this.materials = [];
        this.textures = [];
        this.group.clear();
    }
}
