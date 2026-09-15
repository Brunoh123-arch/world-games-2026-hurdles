import * as THREE from 'three';
import type { AvatarParts, HandFingerBones } from './AvatarBuilder';
import type { HandGesturesResult, FingerCurls } from '../tracking/PoseTracker';

export interface AnimState {
    mode: 'idle' | 'run' | 'jump' | 'stumble' | 'celebrate';
    speed: number;
    progress: number;
}

// Índices dos landmarks do MediaPipe Pose
const LM = {
    NOSE: 0,
    L_SHOULDER: 11, R_SHOULDER: 12,
    L_ELBOW: 13,    R_ELBOW: 14,
    L_WRIST: 15,    R_WRIST: 16,
    L_HIP: 23,      R_HIP: 24,
    L_KNEE: 25,     R_KNEE: 26,
    L_ANKLE: 27,    R_ANKLE: 28,
};

// ── LIMITES ANATÔMICOS / BIOMECÂNICOS PERMITIDOS ──
// Garante que nenhum membro ultrapasse ângulos naturais do corpo humano
const ANGLE_LIMITS = {
    // Tronco (Torso)
    TORSO_PITCH_MIN: -0.06, // Máx ~3.5° para trás
    TORSO_PITCH_MAX:  0.32, // Máx ~18° para frente (inclinação de sprint)
    TORSO_ROLL_MAX:   0.16, // Máx ~9° inclinação lateral

    // Cabeça (Head)
    HEAD_YAW_MAX:     0.45, // Máx ~25° virar para o lado
    HEAD_PITCH_MAX:   0.20, // Máx ~11° cima/baixo

    // Braço Superior / Ombro (Upper Arm)
    ARM_PITCH_UP:    -2.00, // Braço erguido para pular/comemorar (~115°)
    ARM_PITCH_BACK:   0.80, // Braço para trás no balanço (~45°)
    ARM_SPREAD_MIN:   0.08, // Junto ao tronco
    ARM_SPREAD_MAX:   0.85, // Máx ~48° aberto para fora

    // Antebraço / Cotovelo (Forearm)
    ELBOW_FLEX_MAX:  -2.10, // Cotovelo dobrado (~120°)
    ELBOW_FLEX_MIN:  -0.08, // Braço quase reto (nunca dobra ao contrário)

    // Coxa / Quadril (Thigh)
    THIGH_FORWARD_MAX: -1.05, // Perna levantada na passada (máx ~60°)
    THIGH_BACK_MAX:     0.30, // Perna para trás na passada (máx ~17°)
    THIGH_SPREAD_MAX:   0.15, // Abertura lateral da perna (máx ~8.5°)

    // Canela / Joelho (Shin)
    KNEE_FLEX_MIN:      0.00, // Joelho NUNCA dobra para frente (trava anatômica em 0°)
    KNEE_FLEX_MAX:      1.40, // Joelho dobrado para trás (máx ~80°)
};

function angleBetween(
    a: { x: number; y: number },
    b: { x: number; y: number }
): number {
    return Math.atan2(b.y - a.y, b.x - a.x);
}

export class AvatarAnimator {
    private time: number = 0;
    private smoothedAngles: Record<string, number> = {};

    private smooth(key: string, target: number, defaultAlpha: number = 0.85): number {
        if (this.smoothedAngles[key] === undefined) this.smoothedAngles[key] = target;
        const diff = Math.abs(target - this.smoothedAngles[key]);
        // Resposta instantânea em tempo real (zero delay perceptível)
        const alpha = diff > 0.04 ? 0.95 : defaultAlpha;
        this.smoothedAngles[key] += (target - this.smoothedAngles[key]) * alpha;
        return this.smoothedAngles[key];
    }

    public update(parts: AvatarParts, state: AnimState, dt: number) {
        this.time += dt;

        if (parts.isGLTF && parts.mixer) {
            this.updateGLTF(parts, state, dt);
            return;
        }

        this.resetParts(parts);

        switch (state.mode) {
            case 'idle':
                this.animateIdle(parts);
                break;
            case 'run':
                this.animateRun(parts, state.speed, dt);
                break;
            case 'jump':
                this.animateJump(parts, state.progress);
                break;
            case 'stumble':
                this.animateStumble(parts, state.progress);
                break;
            case 'celebrate':
                this.animateCelebrate(parts, state.progress);
                break;
        }
    }

