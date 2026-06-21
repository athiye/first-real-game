import { COURT, GAME } from './config.js';
import { clamp, dist, normalize, rand, angleRelativeHoop } from './math.js';
import { RESET_SPOTS, makeCooldowns, makeBall, rim } from './entities.js';
import { Input } from './input.js';
import {
    resetTraining, updateBall, updateTeammates, updatePlayerTimers,
    resolveSpacing, keepOnCourt, beginPass, beginShot, beginLooseBall, startAction
} from './physics.js';
import { Renderer } from './render.js';

// Grab the <canvas> element from the HTML page — this is the surface everything is drawn on.
const canvas = document.getElementById('game');
if (!canvas) throw new Error('Missing #game canvas');

// Set up the three core systems the game needs every frame.
const input = new Input();           // reads keyboard/gamepad input
const renderer = new Renderer(canvas); // draws everything to the canvas
const state = createInitialState();  // builds the initial game data object

// Put everyone on the court and hand the ball to the point guard.
resetTraining(state, 'COOL GAME');

// "last" stores the timestamp of the previous frame so we can calculate
// how much time has passed (delta time / dt) each frame.
let last = performance.now();

// The game loop. "requestAnimationFrame" calls this function roughly 60 times per second.
// Each call is one frame: advance the simulation by dt seconds, then draw the result.
function frame(now) {
    // Cap dt at 33ms (30fps equivalent) so a laggy frame doesn't make players teleport.
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    renderer.draw(state);
    input.endFrame();          // clear "just pressed / just released" flags after every frame
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Builds the starting game state from scratch.
// Creates the five players on the home team, the one defender, and an empty ball.
// Returns the complete state object that everything else reads from and writes to.
function createInitialState() {
    // Each role maps to a starting position on the court (defined in entities.js).
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
            vx: 0,               // horizontal velocity (pixels per second)
            vy: 0,               // vertical velocity
            facingX: -1,         // direction the player is facing (toward the hoop by default)
            facingY: 0,
            radius: GAME.playerRadius,
            controlled: i === 0, // only the first player (PG) starts as player-controlled
            hasBall: i === 0,    // PG starts with the ball
            stamina: 1,          // 0–1; drives lose stamina, standing still restores it
            pivotLocked: false,  // true after a drive ends — player must pass or shoot
            driveTimer: 0,       // counts down while a drive is active
            homeX: spot.x,       // the default position this player returns to between plays
            homeY: spot.y,
            targetX: spot.x,     // where AI is currently trying to walk to
            targetY: spot.y,
            cutTimer: rand(0.4, 2.0), // time before this player picks a new cut destination
            skin: (i % 3),       // visual skin tone index
            hair: (i % 4),       // visual hair style index
            heightClass: (role === 'C' ? 2 : role === 'PF' ? 1 : 0), // 0=short, 1=medium, 2=tall
            anim: rand(0, 2),    // offset so players' dribble bounces aren't all in sync
            animState: i === 0 ? 'dribble' : 'idle',
            actionElapsed: 0,    // how long the current animation has been playing
            actionDuration: 0.01,
            cooldowns: makeCooldowns()
        };
    });
    // The single defender the player is practising against.
    // It's controlled via a separate set of keys 
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
        facingX: 1,              // defender starts facing the ball (toward the offence)
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
        cooldowns: makeCooldowns(),
        blockContestDist: Infinity // closest the defender got to the shooter during their current block
    };
    return {
        players,
        defender,
        ball: makeBall(),
        controlledId: 0,          // id of the player currently under player control
        shotCharge: null,         // non-null while the shoot button is held down
        pendingShot: null,        // non-null while the player is turning to face the hoop pre-shot
        makes: 0,                 // total baskets scored this session
        attempts: 0,              // total shots attempted this session
        streak: 0,                // consecutive makes without a miss
        resetTimer: 0,            // countdown after a basket before the court resets
        screenShake: 0,           // how much the camera is currently shaking (0 = none)
        message: { text: '', ttl: 0 }, // the banner text shown at the top of the screen
        netTimer: 0,              // how much the net is currently swaying
        netSide: 0,               // which direction the net sways
        lastContest: 0,           // how contested the most recent shot was (0 = wide open, 1 = smothered)
        lastShotError: 0,         // shot error of the last shot for troubleshooting
        shooterDist: 0,           // live distance (px) from the defender to the current ball handler
        shotDist: 0, // distance from shooter to hoop
        contestAngle: 0,
        paused: false
    };
}

