import { COURT, GAME, SHOT_ODDS } from './config.js';
import { clamp, lerp, smoothstep, dist, normalize, rand } from './math.js';
import { RESET_SPOTS, rim } from './entities.js';

// The hoop's depth (Z) coordinate — how high up the basket sits in 3D space.
export const HOOP_Z = 13;
// The radius of the rim circle. A ball must land within this to go in.
export const RIM_RADIUS = 7.5;

// Starts the net-swaying animation when the ball goes through.
// "strength" controls how much the net moves; "side" controls which direction it sways.
export function triggerNet(state, strength, side) {
    state.netTimer = Math.max(state.netTimer, strength);
    state.netSide = clamp(side, -1, 1);
}

// Increments the score and streak, shows a message ("+2" or "+3"), triggers
// the shooter's celebration animation, makes the net sway, and starts moving
// the ball from the hoop back down to the floor for the next possession.
export function finishMake(state, style, side) {
    const b = state.ball;
    state.makes += 1;
    state.streak += 1;
    // Show "SPLASH +3" for three-pointers, "BUCKET +2" for everything else.
    state.message = { text: b.shotValue === 3 ? 'SPLASH +3' : 'BUCKET +2', ttl: 1.0 };
    const shooter = state.players.find(p => p.id === b.shooterId);
    if (shooter) startAction(shooter, 'celebrate', 0.42);
    // Swishes shake the net more than rim-ins or other makes.
    triggerNet(state, style === 'swish' ? 0.56 : style === 'rim' ? 0.42 : 0.36, side);
    b.mode = 'made';
    // Remember where the ball is right now so we can animate it falling away from the hoop.
    b.fromX = b.x;
    b.fromY = b.y;
    b.fromZ = Math.max(2, b.z);
    // Ball drifts to the side of the rim, then falls to the floor.
    b.targetX = rim().x + 3 + side * 1.5;
    b.targetY = rim().y + 12;
    b.elapsed = 0;
    b.duration = style === 'swish' ? 0.24 : 0.3;
    b.vx = 0;
    b.vy = 0;
    b.vz = -16;
    // Start the countdown before the court resets to the next rep.
    state.resetTimer = GAME.resetDelay;
}


// Sets up the ball to orbit the rim for a short animation, then calls finishMake
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

// Returns how far through a player's current animation they are, value from 0 (started) to 1 (finished)
export function actionProgress(p) {
    if (p.actionDuration <= 0) return 1;
    return clamp(p.actionElapsed / p.actionDuration, 0, 1);
}

// Tells a player to start playing a specific animation (shoot, pass, etc.) along with duration of the animation
export function startAction(p, state, duration) {
    p.animState = state;
    p.actionElapsed = 0;
    p.actionDuration = duration;
}

