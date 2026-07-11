/* animations.js — loader sequence, GSAP hero intro, scroll-triggered reveals, counters, parallax */
document.addEventListener("DOMContentLoaded", () => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------------- Loading screen ---------------- */
  const loader = document.getElementById("loader");
  const loaderProgress = document.getElementById("loaderProgress");
  let pct = 0;
  const loaderInterval = setInterval(() => {
    pct += Math.random() * 22;
    if (pct >= 100) pct = 100;
    if (loaderProgress) loaderProgress.style.width = pct + "%";
    if (pct >= 100) clearInterval(loaderInterval);
  }, 140);

  function dismissLoader() {
    clearInterval(loaderInterval);
    if (loaderProgress) loaderProgress.style.width = "100%";
    setTimeout(() => {
      loader?.classList.add("is-done");
      document.body.classList.add("is-loaded");
      // Wait for the display webfont to actually finish loading/swapping in
      // before animating the headline. Starting the transform while the
      // fallback font is still being swapped for Cormorant Garamond forces
      // a layout recalc mid-animation, which is what causes the hero lines
      // to stutter on phones.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(runHeroIntro);
      } else {
        runHeroIntro();
      }
    }, 260);
  }
  window.addEventListener("load", () => setTimeout(dismissLoader, 500));
  setTimeout(dismissLoader, 3200); // safety fallback

  /* ---------------- Hero intro timeline ---------------- */
  function runHeroIntro() {
    if (!window.gsap) {
      document.querySelectorAll(".hero__line-inner").forEach((el) => (el.style.transform = "none"));
      document.querySelectorAll(".hero__eyebrow, .hero__sub, .hero__cta-row, .hero__badge").forEach((el) => {
        el.classList.add("is-visible");
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.to(".hero__line-inner", { y: 0, duration: 1.1, stagger: 0.09 })
      .to(".hero__eyebrow, .hero__sub, .hero__cta-row, .hero__badge", { opacity: 1, y: 0, duration: 0.9 }, "-=0.7");
  }
  if (prefersReduced) {
    document.querySelectorAll(".hero__line-inner").forEach((el) => (el.style.transform = "none"));
  }

  /* ---------------- Scroll reveals ---------------- */
  const revealEls = document.querySelectorAll("[data-reveal], [data-reveal-mask]");
  if (window.ScrollTrigger && !prefersReduced) {
    ScrollTrigger.batch(revealEls, {
      start: "top 88%",
      onEnter: (batch) => {
        batch.forEach((el, i) => {
          setTimeout(() => el.classList.add("is-visible"), i * 70);
        });
      },
      once: true,
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------------- Animated counters ---------------- */
  const counters = document.querySelectorAll("[data-counter]");
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target || "0");
    const isDecimal = el.dataset.decimal === "true";
    const suffix = el.dataset.suffix || "";
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = (isDecimal ? value.toFixed(1) : Math.round(value).toLocaleString("en-IN")) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (window.ScrollTrigger && !prefersReduced) {
    counters.forEach((el) => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 90%",
        once: true,
        onEnter: () => animateCounter(el),
      });
    });
  } else {
    counters.forEach((el) => animateCounter(el));
  }

  /* ---------------- Parallax hero blobs ---------------- */
  // Skipped on mobile/touch: animating a heavily-blurred element on every scroll
  // frame is expensive to repaint/composite and is the main cause of janky/
  // shaky scrolling on phones, especially right at the hero section.
  const isMobile = window.matchMedia("(max-width: 900px), (hover: none)").matches;
  if (window.gsap && window.ScrollTrigger && !prefersReduced && !isMobile) {
    gsap.to(".hero__blob--1", { y: 120, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__blob--2", { y: -80, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    // Subtle scale-in for masked visuals
    gsap.utils.toArray("[data-reveal-mask]").forEach((el) => {
      gsap.fromTo(el, { clipPath: "inset(8% 8% 8% 8% round 24px)" }, {
        clipPath: "inset(0% 0% 0% 0% round 24px)",
        duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });
  }

  /* ---------------- Year in footer ---------------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
