/* main.js — final glue / init */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("js-ready");

  // Close mobile menu on link click already handled in scroll.js via data-scroll-link.
  // Close mobile menu on escape.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("mobileMenu")?.classList.remove("is-open");
      document.getElementById("navToggle")?.classList.remove("is-active");
      document.getElementById("navToggle")?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }
  });
});