// Ticks all of a player's internal timers forward each frame (actual game loop basically)
// - p.anim: a running clock used for things like the dribble-bounce wave
// - p.actionElapsed: how long the current animation has been playing
// - p.cooldowns: timers (shoot, pass, etc.) that count down to 0 so the player doesn't keep doing what they are doing forever
// Also handles animation transitions: once a shooting/passing/etc. animation finishes,
// the player automatically goes back to dribbling (if they have the ball) or standing idle.
export function updatePlayerTimers(p, dt) {
    p.anim += dt;
    p.actionElapsed += dt;
    for (const key of Object.keys(p.cooldowns)) {
        p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
    }
    // if action is complete basically
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

// Prevents a player from walking off the court.
// If they somehow end up outside the boundaries from a glitch it snaps them back inside as well. 
export function keepOnCourt(p) {
    p.x = clamp(p.x, COURT.playableLeft, COURT.playableRight);
    p.y = clamp(p.y, COURT.playableTop, COURT.playableBottom);
}

// Resets the entire court to the start of a new possession after a make or miss is resolved.
// Every player goes back to their default starting position, and literally every value resets so its like the game just started. 
// "message" is the banner text shown on screen (e.g. 'NEXT REP')
export function resetTraining(state, message = 'COOL GAME') {
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
        // Each player waits a random amount before they start cutting in — so they don't
        // all move at the same instant and look robotic. This is the off-ball movement
        p.cutTimer = rand(0.8, 2.4);
        p.stamina = 1;
        p.pivotLocked = false;
        p.driveTimer = 0;
        // Only the point guard is controlled by the player
        p.controlled = p.role === 'PG';
        p.hasBall = p.role === 'PG';
        p.animState = p.hasBall ? 'dribble' : 'idle';
        p.actionElapsed = 0;
        p.actionDuration = 0.01;
        p.cooldowns = { shoot: 0, pass: 0, stepback: 0 };
    }
    // Reset the defender to their default spot
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
    state.defender.cooldowns = { shoot: 0, pass: 0, stepback: 0 };
    state.defender.blockContestDist = Infinity;
    const pg = state.players.find(p => p.role === 'PG');
    if (!pg) throw new Error('No point guard');
    state.controlledId = pg.id;
    // Create a fresh ball held by the point guard
    state.ball = {
        x: pg.x - 7,
        y: pg.y + 1,
        z: 5,
        vx: 0,
        vy: 0,
        vz: 0,
        mode: 'held',          // held, pass, rimroll, shot, made, loose (rebounded off miss)
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
        quality: 0,            // 0–1: how high the make probability was for this shot
        rimHit: false,
        shotStyle: 'miss',     // swish, rim, bank, miss. Default is miss
        shotType: 'jumper',    // jumper, layup, dunk. Default is jumper
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

// For passes. Clears everyone else's hasBall flag,
// gives control to the receiver, and plays their catch animation.
// sets everything up for the receiver so they can be controlled. 
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

// Pushes players apart when they are overlapping each other.
// Checks every pair of players; if they are too close, it nudges both of them
// outward along the line between them until they have enough space.
// After that, it makes sure no one has been pushed outside the court.
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

// Starts a pass from one player to another.
// Immediately takes the ball away from the passer, sets the ball's travel path
// (start position, destination, and travel time), and puts the ball in 'pass'
// mode so updateBall() can animate it flying through the air.
export function beginPass(state, passer, receiver) {
    passer.hasBall = false;
    state.pendingShot = null;
    passer.pivotLocked = false;
    passer.driveTimer = 0;
    passer.cooldowns.pass = 0.24;
    startAction(passer, 'pass', 0.18);
    const b = state.ball;
    b.mode = 'pass';
    b.holderId = null;
    b.receiverId = receiver.id;
    b.shooterId = null;
    // Ball launches from just in front of the passer's chest.
    b.fromX = passer.x + passer.facingX * 7;
    b.fromY = passer.y - 7;
    b.fromZ = 9;
    b.x = b.fromX;
    b.y = b.fromY;
    b.z = b.fromZ;
    b.targetX = receiver.x;
    b.targetY = receiver.y - 3;
    b.elapsed = 0;
    // Travel time scales with the pass distance.
    b.duration = clamp(dist(passer, receiver) / 410, GAME.passDurationMin, GAME.passDurationMax);
    state.message = { text: 'PASS', ttl: 0.5 };
}

// The main shot-resolution function. Called when the player releases the shoot button.
// It determines:
//   1. What type of shot it is (jumper / layup / dunk).
//   2. Whether the shot goes in, based on timing quality, distance, and movement.
//   3. How it misses (airball, front rim, back rim, bank off glass).
//   4. Where the ball ends up (exact target coordinates for the animation).
// Maps the defender's distance (in pixels) from the shooter to a contest value
// from 1 (right on top of them) down to 0 (wide open / too far to bother the shot).
//
// contest function based on distance alone, block isn't included here
export function contestFromDistance(distance, angle) {
    let absangle = Math.abs(angle);
    let withoutAngle = distance >= 36 ? 0: distance > 12 ? -4.07794 * distance + 149.51661 : 100;
    absangle = (absangle <= GAME.contestAngleThreshold ? 0: absangle);
    return clamp((((Math.PI)/2 - Math.min(Math.PI/2, absangle)) / (Math.PI/2)) * withoutAngle * GAME.angleFactor, 0, 100);
}



// "charge01" is 0–1 and represents how far through the shot meter the player released
// "selectedShotType" is 'jumper', 'layup', or 'dunk' (decided by chooseShotType in game.js)
export function beginShot(state, shooter, charge01, selectedShotType = 'jumper') {
    const goal = rim();
    const hoopX = goal.x + 2;
    const hoopY = goal.y;
    const shotDistance = dist(shooter, goal);  // distance from shooter to the hoop
    const dunk = selectedShotType === 'dunk';
    const layup = selectedShotType === 'layup';
    const isThree = shotDistance > COURT.threeRadius + 1;  // true if shooter is behind the three-point line
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
    // Ball launches from just in front of and slightly above the shooter.
    b.fromX = shooter.x + shooter.facingX * 6;
    b.fromY = shooter.y - (dunk || layup ? 13 : 10);
    b.fromZ = dunk ? HOOP_Z + (11 * Math.random() * 0.6 + 0.7) : layup ? 18 : 14;
    b.x = b.fromX;
    b.y = b.fromY;
    b.z = b.fromZ;
    b.elapsed = 0;
    b.duration = dunk ? SHOT_ODDS.dunkDuration : layup ? clamp((SHOT_ODDS.layupDuration + shotDistance / (Math.random() * 200 + 200)), SHOT_ODDS.layupDuration, SHOT_ODDS.layupDuration + 0.2) : clamp(GAME.shotBaseDuration + shotDistance / 500, 0.5, 0.82);
    b.rimHit = false;
    b.touchedBoard = false;
    b.rimContacts = 0;
    b.shotValue = isThree ? 3 : 2;
    b.shotType = dunk ? 'dunk' : layup ? 'layup' : 'jumper';
    // Jumpers get a randomised arc height; layups and dunks use a fixed arc. Within a bound and randomised a little.
    b.arcScale = b.shotType === 'jumper' // this part is good, don't change again plzzz
        ? clamp(SHOT_ODDS.jumperArcHeight + rand(-SHOT_ODDS.shotArcNoise, SHOT_ODDS.shotArcNoise), SHOT_ODDS.shotArcMin, SHOT_ODDS.shotArcMax)
        : 1;

    // Floater / stepback arc adjustment (jumpers only).
    // "toward basket" is the shooter's x-velocity component in the direction of the hoop.
    let isFloater = false;
    if (b.shotType === 'jumper') {
        const toBasket = Math.sign(hoopX - shooter.x) || -1;
        const xSpeedToBasket = shooter.vx * toBasket;
        if (xSpeedToBasket > GAME.floaterSpeedThreshold) {
            // Moving fast toward the basket is floater: higher arc, contest halved later.
            b.arcScale *= GAME.floaterArcScale;
            isFloater = true;
        } else if (xSpeedToBasket < 0) {
            // Moving away from the basket (stepback) — flatten the arc proportionally.
            const backFraction = clamp(-xSpeedToBasket / GAME.sprintSpeed, 0, 1); // this part is REALLY good, don't change
            b.arcScale *= (1 - backFraction * GAME.stepbackArcFlattenMax);
        }
        b.arcScale = clamp(b.arcScale, SHOT_ODDS.shotArcMin, SHOT_ODDS.shotArcMax);
    }


    // For when they are blocking, use their position at the peak of the block, not where they are at the time because they might just be doing a 
    // closeout which isn't really contesting at all
    const def = state.defender;
    const blocking = def.animState === 'block' && def.actionElapsed < def.actionDuration;
    const contestDist = blocking && isFinite(def.blockContestDist)
        ? def.blockContestDist
        : dist(shooter, def);
    // RUn distance thru the contest curve (the e function). Freeze the
    // distance readout at this release distance, since distance doesn't matter if no one has the ball.
    state.shooterDist = contestDist;
    state.lastContest = contestFromDistance(contestDist, state.contestAngle);
    if (isFloater) state.lastContest *= 0.5;  // floaters are harder to contest but also harder to make
    state.lastShotError = charge01 - GAME.greenCenter;


    // --- Timing quality calculation ---
    // "error" is how far charge01 was from the perfect release point (GAME.greenCenter).
    // Positive = released too late (overshot); negative = too early (short). 0 is perfect. 
    const error = charge01 - GAME.greenCenter;
    /*

    we are given: 
        error
        isFloater && shotType
        isMoving / Moving amount
        shotDistance
        contestAmt

        we must give --> makeChance

        // less than 0.35 --> pump fake
        // from -0.3 to 0.27, 0 is perfect
        // +- 0.02 is guaranteed no matter what FS
        // +- 0.055 or something, pretty solidly likely, at least 40% chance of in no matter what and open shot straight guaranteed
        // past that is just based on a function
        if (+- 0.02) makeChance = 1
        else if (+- 0.055) 
        For a 3 (not deep 3)
            0 - 0.02 error : 100% make
                blockChance = 3% if contestAmt above 70%
                Perfect Shot
            0.02 - 0.055 : (80% - 100%) - 5% * moveAmt - 20% * contestAmt - 5 % (only if contestAmt above 60% and is blocking)
                blockChance (only if contestAmt above 60%) → contestAmt / 10
                Really solid shot
            0.055 - 0.1 : (80% - 50%) - 5% * moveAmt - 20% * contestAmt - 5% (only if contestAmt above 50% and is blocking)
                blockChance (only if contestAmt above 50%) → ContestAmt / 9
                Decent - Borderline Decent shot. This is the edge and what you should normally be getting, ideally you get these less contested though. 
            0.1 - 0.2 : max(1%, (50% - 20%) - 5% * moveAmt - ((x - 10%) * contestAmt) - 5% (only if contestAmt above 50% and is blocking))
            0.2 - 0.27 : max(1%, (25% - 10%) - (x% * contestAmt))
                blockChance (if contestAmt above 50% → contestAmt / 9)
                Really bad but not the worst
            0.27 : max(1%, 10% - (10% * contestAmt))
                blockChance (if contestAmt above 50% → contestAmt / 9)
            Lower somehow : 1%

        For a midranger
            0 - 0.02 error : 100% make
                blockChance = 3% if contestAmt above 70%
                Perfect Shot
            0.02 - 0.055 : (80% - 100%) - 5% * moveAmt - 15% * contestAmt - 15 % (only if contestAmt above 60% and is blocking)
                blockChance (only if contestAmt above 60%) → contestAmt / 10
                Really solid shot
            0.055 - 0.1 : (80% - 50%) - 5% * moveAmt - 20% * contestAmt - 5% (only if contestAmt above 50% and is blocking)
                blockChance (only if contestAmt above 50%) → ContestAmt / 9
                Decent - Borderline Decent shot. This is the edge and what you should normally be getting, ideally you get these less contested though. 
            0.1 - 0.2 : max(1%, (50% - 20%) - 5% * moveAmt - ((x - 10%) * contestAmt) - 5% (only if contestAmt above 50% and is blocking))
            0.2 - 0.27 : max(1%, (25% - 10%) - (x% * contestAmt))
                blockChance (if contestAmt above 50% → contestAmt / 9)
                Really bad but not the worst
            0.27 : max(1%, 10% - (10% * contestAmt))
                blockChance (if contestAmt above 50% → contestAmt / 9)
            Lower somehow : 1%           


    */
    const absError = Math.abs(error);
    // "slightWindow" is the margin around perfect where timing still counts as "on target".
    // Dunks and layups are more forgiving than three-pointers.
    const slightWindow = dunk ? SHOT_ODDS.dunkTimingWindow : layup ? SHOT_ODDS.layupTimingWindow : shotDistance < 70 ? SHOT_ODDS.closeJumpTimingWindow : isThree ? SHOT_ODDS.threePointTimingWindow : SHOT_ODDS.jumpTimingWindow;
    const overshot = error > slightWindow;
    const short = error < -slightWindow;
    // severeMistime: 0 = slightly off, 1 = very badly timed.
    const severeMistime = clamp((absError - (slightWindow + SHOT_ODDS.timingMistimeOffset)) / SHOT_ODDS.timingMistimeScale, 0, 1);
    // timingScore: 1 = perfect, 0 = terrible timing.
    const timingScore = 1 - clamp(absError / (slightWindow + SHOT_ODDS.timingScoreRange), 0, 1);
    // movePenalty: moving fast while shooting reduces make chance.
    const movePenalty = clamp(Math.hypot(shooter.vx, shooter.vy) / SHOT_ODDS.movePenaltySpeedDivisor, 0, SHOT_ODDS.movePenaltyMax);

    // --- Make chance calculation ---
    // "perfectBase" is how often this shot type goes in with perfect timing.
    const perfectBase = dunk ? SHOT_ODDS.dunkPerfectMakeChance : layup ? SHOT_ODDS.layupPerfectMakeChance : shotDistance < 70 ? SHOT_ODDS.closeJumpPerfectMakeChance : isThree ? SHOT_ODDS.threePointPerfectMakeChance : SHOT_ODDS.jumpPerfectMakeChance;
    // "onTargetMake" subtracts penalties from the perfect base.
    const onTargetMake = clamp(perfectBase - SHOT_ODDS.missChanceOnPerfectShot - movePenalty * SHOT_ODDS.movePenaltyScale, SHOT_ODDS.perfectOnTargetMin, SHOT_ODDS.makeChanceMaxDunk);
    let makeChance;
    if (dunk) {
        // Dunks always go in.
        makeChance = SHOT_ODDS.dunkPerfectMakeChance;
    } else if (layup) {
        // Layup make chance drops off the worse the timing is.
        const layupFalloff = clamp((absError - slightWindow) / SHOT_ODDS.layupFalloffRange, 0, 1);
        makeChance = clamp(onTargetMake - layupFalloff * SHOT_ODDS.layupFalloffPenalty, SHOT_ODDS.layupMinMakeChance, SHOT_ODDS.layupMaxMakeChance);
    } else {
        // Jumpers: timing error reduces make chance sharply; a "bailout" chance
        // (SHOT_ODDS.luckyMakeChanceOnBadShot) lets badly-timed shots still occasionally go in.
        const falloffRange = shotDistance < 70 ? SHOT_ODDS.closeShotFalloffRange : isThree ? SHOT_ODDS.threePointFalloffRange : SHOT_ODDS.normalShotFalloffRange;
        const offSeverity = clamp((absError - slightWindow) / falloffRange, 0, 1);
        const sharpFalloff = offSeverity * offSeverity;
        const bailout = SHOT_ODDS.luckyMakeChanceOnBadShot * (isThree ? SHOT_ODDS.threePointBailoutScale : shotDistance < 70 ? SHOT_ODDS.closeShotBailoutScale : SHOT_ODDS.normalShotBailoutScale);
        makeChance = clamp(onTargetMake * (1 - sharpFalloff) + bailout * sharpFalloff, SHOT_ODDS.makeChanceMin, SHOT_ODDS.makeChanceMax);
    }
    // Add a small random jitter so identical shots don't always have the same result.
    makeChance = clamp(makeChance + rand(-SHOT_ODDS.makeNoiseVariance, SHOT_ODDS.makeNoiseVariance), SHOT_ODDS.makeChanceMin, dunk ? SHOT_ODDS.makeChanceMaxDunk : SHOT_ODDS.makeChanceMax);
    b.quality = makeChance;
    b.make = Math.random() < makeChance;  // actually flip the coin
    state.attempts += 1;

    
    // --- Shot style determination ---
    // Decides whether the shot is a swish, bank (off the backboard), rim, or miss.
    // Each style has different visual paths and different miss-bounce directions.
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

    // --- Target position calculation ---
    // Based on shot style and timing, figure out exactly WHERE the ball is headed
    // so the arc animation lands in a believable spot.
    // powerBias: positive = overshot (ball goes past the rim), negative = short.
    const powerBias = clamp(error / SHOT_ODDS.accErrorPowerBiasDivisor, -1, 1);
    // sideNoise: how far left or right the ball drifts from centre.
    const sideNoise = rand(-1, 1) * (SHOT_ODDS.sideNoiseBase + absError * SHOT_ODDS.sideNoiseErrorScale + (isThree ? SHOT_ODDS.sideNoiseThreeBonus : 0));
    if (b.shotStyle === 'bank') {
        // Bank shots aim at the backboard first, then bounce to the hoop.
        b.targetX = COURT.backboardX + 2 + rand(-1, 1);
        b.targetY = clamp(hoopY + sideNoise * 0.75 + (short ? rand(-3, 3) : 0), COURT.paintTop + 8, COURT.paintBottom - 8);
    } else if (b.shotStyle === 'rim') {
        if (short) {
            // Short rim shots hit the near (front) side of the rim.
            const sideRim = Math.random() < SHOT_ODDS.shortRimSideChoiceChance;
            if (sideRim) {
                b.targetX = hoopX + (b.make ? rand(0.5, 2.5) : rand(1.5, 4.5));
                b.targetY = hoopY + (Math.random() < 0.5 ? -1 : 1) * rand(7.5, 13.5);
            } else {
                b.targetX = hoopX + (b.make ? rand(2.5, 5.0) : rand(6.0, 10.5));
                b.targetY = hoopY + rand(-4.0, 4.0);
            }
        } else if (overshot) {
            // Overshot rim shots hit the back rim.
            const backSide = Math.random() < SHOT_ODDS.rimBackSideChoiceChance;
            b.targetX = hoopX - (b.make ? rand(1.0, 3.0) : rand(4.5, 8.5));
            b.targetY = hoopY + (backSide ? (Math.random() < 0.5 ? -1 : 1) * rand(5.0, 10.0) : rand(-4.0, 4.0));
        } else {
            // Well-timed rim shots land close to the centre of the hoop.
            b.targetX = hoopX - powerBias * 8 + (b.make ? rand(-2.2, 2.2) : rand(-3.5, 3.5));
            b.targetY = hoopY + sideNoise;
        }
    } else if (b.shotStyle === 'miss') {
        // Clean airballs: short ones land in front of the rim, long ones fly past it.
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
        // Swishes land right in the centre of the hoop with a tiny bit of randomness.
        b.targetX = hoopX + rand(-1.5, 1.5) - powerBias * 1.4;
        b.targetY = hoopY + rand(-1.8, 1.8) + sideNoise * SHOT_ODDS.sideNoiseTargetNoiseScale;
    }

    // Dunks and layups override all of the above with their own specific target logic.
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

    // Show the timing feedback banner at the top of the screen.
    if (dunk)        state.message = { text: 'HAMMER!', ttl: 0.8 };
    else if (layup)  state.message = { text: 'LAYUP', ttl: 0.7 };
    else if (overshot) state.message = { text: 'STRONG', ttl: 0.55 };
    else if (short)  state.message = { text: 'SHORT', ttl: 0.55 };
    else if (absError <= slightWindow * 0.42) state.message = { text: 'GREEN', ttl: 0.75 };
    else if (absError <= slightWindow)        state.message = { text: 'GOOD', ttl: 0.65 };
    else                                      state.message = { text: 'OFF TIMING', ttl: 0.65 };
}

// Drops the ball onto the floor as a loose, physics-simulated object.
// Used after missed shots, deflected passes, or whenever no one has possession.
// x/y/z set the ball's starting position; vx/vy/vz set how fast and in what
// direction it's flying when it first becomes loose.
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

// Moves the AI-controlled teammates around the court.
// Each teammate has a "cut timer". When it expires, they pick a new destination:
//   - Non-PG players sometimes cut toward the rim when the team has the ball.
//   - Otherwise, they wander near their home spot (their default position).
// Once they have a destination, they accelerate toward it and cap their speed.
// When they move fast enough, their facing direction updates to match their velocity.
export function updateTeammates(state, dt) {
    const holder = state.players.find(p => p.hasBall);
    for (const p of state.players) {
        if (p.controlled) continue;
        p.cutTimer -= dt;
        if (p.cutTimer <= 0) {
            if (holder && p.role !== 'PG' && Math.random() < SHOT_ODDS.teammateCutToRimChance) {
                // Cut toward the rim area for an open look.
                p.targetX = clamp(COURT.rim.x + rand(35, 145), COURT.playableLeft, COURT.playableRight);
                p.targetY = clamp(p.homeY + rand(-24, 24), COURT.playableTop, COURT.playableBottom);
            } else {
                // Return to the area near their home spot.
                p.targetX = p.homeX + rand(-16, 16);
                p.targetY = p.homeY + rand(-12, 12);
            }
            p.cutTimer = rand(1.15, 2.6);
        }
        if (p.hasBall) continue;
        // Accelerate toward the target. Acceleration is higher when still far away.
        const to = normalize(p.targetX - p.x, p.targetY - p.y);
        const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
        const accel = d > 8 ? 340 : 120;
        p.vx += to.x * accel * dt;
        p.vy += to.y * accel * dt;
        // Cap speed: full sprint when far away, slow creep when nearly there.
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

// Positions the ball visually on the holder's body while they are dribbling,
// preparing to shoot, catching, driving, or going up for a layup/dunk.
// The ball bobs up and down in sync with the player's dribble animation.
// When charging a shot, the ball rises up into a shooting pose.
function updateHeldBall(state) {
    const b = state.ball;
    const holder = state.players.find(p => p.id === b.holderId);
    if (!holder) return;
    // charge is 0–1: how far through the shot charge the player is.
    const charge = state.shotCharge?.playerId === holder.id
        ? clamp(state.shotCharge.elapsed / GAME.maxChargeTime, 0, 1)
        : 0;
    const dir = holder.facingX >= 0 ? 1 : -1;
    const speed = Math.hypot(holder.vx, holder.vy);
    // wave is a sine curve that drives the dribble bounce rhythm.
    const wave = Math.sin(holder.anim * (speed > 30 ? 13 : 8));
    // side determines which hand the ball is on during a dribble.
    const side = wave > 0 ? 1 : -1;
    if (charge > 0) {
        // Ball rises and extends forward as the shot charges up.
        b.x = holder.x + dir * (5 + charge * 3);
        b.y = holder.y - 13 - charge * 5;
        b.z = 10 + charge * 10;
        return;
    }
    if (holder.animState === 'turnshot') {
        // During a turnaround shot prep, hold the ball high and forward.
        b.x = holder.x + dir * 5.5;
        b.y = holder.y - 12;
        b.z = 13;
        return;
    }
    if (holder.animState === 'catch') {
        // Catching pose: ball is held out to receive the pass.
        b.x = holder.x + dir * 6;
        b.y = holder.y - 9;
        b.z = 10;
        return;
    }
    if (holder.animState === 'drive') {
        // During the drive, the ball tucks in and rises slightly as the player gathers.
        const t = actionProgress(holder);
        const gather = Math.sin(t * Math.PI);
        b.x = holder.x + dir * (5.0 + gather * 0.7);
        b.y = holder.y - 9.5 - gather * 0.7;
        b.z = 10.5 + gather * 1.1;
        return;
    }
    if (holder.animState === 'layup' || holder.animState === 'dunk') {
        // Layup/dunk: ball extends forward and rises as the player goes up.
        const t = actionProgress(holder);
        b.x = holder.x + dir * (6 + t * 3);
        b.y = holder.y - 12 - t * 5;
        b.z = 16 + t * 8;
        return;
    }
    // Default dribble bounce: ball bounces on the floor beside the player.
    const bounce = Math.abs(wave) * (speed > 30 ? 6.5 : 5);
    b.x = holder.x + dir * 4 + side * 5;
    b.y = holder.y - 2 + (speed > 20 ? 1 : 0);
    b.z = 2.5 + bounce;
}

// The main ball movement function. Called every frame to update ball position.
// It handles six distinct ball modes:
//
//  'held'    — ball stays attached to whoever is holding it (delegates to updateHeldBall).
//  'pass'    — ball travels in an arc from passer to receiver.
//  'shot'    — ball flies toward the hoop; when it arrives, resolves the make/miss outcome.
//  'rimroll' — ball orbits the inside of the rim before dropping in for a made basket.
//  'made'    — ball drifts away from the hoop after going in, waiting for the reset.
//  'loose'   — ball is on the floor, bouncing with gravity; any player who touches it
//              picks it up automatically.
export function updateBall(state, dt) {
    const b = state.ball;
    if (b.mode === 'held') {
        updateHeldBall(state);
        return;
    }
    if (b.mode === 'pass') {
        // Keep the target locked to the receiver's current position so passes lead the catcher.
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
        b.z = lerp(b.fromZ, 8, t) + Math.sin(Math.PI * t) * 10; // gentle arc over the pass
        if (receiver && t >= 1) handBallTo(state, receiver, 'CATCH');
        return;
    }
    if (b.mode === 'shot') {
        b.elapsed += dt;
        const t = clamp(b.elapsed / b.duration, 0, 1);
        const eased = smoothstep(t);
        if (b.shotType === 'dunk') {
            // Dunks have a two-phase animation:
            //   Phase 1 (t < 0.55): player gathers and rises up to the rim.
            //   Phase 2 (t >= 0.55): player slams the ball down through the hoop.
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
            // All other shots travel in a smooth horizontal arc.
            b.x = lerp(b.fromX, b.targetX, eased);
            b.y = lerp(b.fromY, b.targetY, eased);
        }
        // Calculate the arc height (how high the ball goes during its flight).
        let high;
        let endZ;
        if (b.shotType === 'dunk') {
            high = 0;
            endZ = HOOP_Z - 1;
        } else if (b.shotType === 'layup') {
            high = b.touchedBoard ? 4 : (b.shotStyle === 'bank' ? 6 : 9);
            endZ = b.touchedBoard ? HOOP_Z : (b.shotStyle === 'bank' ? HOOP_Z + 3 : HOOP_Z);
        } else {
            // Three-pointers arc higher than two-pointers; arcScale adjusts the height.
            high = (b.touchedBoard ? 12 : 42 + (b.shotValue === 3 ? 22 : 8)) * b.arcScale;
            endZ = b.touchedBoard ? HOOP_Z : (b.shotStyle === 'bank' ? HOOP_Z + 5 : HOOP_Z);
        }
        if (b.shotType !== 'dunk')
            b.z = lerp(b.fromZ, endZ, t) + Math.sin(Math.PI * t) * high;
        if (t >= 1) {
            // The ball has reached its destination — resolve the outcome.
            const hoopX = rim().x + 2;
            const hoopY = rim().y;
            if (b.shotStyle === 'bank' && !b.touchedBoard) {
                // Bank shot: ball hits the backboard first. Reset the animation
                // so it can bounce from the glass toward the rim.
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
                    // Rim-in shots get the orbit animation before counting as made.
                    startRimRoll(state);
                } else {
                    finishMake(state, b.shotStyle, clamp((b.y - hoopY) / 6, -1, 1));
                }
            } else {
                // Missed shot: reset the streak and launch the ball as a loose ball
                // so players can rebound it.
                state.streak = 0;
                const out = normalize(b.x - hoopX || 1, b.y - hoopY);
                const force = b.shotStyle === 'bank' ? 82 : 62 + (1 - b.quality) * 94;
                const side = rand(-0.35, 0.35);
                // Kick the ball away from the rim in a direction based on where it hit.
                const vx = out.x * force + -out.y * side * force;
                const vy = out.y * force + out.x * side * force;
                const vz = b.shotStyle === 'bank' ? 16 : 22 + (1 - b.quality) * 24;
                const sideOffset = Math.abs(b.y - hoopY);
                // Show a specific miss description based on where the shot went.
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
        // Animate the ball circling the inside of the rim before dropping in.
        // The radius shrinks over time so the ball spirals inward to the centre.
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
        // After a basket is scored, the ball drifts down to the floor.
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
    // --- Loose ball physics ---
    // Simulates a real ball bouncing on the floor with gravity, friction, and wall bounces.
    b.vx *= Math.pow(0.15, dt);  // heavy horizontal friction so the ball slows quickly
    b.vy *= Math.pow(0.15, dt);
    b.vz -= 118 * dt;            // gravity pulls the ball down
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
        // Ball hit the floor: bounce upward at 45% of its downward speed; lose
        // some horizontal speed on impact too.
        b.z = 0;
        b.vz *= -0.45;
        b.vx *= 0.75;
        b.vy *= 0.75;
    }
    // Bounce off the sidelines and baselines.
    if (b.x < COURT.playableLeft || b.x > COURT.playableRight) b.vx *= -0.55;
    if (b.y < COURT.playableTop  || b.y > COURT.playableBottom) b.vy *= -0.55;
    b.x = clamp(b.x, COURT.playableLeft, COURT.playableRight);
    b.y = clamp(b.y, COURT.playableTop,  COURT.playableBottom);
    // If any teammate is close enough and low enough to grab the ball, they pick it up.
    for (const p of state.players) {
        if (dist(p, b) < p.radius + 5 && b.z < 14 && state.resetTimer <= 0) {
            handBallTo(state, p, 'BOARD');
            break;
        }
    }
}
