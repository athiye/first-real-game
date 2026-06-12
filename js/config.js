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

    // Passing.
    passDurationMin: 0.15,  // shortest possible pass flight time (idk AI did this)
    passDurationMax: 0.42,  // longest possible pass flight time (idk AI did this)
    lobDuration: 0.76,      // flight duration for lob passes

    shotBaseDuration: 0.58, // base flight time of a jump shot 
    resetDelay: 0.85        // pause after a made basket before reset
};

// Shot difficulty. Variable names intuitive
export const SHOT_ODDS = {
    missChanceOnPerfectShot: 0.10,
    luckyMakeChanceOnBadShot: 0.035,

    // How high jump shots arc (average, there is variation)
    jumperArcHeight: 0.80,

    // Make probability baselines by shot type / range.
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
