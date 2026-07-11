/* gallery.js — gallery filters, lightbox, wishlist, before/after comparison slider */
document.addEventListener("DOMContentLoaded", () => {
/* ---------------- Gallery Filters & Load More / Show Less ---------------- */
  const filterBtns = document.querySelectorAll(".gallery__filter-btn");
  const galleryItems = document.querySelectorAll(".gallery__item");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const galleryActions = document.getElementById("galleryActions");
  
  const INITIAL_ITEMS = 12; // Base number of items to show
  let itemsToShow = INITIAL_ITEMS; 
  const itemsToIncrease = 8;

  function applyGalleryLogic() {
    const activeBtn = document.querySelector(".gallery__filter-btn.is-active");
    const filter = activeBtn ? activeBtn.dataset.filter : "All";
    
    let visibleCount = 0; 

    // 1. Count how many total items match the current category
    galleryItems.forEach((item) => {
      if (filter === "All" || item.dataset.category === filter) {
        visibleCount++;
      }
    });

    let currentDisplayIndex = 0;
    
    // 2. Apply the display logic based on the itemsToShow limit
    galleryItems.forEach((item) => {
      const match = filter === "All" || item.dataset.category === filter;
      
      if (match) {
        if (currentDisplayIndex < itemsToShow) {
          item.style.display = ""; // Show
        } else {
          item.style.display = "none"; // Hide
        }
        currentDisplayIndex++;
      } else {
        item.style.display = "none"; // Hide non-matching category
      }
    });

    // 3. Update the Button State (Load More vs Show Less)
    if (galleryActions && loadMoreBtn) {
      if (visibleCount <= INITIAL_ITEMS) {
        // Hide button completely if the category has 12 or fewer items
        galleryActions.style.display = "none";
      } else {
        galleryActions.style.display = "block";
        
        if (itemsToShow >= visibleCount) {
          // All items are currently visible -> switch to "Show Less"
          loadMoreBtn.innerText = "Show Less";
          loadMoreBtn.dataset.state = "less";
        } else {
          // There are still more hidden items -> keep "Load More"
          loadMoreBtn.innerText = "Load More Pieces";
          loadMoreBtn.dataset.state = "more";
        }
      }
    }
  }

  // Handle Category Filter Clicks
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      
      // Reset the counter back to default when switching categories
      itemsToShow = INITIAL_ITEMS; 
      applyGalleryLogic();
    });
  });

  // Handle Load More / Show Less Clicks
