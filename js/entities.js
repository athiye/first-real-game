import { COURT } from './config.js';
import { rand } from './math.js';

export const RESET_SPOTS = {
    PG: { x: 260, y: 154 },
    SG: { x: 321, y: 101 },
    SF: { x: 325, y: 212 },
    PF: { x: 182, y: 112 },
    C:  { x: 137, y: 163 }
};

export function makeCooldowns() {
    return { shoot: 0, pass: 0, lob: 0, dribble: 0, stepback: 0 };
}

export function makeBall(x = 260, y = COURT.centerY) {
    return {
        x, y, z: 0,
        vx: 0, vy: 0, vz: 0,
        mode: 'loose',
        holderId: null,
        receiverId: null,
        shooterId: null,
        fromX: x,
        fromY: y,
        fromZ: 0,
        targetX: x,
        targetY: y,
        elapsed: 0,
        duration: 0.4,
        make: false,
        shotValue: 2,
        quality: 0,
        rimHit: false,
        shotStyle: 'miss',
        shotType: 'jumper',
        floater: false,
        arcScale: 0.8,
        touchedBoard: false,
        rimContacts: 0
    };
}

export function rim() {
    return COURT.rim;
}
