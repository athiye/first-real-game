// Look/feel of the game

// Screen size
// The game is drawn on a 512 x 288 pixel art styled canvas, then stretched up to the big visible canvas (1024 x 576) for the pixelated look
export const VW = 512;          // internal drawing width
export const VH = 288;          // internal drawing height
export const DISPLAY_W = 1024;  // stretched width
export const DISPLAY_H = 576;   // stretched height

// Court
// AI STUFF IDK ART LOL
// --------------------
// The court is drawn to true NBA proportions:
//   court width (sideline to sideline) = 50 feet = 216 virtual pixels,
//   so 1 foot = 4.32 pixels. Distances measured from the baseline (left edge)
//   or the center line (centerY):
//     rim center        5.25 ft from baseline -> x = 88 + 22.7 = 111
//     backboard         4 ft   from baseline -> x = 88 + 17.3 = 105
//     free-throw line   19 ft  from baseline -> x = 88 + 82.1 = 170
//     lane (the paint)  16 ft wide           -> y = 119 .. 189
//     3-point arc       23.75 ft radius      -> 103 pixels
//     restricted arc    4 ft radius          -> 17 pixels
export const COURT = {
    // Outer edges of court rectangle
    left: 88,
    right: 500,
    top: 46,
    bottom: 262,

    // Middle of the court
    centerX: 294,
    centerY: 154,

    // Where the basket is
    rim: { x: 111, y: 154 },
    backboardX: 105,

    // The paint
    paintLeft: 88,
    paintRight: 170,
    paintTop: 119,
    paintBottom: 189,
    freeThrowX: 170,

    // 3pt line
    threeRadius: 103,

    // Restricted area i think its called?
    restrictedRadius: 17,

    // Real player + ball boundaries
    playableLeft: 98,
    playableRight: 490,
    playableTop: 56,
    playableBottom: 252
};

// gameplay feel
export const GAME = {
    playerRadius: 5,        // how chunky player is

    walkSpeed: 76,          // normal top speed 
    sprintSpeed: 112,       // top speed while driving 
    accel: 660,             // acceleration
    friction: 0.045,        // how "agile" players are. If smaller, they can come to stops faster

    ballRadius: 4,          // ball size

    // Shooting: you hold the shoot key to fill a meter, then release.
    maxChargeTime: 0.3,    // seconds for the shot meter to fill completely
    greenCenter: 0.73,      // the meter position (0..1) of a PERFECT release
    pumpFakeError: -0.25,   // release at least this early (shotError ≤ this) = a pump fake, not a real shot
    pumpFakeHold: 0.01,     // seconds the ball hangs at the top of a pump fake before it drops
    pumpFakeDown: 0.05,     // seconds for the ball to drop from the top of the fake back to a hold
    idleHoldHeight: 1,      // how high the ball sits while just holding it (before dribbling); higher = higher

    // Passing.
    passDurationMin: 0.15,  // shortest possible pass flight time (idk AI did this)
    passDurationMax: 0.42,  // longest possible pass flight time (idk AI did this)

    shotBaseDuration: 0.58, // base flight time of a jump shot
    resetDelay: 0.85,       // pause after a made basket before reset

    // Stepback: how hard the ball handler explodes away from the hoop.
    stepbackForce: 230,

    // Defender block lunge. When the defender presses block they leap toward the
    // ball; how far they travel depends on their momentum at that moment:
    //   lunge speed = blockLungeBase + blockLungeMomentum * (how fast they were
    //                 already moving toward the ball, as a fraction of sprint speed)
    // ...floored at blockLungeMin so a defender running the wrong way still twitches.
    blockLungeBase: 30,      // lunge speed from a dead standstill
    blockLungeMomentum: 60,  // bonus lunge speed when already sprinting at the ball
    blockLungeMin: 18,       // lowest possible lunge speed (used when moving away)
    blockDuration: 0.3,      // how long the committed block lunge lasts
    contestAngleThreshold: 0.1,
    angleFactor: 1.2,

    // Floater / stepback arc tuning.
    // If the shooter's x-speed toward the basket exceeds this (px/s), the shot
    // becomes a floater: arc goes higher and contest is halved.
    floaterSpeedThreshold: 40,
    floaterArcScale: 1.55,      // arc multiplier for floaters
    // When stepping back, arc flattens by up to this fraction at full sprint speed.
    stepbackArcFlattenMax: 0.35
};

