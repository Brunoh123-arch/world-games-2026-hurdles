import * as THREE from 'three';
import type { Country } from '../types';

export interface AvatarParts {
    head: THREE.Group;
    torso: THREE.Group;
    leftUpperArm: THREE.Group;
    leftForearm: THREE.Group;
    rightUpperArm: THREE.Group;
    rightForearm: THREE.Group;
    leftThigh: THREE.Group;
    leftShin: THREE.Group;
    rightThigh: THREE.Group;
    rightShin: THREE.Group;
    leftFoot: THREE.Group;
    rightFoot: THREE.Group;
}

export class AvatarBuilder {
    public createAvatar(country: Country): { group: THREE.Group; parts: AvatarParts } {
        const group = new THREE.Group();

        // ── High-Fidelity Materials ──
        const skinMat = new THREE.MeshStandardMaterial({
            color: 0xe0976f,
            roughness: 0.6,
            metalness: 0.05
        });

        const jerseyMat = new THREE.MeshStandardMaterial({
            color: country.jerseyColor || 0x009c3b,
            roughness: 0.7,
            metalness: 0.1
        });

        const shortsMat = new THREE.MeshStandardMaterial({
            color: country.shortsColor || 0x002776,
            roughness: 0.75,
            metalness: 0.05
        });

        const accentMat = new THREE.MeshStandardMaterial({
            color: country.accentColor || 0xffdf00,
            roughness: 0.5,
            metalness: 0.2
        });

        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.4 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
        const shadesMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.1,
            metalness: 0.9
        });
        const goldSpikesMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.2,
            metalness: 0.95
        });

        // ── 1. HEAD & ATHLETIC FACE ──
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.62, 0);

        // Cranium & Face
        const headGeo = new THREE.SphereGeometry(0.20, 24, 24);
        const headMesh = new THREE.Mesh(headGeo, skinMat);
        headMesh.scale.set(0.95, 1.15, 1.0);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        // Athletic Hair / Fade
        const hairGeo = new THREE.SphereGeometry(0.208, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const hairMesh = new THREE.Mesh(hairGeo, darkMat);
        hairMesh.position.set(0, 0.04, -0.01);
        hairMesh.scale.set(0.97, 1.15, 1.02);
        hairGroupAdd(headGroup, hairMesh);

        // Sports Headband
        const bandGeo = new THREE.TorusGeometry(0.205, 0.025, 12, 32);
        const bandMesh = new THREE.Mesh(bandGeo, accentMat);
        bandMesh.rotation.x = Math.PI / 2;
        bandMesh.position.set(0, 0.08, 0.01);
        bandMesh.castShadow = true;
        headGroup.add(bandMesh);

        // Olympic Wrap-Around Sunglasses / Visor Shades
        const shadesGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 24, 1, true, -Math.PI * 0.4, Math.PI * 0.8);
        const shadesMesh = new THREE.Mesh(shadesGeo, shadesMat);
        shadesMesh.position.set(0, 0.02, 0.08);
        shadesMesh.rotation.y = Math.PI;
        shadesMesh.castShadow = true;
        headGroup.add(shadesMesh);

        // Shades Nose Bridge & Frame
        const frameGeo = new THREE.BoxGeometry(0.06, 0.02, 0.06);
        const frameMesh = new THREE.Mesh(frameGeo, darkMat);
        frameMesh.position.set(0, 0.03, 0.21);
        headGroup.add(frameMesh);

        group.add(headGroup);

        // ── 2. ATHLETIC TORSO & RACE BIB ──
        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 0.95, 0);

        // Tapered V-chest & core
        const chestGeo = new THREE.CylinderGeometry(0.24, 0.17, 0.65, 16);
        const chestMesh = new THREE.Mesh(chestGeo, jerseyMat);
        chestMesh.scale.set(1.15, 1.0, 0.85);
        chestMesh.castShadow = true;
        chestMesh.receiveShadow = true;
        torsoGroup.add(chestMesh);

        // Race Bib Number on Chest
        const bibCanvas = document.createElement('canvas');
        bibCanvas.width = 256;
        bibCanvas.height = 180;
        const bCtx = bibCanvas.getContext('2d');
        if (bCtx) {
            bCtx.fillStyle = '#ffffff';
            bCtx.fillRect(0, 0, 256, 180);
            bCtx.fillStyle = '#1e3a8a';
            bCtx.fillRect(0, 0, 256, 32);
            bCtx.fillStyle = '#ffffff';
            bCtx.font = 'bold 22px sans-serif';
            bCtx.textAlign = 'center';
            bCtx.fillText('WORLD GAMES 2026', 128, 24);
            bCtx.fillStyle = '#0f172a';
            bCtx.font = '900 85px sans-serif';
            bCtx.fillText('26', 128, 125);
            bCtx.font = 'bold 22px sans-serif';
            bCtx.fillStyle = '#dc2626';
            bCtx.fillText(country.id.toUpperCase(), 128, 160);
        }
        const bibTex = new THREE.CanvasTexture(bibCanvas);
        const bibGeo = new THREE.PlaneGeometry(0.26, 0.18);
        const bibMat = new THREE.MeshBasicMaterial({ map: bibTex, side: THREE.DoubleSide });
        const bibMesh = new THREE.Mesh(bibGeo, bibMat);
        bibMesh.position.set(0, 0.08, 0.18);
        torsoGroup.add(bibMesh);

        // Singlet Accent Stripes
        const stripeGeo = new THREE.BoxGeometry(0.04, 0.66, 0.02);
        const leftStripe = new THREE.Mesh(stripeGeo, accentMat);
        leftStripe.position.set(-0.21, 0, 0.08);
        const rightStripe = new THREE.Mesh(stripeGeo, accentMat);
        rightStripe.position.set(0.21, 0, 0.08);
        torsoGroup.add(leftStripe, rightStripe);

        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.09, 0.10, 0.15, 16);
        const neckMesh = new THREE.Mesh(neckGeo, skinMat);
        neckMesh.position.set(0, 0.35, 0);
        neckMesh.castShadow = true;
        torsoGroup.add(neckMesh);

        // Pelvis / Waist
        const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.22, 16);
        const pelvisMesh = new THREE.Mesh(pelvisGeo, shortsMat);
        pelvisMesh.scale.set(1.1, 1.0, 0.9);
        pelvisMesh.position.set(0, -0.36, 0);
        pelvisMesh.castShadow = true;
        torsoGroup.add(pelvisMesh);

        group.add(torsoGroup);

        // ── 3. ATHLETIC LIMB GENERATOR ──
        const createLimb = (
            topRadius: number,
            bottomRadius: number,
            length: number,
            mat: THREE.Material,
            jointMat: THREE.Material = mat,
            jointR: number = topRadius * 1.1
        ) => {
            const pivot = new THREE.Group();
            // Joint ball
            const jointGeo = new THREE.SphereGeometry(jointR, 16, 16);
            const joint = new THREE.Mesh(jointGeo, jointMat);
            joint.castShadow = true;
            pivot.add(joint);

            // Limb segment
            const segGeo = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 16);
            const mesh = new THREE.Mesh(segGeo, mat);
            mesh.position.y = -length / 2;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            pivot.add(mesh);

            return pivot;
        };

        // ── ARMS (Muscular sprinters arms with wristbands) ──
        // Shoulders / Deltoids
        const leftUpperArm = createLimb(0.09, 0.075, 0.38, skinMat, jerseyMat, 0.105);
        leftUpperArm.position.set(-0.31, 1.25, 0);
        group.add(leftUpperArm);

        const leftForearm = createLimb(0.075, 0.065, 0.36, skinMat, skinMat, 0.08);
        leftForearm.position.set(0, -0.38, 0);
        // Wrist sweatband
        const wristbandGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.06, 16);
        const leftBand = new THREE.Mesh(wristbandGeo, accentMat);
        leftBand.position.set(0, -0.25, 0);
        leftForearm.add(leftBand);
        // Sprinter fist
        const fistGeo = new THREE.SphereGeometry(0.065, 12, 12);
        const leftFist = new THREE.Mesh(fistGeo, skinMat);
        leftFist.position.set(0, -0.38, 0.02);
        leftFist.castShadow = true;
        leftForearm.add(leftFist);
        leftUpperArm.add(leftForearm);

        const rightUpperArm = createLimb(0.09, 0.075, 0.38, skinMat, jerseyMat, 0.105);
        rightUpperArm.position.set(0.31, 1.25, 0);
        group.add(rightUpperArm);

        const rightForearm = createLimb(0.075, 0.065, 0.36, skinMat, skinMat, 0.08);
        rightForearm.position.set(0, -0.38, 0);
        const rightBand = new THREE.Mesh(wristbandGeo, accentMat);
        rightBand.position.set(0, -0.25, 0);
        rightForearm.add(rightBand);
        const rightFist = new THREE.Mesh(fistGeo, skinMat);
        rightFist.position.set(0, -0.38, 0.02);
        rightFist.castShadow = true;
        rightForearm.add(rightFist);
        rightUpperArm.add(rightForearm);

        // ── LEGS (Running tights, calves, socks & spikes) ──
        const leftThigh = createLimb(0.12, 0.095, 0.45, shortsMat, shortsMat, 0.125);
        leftThigh.position.set(-0.16, 0.60, 0);
        group.add(leftThigh);

        const leftShin = createLimb(0.095, 0.075, 0.45, skinMat, skinMat, 0.10);
        leftShin.position.set(0, -0.45, 0);
        // Athletic crew sock
        const sockGeo = new THREE.CylinderGeometry(0.08, 0.076, 0.12, 16);
        const leftSock = new THREE.Mesh(sockGeo, whiteMat);
        leftSock.position.set(0, -0.38, 0);
        leftShin.add(leftSock);
        leftThigh.add(leftShin);

        const rightThigh = createLimb(0.12, 0.095, 0.45, shortsMat, shortsMat, 0.125);
        rightThigh.position.set(0.16, 0.60, 0);
        group.add(rightThigh);

        const rightShin = createLimb(0.095, 0.075, 0.45, skinMat, skinMat, 0.10);
        rightShin.position.set(0, -0.45, 0);
        const rightSock = new THREE.Mesh(sockGeo, whiteMat);
        rightSock.position.set(0, -0.38, 0);
        rightShin.add(rightSock);
        rightThigh.add(rightShin);

        // ── OLYMPIC SPRINT SPIKES (SHOES) ──
        const createShoe = () => {
            const shoeGroup = new THREE.Group();

            // Upper aerodynamic shoe body
            const upperGeo = new THREE.BoxGeometry(0.14, 0.10, 0.28);
            const upperMesh = new THREE.Mesh(upperGeo, accentMat);
            upperMesh.position.set(0, -0.05, 0.06);
            upperMesh.castShadow = true;
            shoeGroup.add(upperMesh);

            // White midsole
            const soleGeo = new THREE.BoxGeometry(0.145, 0.035, 0.29);
            const soleMesh = new THREE.Mesh(soleGeo, whiteMat);
            soleMesh.position.set(0, -0.10, 0.06);
            soleMesh.castShadow = true;
            shoeGroup.add(soleMesh);

            // Metallic Gold Sprint Spike Plate on bottom forefoot
            const spikePlateGeo = new THREE.BoxGeometry(0.13, 0.02, 0.14);
            const spikePlate = new THREE.Mesh(spikePlateGeo, goldSpikesMat);
            spikePlate.position.set(0, -0.12, 0.11);
            shoeGroup.add(spikePlate);

            // Black heel counter
            const heelGeo = new THREE.BoxGeometry(0.14, 0.08, 0.08);
            const heelMesh = new THREE.Mesh(heelGeo, darkMat);
            heelMesh.position.set(0, -0.04, -0.05);
            shoeGroup.add(heelMesh);

            return shoeGroup;
        };

        const leftFoot = createShoe();
        leftFoot.position.set(0, -0.46, 0);
        leftShin.add(leftFoot);

        const rightFoot = createShoe();
        rightFoot.position.set(0, -0.46, 0);
        rightShin.add(rightFoot);

        return {
            group,
            parts: {
                head: headGroup,
                torso: torsoGroup,
                leftUpperArm,
                leftForearm,
                rightUpperArm,
                rightForearm,
                leftThigh,
                leftShin,
                rightThigh,
                rightShin,
                leftFoot,
                rightFoot
            }
        };
    }
}

function hairGroupAdd(headGroup: THREE.Group, hairMesh: THREE.Mesh): void {
    hairMesh.castShadow = true;
    headGroup.add(hairMesh);
}