// The main simulation step. Called every frame with dt = seconds since last frame.
// Order of operations:
//   1. Tick down global timers (messages, screen shake, net sway).
//   2. Tick down all player animation and cooldown timers.
//   3. If the post-basket reset countdown is active, let the ball finish its
//      animation and slow everyone to a stop, then trigger the full reset.
//   4. Otherwise, process player input, move teammates, apply physics to everyone,
//      stop players from overlapping, and move the ball.
function update(dt) {
    if (state.paused) return;
    // Countdown timers for cosmetic effects.
    state.message.ttl = Math.max(0, state.message.ttl - dt);
    state.screenShake = Math.max(0, state.screenShake - dt * 3);
    state.netTimer    = Math.max(0, state.netTimer    - dt * 2.6);
    for (const p of state.players) updatePlayerTimers(p, dt);
    updatePlayerTimers(state.defender, dt);
    updatePendingShot(dt);
    if (state.resetTimer > 0) {
        // A basket was just scored. Let the "made" ball animation finish while
        // everyone slows to a halt. When the timer hits zero, reset the court.
        state.resetTimer -= dt;
        updateBall(state, dt);
        for (const p of [...state.players, state.defender]) {
            // Rapidly kill all player momentum so they coast to a stop.
            p.vx *= Math.pow(0.03, dt);
            p.vy *= Math.pow(0.03, dt);
        }
        if (state.resetTimer <= 0) resetTraining(state, 'NEXT REP');
        return;
    }
    // Normal gameplay: read input, move AI teammates, apply physics.
    handleControls(dt);
    handleDefenderControls(dt);
    updateTeammates(state, dt);
    for (const p of [...state.players, state.defender]) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // The defender moves slower while in a block lunge animation.
        const blocking = p === state.defender && p.animState === 'block' && p.actionElapsed < p.actionDuration;
        const friction = blocking ? 0.52 : GAME.friction;
        p.vx *= Math.pow(friction, dt);
        p.vy *= Math.pow(friction, dt);
        keepOnCourt(p);
        const v = Math.hypot(p.vx, p.vy);
        // Update the idle/run animation for players not in a special action.
        if (!p.hasBall && p.actionElapsed >= p.actionDuration) {
            p.animState = v > 12 ? 'run' : 'idle';
        }
    }
    // Push overlapping players apart so they don't occupy the same space.
    resolveSpacing([...state.players, state.defender]);
    trackBlockContest();
    updateShooterDistance();
    updateContestAngle();
    updateBall(state, dt);
    updateDistFromHoop();
}

// Keeps the HUD's "DEF DIST" readout live: while someone is holding the ball, it
// always shows how far the defender currently is from that ball handler. (Once the
// ball leaves a player's hands on a shot, beginShot freezes it at the release distance.)
function updateShooterDistance() {
    const holder = state.players.find(p => p.hasBall);
    if (holder) state.shooterDist = dist(holder, state.defender);
}

function updateDistFromHoop() {
    const holder = state.players.find(p => p.hasBall);
    if (holder) state.shotDist = dist(holder, COURT.rim);
}

function updateContestAngle() {
    // angle between defender and shooter relative to hoop, right in between is 0
    const holder = state.players.find(p => p.hasBall);
    if (holder) state.contestAngle = angleRelativeHoop(holder, state.defender);
}

