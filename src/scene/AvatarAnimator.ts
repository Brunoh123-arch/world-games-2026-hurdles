import * as THREE from 'three';
import type { AvatarParts } from './AvatarBuilder';

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
    public applyPoseLandmarks(
        parts: AvatarParts,
        landmarks: { x: number; y: number; visibility?: number }[],
        mode: string = 'idle'
    ): void {
        if (!landmarks || landmarks.length < 17) return;

        // Em salto, tropeço ou corrida GLTF, mantém a animação acrobática/mocap pura do jogo
        if (mode === 'jump' || mode === 'stumble' || (parts.isGLTF && mode === 'run')) return;

        const vis = (idx: number) => landmarks[idx]?.visibility ?? 0;
        const pt  = (idx: number) => landmarks[idx];

        // ── TORSO: inclinação lateral e frente/trás rigorosamente limitadas ──
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

        // ── CABEÇA: rotação lateral limitada ──
        const nose = pt(LM.NOSE);
        if (nose && ls && rs && vis(LM.NOSE) > 0.25) {
            const shoulderCenterX = (ls.x + rs.x) / 2;
            const rawHeadYaw = (nose.x - shoulderCenterX) * -3.0;
            const clampedHeadYaw = THREE.MathUtils.clamp(rawHeadYaw, -ANGLE_LIMITS.HEAD_YAW_MAX, ANGLE_LIMITS.HEAD_YAW_MAX);
            parts.head.rotation.y = this.smooth('headY', clampedHeadYaw);
        }

        // ── BRAÇO NA ESQUERDA DA TELA (controlado pelo BRAÇO ESQUERDO do jogador — Espelho Natural) ──
        // Visto de trás pelo ângulo da câmera (+Z), o membro parts.rightUpperArm (X = +0.31) fica na ESQUERDA da tela!
        const le = pt(LM.L_ELBOW), lw = pt(LM.L_WRIST);
        if (ls && le && vis(LM.L_SHOULDER) > 0.25 && vis(LM.L_ELBOW) > 0.25) {
            const lWristVis = lw && vis(LM.L_WRIST) > 0.25;
            const targetY = lWristVis ? lw.y : le.y;
            const elevation = (ls.y - targetY);

            const rawArmElevationX = -elevation * 4.0;
            const clampedArmElevationX = THREE.MathUtils.clamp(rawArmElevationX, ANGLE_LIMITS.ARM_PITCH_UP, ANGLE_LIMITS.ARM_PITCH_BACK);
            // Abrir braço esquerdo para fora (para a esquerda da tela = rotação Z positiva em parts.rightUpperArm)
            const spreadDistance = Math.abs((lWristVis ? lw.x : le.x) - ls.x);
            const clampedArmSpreadZ = THREE.MathUtils.clamp(spreadDistance * 3.0, ANGLE_LIMITS.ARM_SPREAD_MIN, ANGLE_LIMITS.ARM_SPREAD_MAX);

            parts.rightUpperArm.rotation.x = this.smooth('screenLeftArmX', clampedArmElevationX);
            parts.rightUpperArm.rotation.z = this.smooth('screenLeftArmZ', clampedArmSpreadZ);

            if (lWristVis) {
                const elbowBend = (lw.y - le.y) * 3.5 - 0.4;
                const clampedElbow = THREE.MathUtils.clamp(elbowBend, ANGLE_LIMITS.ELBOW_FLEX_MAX, ANGLE_LIMITS.ELBOW_FLEX_MIN);
                parts.rightForearm.rotation.x = this.smooth('screenLeftForeArmX', clampedElbow);

                // Movimento lateral do antebraço (Acenar / Dar Tchau com a mão esquerda)
                const waveDiff = (lw.x - le.x) * 3.5;
                const clampedWaveZ = THREE.MathUtils.clamp(waveDiff, -1.3, 1.3);
                parts.rightForearm.rotation.z = this.smooth('screenLeftForeArmZ', clampedWaveZ);
            }
        }

        // ── BRAÇO NA DIREITA DA TELA (controlado pelo BRAÇO DIREITO do jogador — Espelho Natural) ──
        // Visto de trás pelo ângulo da câmera (+Z), o membro parts.leftUpperArm (X = -0.31) fica na DIREITA da tela!
        const re = pt(LM.R_ELBOW), rw = pt(LM.R_WRIST);
        if (rs && re && vis(LM.R_SHOULDER) > 0.25 && vis(LM.R_ELBOW) > 0.25) {
            const rWristVis = rw && vis(LM.R_WRIST) > 0.25;
            const targetY = rWristVis ? rw.y : re.y;
            const elevation = (rs.y - targetY);

            const rawArmElevationX = -elevation * 4.0;
            const clampedArmElevationX = THREE.MathUtils.clamp(rawArmElevationX, ANGLE_LIMITS.ARM_PITCH_UP, ANGLE_LIMITS.ARM_PITCH_BACK);
            // Abrir braço direito para fora (para a direita da tela = rotação Z negativa em parts.leftUpperArm)
            const spreadDistance = Math.abs((rWristVis ? rw.x : re.x) - rs.x);
            const clampedArmSpreadZ = -THREE.MathUtils.clamp(spreadDistance * 3.0, ANGLE_LIMITS.ARM_SPREAD_MIN, ANGLE_LIMITS.ARM_SPREAD_MAX);

            parts.leftUpperArm.rotation.x = this.smooth('screenRightArmX', clampedArmElevationX);
            parts.leftUpperArm.rotation.z = this.smooth('screenRightArmZ', clampedArmSpreadZ);

            if (rWristVis) {
                const elbowBend = (rw.y - re.y) * 3.5 - 0.4;
                const clampedElbow = THREE.MathUtils.clamp(elbowBend, ANGLE_LIMITS.ELBOW_FLEX_MAX, ANGLE_LIMITS.ELBOW_FLEX_MIN);
                parts.leftForearm.rotation.x = this.smooth('screenRightForeArmX', clampedElbow);

                // Movimento lateral do antebraço (Acenar / Dar Tchau com a mão direita)
                const waveDiff = (rw.x - re.x) * 3.5;
                const clampedWaveZ = THREE.MathUtils.clamp(waveDiff, -1.3, 1.3);
                parts.leftForearm.rotation.z = this.smooth('screenRightForeArmZ', clampedWaveZ);
            }
        }

        // ── PERNAS: Espelhamento natural e controle estrito por elevação real dos joelhos ──
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

                parts.rightThigh.rotation.x = this.smooth('screenLeftThighX', clampedThigh, 0.35);
                parts.rightShin.rotation.x = this.smooth('screenLeftShinX', clampedShin, 0.35);
            } else {
                parts.rightThigh.rotation.x = this.smooth('screenLeftThighX', 0, 0.25);
                parts.rightShin.rotation.x = this.smooth('screenLeftShinX', 0, 0.25);
            }

            // Perna direita do jogador -> Perna na direita da tela (parts.leftThigh)
            if (rKneeVis && rh) {
                const rDist = rk.y - rh.y;
                const rLift = Math.max(0, 0.22 - rDist);
                const rawThighAngle = -rLift * 5.5;
                const clampedThigh = THREE.MathUtils.clamp(rawThighAngle, ANGLE_LIMITS.THIGH_FORWARD_MAX, ANGLE_LIMITS.THIGH_BACK_MAX);
                const rawShinAngle = rLift * 6.5;
                const clampedShin = THREE.MathUtils.clamp(rawShinAngle, ANGLE_LIMITS.KNEE_FLEX_MIN, ANGLE_LIMITS.KNEE_FLEX_MAX);

                parts.leftThigh.rotation.x = this.smooth('screenRightThighX', clampedThigh, 0.35);
                parts.leftShin.rotation.x = this.smooth('screenRightShinX', clampedShin, 0.35);
            } else {
                parts.leftThigh.rotation.x = this.smooth('screenRightThighX', 0, 0.25);
                parts.leftShin.rotation.x = this.smooth('screenRightShinX', 0, 0.25);
            }
        } else {
            // Pernas não visíveis na câmera: repouso absoluto, nunca balança sozinho
            parts.leftThigh.rotation.x = this.smooth('screenRightThighX', 0, 0.3);
            parts.rightThigh.rotation.x = this.smooth('screenLeftThighX', 0, 0.3);
            parts.leftShin.rotation.x = this.smooth('screenRightShinX', 0, 0.3);
            parts.rightShin.rotation.x = this.smooth('screenLeftShinX', 0, 0.3);
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
