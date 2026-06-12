import { COURT, GAME, SHOT_ODDS } from './config.js';
import { clamp, lerp, smoothstep, dist, normalize, rand } from './math.js';
import { RESET_SPOTS, rim } from './entities.js';

export const HOOP_Z = 13;
export const RIM_RADIUS = 7.5;

// net stuff
export function triggerNet(state, strength, side) {
    state.netTimer = Math.max(state.netTimer, strength);
    state.netSide = clamp(side, -1, 1);
}

// what happens when a make is guaranteed. 
export function finishMake(state, style, side) {
    const b = state.ball;
    state.makes += 1;
    state.streak += 1;
    state.message = { text: b.shotValue === 3 ? 'SPLASH +3' : 'BUCKET +2', ttl: 1.0 };
    const shooter = state.players.find(p => p.id === b.shooterId);
    if (shooter) startAction(shooter, 'celebrate', 0.42);
    triggerNet(state, style === 'swish' ? 0.56 : style === 'rim' ? 0.42 : 0.36, side);
    b.mode = 'made';
    b.fromX = b.x;
    b.fromY = b.y;
    b.fromZ = Math.max(2, b.z);
    b.targetX = rim().x + 3 + side * 1.5;
    b.targetY = rim().y + 12;
    b.elapsed = 0;
    b.duration = style === 'swish' ? 0.24 : 0.3;
    b.vx = 0;
    b.vy = 0;
    b.vz = -16;
    state.resetTimer = GAME.resetDelay;
}

// what happens if it rolls into the rim
export function startRimRoll(state) {
    const b = state.ball;
    const hoopX = rim().x + 2;
    const hoopY = rim().y;
    b.mode = 'rimroll';
    b.elapsed = 0;
    b.duration = 0.48;
    b.fromX = Math.atan2(b.y - hoopY, b.x - hoopX);
    b.fromY = Math.random() < 0.5 ? -1 : 1;
    b.fromZ = HOOP_Z + 1;
    b.targetX = hoopX;
    b.targetY = hoopY;
    b.rimContacts += 1;
    state.message = { text: 'AROUND THE RIM', ttl: 0.45 };
    state.screenShake = 0.12;
}

// 
export function actionProgress(p) {
    if (p.actionDuration <= 0) return 1;
    return clamp(p.actionElapsed / p.actionDuration, 0, 1);
}

// 
export function startAction(p, state, duration) {
    p.animState = state;
    p.actionElapsed = 0;
    p.actionDuration = duration;
}

// 
export function updatePlayerTimers(p, dt) {
    p.anim += dt;
    p.actionElapsed += dt;
    for (const key of Object.keys(p.cooldowns)) {
        p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
    }
    if (p.actionElapsed >= p.actionDuration) {
        if (p.animState === 'shoot' || p.animState === 'turnshot' || p.animState === 'pass' ||
            p.animState === 'catch' || p.animState === 'layup' || p.animState === 'dunk' ||
            p.animState === 'stepback' || p.animState === 'block' ||
            p.animState === 'drive') {
            p.animState = p.hasBall ? 'dribble' : 'idle';
            p.actionElapsed = 0;
            p.actionDuration = 0.01;
        } else if (p.animState === 'celebrate') {
            p.animState = p.hasBall ? 'dribble' : 'idle';
            p.actionElapsed = 0;
            p.actionDuration = 0.01;
        }
    }
}

// makes sure player can't leave court
export function keepOnCourt(p) {
    p.x = clamp(p.x, COURT.playableLeft, COURT.playableRight);
    p.y = clamp(p.y, COURT.playableTop, COURT.playableBottom);
}