// While the defender is mid-block, remember the closest they get to the ball
// handler. That "peak of the lunge" distance is what a shot's contest meter reads,
// so a perfectly timed leap counts even if the defender has started receding by the
// exact frame the shot releases.
function trackBlockContest() {
    const d = state.defender;
    if (d.animState !== 'block' || d.actionElapsed >= d.actionDuration) return;
    const holder = state.players.find(p => p.hasBall);
    if (holder) d.blockContestDist = Math.min(d.blockContestDist, dist(d, holder));
}

// Returns the player object that is currently under player control.
function controlledPlayer() {
    return state.players.find(p => p.id === state.controlledId);
}

// Processes all input for the offensive player (the one under player control).
// Handles: moving, driving, facing the hoop, shot charging, passing, dribbling,
// stepbacks, and speed caps.
function handleControls(dt) {
    // Switch player control to whoever is closest to the ball.
    if (input.justPressed('switch')) switchControlled();
    const p = controlledPlayer();
    if (!p) return;
    const axis = input.axis();  // { x, y } joystick/WASD direction, magnitude 0–1
    const moving   = Math.hypot(axis.x, axis.y) > 0.05;
    const charging = state.shotCharge?.playerId === p.id;
    const pending  = state.pendingShot?.playerId === p.id;
    const driving  = p.hasBall && p.driveTimer > 0;
    const pickedUp = p.hasBall && p.pivotLocked; // pivot locked = drive has ended, must pass/shoot
    const toRim    = normalize(rim().x - p.x, rim().y - p.y);
    const vel      = normalize(p.vx, p.vy);
    // "movingTowardHoop" is true when the player is sprinting roughly at the basket.
    const movingTowardHoop = Math.hypot(p.vx, p.vy) > 10 && (vel.x * toRim.x + vel.y * toRim.y) > 0.42;

    // --- Drive initiation ---
    // Press the drive button while holding the ball (and not already doing something)
    // to burst toward the hoop. If the stick is pushed in a direction, drive that way;
    // otherwise default to driving straight at the rim.
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

    // --- Drive continuation ---
    // While the drive timer is active, movement controls steer the player and
    // cost extra timer if turning sharply. When the timer runs out, the player
    // stops (pivotLocked) and must pass or shoot.
    if (driving) {
        p.driveTimer = Math.max(0, p.driveTimer - dt);
        if (moving) {
            const currentFacing = normalize(p.facingX, p.facingY);
            // Sharp turns are penalised: a 180° turn costs twice as much timer as going straight.
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
            // No stick input: keep a tiny bit of momentum in the drive direction.
            p.vx += p.facingX * GAME.accel * 0.12 * dt;
            p.vy += p.facingY * GAME.accel * 0.12 * dt;
        }
        p.stamina = Math.max(0, p.stamina - dt * 0.34);
        if (p.driveTimer <= 0) {
            // Drive ended: lock the pivot and slow the player down.
            p.pivotLocked = true;
            p.vx *= 0.46;
            p.vy *= 0.46;
            if (p.actionElapsed >= p.actionDuration) p.animState = 'dribble';
            state.message = { text: 'PASS OR FINISH', ttl: 0.65 };
        }
    }

    // --- Facing direction ---
    // When moving normally (not locked or driving), the player gradually turns to face
    // the hoop rather than the direction of movement, unless they are deliberately
    // running away from it. While charging or pivot-locked, the player slowly auto-turns
    // toward the basket.
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
        // Standing still with the ball: slowly drift facing toward the hoop.
        const turn = pending ? 0.34 : pickedUp ? 0.14 : 0.18;
        p.facingX = p.facingX * (1 - turn) + toRim.x * turn;
        p.facingY = p.facingY * (1 - turn) + toRim.y * turn;
        const f = normalize(p.facingX, p.facingY);
        p.facingX = f.x || -1;
        p.facingY = f.y;
    }

    // --- Movement ---
    // The player can't steer during a charge or pending-shot; can't move at all when
    // pivot-locked or driving (the drive already set the velocity).
    const maxSpeed    = (driving ? GAME.sprintSpeed * 1.05 : GAME.walkSpeed) * (p.hasBall ? 0.92 : 1);
    const controlScale = charging || pending ? 0.14 : pickedUp || driving ? 0 : 1;
    p.vx += axis.x * GAME.accel * controlScale * dt;
    p.vy += axis.y * GAME.accel * controlScale * dt;

    // During a pending or charging shot, bleed off velocity quickly unless the
    // player is actively driving toward the hoop (keep that momentum for fluid layups/dunks).
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

    // Pivot-locked but not shooting/charging: player can't move. Show a travel warning.
    if (pickedUp && !charging && !pending && p.animState !== 'stepback') {
        p.vx *= Math.pow(0.015, dt);
        p.vy *= Math.pow(0.015, dt);
        if (moving && state.message.ttl <= 0.05)
            state.message = { text: 'NO TRAVEL: PASS/SHOOT', ttl: 0.45 };
    }

    // Enforce the speed cap.
    const v = Math.hypot(p.vx, p.vy);
    if (v > maxSpeed) {
        p.vx = (p.vx / v) * maxSpeed;
        p.vy = (p.vy / v) * maxSpeed;
    }
    // Stamina recovers while not driving.
    if (!driving) p.stamina = Math.min(1, p.stamina + dt * 0.22);

    // Set idle/dribble/run animation when no special action is playing.
    if (p.actionElapsed >= p.actionDuration && !charging && !pending && !driving) {
        if (p.hasBall) p.animState = 'dribble';
        else           p.animState = moving ? 'run' : 'idle';
    }
    if (p.hasBall) handleBallControls(p, dt);
}

