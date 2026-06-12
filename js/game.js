import { COURT, GAME } from './config.js';
import { clamp, dist, normalize, rand } from './math.js';
import { RESET_SPOTS, makeCooldowns, makeBall, rim } from './entities.js';
import { Input } from './input.js';
import {
    resetTraining, updateBall, updateTeammates, updatePlayerTimers,
    resolveSpacing, keepOnCourt, beginPass, beginShot, beginLooseBall, startAction
} from './physics.js';
import { Renderer } from './render.js';

const canvas = document.getElementById('game');
if (!canvas) throw new Error('Missing #game canvas');

const input = new Input();
const renderer = new Renderer(canvas);
const state = createInitialState();
resetTraining(state, 'TRAINING GROUND');

let last = performance.now();

function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    renderer.draw(state);
    input.endFrame();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function createInitialState() {
    const roles = ['PG', 'SG', 'SF', 'PF', 'C'];
    const names = ['ACE', 'JET', 'VEX', 'MACK', 'BIG'];
    const nums  = [1, 7, 12, 21, 34];
    const players = roles.map((role, i) => {
        const spot = RESET_SPOTS[role];
        return {
            id: i,
            role,
            team: 'home',
            name: names[i] ?? `P${i + 1}`,
            number: nums[i] ?? i + 1,
            x: spot.x,
            y: spot.y,
            vx: 0,
            vy: 0,
            facingX: -1,
            facingY: 0,
            radius: GAME.playerRadius,
            controlled: i === 0,
            hasBall: i === 0,
            stamina: 1,
            pivotLocked: false,
            driveTimer: 0,
            homeX: spot.x,
            homeY: spot.y,
            targetX: spot.x,
            targetY: spot.y,
            cutTimer: rand(0.4, 2.0),
            skin: (i % 3),
            hair: (i % 4),
            heightClass: (role === 'C' ? 2 : role === 'PF' ? 1 : 0),
            anim: rand(0, 2),
            animState: i === 0 ? 'dribble' : 'idle',
            actionElapsed: 0,
            actionDuration: 0.01,
            cooldowns: makeCooldowns()
        };
    });
    const defender = {
        id: 99,
        role: 'SF',
        team: 'away',
        name: 'DEF',
        number: 0,
        x: 178,
        y: COURT.centerY,
        vx: 0,
        vy: 0,
        facingX: 1,
        facingY: 0,
        radius: GAME.playerRadius,
        controlled: false,
        hasBall: false,
        stamina: 1,
        pivotLocked: false,
        driveTimer: 0,
        homeX: 178,
        homeY: COURT.centerY,
        targetX: 178,
        targetY: COURT.centerY,
        cutTimer: 0,
        skin: 1,
        hair: 2,
        heightClass: 0,
        anim: rand(0, 2),
        animState: 'idle',
        actionElapsed: 0,
        actionDuration: 0.01,
        cooldowns: makeCooldowns()
    };
    return {
        players,
        defender,
        ball: makeBall(),
        controlledId: 0,
        shotCharge: null,
        pendingShot: null,
        makes: 0,
        attempts: 0,
        streak: 0,
        resetTimer: 0,
        screenShake: 0,
        message: { text: '', ttl: 0 },
        netTimer: 0,
        netSide: 0,
        offMakeChance: 0.035,
        onMissChance: 0.10,
        defenderLunge: 0.20,
        stepbackPower: 1.00,
        shotArcPower: 0.80,
        threeArcPower: 1.00,
        paused: false
    };
}

