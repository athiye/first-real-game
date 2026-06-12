import { normalize } from './math.js';

export const KEY_MAP = {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ArrowUp: 'defUp',
    ArrowDown: 'defDown',
    ArrowLeft: 'defLeft',
    ArrowRight: 'defRight',
    Enter: 'defBlock',
    Numpad0: 'defBlock',
    ShiftLeft: 'shift',
    ShiftRight: 'shift',
    KeyJ: 'shoot',
    KeyK: 'pass',
    KeyE: 'lob',
    KeyL: 'dribble',
    Space: 'stepback',
    Tab: 'switch',
    KeyR: 'reset',
    KeyP: 'pause',
    Digit1: 'offMakeDown',
    Digit2: 'offMakeUp',
    Digit3: 'onMissDown',
    Digit4: 'onMissUp',
    Digit5: 'stepbackDown',
    Digit6: 'stepbackUp',
    Digit7: 'threeArcDown',
    Digit8: 'threeArcUp'
};

export class Input {
    down = new Set();
    pressed = new Set();
    released = new Set();

    constructor() {
        window.addEventListener('keydown', (e) => {
            const key = KEY_MAP[e.code];
            if (!key) return;
            if (key === 'switch' || key === 'stepback') e.preventDefault();
            if (!this.down.has(key)) this.pressed.add(key);
            this.down.add(key);
        });
        window.addEventListener('keyup', (e) => {
            const key = KEY_MAP[e.code];
            if (!key) return;
            this.down.delete(key);
            this.released.add(key);
        });
        window.addEventListener('blur', () => {
            this.down.clear();
            this.pressed.clear();
            this.released.clear();
        });
    }

    axis() {
        const x = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
        const y = (this.down.has('down') ? 1 : 0) - (this.down.has('up') ? 1 : 0);
        return normalize(x, y);
    }

    defenderAxis() {
        const x = (this.down.has('defRight') ? 1 : 0) - (this.down.has('defLeft') ? 1 : 0);
        const y = (this.down.has('defDown') ? 1 : 0) - (this.down.has('defUp') ? 1 : 0);
        return normalize(x, y);
    }

    isDown(k) { return this.down.has(k); }
    justPressed(k) { return this.pressed.has(k); }
    justReleased(k) { return this.released.has(k); }

    endFrame() {
        this.pressed.clear();
        this.released.clear();
    }
}