// Manages a shot that requires the player to turn and face the hoop before
// the charge meter appears. While the pendingShot timer counts down, the
// player is auto-rotated toward the rim. When it finishes, the charge starts.
function updatePendingShot(dt) {
    const pending = state.pendingShot;
    if (!pending) return;
    const p = state.players.find(player => player.id === pending.playerId);
    if (!p || !p.hasBall) { state.pendingShot = null; return; }
    pending.elapsed += dt;
    // Gradually rotate the player to face the rim while they prep the shot.
    const toRim = normalize(rim().x - p.x, rim().y - p.y);
    p.facingX = p.facingX * 0.62 + toRim.x * 0.38;
    p.facingY = p.facingY * 0.62 + toRim.y * 0.38;
    const f = normalize(p.facingX, p.facingY);
    p.facingX = f.x || -1;
    p.facingY = f.y;
    if (pending.elapsed >= pending.duration) {
        // Prep is done — start the actual shot charge.
        state.pendingShot = null;
        state.shotCharge = { playerId: p.id, elapsed: 0, shotType: pending.shotType };
        startAction(p, 'shoot', 999); // 999 = hold the shoot animation until the button is released
    }
}

// Handles all input for the defender (arrow keys + Enter to block).
// The defender moves freely and can press block to lunge toward the ball. The
// lunge is momentum-based: sprinting at the ball flings the defender a long way,
// standing still gives a short hop, and running away gives almost nothing.
function handleDefenderControls(dt) {
    const d = state.defender;
    const axis   = input.defenderAxis();
    const moving = Math.hypot(axis.x, axis.y) > 0.05;

    // --- Start a block lunge ---
    if (input.justPressed('defBlock') && d.animState !== 'block') {
        const toBall = normalize(state.ball.x - d.x, state.ball.y - d.y);
        d.facingX = toBall.x || d.facingX || 1;
        d.facingY = toBall.y || d.facingY;
        // How fast the defender is ALREADY moving toward the ball, as a fraction of
        // sprint speed: ~1 = sprinting straight at it, 0 = still, negative = backpedalling.
        const closingSpeed = d.vx * toBall.x + d.vy * toBall.y;
        const momentum = clamp(closingSpeed / GAME.sprintSpeed, -1, 1);
        const lungeSpeed = Math.max(GAME.blockLungeMin, GAME.blockLungeBase + GAME.blockLungeMomentum * momentum);
        d.vx = toBall.x * lungeSpeed;
        d.vy = toBall.y * lungeSpeed;
        d.blockContestDist = Infinity; // reset the contest tracker for this new block
        startAction(d, 'block', GAME.blockDuration);
        state.message = { text: 'BLOCK', ttl: 0.45 };
    }

    const blocking = d.animState === 'block' && d.actionElapsed < d.actionDuration;

    // --- Facing ---
    // Mid-lunge the defender stays locked facing where they leapt. Otherwise they
    // face their movement, or drift to face the ball when standing still.
    if (!blocking) {
        if (moving) {
            d.facingX = axis.x;
            d.facingY = axis.y;
        } else {
            const toBall = normalize(state.ball.x - d.x, state.ball.y - d.y);
            d.facingX = d.facingX * 0.92 + toBall.x * 0.08;
            d.facingY = d.facingY * 0.92 + toBall.y * 0.08;
            const f = normalize(d.facingX, d.facingY);
            d.facingX = f.x || 1;
            d.facingY = f.y;
        }
    }

    // --- Steering ---
    // Mid-lunge the defender has almost no control (it's a committed leap).
    const controlScale = blocking ? 0.08 : 0.92;
    d.vx += axis.x * GAME.accel * controlScale * dt;
    d.vy += axis.y * GAME.accel * controlScale * dt;

    // Cap normal running speed — but let the block lunge exceed it, since the lunge
    // is an intentional burst that the heavy block-friction quickly bleeds back off.
    if (!blocking) {
        const v = Math.hypot(d.vx, d.vy);
        const maxSpeed = GAME.sprintSpeed * 0.96;
        if (v > maxSpeed) {
            d.vx = (d.vx / v) * maxSpeed;
            d.vy = (d.vy / v) * maxSpeed;
        }
        if (d.actionElapsed >= d.actionDuration) d.animState = moving ? 'run' : 'idle';
    }
}