// Handle Load More / Show Less Clicks
// Handle Load More / Show Less Clicks
  loadMoreBtn?.addEventListener("click", () => {
    if (loadMoreBtn.dataset.state === "less") {
      
      // 1. Calculate the exact scroll target BEFORE changing the DOM.
      // The top of the gallery grid is a fixed point on the page.
      const grid = document.getElementById("galleryGrid");
      let targetY = 0;
      if (grid) {
        // window.scrollY + rect.top gives the absolute document position
        targetY = grid.getBoundingClientRect().top + window.scrollY - 100;
      }

      // 2. Unload logic: Reset to base count & shrink DOM
      itemsToShow = INITIAL_ITEMS;
      applyGalleryLogic(); 
      
      // 3. Jump to the pre-calculated fixed position.
      // Using 'instant' forces the browser to override any global CSS smooth scrolling.
      if (grid) {
        window.scrollTo({ top: targetY, behavior: 'instant' }); 
      }
      
    } else {
      // Load more logic
      itemsToShow += itemsToIncrease;
      applyGalleryLogic();
    }
  });

  // Run once on page load to set the initial limit
  applyGalleryLogic();

  /* ---------------- Lightbox ---------------- */
  const lightbox = document.getElementById("lightbox");
  const lightboxMedia = document.getElementById("lightboxMedia");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxSwatch = document.getElementById("lightboxSwatch");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxCategory = document.getElementById("lightboxCategory");
  const lightboxPrice = document.getElementById("lightboxPrice");
  const lightboxSku = document.getElementById("lightboxSku");
  const lightboxDescription = document.getElementById("lightboxDescription");
  
  let visibleItems = [];
  let currentIndex = 0;

  function openLightbox(item) {
    visibleItems = Array.from(galleryItems).filter((i) => i.style.display !== "none");
    currentIndex = visibleItems.indexOf(item);
    if (currentIndex === -1) currentIndex = 0;
    renderLightbox();
    lightbox?.classList.add("is-open");
    document.body.classList.add("lightbox-open");
  }

  function renderLightbox() {
    const item = visibleItems[currentIndex];
    if (!item || !lightboxSwatch) return;
    
    const swatchNum = item.dataset.lightboxSwatch;
    lightboxSwatch.className = "swatch lightbox__swatch swatch--" + (((parseInt(swatchNum) || 0) % 12) + 1);
    // lightboxTitle.textContent = item.dataset.lightboxTitle || "";
    lightboxCategory.textContent = item.dataset.lightboxCategory || "";

    if (lightboxPrice) lightboxPrice.textContent = item.dataset.price || "";
    if (lightboxSku) lightboxSku.textContent = item.dataset.sku ? "SKU " + item.dataset.sku : "";
    if (lightboxDescription) lightboxDescription.textContent = item.dataset.description || "";

    if (lightboxImage && lightboxMedia) {
      const imgSrc = item.dataset.image || "";
      lightboxMedia.classList.remove("img-fallback");
      if (imgSrc) {
        lightboxImage.src = imgSrc;
        lightboxImage.alt = item.dataset.name || "";
      } else {
        lightboxImage.removeAttribute("src");
        lightboxMedia.classList.add("img-fallback");
      }
    }

    // Dynamic state application for lightbox Save Button
    const lightboxSaveBtn = document.getElementById("lightboxSaveBtn");
    if (lightboxSaveBtn) {
      const id = item.dataset.id;
      lightboxSaveBtn.classList.toggle("is-saved", isSaved(id));
      lightboxSaveBtn.dataset.currentId = id || ""; 
    }
  }

  lightboxImage?.addEventListener("error", () => {
    if (lightboxImage.getAttribute("src")) {
      lightboxMedia?.classList.add("img-fallback");
    }
  });

  // ---- Global Event Delegation for ALL Wishlist Actions ----
  // This approach is immune to DOM hydration, clones, or external UI scripts
  document.body.addEventListener("click", (e) => {
    
    // 1. Grid Card Save Event
    const gridSaveBtn = e.target.closest("[data-save-btn]");
    if (gridSaveBtn) {
      // Ensure we are inside the gallery grid
      const galleryGrid = document.getElementById("galleryGrid");
      if (!galleryGrid || !galleryGrid.contains(gridSaveBtn)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const item = gridSaveBtn.closest(".gallery__item");
      const id = item?.dataset.id;
      if (!id) return;

      const nowSaved = toggleWishlist(id);
      gridSaveBtn.classList.toggle("is-saved", nowSaved);
      
      // Keep lightbox heart synced if it's currently open
      const lightboxSaveBtn = document.getElementById("lightboxSaveBtn");
      if (lightboxSaveBtn && lightboxSaveBtn.dataset.currentId === id) {
        lightboxSaveBtn.classList.toggle("is-saved", nowSaved);
      }
      
      showToast(nowSaved ? "♡ Added to your wishlist" : "Removed from wishlist");
      updateWishlistCount();
      return;
    }

    // 2. Lightbox Save Event
    const lightboxSaveBtnClick = e.target.closest("#lightboxSaveBtn");
    if (lightboxSaveBtnClick) {
      e.preventDefault();
      const id = lightboxSaveBtnClick.dataset.currentId;
      if (!id) {
        console.error("[Zeverish Debug] Lightbox save clicked, but no dataset ID found.");
        return;
      }
      
      const nowSaved = toggleWishlist(id);
      lightboxSaveBtnClick.classList.toggle("is-saved", nowSaved);

      // Keep underlying grid card synced
      const cardBtn = document.querySelector(`.gallery__item[data-id="${id}"] [data-save-btn]`);
      if (cardBtn) cardBtn.classList.toggle("is-saved", nowSaved);

      showToast(nowSaved ? "♡ Added to your wishlist" : "Removed from wishlist");
      updateWishlistCount();
      return;
    }
    
    // 3. Grid Card Open Lightbox Event
    const itemClick = e.target.closest(".gallery__item");
    if (itemClick) {
      const galleryGrid = document.getElementById("galleryGrid");
      // Ignore clicks if they originated from the wishlist drawer or weren't in the main grid
      if (galleryGrid && galleryGrid.contains(itemClick)) {
        openLightbox(itemClick);
      }
    }
  });


  /* ---------------- Lightbox Navigation & Close ---------------- */
  function closeLightbox() {
    lightbox?.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
  }
  
  document.getElementById("lightboxClose")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  
  document.getElementById("lightboxNext")?.addEventListener("click", () => {
    if (!visibleItems.length) return;
    currentIndex = (currentIndex + 1) % visibleItems.length;
    renderLightbox();
  });
  
  document.getElementById("lightboxPrev")?.addEventListener("click", () => {
    if (!visibleItems.length) return;
    currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    renderLightbox();
  });
  
  document.addEventListener("keydown", (e) => {
    if (!lightbox?.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") document.getElementById("lightboxNext")?.click();
    if (e.key === "ArrowLeft") document.getElementById("lightboxPrev")?.click();
  });

  let touchStartX = 0;
  lightbox?.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  
  lightbox?.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return; 
    if (dx < 0) document.getElementById("lightboxNext")?.click();
    else document.getElementById("lightboxPrev")?.click();
  }, { passive: true });

  /* ---------------- Wishlist (localStorage) Core ---------------- */
  const WISHLIST_KEY = "zeverish_wishlist";

  function getWishlist() {
    try {
      const stored = JSON.parse(localStorage.getItem(WISHLIST_KEY));
      return (Array.isArray(stored) ? stored : []).map(String);
    } catch {
      return [];
    }
  }
  
  function isSaved(id) {
    if (!id) return false;
    return getWishlist().includes(String(id));
  }
  
  function toggleWishlist(id) {
    if (!id) return false;
    const strId = String(id);
    let list = getWishlist();
    
    if (list.includes(strId)) {
      list = list.filter((x) => x !== strId);
    } else {
      list.push(strId);
    }
    
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
      console.log(`[Storage Debug] Saved successfully:`, list);
    } catch (e) {
      console.error("[Storage Debug] Write failed, check browser permissions:", e);
    }
    return list.includes(strId);
  }

  function refreshSavedState() {
    document.querySelectorAll(".gallery__item").forEach((item) => {
      const id = item.dataset.id;
      if (!id) return;
      const btn = item.querySelector("[data-save-btn]");
      if (btn) btn.classList.toggle("is-saved", isSaved(id));
    });
  }
  
  refreshSavedState();

  const galleryGrid = document.getElementById("galleryGrid");
  if (galleryGrid) {
    new MutationObserver(refreshSavedState).observe(galleryGrid, {
      childList: true,
      subtree: true,
    });
  }

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerHTML = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  /* ---------------- Order on Instagram (confirmation modal) ---------------- */
  // Note: Instagram gives no public way for an outside website to pre-fill or
  // pre-attach an image into a person's DM composer — that only exists for
  // approved Meta Business Messaging integrations, not a static site. The best
  // legitimate alternative is to make the hand-off as frictionless as possible:
  // auto-copy the order details, let people grab the photo in one tap, and use
  // the native share sheet (photo + text together) wherever the OS allows it.

  const orderModal = document.getElementById("orderModal");
  const orderModalOverlay = document.getElementById("orderModalOverlay");
  const orderModalClose = document.getElementById("orderModalClose");
  const orderModalImage = document.getElementById("orderModalImage");
  const orderModalCategory = document.getElementById("orderModalCategory");
  const orderModalName = document.getElementById("orderModalName");
  const orderModalPrice = document.getElementById("orderModalPrice");
  const orderModalSku = document.getElementById("orderModalSku");
  const orderModalNote = document.getElementById("orderModalNote");
  const orderModalDownloadBtn = document.getElementById("orderModalDownloadBtn");
  const orderModalShareBtn = document.getElementById("orderModalShareBtn");
  const orderModalContinueBtn = document.getElementById("orderModalContinueBtn");

  let currentOrderItem = null;

  function buildOrderMessage(item) {
    return `Hi Zewarish,\n\nI would like to order this jewellery.\n\nProduct: ${item.dataset.name || ""}\nSKU: ${item.dataset.sku || ""}\nPrice: ₹${item.dataset.price || ""}\nProduct Link: https://new-gamma-flame.vercel.app/static/images/gallery/${item.dataset.id || ""}.jpg\n\nPlease let me know the availability.`;
  }

  function getIgUser() {
    return document.getElementById("lightbox")?.dataset.instagramUser || "zewarish.co";
  }

  async function canShareImages() {
    if (!navigator.canShare || !navigator.share) return false;
    try {
      const testFile = new File(["a"], "test.jpg", { type: "image/jpeg" });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }

  function openOrderModal(item) {
    if (!item || !orderModal) return;
    currentOrderItem = item;

    if (orderModalImage) {
      const imgSrc = item.dataset.image || "";
      orderModalImage.src = imgSrc;
      orderModalImage.alt = item.dataset.name || "";
    }
    if (orderModalCategory) orderModalCategory.textContent = item.dataset.category || "";
    if (orderModalName) orderModalName.textContent = item.dataset.name || "piece";
    if (orderModalPrice) orderModalPrice.textContent = item.dataset.price || "";
    if (orderModalSku) orderModalSku.textContent = item.dataset.sku ? "SKU " + item.dataset.sku : "";

    // Progressively reveal the native share option only where it will actually work
    if (orderModalShareBtn) {
      canShareImages().then((ok) => {
        orderModalShareBtn.hidden = !ok;
      });
    }

    orderModal.classList.add("is-open");
    document.body.classList.add("lightbox-open");
  }

  function closeOrderModal() {
    orderModal?.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
  }

  orderModalClose?.addEventListener("click", closeOrderModal);
  orderModalOverlay?.addEventListener("click", closeOrderModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && orderModal?.classList.contains("is-open")) closeOrderModal();
  });

  // Primary path: copy the order details, then hand off to the Instagram DM thread
  orderModalContinueBtn?.addEventListener("click", async () => {
    if (!currentOrderItem) return;
    const message = buildOrderMessage(currentOrderItem);
    try {
      await navigator.clipboard.writeText(message);
      if (orderModalNote) {
        orderModalNote.textContent = "✓ Copied! Paste it into the Instagram chat that just opened.";
      }
      showToast("✓ Product details copied.<br>Paste them into Instagram.");
    } catch {
      if (orderModalNote) {
        orderModalNote.textContent = "Couldn't auto-copy — please note the details above manually.";
      }
      showToast("Couldn't copy automatically — please note the product details manually.");
    }
    window.open(`https://ig.me/m/${getIgUser()}`, "_blank", "noopener");
  });

  // Convert an image blob to PNG via canvas — PNG is the one raster format
  // every clipboard-supporting browser accepts through ClipboardItem; JPEG
  // support is inconsistent, so we normalize instead of gambling on it.
  function blobToPngBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          pngBlob ? resolve(pngBlob) : reject(new Error("canvas toBlob failed"));
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
  }

  async function copyImageToClipboard(blob) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
    try {
      const pngBlob = await blobToPngBlob(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      return true;
    } catch {
      return false; // permissions blocked, unsupported, or window lost focus
    }
  }

  // Save the product photo locally AND copy it to the clipboard, so it's
  // one tap to attach in the DM either by pasting or by picking it from
  // Downloads — whichever the person's browser/OS makes easier.
  orderModalDownloadBtn?.addEventListener("click", async () => {
    if (!currentOrderItem) return;
    const imgSrc = currentOrderItem.dataset.image;
    if (!imgSrc) {
      showToast("No photo available for this piece.");
      return;
    }
    try {
      const res = await fetch(imgSrc);
      const blob = await res.blob();
      const ext = (imgSrc.split(".").pop() || "jpg").split("?")[0];
      const fileName = `zewarish-${currentOrderItem.dataset.sku || currentOrderItem.dataset.slug || "piece"}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

      const copied = await copyImageToClipboard(blob);
      showToast(
        copied
          ? "📷 Photo saved &amp; copied — paste it straight into Instagram."
          : "📷 Photo saved — attach it in Instagram after pasting."
      );
    } catch {
      // Fallback: let the browser handle it directly (still same-origin)
      const a = document.createElement("a");
      a.href = imgSrc;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  });

  // Optional: native share sheet, where the OS can hand the photo + text to
  // whichever app the person picks (works best for WhatsApp, Messages, Mail;
  // Instagram itself only accepts shared media into Stories/Feed, not DMs)
  orderModalShareBtn?.addEventListener("click", async () => {
    if (!currentOrderItem) return;
    const message = buildOrderMessage(currentOrderItem);
    const imgSrc = currentOrderItem.dataset.image;
    try {
      let files = [];
      if (imgSrc) {
        const res = await fetch(imgSrc);
        const blob = await res.blob();
        const ext = (imgSrc.split(".").pop() || "jpg").split("?")[0];
        files = [new File([blob], `zewarish-piece.${ext}`, { type: blob.type || "image/jpeg" })];
      }
      await navigator.share({
        files,
        title: currentOrderItem.dataset.name || "Zewarish piece",
        text: message,
      });
    } catch {
      /* user cancelled the share sheet or it failed silently — no action needed */
    }
  });

  document.getElementById("lightboxOrderBtn")?.addEventListener("click", () => {
    openOrderModal(visibleItems[currentIndex]);
  });

  /* ---------------- Wishlist Drawer ---------------- */
  const wishlistToggle = document.getElementById("wishlistToggle");
  const wishlistDrawer = document.getElementById("wishlistDrawer");
  const wishlistOverlay = document.getElementById("wishlistOverlay");
  const wishlistClose = document.getElementById("wishlistClose");
  const wishlistBody = document.getElementById("wishlistBody");
  const wishlistCount = document.getElementById("wishlistCount");

  function updateWishlistCount() {
    const count = getWishlist().length;
    if (!wishlistCount) return;
    wishlistCount.textContent = count;
    wishlistCount.classList.toggle("is-empty", count === 0);
  }

function renderWishlistDrawer() {
    if (!wishlistBody) return;
    const ids = getWishlist();

    if (!ids.length) {
      wishlistBody.innerHTML = `
        <div class="wishlist-drawer__empty">
          <i class="fa-regular fa-heart"></i>
          Nothing saved yet.<br>Tap the heart on any piece to save it here.
        </div>`;
      return;
    }

    const cards = ids
      .map((id) => document.querySelector(`.gallery__item[data-id="${id}"]`))
      .filter(Boolean)
      .map((item) => {
        // Fetch the image source from the dataset
        const imgSrc = item.dataset.image || "";
        
        return `
          <div class="wishlist-card" data-id="${item.dataset.id}">
            <div class="wishlist-card__swatch">
              <img src="${imgSrc}" alt="${item.dataset.name || ""}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
            </div>
            <div class="wishlist-card__info">
              <span class="wishlist-card__cat">${item.dataset.category || ""}</span>
              <p class="wishlist-card__name">${item.dataset.name || ""}</p>
              <span class="wishlist-card__price">${item.dataset.price || ""}</span>
              <div class="wishlist-card__actions">
                <button class="wishlist-card__order" data-drawer-order>Order</button>
                <button class="wishlist-card__remove" data-drawer-remove>Remove</button>
              </div>
            </div>
          </div>`;
      });

    wishlistBody.innerHTML = cards.join("");
  }

  function openWishlistDrawer() {
    renderWishlistDrawer();
    wishlistDrawer?.classList.add("is-open");
    wishlistOverlay?.classList.add("is-open");
  }
  
  function closeWishlistDrawer() {
    wishlistDrawer?.classList.remove("is-open");
    wishlistOverlay?.classList.remove("is-open");
  }

  wishlistToggle?.addEventListener("click", openWishlistDrawer);
  wishlistClose?.addEventListener("click", closeWishlistDrawer);
  wishlistOverlay?.addEventListener("click", closeWishlistDrawer);

  wishlistBody?.addEventListener("click", (e) => {
    const card = e.target.closest(".wishlist-card");
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.closest("[data-drawer-remove]")) {
      toggleWishlist(id);
      const gridBtn = document.querySelector(`.gallery__item[data-id="${id}"] [data-save-btn]`);
      if (gridBtn) gridBtn.classList.remove("is-saved");
      
      const lightboxSaveBtn = document.getElementById("lightboxSaveBtn");
      if (lightboxSaveBtn?.dataset.currentId === id) lightboxSaveBtn.classList.remove("is-saved");
      
      renderWishlistDrawer();
      updateWishlistCount();
      showToast("Removed from wishlist");
    }

    if (e.target.closest("[data-drawer-order]")) {
      const item = document.querySelector(`.gallery__item[data-id="${id}"]`);
      openOrderModal(item);
    }
  });

  updateWishlistCount();

  /* ---------------- Before / After sliders ---------------- */
  document.querySelectorAll(".ba-slider__frame").forEach((frame) => {
    const after = frame.querySelector(".ba-slider__after");
    const handle = frame.querySelector(".ba-slider__handle");
    let dragging = false;

    function setPosition(clientX) {
      const rect = frame.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      after.style.clipPath = `inset(0 0 0 ${pct}%)`;
      handle.style.left = pct + "%";
    }
    frame.addEventListener("mousedown", (e) => { dragging = true; setPosition(e.clientX); });
    window.addEventListener("mousemove", (e) => { if (dragging) setPosition(e.clientX); });
    window.addEventListener("mouseup", () => (dragging = false));
    frame.addEventListener("touchstart", (e) => { dragging = true; setPosition(e.touches[0].clientX); }, { passive: true });
    frame.addEventListener("touchmove", (e) => { if (dragging) setPosition(e.touches[0].clientX); }, { passive: true });
    frame.addEventListener("touchend", () => (dragging = false));
  });

  /* ---------------- Testimonials Swiper ---------------- */
  if (window.Swiper) {
    const swiperEl = document.querySelector(".testimonials__swiper");
    if (swiperEl) {
      const testimonialSwiper = new Swiper(swiperEl, {
        slidesPerView: 1,
        spaceBetween: 28,
        speed: 700,
        loop: true,
        grabCursor: true,
        centeredSlides: false,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        preloadImages: true,
        autoplay: { delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true },
        navigation: {
          nextEl: swiperEl.querySelector(".testimonials__next"),
          prevEl: swiperEl.querySelector(".testimonials__prev"),
          disabledClass: "swiper-button-disabled"
        },
        pagination: {
          el: swiperEl.querySelector(".swiper-pagination"),
          clickable: true,
          dynamicBullets: true
        },
        keyboard: { enabled: true, onlyInViewport: true },
        breakpoints: {
          0: { slidesPerView: 1, spaceBetween: 18 },
          640: { slidesPerView: 1, spaceBetween: 22 },
          768: { slidesPerView: 2, spaceBetween: 24 },
          1100: { slidesPerView: 3, spaceBetween: 30 }
        }
      });
      swiperEl.querySelector(".testimonials__next")?.addEventListener("click", (e) => {
        e.preventDefault();
        testimonialSwiper.slideNext();
      });
      swiperEl.querySelector(".testimonials__prev")?.addEventListener("click", (e) => {
        e.preventDefault();
        testimonialSwiper.slidePrev();
      });
      window.addEventListener("resize", () => testimonialSwiper.update());
    }
  }
});