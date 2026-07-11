/* scroll.js - native-safe scroll, optional Lenis, nav + progress + anchors */
window.__lenis = null;

(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let lenis = null;
  if (window.Lenis && !prefersReduced) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    window.__lenis = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    if (window.gsap && window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
    }
  }

  // Scroll progress bar
  const progressBar = document.querySelector("#scrollProgress span");
  function updateProgress() {
    const h = document.documentElement;
    const scrolled = (h.scrollTop || document.body.scrollTop);
    const max = h.scrollHeight - h.clientHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + "%";

    const nav = document.getElementById("siteNav");
    if (nav) nav.classList.toggle("is-scrolled", scrolled > 40);

    const backToTop = document.getElementById("backToTop");
    if (backToTop) backToTop.classList.toggle("is-visible", scrolled > 600);
  }
  // When Lenis is running it re-fires its own "scroll" event on top of the
  // native one for every frame; listening to both would run this twice
  // per frame for no benefit, so pick whichever is actually driving scroll.
  if (lenis) {
    lenis.on("scroll", updateProgress);
  } else {
    // Throttled to one update per animation frame — a raw scroll listener
    // can fire many times per frame on some browsers/trackpads, and each
    // extra call here is wasted work since only the latest position matters.
    let scrollTicking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          updateProgress();
          scrollTicking = false;
        });
      },
      { passive: true }
    );
  }
  updateProgress();

  // Smooth anchor navigation
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-scroll-link]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return; // let external links behave normally
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    document.getElementById("mobileMenu")?.classList.remove("is-open");
    document.getElementById("navToggle")?.classList.remove("is-active");
    document.getElementById("navToggle")?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
    if (lenis) {
      lenis.scrollTo(target, { offset: -80, duration: 1.3 });
    } else {
      const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
    }
  });

  // Back to top
  document.getElementById("backToTop")?.addEventListener("click", () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.3 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Mobile menu toggle
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  navToggle?.addEventListener("click", () => {
    const isOpen = mobileMenu?.classList.toggle("is-open");
    navToggle.classList.toggle("is-active", Boolean(isOpen));
    navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
    document.body.classList.toggle("menu-open", Boolean(isOpen));
  });
})();
