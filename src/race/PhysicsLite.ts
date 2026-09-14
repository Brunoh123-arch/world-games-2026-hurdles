import { JUMP_HEIGHT, SPEED_DRAG } from '../core/Constants';

export class PhysicsLite {
    /**
     * Returns Y offset for a jump based on parabolic arc
     * @param progress 0.0 to 1.0
     * @returns y offset in meters
     */
    static jumpArc(progress: number): number {
        if (progress < 0 || progress > 1) return 0;
        return 4 * JUMP_HEIGHT * progress * (1 - progress);
    }

    /**
     * Applies speed decay drag
     * @param currentSpeed 
     * @param dt 
     * @returns new speed
     */
    static speedDecay(currentSpeed: number, dt: number): number {
        return Math.max(0, currentSpeed - (SPEED_DRAG * dt));
    }

    /**
     * Smooth linear interpolation for speed
     */
    static lerpSpeed(current: number, target: number, dt: number): number {
        const factor = Math.min(1.0, dt * 5); // 5 is a smoothing constant
        return current + (target - current) * factor;
    }

    /**
     * Checks if runner is within the collision zone of a hurdle
     */
    static isInHurdleZone(runnerPos: number, hurdlePos: number): boolean {
        return Math.abs(runnerPos - hurdlePos) <= 0.5;
    }

    /**
     * Evaluates if a jump clears a hurdle
     */
    static checkHurdleClear(isJumping: boolean, jumpProgress: number): 'clear' | 'hit' | 'none' {
        if (!isJumping) return 'hit';
        if (jumpProgress >= 0.2 && jumpProgress <= 0.8) {
            return 'clear';
        }
        return 'hit';
    }
}