// Handles the ball-specific buttons for the player who currently has the ball:
//   - Shoot:    determines shot type, handles turn-to-face prep and charge meter.
//   - Pass:     picks the best teammate to pass to and fires the pass.
//   - Stepback: explodes away from the hoop, locking the pivot for a pull-up jumper.
function handleBallControls(p, dt) {
    const locked  = p.pivotLocked;
    const driving = p.driveTimer > 0;

    // --- Shoot button pressed ---
    if (input.justPressed('shoot') && p.cooldowns.shoot <= 0 && !state.pendingShot) {
        const shotType = chooseShotType(p, driving); // dunk / layup / jumper
        const toHoop   = normalize(rim().x - p.x, rim().y - p.y);
        const facingDot = p.facingX * toHoop.x + p.facingY * toHoop.y; // 1 = facing hoop, -1 = back to hoop
        const shootAxis   = input.axis();
        const shootMoving = Math.hypot(shootAxis.x, shootAxis.y) > 0.05;
        const activeAwayMove = shootMoving && (shootAxis.x * toHoop.x + shootAxis.y * toHoop.y < -0.18);
        const prepThreshold = 0.82; // must be facing at least this much toward the hoop to skip prep
        const needsTurn = shotType === 'jumper' && (activeAwayMove || facingDot < prepThreshold);
        if (needsTurn) {
            // Player isn't facing the hoop enough — insert a brief turn-to-face animation.
            const turnSeverity = clamp((prepThreshold - facingDot) / (1 + prepThreshold), 0, 1);
            const prepDuration = activeAwayMove
                ? clamp(0.10 + turnSeverity * 0.18, 0.10, 0.28)
                : clamp(0.06 + turnSeverity * 0.14, 0.06, 0.22);
            state.pendingShot = { playerId: p.id, elapsed: 0, duration: prepDuration, shotType };
            startAction(p, 'turnshot', prepDuration);
            // Bleed momentum if really facing away, to keep it grounded.
            if (activeAwayMove || facingDot < 0.15) {
                p.vx *= 0.18;
                p.vy *= 0.18;
            }
            state.message = { text: activeAwayMove || facingDot < 0 ? 'TURNAROUND' : 'SHOT PREP', ttl: 0.45 };
        } else {
            // Already facing the hoop — go straight to the shot charge meter.
            state.shotCharge = { playerId: p.id, elapsed: 0, shotType };
            startAction(p, shotType === 'dunk' ? 'dunk' : shotType === 'layup' ? 'layup' : 'shoot', 999);
        }
    }

    // --- Shoot button held / released ---
    // While the shoot button is held, the charge meter fills up (elapsed increases).
    // Releasing the button (or hitting max charge) fires the shot immediately.
    if (state.shotCharge?.playerId === p.id) {
        const chargeState = state.shotCharge;
        chargeState.elapsed = Math.min(GAME.maxChargeTime, chargeState.elapsed + dt);
        if (input.justReleased('shoot') || chargeState.elapsed >= GAME.maxChargeTime) {
            const charge = chargeState.elapsed / GAME.maxChargeTime; // 0–1 release timing
            state.shotCharge = null;
            beginShot(state, p, charge, chargeState.shotType);
            return;
        }
    }

    // --- Pass button ---
    if (input.justPressed('pass') && p.cooldowns.pass <= 0) {
        const target = choosePassTarget(p);
        if (target) beginPass(state, p, target);
    }

    // --- Stepback button ---
    // Explodes the player away from the hoop, locks the pivot immediately (they've
    // gathered), and leaves them in a good position for a pull-up jump shot.
    if (input.justPressed('stepback') && !locked && !driving && p.cooldowns.stepback <= 0) {
        p.cooldowns.stepback = 0.72;
        const away = normalize(p.x - COURT.rim.x, p.y - COURT.rim.y); // direction away from hoop
        p.vx += away.x * GAME.stepbackForce;
        p.vy += away.y * GAME.stepbackForce;
        p.pivotLocked = true;
        p.driveTimer  = 0;
        startAction(p, 'stepback', 0.32);
        state.message = { text: 'STEPBACK', ttl: 0.52 };
    }
}