// Shot difficulty. Variable names intuitive
export const SHOT_ODDS = {
    missChanceOnPerfectShot: 0.10,
    luckyMakeChanceOnBadShot: 0.035,

    // How high jump shots arc (average, there is variation)
    jumperArcHeight: 0.80,

    // Make probabilities for perfect shots
    dunkPerfectMakeChance: 0.95,
    layupPerfectMakeChance: 0.985,
    closeJumpPerfectMakeChance: 0.90,
    threePointPerfectMakeChance: 0.56,
    jumpPerfectMakeChance: 0.74,

    // Timing windows for release mistiming effects.
    dunkTimingWindow: 0.22,
    layupTimingWindow: 0.16,
    closeJumpTimingWindow: 0.12,
    threePointTimingWindow: 0.08,
    jumpTimingWindow: 0.10,

    // How badly movement hurts shot accuracy.
    movePenaltySpeedDivisor: 500,
    movePenaltyMax: 0.10,
    movePenaltyScale: 0.75,

    // Make chance bounds for shot outcomes.
    perfectOnTargetMin: 0.02,
    makeChanceMin: 0.005,
    makeChanceMax: 0.99,
    makeChanceMaxDunk: 0.995,
    makeNoiseVariance: 0.012,

    // Layup specific make curve.
    layupFalloffRange: 0.26,
    layupFalloffPenalty: 0.80,
    layupMinMakeChance: 0.05,
    layupMaxMakeChance: 0.99,

    // Shot duration / timing tuning.
    dunkDuration: 0.30,
    layupDuration: 0.36,
    timingMistimeOffset: 0.08,
    timingMistimeScale: 0.32,
    timingScoreRange: 0.30,

    // Shot range falloff factors.
    closeShotFalloffRange: 0.26,
    threePointFalloffRange: 0.18,
    normalShotFalloffRange: 0.22,
    threePointBailoutScale: 0.72,
    closeShotBailoutScale: 1.25,
    normalShotBailoutScale: 1.00,

    // Style selection probabilities.
    layupMakeBankChance: 0.72,
    layupMakeRimChance: 0.93,
    layupMissBankChance: 0.56,
    layupMissRimChance: 0.88,
    overshotMakeBankChance: 0.44,
    overshotMakeRimChance: 0.78,
    shortMakeRimChance: 0.58,
    shortMakeSwishChance: 0.90,
    normalMakeSwishChance: 0.62,
    normalMakeRimChance: 0.86,
    overshotMissBankChance: 0.46,
    overshotMissRimChance: 0.88,
    shortMissRimChance: 0.72,
    shortMissMissChance: 0.94,
    normalMissRimChance: 0.68,
    normalMissBankChance: 0.82,

    // Triangle shot variation constants.
    shotArcNoise: 0.10,
    shotArcMin: 0.35,
    shotArcMax: 1.25,

    // Goal target variation.
    sideNoiseBase: 2.0,
    sideNoiseErrorScale: 13,
    sideNoiseThreeBonus: 2.5,
    sideNoiseTargetNoiseScale: 0.12,
    accErrorPowerBiasDivisor: 0.28,

    // Decision probabilities.
    shortRimSideChoiceChance: 0.62,
    rimBackSideChoiceChance: 0.40,
    layupSideChoiceChance: 0.50,
    teammateCutToRimChance: 0.44
};

