import { VW, VH, DISPLAY_W, DISPLAY_H, COURT, GAME, COLORS } from './config.js';
import { clamp, lerp } from './math.js';

// all AI stuff for art dw about it

export class Renderer {
    canvas;
    screen;
    buffer;
    ctx;
    topScale = 0.88;
    courtScreenCenterY = 154;

    constructor(canvas) {
        this.canvas = canvas;
        this.canvas.width = DISPLAY_W;
        this.canvas.height = DISPLAY_H;
        const screen = canvas.getContext('2d');
        if (!screen) throw new Error('Canvas unavailable');
        this.screen = screen;
        this.buffer = document.createElement('canvas');
        this.buffer.width = VW;
        this.buffer.height = VH;
        const ctx = this.buffer.getContext('2d');
        if (!ctx) throw new Error('Buffer unavailable');
        this.ctx = ctx;
        this.ctx.imageSmoothingEnabled = false;
        this.screen.imageSmoothingEnabled = false;
    }

    draw(state) {
        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, VW, VH);
        const shake = state.screenShake > 0
            ? Math.round(Math.sin(performance.now() * 0.06) * state.screenShake * 3)
            : 0;
        ctx.translate(shake, 0);
        this.drawArena();
        this.drawCourt(state);
        this.drawHoopBack();
        this.drawPlayerMarker(state);
        this.drawPlayers(state);
        this.drawBall(state.ball);
        this.drawHoopFront(state);
        if (state.paused) this.drawPause();
        ctx.restore();
        this.screen.save();
        this.screen.imageSmoothingEnabled = false;
        this.screen.fillStyle = COLORS.bg0;
        this.screen.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
        this.screen.drawImage(this.buffer, 0, 0, DISPLAY_W, DISPLAY_H);
        this.screen.restore();
        // Draw the HUD last, straight onto the full-resolution screen canvas so its
        // text renders crisp instead of being scaled up from the chunky pixel buffer.
        this.drawHud(state);
    }

    px(x, y, w, h, color) {
        if (color) this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    text(text, x, y, color, size = 6, align = 'center') {
        const ctx = this.ctx;
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px monospace`;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, Math.round(x), Math.round(y));
    }

    project(x, y, z = 0) {
        const yFromCenter = y - COURT.centerY;
        const zScale = 1.08 + (1 - this.topScale) * 0.35;
        return {
            x,
            y: this.courtScreenCenterY + yFromCenter * this.topScale - z * zScale
        };
    }

    polygon(points, fill, stroke, lineWidth = 2) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
    }

    polyline(points, stroke, lineWidth = 2, dash = []) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();
    }

    projectedRect(left, top, right, bottom) {
        return [
            this.project(left, top),
            this.project(right, top),
            this.project(right, bottom),
            this.project(left, bottom)
        ];
    }

    projectedArc(cx, cy, r, a0, a1, steps = 56) {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const t = a0 + (a1 - a0) * (i / steps);
            pts.push(this.project(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
        }
        return pts;
    }

    drawArena() {
        this.px(0, 0, VW, VH, COLORS.crowdBack);
        this.px(0, 31, VW, 26, '#25314a');
        this.px(0, COURT.bottom - 2, VW, VH - (COURT.bottom - 2), '#1d2740');
        this.px(0, COURT.top, 88, COURT.bottom - COURT.top, '#a93b37');
        this.px(0, COURT.top, 16, COURT.bottom - COURT.top, '#8d2928');
        for (let row = 0; row < 15; row++) {
            const y = COURT.top + 8 + row * 12;
            for (let col = 0; col < 4; col++) {
                const x = 8 + col * 12 + (row % 2) * 2;
                const shirt = ['#202737', '#41547f', '#dbc592', '#703040'][((row * 3) + col) % 4] ?? '#202737';
                const skin  = ['#d59b68', '#83553a', '#efc286'][(row + col) % 3] ?? '#d59b68';
                this.px(x, y + 4, 6, 5, shirt);
                this.px(x + 1, y + 1, 4, 4, skin);
            }
            if (row % 3 === 1) {
                this.px(58, y + 2, 8, 6, '#10141f');
                this.px(60, y + 3, 3, 4, '#3b475f');
            }
        }
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 52; i++) {
                const x = 8 + i * 9 + (row % 2) * 2;
                const y = 34 + row * 7;
                const shirt = ['#314d86', '#dbc592', '#7b2f44', '#4a785f', '#d09a48', '#5f6a8b'][i % 6] ?? '#314d86';
                const skin  = ['#d59b68', '#83553a', '#efc286'][i % 3] ?? '#d59b68';
                this.px(x, y + 3, 5, 4, shirt);
                this.px(x + 1, y, 3, 3, skin);
            }
        }
        for (let i = 0; i < 10; i++) {
            this.px(188 + i * 10, 40, 8, 5, '#1f2740');
            this.px(189 + i * 10, 41, 6, 3, '#65748f');
        }
        for (let i = 0; i < 7; i++) {
            this.px(334 + i * 8, 39, 5, 5, '#314d86');
            this.px(335 + i * 8, 36, 3, 3, ['#d59b68', '#83553a', '#efc286'][i % 3] ?? '#d59b68');
        }
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 50; i++) {
                const x = 96 + i * 8 + (row % 2) * 2;
                const y = COURT.bottom + 4 + row * 8;
                const shirt = ['#314d86', '#dbc592', '#7b2f44', '#4a785f', '#d09a48', '#5f6a8b'][i % 6] ?? '#314d86';
                const skin  = ['#d59b68', '#83553a', '#efc286'][i % 3] ?? '#d59b68';
                this.px(x, y + 4, 4, 4, shirt);
                this.px(x + 1, y + 1, 2, 2, skin);
            }
        }
        // removed arena text
        const ctx = this.ctx;
        // removed vertical arena text
    }

    drawCourt(state) {
        const outer = this.projectedRect(COURT.left, COURT.top, COURT.right, COURT.bottom);
        this.polygon(this.projectedRect(COURT.left - 3, COURT.top - 3, COURT.right + 3, COURT.bottom + 3), '#7c2431');
        this.polygon(outer, COLORS.wood0, COLORS.line, 2);
        for (let y = COURT.top; y < COURT.bottom; y += 14) {
            const line = [this.project(COURT.left, y), this.project(COURT.right, y)];
            this.polyline(line, y % 28 === 0 ? COLORS.wood2 : COLORS.wood1, 2);
        }
        for (let y = COURT.top + 4; y < COURT.bottom; y += 28) {
            for (let x = COURT.left + 22; x < COURT.right - 12; x += 54) {
                const top = this.project(x + (((y - COURT.top) / 28) % 2) * 18, y + 1);
                const bot = this.project(x + (((y - COURT.top) / 28) % 2) * 18, y + 9);
                this.polyline([top, bot], COLORS.woodLine, 1);
            }
        }
        this.polyline([this.project(COURT.centerX, COURT.top), this.project(COURT.centerX, COURT.bottom)], COLORS.line, 2);
        this.polyline(this.projectedArc(COURT.centerX, COURT.centerY, 26, 0, Math.PI * 2, 72), COLORS.line, 2);
        this.polygon(this.projectedRect(COURT.paintLeft, COURT.paintTop, COURT.paintRight, COURT.paintBottom), COLORS.paint, COLORS.line, 2);
        this.polygon(this.projectedRect(COURT.paintLeft, COURT.paintTop, COURT.paintLeft + 8, COURT.paintBottom), COLORS.paintDark);
        this.polyline(this.projectedArc(COURT.freeThrowX, COURT.centerY, 26, -Math.PI / 2, Math.PI / 2, 36), COLORS.line, 2);
        this.polyline(this.projectedArc(COURT.freeThrowX, COURT.centerY, 26, Math.PI / 2, Math.PI * 1.5, 36), COLORS.line, 2, [4, 4]);
        // 3PT arc: a true 23.75 ft circle around the rim; the corner join stays tangent.
        const feetPerPx = (COURT.bottom - COURT.top) / 50;
        const cornerDistFt = 22;
        const radiusFt = 23.75;
        const rx = radiusFt * feetPerPx;
        const ry = radiusFt * feetPerPx;
        const cornerOffsetY = cornerDistFt * feetPerPx;
        const topCornerY = COURT.centerY - cornerOffsetY;
        const bottomCornerY = COURT.centerY + cornerOffsetY;
        const joinAngle = Math.asin(Math.min(0.999, cornerDistFt / radiusFt));
        const joinX = COURT.rim.x + Math.cos(joinAngle) * rx;
        this.polyline([this.project(COURT.left, topCornerY), this.project(joinX, topCornerY)], COLORS.line, 2);
        const threePts = [];
        const steps = 88;
        for (let i = 0; i <= steps; i++) {
            const a = -joinAngle + (2 * joinAngle) * (i / steps);
            const x = COURT.rim.x + Math.cos(a) * rx;
            const y = COURT.rim.y + Math.sin(a) * ry;
            threePts.push(this.project(x, y));
        }
        this.polyline(threePts, COLORS.line, 2);
        this.polyline([this.project(joinX, bottomCornerY), this.project(COURT.left, bottomCornerY)], COLORS.line, 2);
        this.polyline(this.projectedArc(COURT.rim.x, COURT.rim.y, COURT.restrictedRadius, -Math.PI / 2, Math.PI / 2, 28), COLORS.line, 2);
        const mp  = this.project(398, 153);
        const lab = this.project(398, 175);
        const tr  = this.project(395, 238);
        this.text('HI', mp.x, mp.y, '#2c63aa', 30);
        this.text('HAVE FUN!', lab.x, lab.y, '#2c63aa', 13);
        this.text('COOL GAME', tr.x, tr.y, '#b84a3b', 10);
    }

    drawHoopBack() {
        const rim = this.project(COURT.rim.x, COURT.rim.y);
        const lift = 12;
        this.px(rim.x - 29, rim.y - 21 - lift, 16, 34, '#223152');
        this.px(rim.x - 34, rim.y - 11 - lift, 12, 15, '#192136');
        this.px(rim.x - 21, rim.y - 14 - lift, 14, 5, '#d6ecfb');
        this.px(rim.x - 19, rim.y - 11 - lift, 4, 22, COLORS.ink);
        this.px(rim.x - 13, rim.y -  5 - lift, 15, 4, COLORS.brownInk);
        this.px(rim.x - 12, rim.y -  4 - lift, 12, 2, '#b88741');
    }

    drawHoopFront(state) {
        const ctx = this.ctx;
        const rim = this.project(COURT.rim.x, COURT.rim.y);
        const lift = 12;
        const t = clamp(state.netTimer / 0.48, 0, 1);
        const sway = state.netSide * Math.sin((1 - t) * 8.5) * t * 4;
        const stretch = t * 6;
        ctx.save();
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rim.x + 2, rim.y - lift, 8, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = COLORS.red;
        ctx.beginPath();
        ctx.ellipse(rim.x + 2, rim.y - lift, 7, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 1;
        const anchors = [-4, 0, 4];
        for (const i of anchors) {
            ctx.beginPath();
            ctx.moveTo(rim.x + i + 2, rim.y + 3 - lift);
            ctx.lineTo(rim.x + Math.round(i * 0.4 + sway), rim.y + 10 - lift + stretch);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(rim.x - 4 + sway, rim.y + 10 - lift + stretch);
        ctx.lineTo(rim.x + 8 + sway, rim.y + 10 - lift + stretch);
        ctx.stroke();
        ctx.restore();
    }

    // Drawn directly on the full-resolution screen canvas (not the pixel-art buffer),
    // so the text is sharp and easy to read. Layout coordinates are still expressed in
    // buffer space and scaled up by S, so the HUD lines up with the game exactly as before.
    drawHud(state) {
        const ctx = this.screen;
        const S = DISPLAY_W / VW; // buffer -> screen scale (2x)
        // Local helpers that draw in buffer coordinates but onto the hi-res screen.
        const rect = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * S, y * S, w * S, h * S);
        };
        const outline = (x, y, w, h, fill, line = COLORS.ink) => {
            rect(x - 1, y - 1, w + 2, h + 2, line);
            rect(x, y, w, h, fill);
        };
        const text = (str, x, y, color, size, align = 'center') => {
            ctx.fillStyle = color;
            ctx.font = `bold ${size * S}px ui-monospace, Menlo, Consolas, monospace`;
            ctx.textAlign = align;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(str, x * S, y * S);
        };

        ctx.save();
        // Top scoreboard bar and its panels.
        rect(0, 0, VW, 31, COLORS.hudInk);
        outline(3, 6, 70, 18, COLORS.hudRed);
        outline(76, 6, 115, 18, COLORS.hudBlue);
        outline(194, 6, 70, 18, COLORS.hudRed);
        outline(268, 6, 74, 18, '#1d2440');
        outline(346, 6, 75, 18, '#18213b'); 
        outline (426, 6, 81, 18, '#26654f');
        text(`MAKE ${String(state.makes).padStart(2, '0')}`, 38, 19, COLORS.white, 8);
        text('COOL GAME', 133, 19, COLORS.white, 8);
        text(`STK ${state.streak}`, 229, 19, COLORS.white, 8);
        const pct = state.attempts === 0 ? 0 : Math.round((state.makes / state.attempts) * 100);
        text(`MAKE% ${Math.round(state.lastMakeChance * 100)}`, 305, 19, COLORS.white, 7);
        text(`SHOT ERROR  ${state.lastShotError}`, 384, 19, COLORS.white, 6);
        text(`CONTEST ${Math.round(state.lastContest)}%`, 467, 19, COLORS.white, 8); 
        rect(146, 26, 72, 3, COLORS.hudBlue2);
        text('PRACTICE GYM', 182, 29, COLORS.white, 4);
        // Center message banner (with a dark drop shadow for legibility)
        if (state.message.ttl > 0) {
            text(state.message.text, VW / 2 + 1, 49 + 1, COLORS.ink, 11);
            text(state.message.text, VW / 2, 49, COLORS.gold, 11);
        }
        ctx.restore();
    }

    drawPlayerMarker(state) {
        const p = state.players.find(player => player.controlled);
        const pulse = 0.65 + Math.sin(performance.now() * 0.008) * 0.22;
        const ctx = this.ctx;
        if (p) {
            const pos = this.project(p.x, p.y);
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = COLORS.gold;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(Math.round(pos.x), Math.round(pos.y + 2), 7, 3, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        const dpos = this.project(state.defender.x, state.defender.y);
        ctx.save();
        ctx.globalAlpha = pulse * 0.85;
        ctx.strokeStyle = COLORS.red;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(Math.round(dpos.x), Math.round(dpos.y + 2), 7, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawPlayers(state) {
        const players = [...state.players, state.defender].sort((a, b) => a.y - b.y);
        for (const p of players) this.drawPlayer(p, state);
    }

    skin(index) {
        if (index === 0) return { base: COLORS.skinLight, shade: COLORS.skinLightShade, hi: '#f7d6a1' };
        if (index === 1) return { base: COLORS.skinMed,   shade: COLORS.skinMedShade,   hi: '#dfa06d' };
        return                 { base: COLORS.skinDark,   shade: COLORS.skinDarkShade,  hi: '#a36d49' };
    }

    hair(index) {
        if (index === 0) return COLORS.hairBlack;
        if (index === 1) return COLORS.hairBrown;
        if (index === 2) return COLORS.hairCharcoal;
        return COLORS.hairNavy;
    }

    drawTinyHair(style, x, y, color) {
        if (style === 0) {
            this.px(x, y, 6, 2, color);
            this.px(x - 1, y + 1, 8, 2, color);
        } else if (style === 1) {
            this.px(x - 1, y - 1, 8, 3, color);
            this.px(x + 1, y - 3, 4, 2, color);
        } else if (style === 2) {
            this.px(x - 1, y - 1, 3, 4, color);
            this.px(x + 4, y - 1, 3, 4, color);
            this.px(x + 1, y - 2, 4, 2, color);
        } else {
            this.px(x - 1, y - 2, 8, 3, color);
            this.px(x - 2, y,     2, 4, color);
            this.px(x + 6, y,     2, 4, color);
        }
    }

    drawPlayer(p, state) {
        const ctx = this.ctx;
        const speed = Math.hypot(p.vx, p.vy);
        const moving = clamp(speed / GAME.sprintSpeed, 0, 1);
        const dir = p.facingX >= 0 ? 1 : -1;
        const runWave  = Math.sin(p.anim * 13);
        const runWave2 = Math.sin(p.anim * 13 + Math.PI);
        const bounceWave = Math.sin(p.anim * 8);
        const charge  = state.shotCharge?.playerId === p.id
            ? clamp(state.shotCharge.elapsed / (state.shotCharge.fillTime || GAME.maxChargeTime), 0, 1)
            : 0;
        const actionT = p.actionDuration <= 0 ? 1 : clamp(p.actionElapsed / p.actionDuration, 0, 1);
        const skin = this.skin(p.skin);
        const hair = this.hair(p.hair);
        const jersey      = p.team === 'away' ? COLORS.hudRed  : COLORS.jersey;
        const jerseyShade = p.team === 'away' ? '#53222b'       : COLORS.jerseyShade;
        const trim        = p.team === 'away' ? '#f0d395'       : COLORS.blue;
        const trimDark    = p.team === 'away' ? '#311722'       : COLORS.blueDark;
        let bodyBob    = Math.round(runWave * moving * 0.25);
        let jump       = 0;
        let torsoShift = Math.round((p.facingX < 0 ? -1 : 1) * moving * 0.2);
        let armL       = Math.round(runWave2 * moving);
        let armR       = Math.round(runWave  * moving);
        let footL      = Math.round(runWave  * moving);
        let footR      = Math.round(runWave2 * moving);
        let armRaise   = 0;
        let torsoLean  = 0;
        if (p.hasBall && (p.animState === 'dribble')) {
            bodyBob += bounceWave > 0 ? 0 : 1;
            armL += bounceWave > 0 ? 1 : -1;
            armR += bounceWave > 0 ? -1 : 1;
        }
        if (p.animState === 'stepback') {
            torsoShift -= Math.round(4 * Math.sin(actionT * Math.PI));
            torsoLean  -= dir;
            footL -= 1;
            footR += 1;
        }
        if (charge > 0) {
            const shot = state.shotCharge?.playerId === p.id ? state.shotCharge : null;
            if (shot?.shotType === 'layup') {
                armRaise = 7;
                jump = 1 + Math.round(Math.sin(charge * Math.PI) * 4);
                torsoLean = dir;
            } else if (shot?.shotType === 'dunk') {
                armRaise = 13;
                const lift = Math.sin(charge * Math.PI);
                jump = 7 + Math.round(lift * 10);
                torsoLean = dir * 2;
            } else {
                armRaise = Math.round(lerp(4, 8, charge));
                const lift = Math.sin(Math.PI * clamp(charge * 0.9, 0, 1));
                jump = 2 + Math.round(lift * 5);
                torsoLean = dir;
            }
            footL = 0;
            footR = 0;
        } else if (p.animState === 'drive') {
            const gather = Math.sin(actionT * Math.PI);
            torsoLean = dir;
            bodyBob -= Math.round(gather * 0.3);
            armL = 0;
            armR = 0;
            footL += Math.round(Math.sin(actionT * Math.PI * 2) * 0.4);
            footR += Math.round(Math.sin(actionT * Math.PI * 2 + Math.PI) * 0.4);
        } else if (p.animState === 'turnshot') {
            armRaise = 3 + Math.round(actionT * 2);
            torsoLean = dir;
            jump = Math.round(Math.sin(actionT * Math.PI) * 1.5);
            footL = 0;
            footR = 0;
        } else if (p.animState === 'shoot') {
            armRaise = 6;
            jump = Math.round(Math.sin(actionT * Math.PI) * 3);
            footL = 0;
            footR = 0;
        } else if (p.animState === 'layup') {
            armRaise = 7;
            jump = 1 + Math.round(Math.sin(actionT * Math.PI) * 4);
            torsoLean = dir;
        } else if (p.animState === 'dunk') {
            armRaise = 13;
            const dunkLift = Math.sin(Math.PI * clamp(actionT * 0.9, 0, 1));
            jump = 7 + Math.round(dunkLift * 10);
            torsoLean = dir * 2;
            footL = 0;
            footR = 0;
        } else if (p.animState === 'block') {
            armRaise = 10;
            const blockLift = Math.sin(Math.PI * clamp(actionT * 0.92, 0, 1));
            jump = 3 + Math.round(blockLift * 7);
            torsoLean = dir;
            footL = 0;
            footR = 0;
        } else if (p.animState === 'pass') {
            torsoLean = dir;
            armL = -1;
            armR = -1;
        } else if (p.animState === 'catch') {
            armL = 0;
            armR = 0;
            bodyBob -= 1;
        } else if (p.animState === 'celebrate') {
            armRaise = 6;
            jump = Math.round(Math.sin(p.anim * 12) * 1.0 + 1.0);
            footL = 0;
            footR = 0;
        }
        const pos = this.project(p.x, p.y, jump);
        const x = Math.round(pos.x);
        const y = Math.round(pos.y + bodyBob);
        ctx.save();
        ctx.translate(x, y);
        if (dir > 0) ctx.scale(-1, 1);
        ctx.save();
        ctx.globalAlpha = clamp(0.32 - jump * 0.025, 0.14, 0.32);
        this.px(-4, 2 + jump, 8, 2, COLORS.ink);
        ctx.restore();
        this.px(-4 + footL, 0, 3, 2, '#202737');
        this.px( 1 + footR, 0, 3, 2, '#202737');
        this.px(-4 + footL, 1, 3, 1, COLORS.white);
        this.px( 1 + footR, 1, 3, 1, COLORS.white);
        this.px(-5 + torsoShift, -4, 10, 3, COLORS.ink);
        this.px(-4 + torsoShift, -4,  8, 2, trimDark);
        this.px(-5 + torsoShift + torsoLean, -12, 10, 8, COLORS.ink);
        this.px(-4 + torsoShift + torsoLean, -11,  8, 6, jersey);
        this.px(-4 + torsoShift + torsoLean, -11,  8, 1, trim);
        this.px(-4 + torsoShift + torsoLean,  -6,  8, 1, trimDark);
        this.px( 2 + torsoShift + torsoLean, -10,  1, 2, '#d05a4e');
        this.px( 1 + torsoShift + torsoLean, -10,  1, 2, '#456fb6');
        const raised = armRaise > 0;
        if (raised) {
            if (p.animState === 'block') {
                this.px(-7 + torsoShift, -12 - Math.round(armRaise * 0.7), 2, 7, skin.shade);
                this.px( 5 + torsoShift, -12 - armRaise, 2, 8, skin.base);
                this.px(-7 + torsoShift, -14 - Math.round(armRaise * 0.7), 3, 2, skin.hi);
                this.px( 4 + torsoShift, -14 - armRaise, 3, 2, skin.hi);
            } else if (p.animState === 'dunk') {
                this.px(-6 + torsoShift + torsoLean, -15 - armRaise, 2, 10, skin.shade);
                this.px( 4 + torsoShift + torsoLean, -15 - armRaise, 2, 10, skin.base);
                this.px(-6 + torsoShift + torsoLean, -17 - armRaise, 3, 2, skin.hi);
                this.px( 3 + torsoShift + torsoLean, -17 - armRaise, 3, 2, skin.hi);
            } else {
                this.px(-7 + torsoShift, -10 - Math.round(armRaise * 0.25), 2, 5, skin.shade);
                this.px( 5 + torsoShift, -11 - armRaise, 2, 6, skin.base);
            }
        } else if (p.animState === 'pass') {
            this.px(-7 + torsoShift, -9, 3, 2, skin.shade);
            this.px( 5 + torsoShift, -9, 3, 2, skin.base);
        } else {
            this.px(-7 + torsoShift, -10 + armL, 2, 5, skin.shade);
            this.px( 5 + torsoShift, -10 + armR, 2, 5, skin.base);
        }
        this.px(-4 + torsoShift + torsoLean, -18, 8, 7, COLORS.ink);
        this.px(-3 + torsoShift + torsoLean, -17, 6, 5, skin.base);
        this.px(-3 + torsoShift + torsoLean, -19, 6, 2, hair);
        this.px(-1 + torsoShift + torsoLean, -15, 1, 1, COLORS.ink);
        this.px( 1 + torsoShift + torsoLean, -15, 1, 1, COLORS.ink);
        ctx.restore();
        if (p.controlled)   this.drawStamina(pos, p.stamina);
        if (p.controlled && p.pivotLocked) this.text('PIVOT', pos.x, pos.y + 13, COLORS.gold, 5);
        if (charge > 0)     this.drawShotMeter(pos, charge);
    }

    drawStamina(pos, stamina) {
        const x = Math.round(pos.x - 7);
        const y = Math.round(pos.y + 6);
        this.px(x, y, 14, 3, COLORS.ink);
        this.px(x + 1, y + 1, Math.round(12 * stamina), 1, stamina > 0.28 ? COLORS.green : COLORS.red);
    }

    drawShotMeter(pos, charge) {
        const x = Math.round(pos.x + 9);
        const y = Math.round(pos.y - 23);
        const h = 21;
        this.px(x, y, 7, h, COLORS.ink);
        this.px(x + 1, y + 1, 5, h - 2, '#29304a');
        const green = y + Math.round((1 - GAME.greenCenter) * (h - 4)) + 1;
        this.px(x + 1, green, 5, 3, COLORS.green);
        this.px(x + 2, y + h - 2 - Math.round((h - 4) * charge), 3, Math.round((h - 4) * charge),
            charge > 0.69 && charge < 0.84 ? COLORS.green : COLORS.gold);
    }

    drawBall(b) {
        const ctx = this.ctx;
        const pos = this.project(b.x, b.y, b.z);
        const sx = Math.round(pos.x);
        const sy = Math.round(this.project(b.x, b.y).y + 2);
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 4 + clamp(b.z / 30, 0, 2), 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const r = GAME.ballRadius + Math.round(clamp(b.z / 70, 0, 1));
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);
        this.px(x - r,     y - r,     r * 2 + 1, r * 2 + 1, COLORS.ballDark);
        this.px(x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, COLORS.ball);
        this.px(x - r + 2, y - r + 1, 2, 1, COLORS.ballHi);
        this.px(x - r + 1, y,         r * 2 - 1, 1, COLORS.ballDark);
        this.px(x,         y - r + 1, 1, r * 2 - 1, COLORS.ballDark);
        ctx.restore();
    }

    drawPause() {
        this.px(0, 0, VW, VH, 'rgba(0,0,0,.42)');
        this.text('PAUSED', VW / 2, VH / 2, COLORS.white, 18);
    }
}
