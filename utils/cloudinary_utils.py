"""
cloudinary_utils.py
--------------------
Everything the Gallery admin needs to talk to Cloudinary, kept in one
narrow module (mirrors the intentionally-narrow style of utils/db.py).

Why Cloudinary, and why this shape of integration:

- Vercel's Python runtime is a serverless function: its filesystem is
  read-only outside of /tmp, /tmp itself is wiped between invocations,
  and there is no guarantee two requests even land on the same instance.
  Any code that does `file.save("static/images/...")` will either throw
  (read-only fs) or silently vanish (wrote to a container that's gone by
  the next request) -- that's the classic "works on localhost, breaks on
  Vercel" bug for image uploads.
- Cloudinary removes the filesystem from the equation entirely: images
  are stored on Cloudinary's own infra and served through their CDN, so
  Vercel never needs to persist a byte of image data.
- Uploads go BROWSER -> CLOUDINARY DIRECTLY, not browser -> Flask ->
  Cloudinary. Flask only ever hands out a short-lived signature. This
  matters for performance: raw image bytes never touch the serverless
  function (no 4.5MB request-body ceiling to worry about, no function
  execution time spent proxying bytes, no extra bandwidth cost), and the
  admin dashboard stays just as lightweight as the rest of the site.
- Delivery is optimized via Cloudinary's URL-based transformations
  (f_auto,q_auto + a sane width cap) rather than a server-side image
  pipeline: it's just string manipulation on our end (free, instant),
  and Cloudinary's CDN handles format negotiation (WebP/AVIF) and
  compression, and caches the result at the edge.
"""
import time

import cloudinary
import cloudinary.uploader
import cloudinary.utils

_configured = False


def configure(app):
    """Call once from create_app(). Safe to call multiple times."""
    global _configured
    cloudinary.config(
        cloud_name=app.config.get("CLOUDINARY_CLOUD_NAME"),
        api_key=app.config.get("CLOUDINARY_API_KEY"),
        api_secret=app.config.get("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    _configured = True


def is_configured() -> bool:
    cfg = cloudinary.config()
    return bool(cfg.cloud_name and cfg.api_key and cfg.api_secret)


def generate_upload_signature(folder: str) -> dict:
    """Sign a narrow, fixed set of upload params. The browser must send
    back EXACTLY these params (plus file + api_key) or Cloudinary will
    reject the upload with 'Invalid Signature' -- that's a feature: it
    stops anyone from smuggling in extra params (like a different folder
    or an upload_preset) using a signature meant for something else.
    """
    timestamp = int(time.time())
    params_to_sign = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params_to_sign, cloudinary.config().api_secret)
    return {
        "timestamp": timestamp,
        "folder": folder,
        "signature": signature,
        "api_key": cloudinary.config().api_key,
        "cloud_name": cloudinary.config().cloud_name,
    }


def delete_asset(public_id: str) -> bool:
    """Best-effort delete. Returns True on Cloudinary-confirmed deletion,
    False otherwise -- callers should treat False as non-fatal (an
    orphaned Cloudinary asset is a minor cleanup issue, not a reason to
    fail the user's edit/delete action on the gallery item itself)."""
    if not public_id:
        return False
    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get("result") == "ok"
    except Exception as exc:  # noqa: BLE001 - deliberately broad, best-effort
        print("Cloudinary delete error:", exc)
        return False


def optimized_url(url: str, width: int = 1200) -> str:
    """Insert f_auto,q_auto (+ a width cap) into a Cloudinary delivery URL
    so every gallery image is served pre-compressed, in the best format
    the requesting browser supports, off Cloudinary's CDN.

    Non-Cloudinary URLs (e.g. legacy /static/images/... paths from before
    this migration) are returned untouched -- this keeps old gallery rows
    working exactly as they do today until they're re-saved through the
    admin with a real upload.
    """
    if not url or "res.cloudinary.com" not in url or "/upload/" not in url:
        return url
    transform = f"f_auto,q_auto,w_{width},c_limit"
    return url.replace("/upload/", f"/upload/{transform}/", 1)