function update(dt) {
    if (input.justPressed('pause')) state.paused = !state.paused;
    if (input.justPressed('reset')) resetTraining(state, 'RESET');
    if (input.justPressed('offMakeDown')) {
        state.offMakeChance = clamp(Number((state.offMakeChance - 0.01).toFixed(3)), 0, 0.20);
        state.message = { text: `OFF MAKE ${Math.round(state.offMakeChance * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('offMakeUp')) {
        state.offMakeChance = clamp(Number((state.offMakeChance + 0.01).toFixed(3)), 0, 0.20);
        state.message = { text: `OFF MAKE ${Math.round(state.offMakeChance * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('onMissDown')) {
        state.onMissChance = clamp(Number((state.onMissChance - 0.01).toFixed(3)), 0, 0.30);
        state.message = { text: `ON MISS ${Math.round(state.onMissChance * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('onMissUp')) {
        state.onMissChance = clamp(Number((state.onMissChance + 0.01).toFixed(3)), 0, 0.30);
        state.message = { text: `ON MISS ${Math.round(state.onMissChance * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('stepbackDown')) {
        state.stepbackPower = clamp(Number((state.stepbackPower - 0.05).toFixed(2)), 0.50, 1.80);
        state.message = { text: `STEPBACK ${Math.round(state.stepbackPower * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('stepbackUp')) {
        state.stepbackPower = clamp(Number((state.stepbackPower + 0.05).toFixed(2)), 0.50, 1.80);
        state.message = { text: `STEPBACK ${Math.round(state.stepbackPower * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('threeArcDown')) {
        state.threeArcPower = clamp(Number((state.threeArcPower - 0.05).toFixed(2)), 0.70, 1.55);
        state.message = { text: `3PT ARC ${Math.round(state.threeArcPower * 100)}%`, ttl: 0.7 };
    }
    if (input.justPressed('threeArcUp')) {
        state.threeArcPower = clamp(Number((state.threeArcPower + 0.05).toFixed(2)), 0.70, 1.55);
        state.message = { text: `3PT ARC ${Math.round(state.threeArcPower * 100)}%`, ttl: 0.7 };
    }
    if (state.paused) return;
    state.message.ttl = Math.max(0, state.message.ttl - dt);
    state.screenShake = Math.max(0, state.screenShake - dt * 3);
    state.netTimer    = Math.max(0, state.netTimer    - dt * 2.6);
    for (const p of state.players) updatePlayerTimers(p, dt);
    updatePlayerTimers(state.defender, dt);
    updatePendingShot(dt);
    if (state.resetTimer > 0) {
        state.resetTimer -= dt;
        updateBall(state, dt);
        for (const p of [...state.players, state.defender]) {
            p.vx *= Math.pow(0.03, dt);
            p.vy *= Math.pow(0.03, dt);
        }
        if (state.resetTimer <= 0) resetTraining(state, 'NEXT REP');
        return;
    }
    handleControls(dt);
    handleDefenderControls(dt);
    updateTeammates(state, dt);
    for (const p of [...state.players, state.defender]) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const blocking = p === state.defender && p.animState === 'block' && p.actionElapsed < p.actionDuration;
        const friction = blocking ? 0.52 : GAME.friction;
        p.vx *= Math.pow(friction, dt);
        p.vy *= Math.pow(friction, dt);
        keepOnCourt(p);
        const v = Math.hypot(p.vx, p.vy);
        if (!p.hasBall && p.actionElapsed >= p.actionDuration) {
            p.animState = v > 12 ? 'run' : 'idle';
        }
    }
    resolveSpacing([...state.players, state.defender]);
    updateBall(state, dt);
}

function controlledPlayer() {
    return state.players.find(p => p.id === state.controlledId);
}

function handleControls(dt) {
    if (input.justPressed('switch')) switchControlled();
    const p = controlledPlayer();
    if (!p) return;
    const axis = input.axis();
    const moving   = Math.hypot(axis.x, axis.y) > 0.05;
    const charging = state.shotCharge?.playerId === p.id;
    const pending  = state.pendingShot?.playerId === p.id;
    const driving  = p.hasBall && p.driveTimer > 0;
    const pickedUp = p.hasBall && p.pivotLocked;
    const toRim    = normalize(rim().x - p.x, rim().y - p.y);
    const vel      = normalize(p.vx, p.vy);
    const movingTowardHoop = Math.hypot(p.vx, p.vy) > 10 && (vel.x * toRim.x + vel.y * toRim.y) > 0.42;
    if (p.hasBall && input.justPressed('shift') && !charging && !pending && !pickedUp && !driving) {
        const driveDir = moving ? axis : toRim;
        p.facingX = driveDir.x || p.facingX || -1;
        p.facingY = driveDir.y || p.facingY;
        p.driveTimer = 0.52;
        p.pivotLocked = false;
        p.vx = p.vx * 0.35 + p.facingX * 82;
        p.vy = p.vy * 0.35 + p.facingY * 82;
        startAction(p, 'drive', 0.52);
        state.message = { text: 'DRIVE', ttl: 0.45 };
    }
    if (driving) {
        p.driveTimer = Math.max(0, p.driveTimer - dt);
        if (moving) {
            const currentFacing = normalize(p.facingX, p.facingY);
            const turnCost = clamp(1 - (axis.x * currentFacing.x + axis.y * currentFacing.y), 0, 2);
            p.driveTimer = Math.max(0, p.driveTimer - dt * turnCost * 0.62);
            p.vx *= Math.max(0.86, 1 - turnCost * 0.045);
            p.vy *= Math.max(0.86, 1 - turnCost * 0.045);
            const turnRate = 0.16;
            p.facingX = p.facingX * (1 - turnRate) + axis.x * turnRate;
            p.facingY = p.facingY * (1 - turnRate) + axis.y * turnRate;
            const f = normalize(p.facingX, p.facingY);
            p.facingX = f.x || p.facingX || -1;
            p.facingY = f.y || p.facingY;
            p.vx += axis.x * GAME.accel * 1.28 * dt;
            p.vy += axis.y * GAME.accel * 1.28 * dt;
        } else {
            p.vx += p.facingX * GAME.accel * 0.12 * dt;
            p.vy += p.facingY * GAME.accel * 0.12 * dt;
        }
        p.stamina = Math.max(0, p.stamina - dt * 0.34);
        if (p.driveTimer <= 0) {
            p.pivotLocked = true;
            p.vx *= 0.46;
            p.vy *= 0.46;
            if (p.actionElapsed >= p.actionDuration) p.animState = 'dribble';
            state.message = { text: 'PASS OR FINISH', ttl: 0.65 };
        }
    }
    if (moving && !pickedUp && !driving && !pending) {
        const movingAway = axis.x * toRim.x + axis.y * toRim.y < -0.18;
        if (movingAway) {
            p.facingX = axis.x;
            p.facingY = axis.y;
        } else {
            const turn = 0.18;
            p.facingX = p.facingX * (1 - turn) + toRim.x * turn;
            p.facingY = p.facingY * (1 - turn) + toRim.y * turn;
            const f = normalize(p.facingX, p.facingY);
            p.facingX = f.x || -1;
            p.facingY = f.y;
        }
    } else if (p.hasBall && !driving) {
        const turn = pending ? 0.34 : pickedUp ? 0.14 : 0.18;
        p.facingX = p.facingX * (1 - turn) + toRim.x * turn;
        p.facingY = p.facingY * (1 - turn) + toRim.y * turn;
        const f = normalize(p.facingX, p.facingY);
        p.facingX = f.x || -1;
        p.facingY = f.y;
    }
    const maxSpeed    = (driving ? GAME.sprintSpeed * 1.05 : GAME.walkSpeed) * (p.hasBall ? 0.92 : 1);
    const controlScale = charging || pending ? 0.14 : pickedUp || driving ? 0 : 1;
    p.vx += axis.x * GAME.accel * controlScale * dt;
    p.vy += axis.y * GAME.accel * controlScale * dt;
    if (pending) {
        if (movingTowardHoop && driving) {
            // Keep the drive finish fluid.
        } else if (movingTowardHoop) {
            p.vx *= Math.pow(0.28, dt);
            p.vy *= Math.pow(0.28, dt);
        } else {
            p.vx *= Math.pow(0.006, dt);
            p.vy *= Math.pow(0.006, dt);
        }
    } else if (charging) {
        if (movingTowardHoop && driving) {
            // Keep the drive finish fluid.
        } else if (movingTowardHoop) {
            p.vx *= Math.pow(0.36, dt);
            p.vy *= Math.pow(0.36, dt);
        } else {
            p.vx *= Math.pow(0.012, dt);
            p.vy *= Math.pow(0.012, dt);
        }
    }
    if (pickedUp && !charging && !pending && p.animState !== 'stepback') {
        p.vx *= Math.pow(0.015, dt);
        p.vy *= Math.pow(0.015, dt);
        if (moving && state.message.ttl <= 0.05)
            state.message = { text: 'NO TRAVEL: PASS/SHOOT', ttl: 0.45 };
    }
    const v = Math.hypot(p.vx, p.vy);
    if (v > maxSpeed) {
        p.vx = (p.vx / v) * maxSpeed;
        p.vy = (p.vy / v) * maxSpeed;
    }
    if (!driving) p.stamina = Math.min(1, p.stamina + dt * 0.22);
    if (p.actionElapsed >= p.actionDuration && !charging && !pending && !driving) {
        if (p.hasBall) p.animState = 'dribble';
        else           p.animState = moving ? 'run' : 'idle';
    }
    if (p.hasBall) handleBallControls(p, dt);
}

function updatePendingShot(dt) {
    const pending = state.pendingShot;
    if (!pending) return;
    const p = state.players.find(player => player.id === pending.playerId);
    if (!p || !p.hasBall) { state.pendingShot = null; return; }
    pending.elapsed += dt;
    const toRim = normalize(rim().x - p.x, rim().y - p.y);
    p.facingX = p.facingX * 0.62 + toRim.x * 0.38;
    p.facingY = p.facingY * 0.62 + toRim.y * 0.38;
    const f = normalize(p.facingX, p.facingY);
    p.facingX = f.x || -1;
    p.facingY = f.y;
    if (pending.elapsed >= pending.duration) {
        state.pendingShot = null;
        state.shotCharge = { playerId: p.id, elapsed: 0, shotType: pending.shotType, floater: pending.floater, wasDriving: pending.wasDriving };
        startAction(p, 'shoot', 999);
    }
}

function handleDefenderControls(dt) {
    const d = state.defender;
    const axis    = input.defenderAxis();
    const moving  = Math.hypot(axis.x, axis.y) > 0.05;
    const blocking = d.animState === 'block' && d.actionElapsed < d.actionDuration;
    if (input.justPressed('defBlock') && !blocking) {
        const toBall = normalize(state.ball.x - d.x, state.ball.y - d.y);
        d.facingX = toBall.x || d.facingX || 1;
        d.facingY = toBall.y || d.facingY;
        const distance = dist(d, state.ball);
        const baseLunge = clamp(230 - distance * 0.32, 145, 230);
        const lunge = baseLunge * 0.20;
        d.vx = d.vx * 0.45 + d.facingX * lunge;
        d.vy = d.vy * 0.45 + d.facingY * lunge;
        startAction(d, 'block', 0.56);
        state.message = { text: 'BLOCK LUNGE', ttl: 0.45 };
    }
    if (moving && !blocking) {
        d.facingX = axis.x;
        d.facingY = axis.y;
    } else {
        const toBall   = normalize(state.ball.x - d.x, state.ball.y - d.y);
        const turnRate = blocking ? 0.015 : 0.08;
        d.facingX = d.facingX * (1 - turnRate) + toBall.x * turnRate;
        d.facingY = d.facingY * (1 - turnRate) + toBall.y * turnRate;
        const f = normalize(d.facingX, d.facingY);
        d.facingX = f.x || 1;
        d.facingY = f.y;
    }
    const controlScale = blocking ? 0.08 : 0.92;
    d.vx += axis.x * GAME.accel * controlScale * dt;
    d.vy += axis.y * GAME.accel * controlScale * dt;
    const v = Math.hypot(d.vx, d.vy);
    const maxSpeed = blocking ? GAME.sprintSpeed * 0.94 : GAME.sprintSpeed * 0.96;
    if (v > maxSpeed) {
        d.vx = (d.vx / v) * maxSpeed;
        d.vy = (d.vy / v) * maxSpeed;
    }
    if (!blocking && d.actionElapsed >= d.actionDuration)
        d.animState = moving ? 'run' : 'idle';
}

function handleBallControls(p, dt) {
    const locked  = p.pivotLocked;
    const driving = p.driveTimer > 0;
    if (input.justPressed('shoot') && p.cooldowns.shoot <= 0 && !state.pendingShot) {
        const shotType = chooseShotType(p, driving);
        const toHoop   = normalize(rim().x - p.x, rim().y - p.y);
        const facingDot = p.facingX * toHoop.x + p.facingY * toHoop.y;
        const shootAxis   = input.axis();
        const shootMoving = Math.hypot(shootAxis.x, shootAxis.y) > 0.05;
        const activeAwayMove = shootMoving && (shootAxis.x * toHoop.x + shootAxis.y * toHoop.y < -0.18);
        const prepThreshold = 0.82;
        const needsTurn = shotType === 'jumper' && (activeAwayMove || facingDot < prepThreshold);
        if (needsTurn) {
            const turnSeverity = clamp((prepThreshold - facingDot) / (1 + prepThreshold), 0, 1);
            const prepDuration = activeAwayMove
                ? clamp(0.10 + turnSeverity * 0.18, 0.10, 0.28)
                : clamp(0.06 + turnSeverity * 0.14, 0.06, 0.22);
            state.pendingShot = { playerId: p.id, elapsed: 0, duration: prepDuration, shotType, floater: false, wasDriving: driving };
            startAction(p, 'turnshot', prepDuration);
            if (activeAwayMove || facingDot < 0.15) {
                p.vx *= 0.18;
                p.vy *= 0.18;
            }
            state.message = { text: activeAwayMove || facingDot < 0 ? 'TURNAROUND' : 'SHOT PREP', ttl: 0.45 };
        } else {
            state.shotCharge = { playerId: p.id, elapsed: 0, shotType, floater: false, wasDriving: driving };
            startAction(p, shotType === 'dunk' ? 'dunk' : shotType === 'layup' ? 'layup' : 'shoot', 999);
        }
    }
    if (state.shotCharge?.playerId === p.id) {
        const chargeState = state.shotCharge;
        chargeState.elapsed = Math.min(GAME.maxChargeTime, chargeState.elapsed + dt);
        if (input.justReleased('shoot') || chargeState.elapsed >= GAME.maxChargeTime) {
            const charge   = chargeState.elapsed / GAME.maxChargeTime;
            const shotType = chargeState.shotType;
            state.shotCharge = null;
            beginShot(state, p, charge, false, shotType, false);
            return;
        }
    }
    if (input.justPressed('pass') && p.cooldowns.pass <= 0) {
        const target = choosePassTarget(p);
        if (target) beginPass(state, p, target, false);
    }
    if (input.justPressed('lob') && p.cooldowns.lob <= 0) {
        const nearRim = dist(p, rim()) < 35;
        if (nearRim) beginShot(state, p, 0.82, true);
        else {
            const target = chooseLobTarget(p);
            if (target) beginPass(state, p, target, true);
        }
    }
    if (!state.shotCharge && input.justPressed('dribble') && !locked && !driving && p.cooldowns.dribble <= 0) {
        p.cooldowns.dribble = 0.55;
        const side    = Math.random() < 0.5 ? -1 : 1;
        const lateral = { x: -p.facingY * side, y: p.facingX * side };
        p.vx += lateral.x * 132 + p.facingX * 24;
        p.vy += lateral.y * 132 + p.facingY * 24;
        startAction(p, 'cross', 0.2);
        state.message = { text: 'CROSS', ttl: 0.42 };
    }
    if (input.justPressed('stepback') && !locked && !driving && p.cooldowns.stepback <= 0) {
        p.cooldowns.stepback = 0.72;
        const away = normalize(p.x - COURT.rim.x, p.y - COURT.rim.y);
        const stepForce = 230 * state.stepbackPower;
        p.vx += away.x * stepForce;
        p.vy += away.y * stepForce;
        p.pivotLocked = true;
        p.driveTimer  = 0;
        startAction(p, 'stepback', 0.32);
        state.message = { text: 'STEPBACK', ttl: 0.52 };
    }
}

function inPaint(p) {
    return p.x >= COURT.paintLeft && p.x <= COURT.paintRight
        && p.y >= COURT.paintTop  && p.y <= COURT.paintBottom;
}

function inClosePaintHalf(p) {
    const midPaintX = (COURT.paintLeft + COURT.paintRight) / 2;
    return inPaint(p) && p.x <= midPaintX;
}

function chooseShotType(p, driving) {
    if (driving && inClosePaintHalf(p)) return 'dunk';
    if (driving && inPaint(p))          return 'layup';
    if (!driving && inClosePaintHalf(p)) return 'layup';
    return 'jumper';
}

function choosePassTarget(passer) {
    const axis    = input.axis();
    const hasAxis = Math.hypot(axis.x, axis.y) > 0.1;
    let best = null;
    let bestScore = -Infinity;
    for (const t of state.players) {
        if (t.id === passer.id) continue;
        const toT = normalize(t.x - passer.x, t.y - passer.y);
        const directional = hasAxis ? toT.x * axis.x + toT.y * axis.y : 0;
        const rimGravity  = 1 - clamp(dist(t, rim()) / 220, 0, 1);
        const score = directional * 120 + rimGravity * 28 - dist(passer, t) * 0.03 + (t.role === 'C' ? 7 : 0);
        if (score > bestScore) { best = t; bestScore = score; }
    }
    return best;
}

function chooseLobTarget(passer) {
    let best = null;
    let bestScore = -Infinity;
    for (const t of state.players) {
        if (t.id === passer.id) continue;
        const score = 110 - dist(t, rim()) - dist(t, passer) * 0.02 + (t.role === 'C' ? 22 : t.role === 'PF' ? 12 : 0);
        if (score > bestScore) { best = t; bestScore = score; }
    }
    return bestScore > 8 ? best : choosePassTarget(passer);
}

function switchControlled() {
    let next = null;
    let best = Infinity;
    for (const p of state.players) {
        const d = dist(p, state.ball);
        if (d < best) { best = d; next = p; }
    }
    if (!next) return;
    for (const p of state.players) p.controlled = false;
    next.controlled = true;
    state.controlledId = next.id;
    state.message = { text: `${next.name} ON BALL`, ttl: 0.45 };
}
