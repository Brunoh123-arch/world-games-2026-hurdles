import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Country } from '../types';

export interface AvatarParts {
    head: THREE.Object3D;
    torso: THREE.Object3D;
    leftUpperArm: THREE.Object3D;
    leftForearm: THREE.Object3D;
    rightUpperArm: THREE.Object3D;
    rightForearm: THREE.Object3D;
    leftThigh: THREE.Object3D;
    leftShin: THREE.Object3D;
    rightThigh: THREE.Object3D;
    rightShin: THREE.Object3D;
    leftFoot: THREE.Object3D;
    rightFoot: THREE.Object3D;
    mixer?: THREE.AnimationMixer;
    actions?: { run?: THREE.AnimationAction; idle?: THREE.AnimationAction; };
    isGLTF?: boolean;
}
export class AvatarBuilder {
    private templateScene: THREE.Group | null = null;
    private runClip: THREE.AnimationClip | null = null;
    private idleClip: THREE.AnimationClip | null = null;
    private isLoaded: boolean = false;

    public async init(): Promise<void> {
        const loader = new GLTFLoader();
        try {
            // Load runner.glb - textured realistic human with Mixamo skeleton
            const avatarGltf = await loader.loadAsync('/models/runner.glb');
            this.templateScene = avatarGltf.scene;
            this.templateScene.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Load soldier.glb for motion-captured Run/Idle animations
            // Same Mixamo skeleton (65 bones, same mixamorig: names) - direct clip use
            const animGltf = await loader.loadAsync('/models/soldier.glb');
            if (animGltf.animations && animGltf.animations.length > 0) {
                const rawRun = animGltf.animations.find((a) => a.name === 'Run');
                const rawIdle = animGltf.animations.find((a) => a.name === 'Idle');
                if (rawRun) this.runClip = this.stripToRotations(rawRun);
                if (rawIdle) this.idleClip = this.stripToRotations(rawIdle);
            }

            this.isLoaded = true;
            console.log('AvatarBuilder: runner.glb + soldier.glb animations loaded.');
        } catch (err) {
            console.warn('AvatarBuilder: GLB load failed, procedural fallback:', err);
            this.isLoaded = false;
        }
    }

    /** Keep only quaternion tracks for in-place animation */
    private stripToRotations(clip: THREE.AnimationClip): THREE.AnimationClip {
        const tracks = clip.tracks.filter(t => t.name.endsWith('.quaternion'));
        return new THREE.AnimationClip(clip.name, clip.duration, tracks);
    }