// ============================================================
//  2K-STYLE SHOT RESOLUTION — every number here is adjustable.
// ------------------------------------------------------------
//  The make chance is ONE smooth regression on the release-timing error:
//
//      make = floor + (ceiling - floor) * exp( -((|err| - PERFECT) / width) ^ makeShape )
//
//  Only two things change per shot, and BOTH come from the same place for every shot type:
//    width   = how forgiving the timing is  (clean/close/open -> wide, contested/moving/deep -> narrow)
//    ceiling = the make at a perfect release (~1 from the rim out past the arc, capped only when deep)
//  So a three is just this curve at 101px; midrange / layup / dunk / floater are the SAME curve with a
//  wider width (they're closer / cleaner) — every shot type is derived off the same regression, no
//  per-type make tables. Tune the three and everything else moves with it.
//
//  shotError units match (charge01 - greenCenter): 0 = ideal release,
//  negative = too early (short), positive = too late (long).
// ============================================================
export const SHOT_MODEL = {
    // --- The regression itself ---
    PERFECT:     0.008,  // dead-center half-width: a guaranteed make (tiny flat top before the smooth rolloff)
    perfectMake: 1.00,   // ceiling: make at a perfect release on a clean look
    floorMake:   0.01,   // a heave is never truly 0%: every shot keeps at least this make chance
    makeShape:   1.25,   // rolloff shape (higher = rounder top then bricks faster; lower = longer shallow tail)

    // --- Width: the timing forgiveness. Closer shots are FAR more forgiving (error matters less),
    //     which is what makes a layup easier than a midrange easier than a three at the same contest.
    //     widthByDistanceAnchors is the CLEAN (cleanliness = 1) width at each distance, piecewise-linear
    //     (a smooth regression). The ~101px anchor is the tuned three — leave it to keep the three intact;
    //     raise the close anchors to make close shots easier. A bad look shrinks the width toward the floor.
    //     Sorted by px. ---
    widthByDistanceAnchors: [
        [0,   0.260],   // point-blank: very forgiving timing
        [20,  0.200],
        [40,  0.150],
        [57,  0.115],   // free-throw / short midrange
        [101, 0.074],   // THREE — matches the tuned three; every other distance scales off this
        [140, 0.055],   // deep
        [184, 0.040]    // half court: very tight
    ],
    baselineDist:     101,  // px treated as "the three" — the fixed pivot the forgiveness scales around
    closeForgiveness: 1.0,  // how much MORE forgiving shots get closer than the three (the dial you asked for):
                            //   1 = the anchors as-is, >1 = close shots easier & far shots tighter, 0 = flat
                            //   (everything pivots on baselineDist, so the three NEVER changes)
    cleanWidthFloor: 0.50, // a totally bad look (cleanliness 0) keeps this fraction of the clean width
    goodWidthFrac:   1.00, // |err| within PERFECT + width*this still reads "on time" (visual styling only)

    // --- Cleanliness: how open & controlled the look is (sets window width + green make rate) ---
    contestBiteNear:    0.5,  // contest bites this hard at the rim
    contestBiteFar:     0.3,  // contest bites this little far away
    contestBiteDist:    120,   // px over which contestBite eases from near -> far
    moveDeadzone:       0.15,  // movement below this fraction of top speed is ignored
    floaterContestMult: 1.0,   // extra contest reduction for floaters (state.lastContest is already halved upstream)

    // --- Per shot type. shotType is one of: jumpShot | layup | dunk | floater ---
    typeClean:   { jumpShot: 1.00, layup: 1.00, dunk: 1.00, floater: 0.85 }, // inherent quality cap (floaters < 1)
    movePenalty: { jumpShot: 1.00, layup: 0.15, dunk: 0.05, floater: 0.65 }, // how much movement hurts the look
    // --- Live shot-meter speed. Contest and movement each speed the meter up (a faster meter is a
    //     shorter, harder-to-time window). Each value is the meter SPEED MULTIPLIER at its 100%
    //     endpoint: 1.0 = no change (the base), 2.0 = meter runs twice as fast at that extreme,
    //     0.5 = half speed (slower / easier). The 0% -> 100% ramp is linear (you give the endpoint,
    //     the in-between points are interpolated), and the two combine by multiplying. At the default
    //     1.0 / 1.0 the meter takes exactly GAME.maxChargeTime regardless of contest/movement. ---
    contestMeterSpeedup: 1.4,  // meter speed at 100% contest        (e.g. 1.5 = 50% faster when smothered)
    moveMeterSpeedup:    1.2,  // meter speed at full-speed movement (e.g. 2.0 = twice as fast on the run)

    // --- Defender block (only while the defender is mid block-lunge) ---
    //   Near the rim:  barely lowers the make, but a decent chance to swat it outright.
    //   Far from rim:  can't reach to swat, but pressures the make % down more.
    //   Everything also scales with contest and how mistimed the shot was (a clean green
    //   release is much harder to block than a bricked one).
    block: {
        fadeDist:         110,  // px: swat chance fades to ~0 by here; make-pressure grows to full past here
        maxBlockChance:   0.45, // swat chance at the rim, full contest, badly-timed shot
        maxMakeReduction: 0.65, // most the make % is cut, far out, full contest, badly-timed shot
        vulnFloor:        0.25, // a perfectly-timed shot still keeps this fraction of block vulnerability
        vulnRange:        0.12, // shotError at/above which a shot is fully block-vulnerable (perfect = vulnFloor)
        // Knock-away: when a shot is swatted, the ball is flung loose from the block point.
        knockSpeedMin:    95,   // weakest swat fling (px/s) — friction is heavy, so keep these punchy
        knockSpeedMax:    165,  // hardest swat fling (px/s)
        knockUpMin:       26,   // smallest upward pop on the swat
        knockUpMax:       52,   // largest upward pop on the swat
        knockSpread:      0.5   // max random fling angle off the swat direction (radians)
    },

    // --- Ceiling by distance: the make at a PERFECT release (px -> 0..1), piecewise-linear.
    //     ~1 from the rim out past the three; only deep shots cap a perfect release below 100%.
    //     Anchors: [rim, three≈101/110, deep, half-court≈184, heave]. Keep sorted by px. ---
    rangeCeilingAnchors: [
        [0,   1.00],
        [110, 1.00],   // out to the arc, a perfect release is automatic
        [150, 0.82],
        [184, 0.55],   // half court: even perfect timing is a heave
        [260, 0.18]
    ]
};