    private updateGLTF(parts: AvatarParts, state: AnimState, dt: number): void {
        const { mixer, actions } = parts;
        if (!mixer || !actions) return;

        const runAction = actions.run;
        const idleAction = actions.idle;

        if (state.mode === 'run') {
            if (runAction) {
                if (!runAction.isRunning()) {
                    idleAction?.crossFadeTo(runAction, 0.10, true);
                    runAction.play();
                }
                const speedNorm = Math.min(1.5, Math.max(0.2, state.speed));
                runAction.timeScale = 0.90 + speedNorm * 1.35;
            }
        } else if (state.mode === 'idle') {
            if (idleAction) {
                if (!idleAction.isRunning()) {
                    runAction?.crossFadeTo(idleAction, 0.12, true);
                    idleAction.play();
                }
                idleAction.timeScale = 1.0;
            }
        } else if (state.mode === 'jump') {
            if (runAction && runAction.isRunning()) {
                runAction.timeScale = 0.45;
            }
        } else if (state.mode === 'stumble') {
            if (runAction && runAction.isRunning()) {
                runAction.timeScale = 0.3;
            }
        } else if (state.mode === 'celebrate') {
            if (idleAction && !idleAction.isRunning()) {
                runAction?.stop();
                idleAction.play();
                idleAction.timeScale = 1.4;
            }
        }

        mixer.update(dt);
    }

