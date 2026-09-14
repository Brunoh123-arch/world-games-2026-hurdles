import * as THREE from 'three';
import type { AvatarParts } from './AvatarBuilder';

export interface AnimState {
    mode: 'idle' | 'run' | 'jump' | 'stumble' | 'celebrate';
    speed: number;
    progress: number;
}

export class AvatarAnimator {
    private time: number = 0;

    public update(parts: AvatarParts, state: AnimState, dt: number) {
        this.time += dt;

        // Reset to default
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

    private resetParts(parts: AvatarParts) {
        const allParts = Object.values(parts);
        for (const part of allParts) {
            part.rotation.set(0, 0, 0);
            if (part === parts.torso) part.position.set(0, 0.9, 0);
            if (part === parts.head) part.position.set(0, 1.6, 0);
        }
    }

    private animateIdle(parts: AvatarParts) {
        const breathing = Math.sin(this.time * 2.5) * 0.015;
        parts.torso.position.y += breathing;
        parts.head.position.y += breathing * 1.2;
        
        // Athletic ready stance
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
        // Cadence frequency increases with speed
        const cadenceFreq = (3.5 + speedNorm * 4.5) * Math.PI * 2;
        const phase = this.time * cadenceFreq;

        // ── Torso & Head: Dynamic Athletic Lean & Twist ──
        const lean = THREE.MathUtils.lerp(0.12, 0.38, speedNorm);
        const verticalBob = Math.abs(Math.sin(phase)) * 0.08 * speedNorm;
        parts.torso.position.y += verticalBob;
        parts.head.position.y += verticalBob;

        parts.torso.rotation.x = lean;
        parts.torso.rotation.y = Math.sin(phase) * 0.12 * speedNorm; // shoulder drive
        parts.torso.rotation.z = Math.cos(phase) * 0.04 * speedNorm;

        // Head stays focused on the track ahead
        parts.head.rotation.x = -lean * 0.75;
        parts.head.rotation.y = -parts.torso.rotation.y * 0.85;

        // ── Arms: 90-degree Sprinter Elbow Drive ──
        const armAmplitude = THREE.MathUtils.lerp(0.6, 1.45, speedNorm);
        
        // Left arm drives back when left leg is back
        parts.leftUpperArm.rotation.x = Math.sin(phase + Math.PI) * armAmplitude;
        parts.rightUpperArm.rotation.x = Math.sin(phase) * armAmplitude;
        // Keep elbows bent at ~90 degrees like professional sprinters
        parts.leftForearm.rotation.x = -1.25 + Math.sin(phase + Math.PI) * 0.25;
        parts.rightForearm.rotation.x = -1.25 + Math.sin(phase) * 0.25;

        parts.leftUpperArm.rotation.z = -0.15;
        parts.rightUpperArm.rotation.z = 0.15;

        // ── Legs: High Knee Drive + Heel Recovery ──
        const legAmplitude = THREE.MathUtils.lerp(0.7, 1.55, speedNorm);
        const leftCycle = Math.sin(phase);
        const rightCycle = Math.sin(phase + Math.PI);

        // Thighs
        parts.leftThigh.rotation.x = leftCycle * legAmplitude;
        parts.rightThigh.rotation.x = rightCycle * legAmplitude;

        // Knee flexion on recovery (heel flick to glute)
        parts.leftShin.rotation.x = Math.max(0, -Math.sin(phase - 0.5) * legAmplitude * 1.25);
        parts.rightShin.rotation.x = Math.max(0, -Math.sin(phase + Math.PI - 0.5) * legAmplitude * 1.25);

        // Feet plantarflexion on push-off
        parts.leftFoot.rotation.x = Math.sin(phase) * 0.3;
        parts.rightFoot.rotation.x = Math.sin(phase + Math.PI) * 0.3;
    }

    /**
     * True Olympic Hurdle Clearance Technique:
     * - Lead leg (right) straight out over the bar
     * - Trail leg (left) flat & folded horizontally
     * - Torso dips low over lead leg
     * - Lead arm reaches forward for balance
     */
    private animateJump(parts: AvatarParts, progress: number) {
        // Arc peak is around progress = 0.5
        const p = Math.sin(progress * Math.PI);
        const flightPhase = progress; // 0 (takeoff) -> 0.5 (peak) -> 1.0 (landing)

        // Torso forward dip over hurdle
        parts.torso.rotation.x = THREE.MathUtils.lerp(0.2, 0.52, p);
        parts.head.rotation.x = -parts.torso.rotation.x * 0.8;

        // ── LEAD LEG (Right Leg - Straight Kick over Hurdle) ──
        const leadThighAngle = THREE.MathUtils.lerp(-0.4, -1.48, p);
        parts.rightThigh.rotation.x = leadThighAngle;
        // Knee extends straight at peak
        parts.rightShin.rotation.x = THREE.MathUtils.lerp(0.8, 0.08, p);
        parts.rightFoot.rotation.x = -0.2;

        // ── TRAIL LEG (Left Leg - Folded flat horizontally over Hurdle) ──
        parts.leftThigh.rotation.x = THREE.MathUtils.lerp(-0.2, 0.35, p);
        parts.leftThigh.rotation.z = THREE.MathUtils.lerp(0.0, -0.95, p); // abduct out to side
        parts.leftShin.rotation.x = THREE.MathUtils.lerp(0.4, 1.75, p);  // tight knee bend
        parts.leftShin.rotation.z = THREE.MathUtils.lerp(0.0, -0.4, p);

        // ── ARMS (Olympic Hurdler Counter-Balance) ──
        // Left arm reaches forward to lead toe
        parts.leftUpperArm.rotation.x = THREE.MathUtils.lerp(-0.5, -1.85, p);
        parts.leftForearm.rotation.x = -0.4;
        parts.leftUpperArm.rotation.z = -0.25;

        // Right arm tucked back for balance
        parts.rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.3, 0.95, p);
        parts.rightForearm.rotation.x = -0.8;
        parts.rightUpperArm.rotation.z = 0.45;
    }

