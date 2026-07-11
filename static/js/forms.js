document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".faq-item__q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("is-open");
      item.parentElement.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("is-open"));
      if (!wasOpen) item.classList.add("is-open");
    });
  });

  function validateForm(form) {
    let isValid = true;

    // Clear previous errors
    form.querySelectorAll(".form-error").forEach((span) => {
      span.textContent = "";
    });
    form.querySelectorAll(".form-field").forEach((field) => {
      field.classList.remove("has-error");
    });

    form.querySelectorAll("[required]").forEach((field) => {
      const errorSpan = form.querySelector(`[data-error-for="${field.name}"]`);
      const value = field.value.trim();
      let message = "";

      if (!value) {
        message = "This field is required.";
      } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        message = "Please enter a valid email address.";
      }

      if (message) {
        isValid = false;
        if (errorSpan) errorSpan.textContent = message;
        field.closest(".form-field")?.classList.add("has-error");
      }
    });

    return isValid;
  }

  async function submitForm(form, url, statusEl) {
    if (!validateForm(form)) {
      if (statusEl) {
        statusEl.textContent = "Please fix the errors above.";
        statusEl.className = "form-status form-status--error";
      }
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHTML = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "<span>Sending&hellip;</span>"; }
    if (statusEl) { statusEl.textContent = ""; statusEl.className = "form-status"; }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (statusEl) {
        statusEl.textContent = data.message || (data.ok ? "Sent!" : "Something went wrong.");
        statusEl.className = "form-status " + (data.ok ? "form-status--success" : "form-status--error");
      }

      if (data.ok) form.reset();
    } catch (err) {
      console.error("Form submission error:", err);
      if (statusEl) {
        statusEl.textContent = "Network error. Please try again.";
        statusEl.className = "form-status form-status--error";
      }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalHTML; }
    }
  }

  const bookingForm = document.getElementById("bookingForm");
  const bookingStatus = document.getElementById("bookingStatus");
  bookingForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm(bookingForm, "/contact", bookingStatus);
  });
});