    /**
     * POSE RETARGETING — Espelha o corpo real do jogador no avatar 3D com travas anatômicas.
     * Landmarks do Google MediaPipe → Rotações dos ossos limitadas a ângulos permitidos.
     * Responde instantaneamente em tempo real a gestos, acenos ("dar tchau") e balanços.
     */
    private applyBonePose(
        bone: THREE.Object3D,
        deltaX: number,
        deltaY: number,
        deltaZ: number
    ): void {
        const initQ = (bone as any).userData?.initialQuaternion as THREE.Quaternion | undefined;
        if (initQ) {
            const deltaQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(deltaX, deltaY, deltaZ, 'ZXY'));
            bone.quaternion.copy(initQ).multiply(deltaQ);
        } else {
            bone.rotation.x = deltaX;
            bone.rotation.y = deltaY;
            bone.rotation.z = deltaZ;
        }
    }

    private applyForearmPose(
        forearm: THREE.Object3D,
        elbowBend: number,
        waveZ: number
    ): void {
        const initQ = (forearm as any).userData?.initialQuaternion as THREE.Quaternion | undefined;
        if (initQ) {
            const deltaQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(elbowBend, waveZ * 0.7, waveZ, 'XYZ'));
            forearm.quaternion.copy(initQ).multiply(deltaQ);
        } else {
            forearm.rotation.x = elbowBend;
            forearm.rotation.z = waveZ;
        }
    }

    /**
     * CONTROLE DINÂMICO DOS DEDOS E GESTOS (Beleza 👍, Pitoco 🖕, Vitória ✌️, etc.)
     * Espelho natural 1:1:
     * Mão esquerda do jogador -> Mão na esquerda da tela (parts.rightFingers)
     * Mão direita do jogador -> Mão na direita da tela (parts.leftFingers)
     */
    public applyHandGestures(parts: AvatarParts, gestures: HandGesturesResult): void {
        if (!parts.isGLTF) return;

        // Mão esquerda do jogador (tela esquerda)
        if (parts.rightFingers) {
            const curls = gestures.leftHand?.curls ?? {
                thumb: 0.25,
                index: 0.35,
                middle: 0.35,
                ring: 0.35,
                pinky: 0.35
            };
            this.animateHandFingers(parts.rightFingers, curls, false);
        }

        // Mão direita do jogador (tela direita)
        if (parts.leftFingers) {
            const curls = gestures.rightHand?.curls ?? {
                thumb: 0.25,
                index: 0.35,
                middle: 0.35,
                ring: 0.35,
                pinky: 0.35
            };
            this.animateHandFingers(parts.leftFingers, curls, true);
        }
    }

    private animateHandFingers(fingers: HandFingerBones, curls: FingerCurls, isScreenRight: boolean): void {
        const prefix = isScreenRight ? 'r_' : 'l_';

        // Thumb (Polegar)
        if (fingers.thumb.length > 0) {
            const smoothThumb = this.smooth(`${prefix}thumb`, curls.thumb, 0.45);
            fingers.thumb.forEach((bone, idx) => {
                const initQ = (bone as any).userData?.initialQuaternion as THREE.Quaternion | undefined;
                if (!initQ) return;
                let deltaQ: THREE.Quaternion;
                if (idx === 0) {
                    const foldZ = isScreenRight ? smoothThumb * 0.35 : -smoothThumb * 0.35;
                    deltaQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(smoothThumb * 0.30, 0, foldZ));
                } else if (idx === 1) {
                    deltaQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), smoothThumb * 0.60);
                } else {
                    deltaQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), smoothThumb * 0.75);
                }
                bone.quaternion.copy(initQ).multiply(deltaQ);
            });
        }

        // Index (Indicador)
        if (fingers.index.length > 0) {
            const smoothIndex = this.smooth(`${prefix}index`, curls.index, 0.45);
            this.applyFingerBones(fingers.index, smoothIndex);
        }

        // Middle (Médio - PITOCO / DEDO DO MEIO 🖕)
        if (fingers.middle.length > 0) {
            const smoothMiddle = this.smooth(`${prefix}middle`, curls.middle, 0.45);
            this.applyFingerBones(fingers.middle, smoothMiddle);
        }

        // Ring (Anelar)
        if (fingers.ring.length > 0) {
            const smoothRing = this.smooth(`${prefix}ring`, curls.ring, 0.45);
            this.applyFingerBones(fingers.ring, smoothRing);
        }

        // Pinky (Mindinho)
        if (fingers.pinky.length > 0) {
            const smoothPinky = this.smooth(`${prefix}pinky`, curls.pinky, 0.45);
            this.applyFingerBones(fingers.pinky, smoothPinky);
        }
    }

    private applyFingerBones(bones: THREE.Object3D[], curl: number): void {
        const bendAngles = [1.05, 1.30, 0.80];
        bones.forEach((bone, idx) => {
            const initQ = (bone as any).userData?.initialQuaternion as THREE.Quaternion | undefined;
            if (!initQ) return;
            const angle = curl * (bendAngles[idx] ?? 1.0);
            const deltaQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
            bone.quaternion.copy(initQ).multiply(deltaQ);
        });
    }

    /**
     * POSE RETARGETING — Espelho Natural 1:1.
     * Mão DIREITA do jogador → Braço na DIREITA da tela.
     * Mão ESQUERDA do jogador → Braço na ESQUERDA da tela.
     * Suporta acenos ("dar tchau"), comemoração e corrida sem travar nem distorcer.
     */
    public applyPoseLandmarks(
        parts: AvatarParts,
        landmarks: { x: number; y: number; visibility?: number }[],
        mode: string = 'idle'
    ): void {
        if (!landmarks || landmarks.length < 17) return;

        // Em salto ou tropeço, mantém a física e acrobacia do jogo
        if (mode === 'jump' || mode === 'stumble') return;

        const vis = (idx: number) => landmarks[idx]?.visibility ?? 0;
        const pt  = (idx: number) => landmarks[idx];

        // ── Se estiver correndo no modelo GLTF: permite erguer mãos e acenar em movimento ──
        if (parts.isGLTF && mode === 'run') {
            const l_s = pt(LM.L_SHOULDER), l_e = pt(LM.L_ELBOW), l_w = pt(LM.L_WRIST);
            const r_s = pt(LM.R_SHOULDER), r_e = pt(LM.R_ELBOW), r_w = pt(LM.R_WRIST);

            const isLeftHandUp = l_w && l_s && (l_w.y < l_s.y + 0.10);
            const isRightHandUp = r_w && r_s && (r_w.y < r_s.y + 0.10);

            if (isLeftHandUp && l_s && l_e && vis(LM.L_SHOULDER) > 0.25 && vis(LM.L_ELBOW) > 0.25) {
                this.applyBonePose(parts.rightUpperArm, -1.2, 0.4, 0);
                this.applyForearmPose(parts.rightForearm, -1.35, (l_w.x - l_e.x) * 4.0);
            }
            if (isRightHandUp && r_s && r_e && vis(LM.R_SHOULDER) > 0.25 && vis(LM.R_ELBOW) > 0.25) {
                this.applyBonePose(parts.leftUpperArm, -1.2, -0.4, 0);
                this.applyForearmPose(parts.leftForearm, -1.35, (r_w.x - r_e.x) * 4.0);
            }
            return;
        }

        // ── TORSO ──
        const ls = pt(LM.L_SHOULDER), rs = pt(LM.R_SHOULDER);
        const lh = pt(LM.L_HIP),      rh = pt(LM.R_HIP);
        if (ls && rs && vis(LM.L_SHOULDER) > 0.25 && vis(LM.R_SHOULDER) > 0.25) {
            const shoulderAngle = angleBetween(rs, ls);
            const rawTiltZ = -(shoulderAngle + Math.PI / 2) * 0.4;
            const clampedTiltZ = THREE.MathUtils.clamp(rawTiltZ, -ANGLE_LIMITS.TORSO_ROLL_MAX, ANGLE_LIMITS.TORSO_ROLL_MAX);
            parts.torso.rotation.z = this.smooth('torsoZ', clampedTiltZ);

            if (lh && rh && vis(LM.L_HIP) > 0.2 && vis(LM.R_HIP) > 0.2) {
                const shoulderMidY = (ls.y + rs.y) / 2;
                const hipMidY = (lh.y + rh.y) / 2;
                const rawTorsoX = (shoulderMidY - hipMidY) * 2.0;
                const clampedTorsoX = THREE.MathUtils.clamp(rawTorsoX, ANGLE_LIMITS.TORSO_PITCH_MIN, ANGLE_LIMITS.TORSO_PITCH_MAX);
                parts.torso.rotation.x = this.smooth('torsoX', clampedTorsoX);
            }
        }

        // ── CABEÇA ──
        const nose = pt(LM.NOSE);
        if (nose && ls && rs && vis(LM.NOSE) > 0.25) {
            const shoulderCenterX = (ls.x + rs.x) / 2;
            const rawHeadYaw = (nose.x - shoulderCenterX) * -3.0;
            const clampedHeadYaw = THREE.MathUtils.clamp(rawHeadYaw, -ANGLE_LIMITS.HEAD_YAW_MAX, ANGLE_LIMITS.HEAD_YAW_MAX);
            parts.head.rotation.y = this.smooth('headY', clampedHeadYaw);
        }

        // ── BRAÇO ESQUERDO DO JOGADOR → BRAÇO NA ESQUERDA DA TELA (parts.rightUpperArm) ──
        const le = pt(LM.L_ELBOW), lw = pt(LM.L_WRIST);
        if (ls && le && vis(LM.L_SHOULDER) > 0.25 && vis(LM.L_ELBOW) > 0.25) {
            const lWristVis = lw && vis(LM.L_WRIST) > 0.25;
            const targetY = lWristVis ? lw.y : le.y;
            const elevation = (ls.y - targetY);

            const rawArmElevationX = -elevation * 3.8;
            const clampedArmElevationX = THREE.MathUtils.clamp(rawArmElevationX, ANGLE_LIMITS.ARM_PITCH_UP, ANGLE_LIMITS.ARM_PITCH_BACK);
            const spreadDistance = Math.abs((lWristVis ? lw.x : le.x) - ls.x);
            const clampedArmSpreadZ = THREE.MathUtils.clamp(spreadDistance * 2.8, ANGLE_LIMITS.ARM_SPREAD_MIN, ANGLE_LIMITS.ARM_SPREAD_MAX);

            const smoothElevX = this.smooth('screenLeftArmX', clampedArmElevationX);
            const smoothSpreadZ = this.smooth('screenLeftArmZ', clampedArmSpreadZ);
            this.applyBonePose(parts.rightUpperArm, smoothElevX, smoothSpreadZ, 0);

            if (lWristVis) {
                // Se a mão está erguida: flexiona cotovelo e permite dar tchau
                const isHandUp = lw.y < ls.y + 0.05;
                const elbowBend = isHandUp ? -1.35 : THREE.MathUtils.clamp((lw.y - le.y) * 3.2 - 0.3, ANGLE_LIMITS.ELBOW_FLEX_MAX, ANGLE_LIMITS.ELBOW_FLEX_MIN);
                // Movimento lateral do aceno ("Dar Tchau")
                const waveDiff = (lw.x - le.x) * 4.2;
                const clampedWaveZ = THREE.MathUtils.clamp(waveDiff, -1.2, 1.2);

                const smoothElbow = this.smooth('screenLeftForeArmX', elbowBend);
                const smoothWave = this.smooth('screenLeftForeArmZ', clampedWaveZ);
                this.applyForearmPose(parts.rightForearm, smoothElbow, smoothWave);
            }
        }

        // ── BRAÇO DIREITO DO JOGADOR → BRAÇO NA DIREITA DA TELA (parts.leftUpperArm) ──
        const re = pt(LM.R_ELBOW), rw = pt(LM.R_WRIST);
        if (rs && re && vis(LM.R_SHOULDER) > 0.25 && vis(LM.R_ELBOW) > 0.25) {
            const rWristVis = rw && vis(LM.R_WRIST) > 0.25;
            const targetY = rWristVis ? rw.y : re.y;
            const elevation = (rs.y - targetY);

            const rawArmElevationX = -elevation * 3.8;
            const clampedArmElevationX = THREE.MathUtils.clamp(rawArmElevationX, ANGLE_LIMITS.ARM_PITCH_UP, ANGLE_LIMITS.ARM_PITCH_BACK);
            const spreadDistance = Math.abs((rWristVis ? rw.x : re.x) - rs.x);
            const clampedArmSpreadZ = -THREE.MathUtils.clamp(spreadDistance * 2.8, ANGLE_LIMITS.ARM_SPREAD_MIN, ANGLE_LIMITS.ARM_SPREAD_MAX);

            const smoothElevX = this.smooth('screenRightArmX', clampedArmElevationX);
            const smoothSpreadZ = this.smooth('screenRightArmZ', clampedArmSpreadZ);
            this.applyBonePose(parts.leftUpperArm, smoothElevX, smoothSpreadZ, 0);

            if (rWristVis) {
                // Se a mão está erguida: flexiona cotovelo e permite dar tchau
                const isHandUp = rw.y < rs.y + 0.05;
                const elbowBend = isHandUp ? -1.35 : THREE.MathUtils.clamp((rw.y - re.y) * 3.2 - 0.3, ANGLE_LIMITS.ELBOW_FLEX_MAX, ANGLE_LIMITS.ELBOW_FLEX_MIN);
                // Movimento lateral do aceno ("Dar Tchau")
                const waveDiff = (rw.x - re.x) * 4.2;
                const clampedWaveZ = THREE.MathUtils.clamp(waveDiff, -1.2, 1.2);

                const smoothElbow = this.smooth('screenRightForeArmX', elbowBend);
                const smoothWave = this.smooth('screenRightForeArmZ', clampedWaveZ);
                this.applyForearmPose(parts.leftForearm, smoothElbow, smoothWave);
            }
        }

        // ── PERNAS: Espelhamento natural (Pernas só se movem por elevação real dos joelhos) ──
        const lk = pt(LM.L_KNEE), rk = pt(LM.R_KNEE);
        const lKneeVis = lk && vis(LM.L_KNEE) > 0.25;
        const rKneeVis = rk && vis(LM.R_KNEE) > 0.25;

        if (lKneeVis || rKneeVis) {
            // Perna esquerda do jogador -> Perna na esquerda da tela (parts.rightThigh)
            if (lKneeVis && lh) {
                const lDist = lk.y - lh.y;
                const lLift = Math.max(0, 0.22 - lDist);
                const rawThighAngle = -lLift * 5.5;
                const clampedThigh = THREE.MathUtils.clamp(rawThighAngle, ANGLE_LIMITS.THIGH_FORWARD_MAX, ANGLE_LIMITS.THIGH_BACK_MAX);
                const rawShinAngle = lLift * 6.5;
                const clampedShin = THREE.MathUtils.clamp(rawShinAngle, ANGLE_LIMITS.KNEE_FLEX_MIN, ANGLE_LIMITS.KNEE_FLEX_MAX);

                this.applyBonePose(parts.rightThigh, this.smooth('screenLeftThighX', clampedThigh, 0.35), 0, 0);
                this.applyBonePose(parts.rightShin, this.smooth('screenLeftShinX', clampedShin, 0.35), 0, 0);
            } else {
                this.applyBonePose(parts.rightThigh, this.smooth('screenLeftThighX', 0, 0.25), 0, 0);
                this.applyBonePose(parts.rightShin, this.smooth('screenLeftShinX', 0, 0.25), 0, 0);
            }

            // Perna direita do jogador -> Perna na direita da tela (parts.leftThigh)
            if (rKneeVis && rh) {
                const rDist = rk.y - rh.y;
                const rLift = Math.max(0, 0.22 - rDist);
                const rawThighAngle = -rLift * 5.5;
                const clampedThigh = THREE.MathUtils.clamp(rawThighAngle, ANGLE_LIMITS.THIGH_FORWARD_MAX, ANGLE_LIMITS.THIGH_BACK_MAX);
                const rawShinAngle = rLift * 6.5;
                const clampedShin = THREE.MathUtils.clamp(rawShinAngle, ANGLE_LIMITS.KNEE_FLEX_MIN, ANGLE_LIMITS.KNEE_FLEX_MAX);

                this.applyBonePose(parts.leftThigh, this.smooth('screenRightThighX', clampedThigh, 0.35), 0, 0);
                this.applyBonePose(parts.leftShin, this.smooth('screenRightShinX', clampedShin, 0.35), 0, 0);
            } else {
                this.applyBonePose(parts.leftThigh, this.smooth('screenRightThighX', 0, 0.25), 0, 0);
                this.applyBonePose(parts.leftShin, this.smooth('screenRightShinX', 0, 0.25), 0, 0);
            }
        } else {
            // Pernas não visíveis na câmera: repouso absoluto
            this.applyBonePose(parts.rightThigh, this.smooth('screenLeftThighX', 0, 0.3), 0, 0);
            this.applyBonePose(parts.leftThigh, this.smooth('screenRightThighX', 0, 0.3), 0, 0);
            this.applyBonePose(parts.rightShin, this.smooth('screenLeftShinX', 0, 0.3), 0, 0);
            this.applyBonePose(parts.leftShin, this.smooth('screenRightShinX', 0, 0.3), 0, 0);
        }
    }

    private resetParts(parts: AvatarParts) {
        if (parts.isGLTF) return;
        const allParts = Object.values(parts);
        for (const part of allParts) {
            if (part && (part as THREE.Object3D).rotation) {
                (part as THREE.Object3D).rotation.set(0, 0, 0);
            }
            if (part === parts.torso && (part as THREE.Group).position) (part as THREE.Group).position.set(0, 0.9, 0);
            if (part === parts.head && (part as THREE.Group).position) (part as THREE.Group).position.set(0, 1.6, 0);
        }
    }

    private animateIdle(parts: AvatarParts) {
        const breathing = Math.sin(this.time * 2.5) * 0.015;
        parts.torso.position.y += breathing;
        parts.head.position.y += breathing * 1.2;
        
        parts.torso.rotation.x = 0.08;
        parts.head.rotation.x = -0.06;
        parts.leftUpperArm.rotation.x = 0.25;
        parts.rightUpperArm.rotation.x = 0.25;
        parts.leftForearm.rotation.x = -0.6;
        parts.rightForearm.rotation.x = -0.6;
        
        parts.leftThigh.rotation.x = -0.08;
        parts.rightThigh.rotation.x = 0.08;
        parts.leftShin.rotation.x = 0.12;
        parts.rightShin.rotation.x = 0.05;
    }

    private animateRun(parts: AvatarParts, speed: number, dt: number) {
        const speedNorm = Math.min(1.2, Math.max(0.1, speed));
        const cadenceFreq = (3.5 + speedNorm * 4.5) * Math.PI * 2;
        const phase = this.time * cadenceFreq;

        const lean = THREE.MathUtils.lerp(0.12, 0.38, speedNorm);
        const verticalBob = Math.abs(Math.sin(phase)) * 0.08 * speedNorm;
        parts.torso.position.y += verticalBob;
        parts.head.position.y += verticalBob;

        parts.torso.rotation.x = lean;
        parts.torso.rotation.y = Math.sin(phase) * 0.12 * speedNorm;
        parts.torso.rotation.z = Math.cos(phase) * 0.04 * speedNorm;

        parts.head.rotation.x = -lean * 0.75;
        parts.head.rotation.y = -parts.torso.rotation.y * 0.85;

        const armAmplitude = THREE.MathUtils.lerp(0.6, 1.45, speedNorm);
        parts.leftUpperArm.rotation.x = Math.sin(phase + Math.PI) * armAmplitude;
        parts.rightUpperArm.rotation.x = Math.sin(phase) * armAmplitude;
        parts.leftForearm.rotation.x = -1.25 + Math.sin(phase + Math.PI) * 0.25;
        parts.rightForearm.rotation.x = -1.25 + Math.sin(phase) * 0.25;
        parts.leftUpperArm.rotation.z = -0.15;
        parts.rightUpperArm.rotation.z = 0.15;

        const legAmplitude = THREE.MathUtils.lerp(0.7, 1.55, speedNorm);
        const leftCycle = Math.sin(phase);
        const rightCycle = Math.sin(phase + Math.PI);

        parts.leftThigh.rotation.x = leftCycle * legAmplitude;
        parts.rightThigh.rotation.x = rightCycle * legAmplitude;

        parts.leftShin.rotation.x = Math.max(0, -Math.sin(phase - 0.5) * legAmplitude * 1.25);
        parts.rightShin.rotation.x = Math.max(0, -Math.sin(phase + Math.PI - 0.5) * legAmplitude * 1.25);

        parts.leftFoot.rotation.x = Math.sin(phase) * 0.3;
        parts.rightFoot.rotation.x = Math.sin(phase + Math.PI) * 0.3;
    }

    private animateJump(parts: AvatarParts, progress: number) {
        const p = Math.sin(progress * Math.PI);

        parts.torso.rotation.x = THREE.MathUtils.lerp(0.2, 0.52, p);
        parts.head.rotation.x = -parts.torso.rotation.x * 0.8;

        const leadThighAngle = THREE.MathUtils.lerp(-0.4, -1.48, p);
        parts.rightThigh.rotation.x = leadThighAngle;
        parts.rightShin.rotation.x = THREE.MathUtils.lerp(0.8, 0.08, p);
        parts.rightFoot.rotation.x = -0.2;

        parts.leftThigh.rotation.x = THREE.MathUtils.lerp(-0.2, 0.35, p);
        parts.leftThigh.rotation.z = THREE.MathUtils.lerp(0.0, -0.95, p);
        parts.leftShin.rotation.x = THREE.MathUtils.lerp(0.4, 1.75, p);
        parts.leftShin.rotation.z = THREE.MathUtils.lerp(0.0, -0.4, p);

        parts.leftUpperArm.rotation.x = THREE.MathUtils.lerp(-0.5, -1.85, p);
        parts.leftForearm.rotation.x = -0.4;
        parts.leftUpperArm.rotation.z = -0.25;

        parts.rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.3, 0.95, p);
        parts.rightForearm.rotation.x = -0.8;
        parts.rightUpperArm.rotation.z = 0.45;
    }

    private animateStumble(parts: AvatarParts, progress: number) {
        const p = Math.sin(progress * Math.PI);
        parts.torso.rotation.x = p * 0.65;
        parts.torso.rotation.z = Math.sin(progress * Math.PI * 3) * 0.35;
        parts.head.rotation.x = -parts.torso.rotation.x * 0.5;

        parts.leftUpperArm.rotation.x = -1.2 + Math.sin(progress * Math.PI * 6) * 0.8;
        parts.rightUpperArm.rotation.x = -1.2 - Math.sin(progress * Math.PI * 6) * 0.8;
        parts.leftUpperArm.rotation.z = -0.7;
        parts.rightUpperArm.rotation.z = 0.7;
        parts.leftForearm.rotation.x = -0.6;
        parts.rightForearm.rotation.x = -0.6;

        parts.leftThigh.rotation.x = Math.sin(progress * Math.PI * 6) * 0.5;
        parts.rightThigh.rotation.x = -Math.sin(progress * Math.PI * 6) * 0.5;
        parts.leftShin.rotation.x = 0.6;
        parts.rightShin.rotation.x = 0.6;
    }

    private animateCelebrate(parts: AvatarParts, progress: number) {
        const cycle = this.time * 6;
        const hop = Math.abs(Math.sin(cycle)) * 0.18;
        parts.torso.position.y += hop;
        parts.head.position.y += hop * 1.1;

        parts.torso.rotation.x = -0.15;
        parts.head.rotation.x = 0.2;

        parts.leftUpperArm.rotation.x = -Math.PI * 0.85 + Math.sin(cycle) * 0.2;
        parts.rightUpperArm.rotation.x = -Math.PI * 0.85 + Math.sin(cycle) * 0.2;
        parts.leftUpperArm.rotation.z = -0.65;
        parts.rightUpperArm.rotation.z = 0.65;
        parts.leftForearm.rotation.x = -0.3;
        parts.rightForearm.rotation.x = -0.3;

        parts.leftThigh.rotation.x = Math.sin(cycle) * 0.45;
        parts.rightThigh.rotation.x = -Math.sin(cycle) * 0.45;
        parts.leftShin.rotation.x = Math.max(0, -Math.sin(cycle) * 0.8);
        parts.rightShin.rotation.x = Math.max(0, Math.sin(cycle) * 0.8);
    }
}