    public createAvatar(country: Country): { group: THREE.Group; parts: AvatarParts } {
        if (this.isLoaded && this.templateScene) {
            return this.createGLTFAvatar(country);
        }
        return this.createProceduralAvatar(country);
    }
    private createGLTFAvatar(country: Country): { group: THREE.Group; parts: AvatarParts } {
        const cloned = SkeletonUtils.clone(this.templateScene!) as THREE.Group;

        // Wrapper group so we can fix facing direction
        const group = new THREE.Group();
        group.add(cloned);

        // The runner.glb Character root has +90deg X, soldier has -90deg X.
        // The Run animation was captured on soldier. We adjust the root rotation
        // to match soldier so the mocap clips produce correct orientation.
        const charNode = cloned.getObjectByName('Character');
        if (charNode) {
            charNode.quaternion.set(-0.7071067690849304, 0, 0, 0.7071067690849304);
            charNode.scale.set(0.01, 0.01, 0.01);
        }

        const findBone = (name: string): THREE.Object3D => {
            return cloned.getObjectByName(name) || cloned;
        };

        const head = findBone('mixamorig:Head');
        const torso = findBone('mixamorig:Spine1');
        const chest = findBone('mixamorig:Spine2');

        // ESPELHO NATURAL: bone RightArm fica na esquerda da tela (camera atras)
        const leftUpperArm = findBone('mixamorig:RightArm');
        const leftForearm = findBone('mixamorig:RightForeArm');
        const rightUpperArm = findBone('mixamorig:LeftArm');
        const rightForearm = findBone('mixamorig:LeftForeArm');
        const leftThigh = findBone('mixamorig:RightUpLeg');
        const leftShin = findBone('mixamorig:RightLeg');
        const rightThigh = findBone('mixamorig:LeftUpLeg');
        const rightShin = findBone('mixamorig:LeftLeg');
        const leftFoot = findBone('mixamorig:RightFoot');
        const rightFoot = findBone('mixamorig:LeftFoot');

        // Race bib on chest
        const bib = this.createRaceBib(country);
        bib.position.set(0, 8, 4);
        bib.scale.set(22, 16, 1);
        chest.add(bib);

        // AnimationMixer on cloned scene - clips use same mixamorig: bone names
        const mixer = new THREE.AnimationMixer(cloned);
        const actions: { run?: THREE.AnimationAction; idle?: THREE.AnimationAction } = {};

        if (this.runClip) {
            actions.run = mixer.clipAction(this.runClip);
            actions.run.setLoop(THREE.LoopRepeat, Infinity);
        }
        if (this.idleClip) {
            actions.idle = mixer.clipAction(this.idleClip);
            actions.idle.setLoop(THREE.LoopRepeat, Infinity);
            actions.idle.play();
        }

        return {
            group,
            parts: {
                head, torso,
                leftUpperArm, leftForearm,
                rightUpperArm, rightForearm,
                leftThigh, leftShin,
                rightThigh, rightShin,
                leftFoot, rightFoot,
                mixer, actions,
                isGLTF: true
            }
        };
    }
    private createRaceBib(country: Country): THREE.Mesh {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 180;
        const x = c.getContext('2d');
        if (x) {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 180);
            x.fillStyle = '#1e3a8a'; x.fillRect(0, 0, 256, 32);
            x.fillStyle = '#ffffff'; x.font = 'bold 20px sans-serif';
            x.textAlign = 'center';
            x.fillText('WORLD GAMES 2026', 128, 24);
            x.fillStyle = '#0f172a'; x.font = '900 82px sans-serif';
            x.fillText('26', 128, 122);
            x.font = 'bold 22px sans-serif';
            x.fillStyle = '#dc2626';
            x.fillText(country.id.toUpperCase(), 128, 160);
        }
        const tex = new THREE.CanvasTexture(c);
        const geo = new THREE.PlaneGeometry(0.24, 0.17);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        return new THREE.Mesh(geo, mat);
    }

    private createProceduralAvatar(country: Country): { group: THREE.Group; parts: AvatarParts } {
        const group = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0976f, roughness: 0.6 });
        const jerseyMat = new THREE.MeshStandardMaterial({ color: country.jerseyColor || 0x009c3b, roughness: 0.7 });
        const shortsMat = new THREE.MeshStandardMaterial({ color: country.shortsColor || 0x002776, roughness: 0.75 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });

        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.62, 0);
        const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.20, 24, 24), skinMat);
        headMesh.castShadow = true;
        headGroup.add(headMesh);
        group.add(headGroup);

        const torsoGroup = new THREE.Group();
        torsoGroup.position.set(0, 0.95, 0);
        const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.65, 16), jerseyMat);
        chestMesh.castShadow = true;
        torsoGroup.add(chestMesh);
        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.22, 16), shortsMat);
        pelvis.position.set(0, -0.36, 0);
        torsoGroup.add(pelvis);
        group.add(torsoGroup);

        const limb = (tR: number, bR: number, len: number, mat: THREE.Material) => {
            const p = new THREE.Group();
            const j = new THREE.Mesh(new THREE.SphereGeometry(tR * 1.1, 12, 12), mat); j.castShadow = true; p.add(j);
            const s = new THREE.Mesh(new THREE.CylinderGeometry(tR, bR, len, 12), mat); s.position.y = -len/2; s.castShadow = true; p.add(s);
            return p;
        };

        const lUA = limb(0.09, 0.075, 0.38, skinMat); lUA.position.set(-0.31, 1.25, 0); group.add(lUA);
        const lFA = limb(0.075, 0.065, 0.36, skinMat); lFA.position.set(0, -0.38, 0); lUA.add(lFA);
        const rUA = limb(0.09, 0.075, 0.38, skinMat); rUA.position.set(0.31, 1.25, 0); group.add(rUA);
        const rFA = limb(0.075, 0.065, 0.36, skinMat); rFA.position.set(0, -0.38, 0); rUA.add(rFA);
        const lTh = limb(0.12, 0.095, 0.45, shortsMat); lTh.position.set(-0.16, 0.60, 0); group.add(lTh);
        const lSh = limb(0.095, 0.075, 0.45, skinMat); lSh.position.set(0, -0.45, 0); lTh.add(lSh);
        const rTh = limb(0.12, 0.095, 0.45, shortsMat); rTh.position.set(0.16, 0.60, 0); group.add(rTh);
        const rSh = limb(0.095, 0.075, 0.45, skinMat); rSh.position.set(0, -0.45, 0); rTh.add(rSh);
        const lF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), darkMat); lF.position.set(0, -0.46, 0.04); lSh.add(lF);
        const rF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), darkMat); rF.position.set(0, -0.46, 0.04); rSh.add(rF);

        return {
            group,
            parts: {
                head: headGroup, torso: torsoGroup,
                leftUpperArm: lUA, leftForearm: lFA,
                rightUpperArm: rUA, rightForearm: rFA,
                leftThigh: lTh, leftShin: lSh,
                rightThigh: rTh, rightShin: rSh,
                leftFoot: lF, rightFoot: rF,
                isGLTF: false
            }
        };
    }
}
