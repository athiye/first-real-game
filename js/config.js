export const VW = 512;
export const VH = 288;
export const DISPLAY_W = 1024;
export const DISPLAY_H = 576;

// Court markings are laid out to true NBA proportions.
// Scale: court width (sideline to sideline) = 50 ft = (bottom - top) = 216 px,
// so 1 ft = 4.32 px. All distances below are that scale measured from the
// baseline (x = left) or the centre line (y = centerY):
//   rim center        5.25 ft from baseline -> 88 + 22.7 = 111
//   backboard         4 ft   from baseline -> 88 + 17.3 = 105
//   free-throw line   19 ft  from baseline -> 88 + 82.1 = 170
//   lane (paint)      16 ft wide           -> +/- 34.6 about centerY = 119..189
//   free-throw circle 6 ft radius          -> 26 (drawn in render)
//   3-pt arc          23.75 ft radius      -> 103
//   restricted arc    4 ft radius          -> 17
//   center circle     6 ft radius          -> 26 (drawn in render)
export const COURT = {
    left: 88,
    right: 500,
    top: 46,
    bottom: 262,
    centerX: 294,
    centerY: 154,
    rim: { x: 111, y: 154 },
    backboardX: 105,
    paintLeft: 88,
    paintRight: 170,
    paintTop: 119,
    paintBottom: 189,
    freeThrowX: 170,
    threeRadius: 103,
    restrictedRadius: 17,
    playableLeft: 98,
    playableRight: 490,
    playableTop: 56,
    playableBottom: 252
};

export const GAME = {
    playerRadius: 5,
    walkSpeed: 76,
    sprintSpeed: 112,
    accel: 660,
    friction: 0.045,
    ballRadius: 4,
    maxChargeTime: 0.37,
    greenCenter: 0.76,
    passDurationMin: 0.15,
    passDurationMax: 0.42,
    lobDuration: 0.72,
    shotBaseDuration: 0.58,
    resetDelay: 0.85
};

export const COLORS = {
    bg0: '#050711',
    crowdBack: '#101629',
    crowdSeat: '#242b43',
    sidelineBlue: '#1e4f91',
    sidelineBlueDark: '#12336b',
    hudInk: '#070914',
    hudBlue: '#203f7c',
    hudBlue2: '#2f62ad',
    hudRed: '#7a2c32',
    hudGold: '#cfa34a',
    ink: '#101521',
    ink2: '#17223b',
    brownInk: '#34221b',
    shadow: '#6a593f',
    wood0: '#e4c27f',
    wood1: '#d5ad68',
    wood2: '#f0d395',
    woodLine: '#b99057',
    line: '#fff2d5',
    lineDim: '#ead9b9',
    paint: '#2d73bb',
    paintDark: '#1d4f8f',
    jersey: '#f7efe0',
    jerseyShade: '#dad5c9',
    blue: '#2d65ad',
    blueDark: '#173762',
    skinLight: '#efc38b',
    skinLightShade: '#be8753',
    skinMed: '#c98959',
    skinMedShade: '#835236',
    skinDark: '#7d5135',
    skinDarkShade: '#3d281e',
    hairBlack: '#11131a',
    hairBrown: '#4c2a1a',
    hairCharcoal: '#2f3441',
    hairNavy: '#0c1628',
    ball: '#c86a36',
    ballDark: '#71351f',
    ballHi: '#ef9a4d',
    white: '#fff8e8',
    gold: '#f4c84d',
    green: '#65e071',
    red: '#d33d3c'
};