// resets everything once a shot is made, everything reset
export function resetTraining(state, message = 'TRAINING GROUND') {
    for (const p of state.players) {
        const spot = RESET_SPOTS[p.role];
        p.x = spot.x;
        p.y = spot.y;
        p.vx = 0;
        p.vy = 0;
        p.facingX = -1;
        p.facingY = 0;
        p.homeX = spot.x;
        p.homeY = spot.y;
        p.targetX = spot.x;
        p.targetY = spot.y;
        p.cutTimer = rand(0.8, 2.4);
        p.stamina = 1;
        p.pivotLocked = false;
        p.driveTimer = 0;
        p.controlled = p.role === 'PG';
        p.hasBall = p.role === 'PG';
        p.animState = p.hasBall ? 'dribble' : 'idle';
        p.actionElapsed = 0;
        p.actionDuration = 0.01;
        p.cooldowns = { shoot: 0, pass: 0, lob: 0, dribble: 0, stepback: 0 };
    }
    state.defender.x = 178;
    state.defender.y = COURT.centerY;
    state.defender.vx = 0;
    state.defender.vy = 0;
    state.defender.facingX = 1;
    state.defender.facingY = 0;
    state.defender.homeX = state.defender.x;
    state.defender.homeY = state.defender.y;
    state.defender.targetX = state.defender.x;
    state.defender.targetY = state.defender.y;
    state.defender.stamina = 1;
    state.defender.pivotLocked = false;
    state.defender.driveTimer = 0;
    state.defender.controlled = false;
    state.defender.hasBall = false;
    state.defender.animState = 'idle';
    state.defender.actionElapsed = 0;
    state.defender.actionDuration = 0.01;
    state.defender.cooldowns = { shoot: 0, pass: 0, lob: 0, dribble: 0, stepback: 0 };
    const pg = state.players.find(p => p.role === 'PG');
    if (!pg) throw new Error('No point guard');
    state.controlledId = pg.id;
    state.ball = {
        x: pg.x - 7,
        y: pg.y + 1,
        z: 5,
        vx: 0,
        vy: 0,
        vz: 0,
        mode: 'held',
        holderId: pg.id,
        receiverId: null,
        shooterId: null,
        fromX: pg.x,
        fromY: pg.y,
        fromZ: 0,
        targetX: pg.x,
        targetY: pg.y,
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
    state.shotCharge = null;
    state.pendingShot = null;
    state.resetTimer = 0;
    state.screenShake = 0;
    state.message = { text: message, ttl: 1.0 };
    state.netTimer = 0;
    state.netSide = 0;
}

export function handBallTo(state, receiver, showMessage = 'CATCH') {
    for (const p of state.players) {
        p.hasBall = false;
        p.controlled = p.id === receiver.id;
    }
    receiver.hasBall = true;
    receiver.controlled = true;
    receiver.pivotLocked = false;
    receiver.driveTimer = 0;
    receiver.animState = 'catch';
    receiver.actionElapsed = 0;
    receiver.actionDuration = 0.16;
    state.controlledId = receiver.id;
    state.ball.mode = 'held';
    state.ball.holderId = receiver.id;
    state.ball.receiverId = null;
    state.ball.shooterId = null;
    state.message = { text: showMessage, ttl: 0.45 };
}

export function resolveSpacing(players) {
    for (let i = 0; i < players.length; i++) {
        const a = players[i];
        if (!a) continue;
        for (let j = i + 1; j < players.length; j++) {
            const b = players[j];
            if (!b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 0.0001;
            const min = a.radius + b.radius + 1;
            if (len < min) {
                const nx = dx / len;
                const ny = dy / len;
                const push = (min - len) * 0.48;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;
            }
        }
    }
    for (const p of players) keepOnCourt(p);
}

export function beginPass(state, passer, receiver, lob = false) {
    passer.hasBall = false;
    state.pendingShot = null;
    passer.pivotLocked = false;
    passer.driveTimer = 0;
    passer.cooldowns.pass = 0.24;
    if (lob) passer.cooldowns.lob = 0.76;
    startAction(passer, 'pass', 0.18);
    const b = state.ball;
    b.mode = lob ? 'lob' : 'pass';
    b.holderId = null;
    b.receiverId = receiver.id;
    b.shooterId = null;
    b.fromX = passer.x + passer.facingX * 7;
    b.fromY = passer.y - 7;
    b.fromZ = lob ? 12 : 9;
    b.x = b.fromX;
    b.y = b.fromY;
    b.z = b.fromZ;
    b.targetX = receiver.x;
    b.targetY = receiver.y - 3;
    b.elapsed = 0;
    b.duration = lob
        ? GAME.lobDuration
        : clamp(dist(passer, receiver) / 410, GAME.passDurationMin, GAME.passDurationMax);
    state.message = { text: lob ? 'LOB' : 'PASS', ttl: 0.5 };
}

export function beginShot(state, shooter, charge01, forcedFinish = false, selectedShotType = 'jumper', floater = false) {
    const goal = rim();
    const hoopX = goal.x + 2;
    const hoopY = goal.y;
    const d = dist(shooter, goal);
    const dunk = forcedFinish || selectedShotType === 'dunk';
    const layup = !dunk && selectedShotType === 'layup';
    const isThree = d > COURT.threeRadius + 4;
    shooter.hasBall = false;
    state.pendingShot = null;
    shooter.pivotLocked = false;
    shooter.driveTimer = 0;
    shooter.cooldowns.shoot = 0.38;
    startAction(shooter, dunk ? 'dunk' : layup ? 'layup' : 'shoot', dunk ? 0.38 : layup ? 0.34 : 0.28);
    const b = state.ball;
    b.mode = 'shot';
    b.holderId = null;
    b.receiverId = null;
    b.shooterId = shooter.id;
    b.fromX = shooter.x + shooter.facingX * 6;
    b.fromY = shooter.y - (dunk || layup ? 13 : 10);
    b.fromZ = dunk ? HOOP_Z + 13 : layup ? 18 : 14;
    b.x = b.fromX;
    b.y = b.fromY;
    b.z = b.fromZ;
    b.elapsed = 0;
    b.duration = dunk ? SHOT_ODDS.dunkDuration : layup ? SHOT_ODDS.layupDuration : clamp(GAME.shotBaseDuration + d / 900, 0.5, 0.82);
    b.rimHit = false;
    b.touchedBoard = false;
    b.rimContacts = 0;
    b.shotValue = isThree ? 3 : 2;
    b.shotType = dunk ? 'dunk' : layup ? 'layup' : 'jumper';
    b.floater = floater && b.shotType === 'jumper';
    b.arcScale = b.shotType === 'jumper'
        ? clamp(state.shotArcPower + rand(-SHOT_ODDS.shotArcNoise, SHOT_ODDS.shotArcNoise), SHOT_ODDS.shotArcMin, SHOT_ODDS.shotArcMax)
        : 1;
    const error = charge01 - GAME.greenCenter;
    const absError = Math.abs(error);
    const slightWindow = dunk ? SHOT_ODDS.dunkTimingWindow : layup ? SHOT_ODDS.layupTimingWindow : d < 70 ? SHOT_ODDS.closeJumpTimingWindow : isThree ? SHOT_ODDS.threePointTimingWindow : SHOT_ODDS.jumpTimingWindow;
    const overshot = error > slightWindow;
    const short = error < -slightWindow;
    const severeMistime = clamp((absError - (slightWindow + SHOT_ODDS.timingMistimeOffset)) / SHOT_ODDS.timingMistimeScale, 0, 1);
    const timingScore = 1 - clamp(absError / (slightWindow + SHOT_ODDS.timingScoreRange), 0, 1);
    const movePenalty = clamp(Math.hypot(shooter.vx, shooter.vy) / SHOT_ODDS.movePenaltySpeedDivisor, 0, SHOT_ODDS.movePenaltyMax);
    const perfectBase = dunk ? SHOT_ODDS.dunkPerfectMakeChance : layup ? SHOT_ODDS.layupPerfectMakeChance : d < 70 ? SHOT_ODDS.closeJumpPerfectMakeChance : isThree ? SHOT_ODDS.threePointPerfectMakeChance : SHOT_ODDS.jumpPerfectMakeChance;
    const onTargetMake = clamp(perfectBase - state.onMissChance - movePenalty * SHOT_ODDS.movePenaltyScale, SHOT_ODDS.perfectOnTargetMin, SHOT_ODDS.makeChanceMaxDunk);
    let makeChance;
    if (dunk) {
        makeChance = SHOT_ODDS.dunkPerfectMakeChance;
    } else if (layup) {
        const layupFalloff = clamp((absError - slightWindow) / SHOT_ODDS.layupFalloffRange, 0, 1);
        makeChance = clamp(onTargetMake - layupFalloff * SHOT_ODDS.layupFalloffPenalty, SHOT_ODDS.layupMinMakeChance, SHOT_ODDS.layupMaxMakeChance);
    } else {
        const falloffRange = d < 70 ? SHOT_ODDS.closeShotFalloffRange : isThree ? SHOT_ODDS.threePointFalloffRange : SHOT_ODDS.normalShotFalloffRange;
        const offSeverity = clamp((absError - slightWindow) / falloffRange, 0, 1);
        const sharpFalloff = offSeverity * offSeverity;
        const bailout = state.offMakeChance * (isThree ? SHOT_ODDS.threePointBailoutScale : d < 70 ? SHOT_ODDS.closeShotBailoutScale : SHOT_ODDS.normalShotBailoutScale);
        makeChance = clamp(onTargetMake * (1 - sharpFalloff) + bailout * sharpFalloff, SHOT_ODDS.makeChanceMin, SHOT_ODDS.makeChanceMax);
    }
    makeChance = clamp(makeChance + rand(-SHOT_ODDS.makeNoiseVariance, SHOT_ODDS.makeNoiseVariance), SHOT_ODDS.makeChanceMin, dunk ? SHOT_ODDS.makeChanceMaxDunk : SHOT_ODDS.makeChanceMax);
    b.quality = makeChance;
    b.make = Math.random() < makeChance;
    state.attempts += 1;
    const roll = Math.random();
    if (dunk) {
        b.shotStyle = 'swish';
    } else if (layup) {
        if (b.make) b.shotStyle = roll < SHOT_ODDS.layupMakeBankChance ? 'bank' : roll < SHOT_ODDS.layupMakeRimChance ? 'rim' : 'swish';
        else        b.shotStyle = roll < SHOT_ODDS.layupMissBankChance ? 'bank' : roll < SHOT_ODDS.layupMissRimChance ? 'rim' : 'miss';
    } else if (b.make) {
        if (overshot) b.shotStyle = roll < SHOT_ODDS.overshotMakeBankChance ? 'bank' : roll < SHOT_ODDS.overshotMakeRimChance ? 'rim' : 'swish';
        else if (short) b.shotStyle = roll < SHOT_ODDS.shortMakeRimChance ? 'rim' : roll < SHOT_ODDS.shortMakeSwishChance ? 'swish' : 'bank';
        else            b.shotStyle = roll < SHOT_ODDS.normalMakeSwishChance ? 'swish' : roll < SHOT_ODDS.normalMakeRimChance ? 'rim' : 'bank';
    } else {
        if (overshot) b.shotStyle = roll < SHOT_ODDS.overshotMissBankChance ? 'bank' : roll < SHOT_ODDS.overshotMissRimChance ? 'rim' : 'miss';
        else if (short) b.shotStyle = roll < SHOT_ODDS.shortMissRimChance ? 'rim' : roll < SHOT_ODDS.shortMissMissChance ? 'miss' : 'bank';
        else            b.shotStyle = roll < SHOT_ODDS.normalMissRimChance ? 'rim' : roll < SHOT_ODDS.normalMissBankChance ? 'bank' : 'miss';
    }
    const powerBias = clamp(error / SHOT_ODDS.accErrorPowerBiasDivisor, -1, 1);
    const sideNoise = rand(-1, 1) * (SHOT_ODDS.sideNoiseBase + absError * SHOT_ODDS.sideNoiseErrorScale + (isThree ? SHOT_ODDS.sideNoiseThreeBonus : 0));
    if (b.shotStyle === 'bank') {
        b.targetX = COURT.backboardX + 2 + rand(-1, 1);
        b.targetY = clamp(hoopY + sideNoise * 0.75 + (short ? rand(-3, 3) : 0), COURT.paintTop + 8, COURT.paintBottom - 8);
    } else if (b.shotStyle === 'rim') {
        if (short) {
            const sideRim = Math.random() < SHOT_ODDS.shortRimSideChoiceChance;
            if (sideRim) {
                b.targetX = hoopX + (b.make ? rand(0.5, 2.5) : rand(1.5, 4.5));
                b.targetY = hoopY + (Math.random() < 0.5 ? -1 : 1) * rand(7.5, 13.5);
            } else {
                b.targetX = hoopX + (b.make ? rand(2.5, 5.0) : rand(6.0, 10.5));
                b.targetY = hoopY + rand(-4.0, 4.0);
            }
        } else if (overshot) {
            const backSide = Math.random() < SHOT_ODDS.rimBackSideChoiceChance;
            b.targetX = hoopX - (b.make ? rand(1.0, 3.0) : rand(4.5, 8.5));
            b.targetY = hoopY + (backSide ? (Math.random() < 0.5 ? -1 : 1) * rand(5.0, 10.0) : rand(-4.0, 4.0));
        } else {
            b.targetX = hoopX - powerBias * 8 + (b.make ? rand(-2.2, 2.2) : rand(-3.5, 3.5));
            b.targetY = hoopY + sideNoise;
        }
    } else if (b.shotStyle === 'miss') {
        if (short) {
            b.targetX = hoopX + rand(12, 24);
            b.targetY = hoopY + rand(-10, 10);
        } else if (overshot) {
            b.targetX = hoopX - rand(10, 20);
            b.targetY = hoopY + rand(-9, 9);
        } else {
            b.targetX = hoopX + rand(-12, 12);
            b.targetY = hoopY + rand(-12, 12);
        }
    } else {
        b.targetX = hoopX + rand(-1.5, 1.5) - powerBias * 1.4;
        b.targetY = hoopY + rand(-1.8, 1.8) + sideNoise * SHOT_ODDS.sideNoiseTargetNoiseScale;
    }
    if (dunk) {
        b.shotStyle = 'swish';
        b.targetX = hoopX + rand(-0.4, 0.4);
        b.targetY = hoopY + rand(-0.6, 0.6);
        b.duration = 0.30;
    } else if (layup) {
        const side = Math.random() < SHOT_ODDS.layupSideChoiceChance ? -1 : 1;
        if (b.shotStyle === 'bank') {
            b.targetX = COURT.backboardX + rand(1.0, 3.0);
            b.targetY = clamp(hoopY + side * rand(4.0, 11.0) + (overshot ? rand(-2, 2) : 0), COURT.paintTop + 8, COURT.paintBottom - 8);
            b.duration = 0.22 + rand(0, 0.05);
        } else if (b.shotStyle === 'rim') {
            b.targetX = hoopX + rand(-1.5, 3.5);
            b.targetY = hoopY + side * rand(4.0, 9.5);
            b.duration = 0.24 + rand(0, 0.06);
        } else if (b.shotStyle === 'miss') {
            b.targetX = hoopX + (short ? rand(6, 14) : rand(-5, 9));
            b.targetY = hoopY + side * rand(6, 14);
            b.duration = 0.24 + rand(0, 0.06);
        } else {
            b.targetX = hoopX + rand(-1.2, 1.2);
            b.targetY = hoopY + side * rand(1.5, 4.0);
            b.duration = 0.23 + rand(0, 0.05);
        }
    }
    if (dunk)        state.message = { text: 'HAMMER!', ttl: 0.8 };
    else if (layup)  state.message = { text: 'LAYUP', ttl: 0.7 };
    else if (overshot) state.message = { text: 'STRONG', ttl: 0.55 };
    else if (short)  state.message = { text: 'SHORT', ttl: 0.55 };
    else if (absError <= slightWindow * 0.42) state.message = { text: 'GREEN', ttl: 0.75 };
    else if (absError <= slightWindow)        state.message = { text: 'GOOD', ttl: 0.65 };
    else                                      state.message = { text: 'OFF TIMING', ttl: 0.65 };
}

export function beginLooseBall(state, x, y, z, vx, vy, vz) {
    const b = state.ball;
    b.mode = 'loose';
    b.holderId = null;
    b.receiverId = null;
    b.shooterId = null;
    b.x = clamp(x, COURT.playableLeft, COURT.playableRight);
    b.y = clamp(y, COURT.playableTop, COURT.playableBottom);
    b.z = z;
    b.vx = vx;
    b.vy = vy;
    b.vz = vz;
}

export function updateTeammates(state, dt) {
    const holder = state.players.find(p => p.hasBall);
    for (const p of state.players) {
        if (p.controlled) continue;
        p.cutTimer -= dt;
        if (p.cutTimer <= 0) {
            if (holder && p.role !== 'PG' && Math.random() < SHOT_ODDS.teammateCutToRimChance) {
                p.targetX = clamp(COURT.rim.x + rand(35, 145), COURT.playableLeft, COURT.playableRight);
                p.targetY = clamp(p.homeY + rand(-24, 24), COURT.playableTop, COURT.playableBottom);
            } else {
                p.targetX = p.homeX + rand(-16, 16);
                p.targetY = p.homeY + rand(-12, 12);
            }
            p.cutTimer = rand(1.15, 2.6);
        }
        if (p.hasBall) continue;
        const to = normalize(p.targetX - p.x, p.targetY - p.y);
        const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
        const accel = d > 8 ? 340 : 120;
        p.vx += to.x * accel * dt;
        p.vy += to.y * accel * dt;
        const max = d > 8 ? 58 : 22;
        const v = Math.hypot(p.vx, p.vy);
        if (v > max) {
            p.vx = (p.vx / v) * max;
            p.vy = (p.vy / v) * max;
        }
        if (v > 4) {
            p.facingX = p.vx / v;
            p.facingY = p.vy / v;
            if (p.actionElapsed >= p.actionDuration)
                p.animState = d > 8 ? 'run' : 'idle';
        }
    }
}

function updateHeldBall(state) {
    const b = state.ball;
    const holder = state.players.find(p => p.id === b.holderId);
    if (!holder) return;
    const charge = state.shotCharge?.playerId === holder.id
        ? clamp(state.shotCharge.elapsed / GAME.maxChargeTime, 0, 1)
        : 0;
    const dir = holder.facingX >= 0 ? 1 : -1;
    const speed = Math.hypot(holder.vx, holder.vy);
    const wave = Math.sin(holder.anim * (speed > 30 ? 13 : 8));
    const side = holder.cooldowns.dribble > 0.2
        ? (holder.cooldowns.dribble > 0.42 ? 1 : -1)
        : (wave > 0 ? 1 : -1);
    if (charge > 0) {
        b.x = holder.x + dir * (5 + charge * 3);
        b.y = holder.y - 13 - charge * 5;
        b.z = 10 + charge * 10;
        return;
    }
    if (holder.animState === 'turnshot') {
        b.x = holder.x + dir * 5.5;
        b.y = holder.y - 12;
        b.z = 13;
        return;
    }
    if (holder.animState === 'catch') {
        b.x = holder.x + dir * 6;
        b.y = holder.y - 9;
        b.z = 10;
        return;
    }
    if (holder.animState === 'drive') {
        const t = actionProgress(holder);
        const gather = Math.sin(t * Math.PI);
        b.x = holder.x + dir * (5.0 + gather * 0.7);
        b.y = holder.y - 9.5 - gather * 0.7;
        b.z = 10.5 + gather * 1.1;
        return;
    }
    if (holder.animState === 'layup' || holder.animState === 'dunk') {
        const t = actionProgress(holder);
        b.x = holder.x + dir * (6 + t * 3);
        b.y = holder.y - 12 - t * 5;
        b.z = 16 + t * 8;
        return;
    }
    const bounce = Math.abs(wave) * (speed > 30 ? 6.5 : 5);
    b.x = holder.x + dir * 4 + side * 5;
    b.y = holder.y - 2 + (speed > 20 ? 1 : 0);
    b.z = 2.5 + bounce;
}

export function updateBall(state, dt) {
    const b = state.ball;
    if (b.mode === 'held') {
        updateHeldBall(state);
        return;
    }
    if (b.mode === 'pass' || b.mode === 'lob') {
        const receiver = state.players.find(p => p.id === b.receiverId);
        if (receiver) {
            b.targetX = receiver.x;
            b.targetY = receiver.y - 3;
        }
        b.elapsed += dt;
        const t = clamp(b.elapsed / b.duration, 0, 1);
        const eased = smoothstep(t);
        b.x = lerp(b.fromX, b.targetX, eased);
        b.y = lerp(b.fromY, b.targetY, eased);
        b.z = lerp(b.fromZ, 8, t) + Math.sin(Math.PI * t) * (b.mode === 'lob' ? 40 : 10);
        if (receiver && t >= 1) {
            handBallTo(state, receiver, b.mode === 'lob' ? 'LOB CATCH' : 'CATCH');
            if (b.mode === 'lob' && dist(receiver, rim()) < 43)
                beginShot(state, receiver, 0.82, true);
        }
        return;
    }
    if (b.mode === 'shot') {
        b.elapsed += dt;
        const t = clamp(b.elapsed / b.duration, 0, 1);
        const eased = smoothstep(t);
        if (b.shotType === 'dunk') {
            const hoopX = rim().x + 2;
            const hoopY = rim().y;
            const gatherT = clamp(t / 0.55, 0, 1);
            const slamT = clamp((t - 0.55) / 0.45, 0, 1);
            if (t < 0.55) {
                const e = smoothstep(gatherT);
                b.x = lerp(b.fromX, hoopX - 1.0, e);
                b.y = lerp(b.fromY, hoopY + rand(-0.2, 0.2), e);
                b.z = lerp(b.fromZ, HOOP_Z + 14, e) + Math.sin(Math.PI * gatherT) * 2.0;
            } else {
                const e = smoothstep(slamT);
                b.x = lerp(hoopX - 1.0, b.targetX, e);
                b.y = lerp(hoopY, b.targetY, e);
                b.z = lerp(HOOP_Z + 14, HOOP_Z - 1, e);
            }
        } else {
            b.x = lerp(b.fromX, b.targetX, eased);
            b.y = lerp(b.fromY, b.targetY, eased);
        }
        let high;
        let endZ;
        if (b.shotType === 'dunk') {
            high = 0;
            endZ = HOOP_Z - 1;
        } else if (b.shotType === 'layup') {
            high = b.touchedBoard ? 4 : (b.shotStyle === 'bank' ? 6 : 9);
            endZ = b.touchedBoard ? HOOP_Z : (b.shotStyle === 'bank' ? HOOP_Z + 3 : HOOP_Z);
        } else {
            high = (b.touchedBoard ? 12 : 42 + (b.shotValue === 3 ? 22 : 8)) * b.arcScale;
            endZ = b.touchedBoard ? HOOP_Z : (b.shotStyle === 'bank' ? HOOP_Z + 5 : HOOP_Z);
        }
        if (b.shotType !== 'dunk')
            b.z = lerp(b.fromZ, endZ, t) + Math.sin(Math.PI * t) * high;
        if (t >= 1) {
            const hoopX = rim().x + 2;
            const hoopY = rim().y;
            if (b.shotStyle === 'bank' && !b.touchedBoard) {
                b.touchedBoard = true;
                b.rimHit = true;
                b.fromX = b.x;
                b.fromY = b.y;
                b.fromZ = b.z;
                b.targetX = hoopX + (b.make ? rand(-1.5, 1.5) : rand(4, 10));
                b.targetY = hoopY + (b.make ? rand(-2.5, 2.5) : rand(-6, 6));
                b.elapsed = 0;
                b.duration = b.shotType === 'layup' ? 0.15 : 0.26;
                state.message = { text: b.shotType === 'layup' ? 'BANK' : 'GLASS', ttl: 0.35 };
                state.screenShake = 0.14;
                return;
            }
            if (b.make) {
                if (b.shotStyle === 'rim') {
                    startRimRoll(state);
                } else {
                    finishMake(state, b.shotStyle, clamp((b.y - hoopY) / 6, -1, 1));
                }
            } else {
                state.streak = 0;
                const out = normalize(b.x - hoopX || 1, b.y - hoopY);
                const force = b.shotStyle === 'bank' ? 82 : 62 + (1 - b.quality) * 94;
                const side = rand(-0.35, 0.35);
                const vx = out.x * force + -out.y * side * force;
                const vy = out.y * force + out.x * side * force;
                const vz = b.shotStyle === 'bank' ? 16 : 22 + (1 - b.quality) * 24;
                const sideOffset = Math.abs(b.y - hoopY);
                const missText = b.shotStyle === 'bank' ? 'OFF GLASS' :
                    b.shotStyle === 'miss' ? (b.x > hoopX ? 'AIRBALL SHORT' : 'LONG') :
                        sideOffset > 5.5 ? 'SIDE RIM' :
                            b.x > hoopX + 5 ? 'FRONT RIM' :
                                b.x < hoopX - 5 ? 'BACK RIM' :
                                    'SIDE RIM';
                state.message = { text: missText, ttl: 0.85 };
                state.screenShake = b.shotStyle === 'rim' ? 0.22 : 0.14;
                beginLooseBall(state, b.x, b.y, 14, vx, vy, vz);
            }
        }
        return;
    }
    if (b.mode === 'rimroll') {
        b.elapsed += dt;
        const t = clamp(b.elapsed / b.duration, 0, 1);
        const hoopX = rim().x + 2;
        const hoopY = rim().y;
        const spin = b.fromY || 1;
        const angle = b.fromX + spin * Math.PI * 1.35 * t;
        const r = RIM_RADIUS - 2.3 - t * 2.4;
        b.x = hoopX + Math.cos(angle) * r;
        b.y = hoopY + Math.sin(angle) * r * 0.56;
        b.z = HOOP_Z + 1 - t * 2.5;
        if (t >= 1) {
            finishMake(state, 'rim', clamp((b.y - hoopY) / 6, -1, 1));
        }
        return;
    }
    if (b.mode === 'made') {
        b.elapsed += dt;
        const t = clamp(b.elapsed / b.duration, 0, 1);
        const eased = smoothstep(t);
        b.x = lerp(b.fromX, b.targetX, eased);
        b.y = lerp(b.fromY, b.targetY, eased);
        b.z = lerp(b.fromZ, 0, t);
        if (t >= 1) {
            b.x = b.targetX;
            b.y = b.targetY;
            b.z = 0;
            b.vx = 0;
            b.vy = 0;
            b.vz = 0;
        }
        return;
    }
    // Loose ball physics.
    b.vx *= Math.pow(0.15, dt);
    b.vy *= Math.pow(0.15, dt);
    b.vz -= 118 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
        b.z = 0;
        b.vz *= -0.45;
        b.vx *= 0.75;
        b.vy *= 0.75;
    }
    if (b.x < COURT.playableLeft || b.x > COURT.playableRight) b.vx *= -0.55;
    if (b.y < COURT.playableTop  || b.y > COURT.playableBottom) b.vy *= -0.55;
    b.x = clamp(b.x, COURT.playableLeft, COURT.playableRight);
    b.y = clamp(b.y, COURT.playableTop,  COURT.playableBottom);
    for (const p of state.players) {
        if (dist(p, b) < p.radius + 5 && b.z < 14 && state.resetTimer <= 0) {
            handBallTo(state, p, 'BOARD');
            break;
        }
    }
}