// Returns true if the player is inside the painted area (the key / lane).
function inPaint(p) {
    return p.x >= COURT.paintLeft && p.x <= COURT.paintRight
        && p.y >= COURT.paintTop  && p.y <= COURT.paintBottom;
}

// Returns true if the player is in the close half of the paint
// (the side nearer the basket, where dunks happen).
function inClosePaintHalf(p) {
    const midPaintX = (COURT.paintLeft + COURT.paintRight) / 2;
    return inPaint(p) && p.x <= midPaintX;
}

// Decides what kind of shot to attempt based on where the player is and
// whether they are in the middle of a drive.
// Close paint while driving → dunk.
// Anywhere else in the paint while driving → layup.
// Close paint without driving → layup.
// Anywhere else → jump shot.
function chooseShotType(p, driving) {
    if (driving && inClosePaintHalf(p)) return 'dunk';
    if (driving && inPaint(p))          return 'layup';
    if (!driving && inClosePaintHalf(p)) return 'layup';
    if (!driving && inPaint(p)) {
        return Math.random(0.5) > 0.5 ? 'layup' : 'jumper';
    }
    return 'jumper';
}

// Picks the best teammate to receive a flat pass.
// Scores each candidate by three factors:
//   - How closely they match the direction the stick is pointing (directional pass).
//   - How close they are to the rim (gravity toward open cutters).
//   - How far they are from the passer (prefer closer targets, small penalty for distance).
//   - Centers get a small bonus so interior passes are a bit preferred.
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

// Switches player control to whichever teammate is currently closest to the ball.
// Used to quickly grab a loose ball or position yourself for a rebound.
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
