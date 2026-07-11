/**
 * admin_gallery.js
 * ----------------
 * Handles the Gallery admin's photo upload: the file goes straight from
 * this browser to Cloudinary (never through our Flask/Vercel backend).
 * This script only ever talks to two places:
 *   1. our own /admin/gallery/upload-signature (to get a signed, timed
 *      permission slip for the upload)
 *   2. Cloudinary's own upload API (to actually send the file)
 * The form itself only submits small text fields, including the
 * resulting image URL — never the image bytes.
 */
(function () {
  const config = window.__galleryAdmin || {};
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const dropzoneHint = document.getElementById("dropzoneHint");
  const progressWrap = document.getElementById("uploadProgress");
  const progressBar = document.getElementById("uploadProgressBar");
  const progressLabel = document.getElementById("uploadProgressLabel");
  const imageUrlInput = document.getElementById("imageUrl");
  const imagePublicIdInput = document.getElementById("imagePublicId");
  const form = document.getElementById("galleryForm");
  const submitBtn = document.getElementById("submitBtn");

  if (!dropzone || !fileInput) return;

  const MAX_BYTES = 10 * 1024 * 1024; // 10MB client-side guardrail
  let uploading = false;

  function setSubmitState(disabled, label) {
    if (!submitBtn) return;
    submitBtn.disabled = disabled;
    const span = submitBtn.querySelector("span");
    if (span && label) span.textContent = label;
  }

  function showPreview(src) {
    preview.src = src;
    preview.style.display = "";
    if (dropzoneHint) dropzoneHint.style.display = "none";
  }

  function resetProgress() {
    progressWrap.hidden = true;
    progressBar.style.width = "0%";
  }

  function toast(message) {
    // Reuses the site-wide #toast element if present; otherwise a
    // lightweight fallback so this never throws in the admin-only pages.
    const el = document.getElementById("toast");
    if (el) {
      el.innerHTML = message;
      el.classList.add("is-visible");
      setTimeout(() => el.classList.remove("is-visible"), 3500);
    } else {
      console.warn(message);
    }
  }

  async function getSignature() {
    const res = await fetch(config.signatureUrl, { method: "POST", credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Could not get an upload signature.");
    }
    return data;
  }

  function uploadToCloudinary(file, sig) {
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`;
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.api_key);
      body.append("timestamp", sig.timestamp);
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        progressBar.style.width = pct + "%";
        progressLabel.textContent = `Uploading… ${pct}%`;
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Unexpected response from Cloudinary."));
          }
        } else {
          let message = "Upload failed.";
          try {
            message = JSON.parse(xhr.responseText)?.error?.message || message;
          } catch { /* keep default message */ }
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.send(body);
    });
  }

  async function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast("That image is larger than 10MB — please choose a smaller file.");
      return;
    }

    // Optimistic local preview while the real upload happens.
    const localUrl = URL.createObjectURL(file);
    showPreview(localUrl);

    uploading = true;
    progressWrap.hidden = false;
    progressBar.style.width = "0%";
    progressLabel.textContent = "Uploading… 0%";
    setSubmitState(true, "Uploading photo…");

    try {
      const sig = await getSignature();
      const result = await uploadToCloudinary(file, sig);
      imageUrlInput.value = result.secure_url;
      imagePublicIdInput.value = result.public_id;
      showPreview(result.secure_url);
      progressLabel.textContent = "Uploaded ✓";
      setTimeout(resetProgress, 900);
      toast("📷 Photo uploaded.");
    } catch (err) {
      resetProgress();
      toast(err.message || "Upload failed — please try again.");
    } finally {
      uploading = false;
      setSubmitState(false, config.mode === "edit" ? "Save Changes" : "Add Item");
      URL.revokeObjectURL(localUrl);
    }
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  form?.addEventListener("submit", (e) => {
    if (uploading) {
      e.preventDefault();
      toast("Please wait for the photo to finish uploading.");
      return;
    }
    if (config.mode === "new" && !imageUrlInput.value) {
      e.preventDefault();
      toast("Please upload a photo before saving.");
    }
  });
})();