    private animateStumble(parts: AvatarParts, progress: number) {
        const p = Math.sin(progress * Math.PI);
        // Off balance pitch and sway
        parts.torso.rotation.x = p * 0.65;
        parts.torso.rotation.z = Math.sin(progress * Math.PI * 3) * 0.35;
        parts.head.rotation.x = -parts.torso.rotation.x * 0.5;

        // Arms flailing in air to regain balance
        parts.leftUpperArm.rotation.x = -1.2 + Math.sin(progress * Math.PI * 6) * 0.8;
        parts.rightUpperArm.rotation.x = -1.2 - Math.sin(progress * Math.PI * 6) * 0.8;
        parts.leftUpperArm.rotation.z = -0.7;
        parts.rightUpperArm.rotation.z = 0.7;
        parts.leftForearm.rotation.x = -0.6;
        parts.rightForearm.rotation.x = -0.6;

        // Shuffling legs
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

        // Proud upright chest
        parts.torso.rotation.x = -0.15;
        parts.head.rotation.x = 0.2; // looking up at stadium

        // Dual Victory V-Arms pumping to crowd
        parts.leftUpperArm.rotation.x = -Math.PI * 0.85 + Math.sin(cycle) * 0.2;
        parts.rightUpperArm.rotation.x = -Math.PI * 0.85 + Math.sin(cycle) * 0.2;
        parts.leftUpperArm.rotation.z = -0.65;
        parts.rightUpperArm.rotation.z = 0.65;
        parts.leftForearm.rotation.x = -0.3;
        parts.rightForearm.rotation.x = -0.3;

        // Happy celebration trot
        parts.leftThigh.rotation.x = Math.sin(cycle) * 0.45;
        parts.rightThigh.rotation.x = -Math.sin(cycle) * 0.45;
        parts.leftShin.rotation.x = Math.max(0, -Math.sin(cycle) * 0.8);
        parts.rightShin.rotation.x = Math.max(0, Math.sin(cycle) * 0.8);
    }
}
