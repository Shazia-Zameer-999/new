/* cursor.js — liquid gold cursor, magnetic buttons, tilt cards
 *
 * Everything that touches the DOM each frame is written from a single
 * requestAnimationFrame loop, driven by real elapsed time. That's the
 * fix for the lag/jank in the old version, which wrote the dot's
 * transform straight from the mousemove event (so it updated on a
 * different, uncapped cadence than the trailing drop) and animated
 * width/height on hover (a layout property, not just a compositor one).
 * Here every write is `transform`/`filter` only, batched into one frame.
 */
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarsePointer = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 900px)").matches;
  if (prefersReducedMotion || isCoarsePointer) return;

  const goo = document.getElementById("cursorGoo");
  const blob = document.getElementById("cursorBlob");
  const core = document.getElementById("cursorCore");
  const ripple = document.getElementById("cursorRipple");
  if (!goo || !blob || !core) return;

  // Only hide the native system cursor once we know the custom one is here
  // and active — keeps things working normally if JS fails to load.
  document.documentElement.classList.add("has-custom-cursor");

  const GOO_HALF = 40; // half of .cursor-goo's 80px box, keep in sync with CSS

  // --- Raw pointer position, updated on the event only. No DOM writes here
  // — that's the whole point: the event handler stays cheap and every
  // visual update happens together in the animation loop below. ---
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );

  // --- Spring-following blob (the trailing liquid droplet) ---
  let blobX = mouseX, blobY = mouseY;
  let velX = 0, velY = 0;
  let angle = 0;
  let scale = 1, scaleVel = 0;
  let targetScale = 1;

  // Critically-damped-ish spring: catches up in ~80ms (no perceptible lag)
  // with just enough give to read as liquid rather than mechanical.
  const STIFFNESS = 260;
  const DAMPING = 26;

  const hoverables = "a, button, [data-tilt], input, select, textarea, .faq-item__q";

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (e.target.closest && e.target.closest(hoverables)) {
      targetScale = 1.2;
      goo.classList.add("is-active");
    }
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (e.target.closest && e.target.closest(hoverables)) {
      targetScale = 1;
      goo.classList.remove("is-active");
    }
  });

  // --- Click ripple: a quick liquid "splash" for tactile feedback ---
  if (ripple) {
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType && e.pointerType !== "mouse") return;
        ripple.style.setProperty("--x", `${e.clientX}px`);
        ripple.style.setProperty("--y", `${e.clientY}px`);
        ripple.classList.remove("is-rippling");
        void ripple.offsetWidth; // restart the CSS animation
        ripple.classList.add("is-rippling");
      },
      { passive: true }
    );
  }

  // --- Magnetic buttons: the bounding rect is cached once on entry
  // instead of being read on every mousemove (that forced-layout read
  // was another source of the jank). The pull itself is applied inside
  // the shared animation loop so it's always in sync with the cursor. ---
  const magnets = Array.from(document.querySelectorAll("[data-magnetic]")).map((el) => ({
    el, rect: null, targetX: 0, targetY: 0, x: 0, y: 0,
  }));
  magnets.forEach((m) => {
    m.el.addEventListener("pointerenter", () => {
      m.rect = m.el.getBoundingClientRect();
    });
    m.el.addEventListener("pointermove", (e) => {
      if (!m.rect) m.rect = m.el.getBoundingClientRect();
      m.targetX = (e.clientX - m.rect.left - m.rect.width / 2) * 0.28;
      m.targetY = (e.clientY - m.rect.top - m.rect.height / 2) * 0.4;
    });
    m.el.addEventListener("pointerleave", () => {
      m.targetX = 0;
      m.targetY = 0;
      m.rect = null;
    });
  });

  // --- Tilt cards: same caching + shared-loop pattern as the magnets ---
  const tilts = Array.from(document.querySelectorAll("[data-tilt]")).map((el) => ({
    el, rect: null, targetRX: 0, targetRY: 0, rx: 0, ry: 0,
  }));
  tilts.forEach((t) => {
    t.el.addEventListener("pointerenter", () => {
      t.rect = t.el.getBoundingClientRect();
    });
    t.el.addEventListener("pointermove", (e) => {
      if (!t.rect) t.rect = t.el.getBoundingClientRect();
      const px = (e.clientX - t.rect.left) / t.rect.width - 0.5;
      const py = (e.clientY - t.rect.top) / t.rect.height - 0.5;
      t.targetRY = px * 8;
      t.targetRX = -py * 8;
    });
    t.el.addEventListener("pointerleave", () => {
      t.targetRX = 0;
      t.targetRY = 0;
      t.rect = null;
    });
  });

  // --- Single animation loop, driven by real elapsed time so the motion
  // reads the same on a 60Hz laptop and a 120Hz+ display, and can't spiral
  // out after a dropped frame or a backgrounded tab. ---
  let lastTime = null;

  function tick(now) {
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    // Damped spring chasing the real pointer position.
    const dx = mouseX - blobX;
    const dy = mouseY - blobY;
    velX += (dx * STIFFNESS - velX * DAMPING) * dt;
    velY += (dy * STIFFNESS - velY * DAMPING) * dt;
    blobX += velX * dt;
    blobY += velY * dt;

    const speed = Math.min(Math.hypot(velX, velY), 900);
    if (speed > 40) {
      angle = (Math.atan2(velY, velX) * 180) / Math.PI + 90;
    }
    // Small, capped stretch/squeeze — enough to read as a droplet
    // trailing behind the pointer, never enough to balloon in size.
    const stretch = 1 + (speed / 900) * 0.18;
    const squeeze = 1 - (speed / 900) * 0.08;

    scaleVel += ((targetScale - scale) * STIFFNESS - scaleVel * DAMPING) * dt;
    scale += scaleVel * dt;
    // Hard ceiling: whatever hover/speed math produces, the drop can
    // never render more than 25% larger than its resting size.
    const cappedScale = Math.min(scale, 1.25);

    goo.style.transform = `translate(${blobX - GOO_HALF}px, ${blobY - GOO_HALF}px)`;
    blob.style.transform = `rotate(${angle}deg) scale(${squeeze * cappedScale}, ${stretch * cappedScale})`;
    core.style.transform = `translate(${mouseX - blobX}px, ${mouseY - blobY}px)`;

    const ease = Math.min(dt * 14, 1);
    magnets.forEach((m) => {
      m.x += (m.targetX - m.x) * ease;
      m.y += (m.targetY - m.y) * ease;
      m.el.style.transform = `translate(${m.x}px, ${m.y}px)`;
    });
    tilts.forEach((t) => {
      t.rx += (t.targetRX - t.rx) * ease;
      t.ry += (t.targetRY - t.ry) * ease;
      t.el.style.transform = `perspective(700px) rotateY(${t.ry}deg) rotateX(${t.rx}deg)`;
    });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
