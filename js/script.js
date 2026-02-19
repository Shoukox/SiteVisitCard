(() => {
    // Canvas setup (reuse #fx if present; otherwise create)
    let canvas = document.getElementById("fx");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "fx";
        document.body.prepend(canvas);
    }

    const ctx = canvas.getContext("2d", { alpha: true });

    // Ensure canvas covers screen and sits behind content
    Object.assign(canvas.style, {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        zIndex: "0",
        pointerEvents: "none",
    });

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W = 0,
        H = 0;

    function resize() {
        W = Math.floor(window.innerWidth);
        H = Math.floor(window.innerHeight);
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    // Bloomy "breathing" background (GTA5-ish)
    // We paint multiple soft moving blobs into an offscreen buffer,
    // blur-ish by drawing scaled + additive, then overlay a subtle vignette.
    const bg = document.createElement("canvas");
    const bctx = bg.getContext("2d", { alpha: true });
    let bW = 0,
        bH = 0;

    function resizeBg() {
        // offscreen lower-res buffer for cheaper faux-blur
        bW = Math.max(320, Math.floor(W * 0.55));
        bH = Math.max(240, Math.floor(H * 0.55));
        bg.width = bW;
        bg.height = bH;
    }
    resizeBg();
    window.addEventListener("resize", resizeBg);

    // Color palette (neon-pastel)
    const BLOBS = [
        { c: [165, 110, 255], a: 0.55, r: 0.55, sp: 0.22 },
        { c: [255, 105, 185], a: 0.40, r: 0.50, sp: 0.18 },
        { c: [120, 235, 255], a: 0.35, r: 0.60, sp: 0.15 },
        { c: [145, 255, 210], a: 0.28, r: 0.45, sp: 0.16 },
    ].map((b, i) => ({
        ...b,
        p: Math.random() * Math.PI * 2,
        p2: Math.random() * Math.PI * 2,
        ox: Math.random(),
        oy: Math.random(),
        phase: Math.random() * 10,
        idx: i,
    }));

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    function rgba([r, g, b], a) {
        return `rgba(${r},${g},${b},${a})`;
    }

    function paintBloomBackground(t) {
        // t in seconds
        const time = t * 0.001;

        // base dark gradient
        const g = bctx.createLinearGradient(0, 0, bW, bH);
        g.addColorStop(0, "rgba(7,8,18,1)");
        g.addColorStop(1, "rgba(14,8,32,1)");
        bctx.globalCompositeOperation = "source-over";
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, bW, bH);

        // "breathing" factor (slow pulse)
        const breathe = 0.5 + 0.5 * Math.sin(time * 0.65);
        const breathe2 = 0.5 + 0.5 * Math.sin(time * 0.42 + 1.4);

        // blob layer (normal)
        bctx.globalCompositeOperation = "lighter";

        for (const b of BLOBS) {
            // center drift in Lissajous-ish curves
            const driftX =
                0.5 +
                0.28 * Math.sin(time * (0.30 + b.sp) + b.p) +
                0.12 * Math.sin(time * 0.17 + b.p2);
            const driftY =
                0.5 +
                0.26 * Math.cos(time * (0.28 + b.sp) + b.p2) +
                0.10 * Math.sin(time * 0.21 + b.p);

            const cx = driftX * bW;
            const cy = driftY * bH;

            // radius breathes + slight independent wobble
            const r =
                (Math.min(bW, bH) * b.r) *
                (0.72 + 0.28 * (breathe * 0.7 + breathe2 * 0.3)) *
                (0.92 + 0.08 * Math.sin(time * 0.9 + b.phase));

            const a =
                b.a *
                (0.55 + 0.45 * (breathe * 0.6 + breathe2 * 0.4)) *
                (0.85 + 0.15 * Math.sin(time * 0.8 + b.phase)) * 0.5;

            const grad = bctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, rgba(b.c, a));
            grad.addColorStop(0.45, rgba(b.c, a * 0.30));
            grad.addColorStop(1, rgba(b.c, 0));

            bctx.fillStyle = grad;
            bctx.beginPath();
            bctx.arc(cx, cy, r, 0, Math.PI * 2);
            bctx.fill();
        }

        // faux blur / bloom: draw the buffer onto itself scaled down/up with additive blending
        // (cheap "bloom" trick)
        bctx.globalCompositeOperation = "lighter";
        bctx.globalAlpha = 0.55;
        bctx.drawImage(bg, -bW * 0.03, -bH * 0.03, bW * 1.06, bH * 1.06);
        bctx.globalAlpha = 0.35;
        bctx.drawImage(bg, -bW * 0.06, -bH * 0.06, bW * 1.12, bH * 1.12);
        bctx.globalAlpha = 1;

        // subtle vignette (multiply)
        bctx.globalCompositeOperation = "multiply";
        const vg = bctx.createRadialGradient(
            bW * 0.5,
            bH * 0.5,
            Math.min(bW, bH) * 0.18,
            bW * 0.5,
            bH * 0.5,
            Math.min(bW, bH) * 0.72
        );
        vg.addColorStop(0, "rgba(255,255,255,1)");
        vg.addColorStop(1, "rgba(0,0,0,0.55)");
        bctx.fillStyle = vg;
        bctx.fillRect(0, 0, bW, bH);

        bctx.globalCompositeOperation = "source-over";
    }

    // Cursor triangles (particles)
    const tris = [];
    let fxEnabled = true;

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    const palette = [
        "rgba(170,120,255,0.85)",
        "rgba(255,120,200,0.78)",
        "rgba(120,230,255,0.72)",
        "rgba(140,255,200,0.70)",
        "rgba(255,220,140,0.62)",
    ];

    function spawnTriangle(x, y, intensity = 1) {
        const count = 1;
        for (let i = 0; i < count; i++) {
            const size = rand(10, 26) * rand(0.8, 1.2);
            const life = rand(700, 1400);
            const a = rand(0, Math.PI * 2);
            const speed = rand(0.05, 0.22) * rand(0.7, 1.6) * intensity;

            tris.push({
                x: x + rand(-16, 16),
                y: y + rand(-16, 16),
                vx: Math.cos(a) * speed * 60,
                vy: Math.sin(a) * speed * 60,
                rot: rand(0, Math.PI * 2),
                vr: rand(-1, 1) * 0.9,
                size,
                born: performance.now(),
                life,
                hue: palette[(Math.random() * palette.length) | 0],
                wobble: rand(0.6, 1.4),
                wobblePhase: rand(0, 10),
            });
        }
    }

    function drawTriangle(px, py, r, s, fill) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(r);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.9, s * 0.7);
        ctx.lineTo(-s * 0.9, s * 0.7);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
    }

    // Cursor speed -> spawn intensity
    let lastX = W / 2,
        lastY = H / 2,
        lastMoveT = performance.now();

    function onMove(e) {
        if (!fxEnabled) return;

        const x = e.clientX;
        const y = e.clientY;

        const now = performance.now();
        const dt = Math.max(1, now - lastMoveT);
        const dx = x - lastX;
        const dy = y - lastY;

        const dist = Math.hypot(dx, dy);
        if (dist < 50) return;

        const speed = dist / dt;
        const intensity = clamp(speed * 12, 0.7, 2.4);

        spawnTriangle(x + rand(-6, 6), y + rand(-6, 6), intensity + 5);

        lastX = x;
        lastY = y;
        lastMoveT = now;
    }
    window.addEventListener("pointermove", onMove, { passive: true });

        // -----------------------------
    // Glass card tilts toward cursor
    // -----------------------------
    const card = document.getElementById("card");
    let targetRX = 0, targetRY = 0;
    let curRX = 0, curRY = 0;

    function cardAim(e){
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);

      // clamp to avoid wild rotations
      const x = clamp(dx, -1, 1);
      const y = clamp(dy, -1, 1);

      // rotateX is opposite of y movement
      targetRX = (-y) * 3;   // degrees
      targetRY = (x) * 3;    // degrees
    }
    window.addEventListener("pointermove", cardAim, { passive:true });

    function smoothCard(){
      // critically damped-ish smoothing
      curRX += (targetRX - curRX) * 0.10;
      curRY += (targetRY - curRY) * 0.10;

      // small z translation for depth
      card.style.transform = `rotateX(${curRX.toFixed(3)}deg) rotateY(${curRY.toFixed(3)}deg) translateZ(0px)`;
      requestAnimationFrame(smoothCard);
    }
    requestAnimationFrame(smoothCard);

    // -----------------------------
    // Main animation loop
    // -----------------------------
    let lastT = performance.now();

    function tick(t) {
        const dt = Math.min(32, t - lastT);
        lastT = t;

        // 1) Paint bloom background into offscreen, then draw to main canvas
        paintBloomBackground(t);

        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(bg, 0, 0, bW, bH, 0, 0, W, H);

        // 2) Draw triangles on top (additive)
        ctx.globalCompositeOperation = "lighter";

        for (let i = tris.length - 1; i >= 0; i--) {
            const p = tris[i];
            const age = t - p.born;
            if (age > p.life) {
                tris.splice(i, 1);
                continue;
            }

            const k = age / p.life;
            const fade = 1 - k;
            const ease = fade * fade;

            p.x += (p.vx * dt) / 1000;
            p.y += (p.vy * dt) / 1000;
            p.rot += (p.vr * dt) / 1000;

            const wob = Math.sin(p.wobblePhase + age * 0.006) * p.wobble;
            const px = p.x + wob;
            const py = p.y - wob * 0.6;

            const baseAlpha = 0.25;
            const fill = p.hue.replace(
                /[\d.]+\)$/,
                (baseAlpha).toFixed(3) + ")"
            );

            drawTriangle(
                px,
                py,
                p.rot,
                p.size * (0.9 + 0.15 * Math.sin(age * 0.01)),
                fill
            );

            // subtle outline
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(p.rot);
            ctx.beginPath();
            const s = p.size;
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.9, s * 0.7);
            ctx.lineTo(-s * 0.9, s * 0.7);
            ctx.closePath();
            ctx.strokeStyle = `rgba(255,255,255,${(0.06 * ease).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        ctx.globalCompositeOperation = "source-over";

        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
})();