// colors (AI stuff, idk any of this)
export const COLORS = {
    bg0: '#050711',          // page / letterbox background

    // Arena crowd.
    crowdBack: '#101629',
    crowdSeat: '#242b43',

    // Scoreboard (HUD) panels at the top of the screen.
    hudInk: '#070914',
    hudBlue: '#203f7c',
    hudBlue2: '#2f62ad',
    hudRed: '#7a2c32',
    hudGold: '#cfa34a',

    // Dark outline colors.
    ink: '#101521',
    ink2: '#17223b',
    brownInk: '#34221b',
    shadow: '#6a593f',

    // Court floorboards.
    wood0: '#e4c27f',
    wood1: '#d5ad68',
    wood2: '#f0d395',
    woodLine: '#b99057',

    // Painted court lines.
    line: '#fff2d5',
    lineDim: '#ead9b9',

    // The blue painted lane under the basket.
    paint: '#2d73bb',
    paintDark: '#1d4f8f',

    // Home team uniform.
    jersey: '#f7efe0',
    jerseyShade: '#d5c5a4',
    blue: '#2d65ad',
    blueDark: '#173762',

    // Player skin tones (3 shades, each with a darker shadow version).
    skinLight: '#efc38b',
    skinLightShade: '#be8753',
    skinMed: '#c98959',
    skinMedShade: '#835236',
    skinDark: '#7d5135',
    skinDarkShade: '#3d281e',

    // Hair colors.
    hairBlack: '#11131a',
    hairBrown: '#4c2a1a',
    hairCharcoal: '#2f3441',
    hairNavy: '#0c1628',

    // The basketball.
    ball: '#c86a36',
    ballDark: '#71351f',
    ballHi: '#ef9a4d',

    // General-purpose UI colors.
    white: '#fff8e8',
    gold: '#f4c84d',
    green: '#65e071',
    red: '#d33d3c'
};



/*

First, get the distance between shooter and defender as well as defender's angle to shooter relative to the hoop.
    - first, take absolute value of angle because side doesn't matter. Then, 
    - 0 -> 1, pi/4 -> 0.5 or smth, pi/2 -> 0
    - if (angle == +- contestAngleThreshold)
    - (pi/2 - abs(angle)) / (pi/2)
    - 
Then, have some scalar to 
multiply that by or something. Straight on should be 1, and directly perpendicular should be 0. Anything +- 20 degrees of straight on should keep being 1, 
then it should just be a linear function to perpendicular. Multiply this by the shot contest value to get the real shot contest value. 

export function contestFromDistance(distance, angle) {
    

}

How to get defender angle to shooter? 





*/