export function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function invLerp(a, b, v) {
    return clamp((v - a) / (b - a), 0, 1);
}

export function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
}

export function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(x, y) {
    const d = Math.hypot(x, y);
    if (d < 0.0001) return { x: 0, y: 0 };
    return { x: x / d, y: y / d };
}

export function rand(min, max) {
    return min + Math.random() * (max - min);
}

export function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}
