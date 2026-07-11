"""
blueprints/admin_gallery.py
---------------------------
The Gallery admin: the ONLY CMS surface this project exposes, by design
(see project brief -- appointments/newsletter admin already existed and
is left untouched in blueprints/main.py; this file adds nothing beyond
Create/Read/Update/Delete for gallery items).

Auth: reuses the existing single-admin-password session (utils.auth),
the same login at /admin used by the rest of the admin area.

Images: the browser uploads directly to Cloudinary using a short-lived
signature this blueprint hands out (see utils/cloudinary_utils.py for
the full reasoning). Flask/Vercel never receives or writes raw image
bytes -- only the resulting URL + public_id, which get stored in Mongo
like any other field.

Cache invalidation: utils.content_loader.load_all_content() is process-
cached (lru_cache) so the public site doesn't re-read Mongo on every
request. Every mutation here calls clear_content_cache() so changes are
visible immediately on the next page load, without adding any DB calls
to the public gallery's normal request path.
"""
import random

from flask import (
    Blueprint,
    current_app,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)

from utils.auth import admin_required
from utils.cloudinary_utils import delete_asset, generate_upload_signature, is_configured
from utils.content_loader import clear_content_cache
from utils.db import (
    delete_gallery_photo,
    fetch_gallery_photo_by_id,
    fetch_gallery_photos,
    insert_gallery_photo,
    update_gallery_photo,
)

admin_gallery_bp = Blueprint("admin_gallery", __name__, url_prefix="/admin/gallery")

VALID_SIZES = {"tall", "wide", "square"}
DEFAULT_SIZE = "square"


def _clean_str(value, max_len=None):
    value = (value or "").strip()
    if max_len:
        value = value[:max_len]
    return value


def _parse_price(raw):
    raw = (raw or "").strip()
    if not raw:
        return None, "Price is required."
    try:
        value = float(raw)
    except ValueError:
        return None, "Price must be a number."
    if value < 0:
        return None, "Price can't be negative."
    return (int(value) if value.is_integer() else round(value, 2)), None


def _parse_swatch(raw):
    raw = (raw or "").strip()
    if not raw:
        return random.randint(1, 12)
    try:
        value = int(raw)
    except ValueError:
        return random.randint(1, 12)
    return value if 1 <= value <= 12 else random.randint(1, 12)


def _validate_form(form, *, require_image: bool):
    """Returns (fields dict ready for Mongo, errors dict keyed by field)."""
    errors = {}

    name = _clean_str(form.get("name"), 120)
    category = _clean_str(form.get("category"), 60)
    sku = _clean_str(form.get("sku"), 40)
    # description = _clean_str(form.get("description"), 2000)
    size = _clean_str(form.get("size")).lower() or DEFAULT_SIZE

    if not category:
        errors["category"] = "Category is required."
    if not size:
        errors["size"] = "Size is required."
    if not sku:
        errors["sku"] = "SKU is required."

    if size not in VALID_SIZES:
        size = DEFAULT_SIZE

    price, price_error = _parse_price(form.get("price"))
    if price_error:
        errors["price"] = price_error

    swatch = _parse_swatch(form.get("swatch"))

    image_url = _clean_str(form.get("image_url"))
    image_public_id = _clean_str(form.get("image_public_id"))
    if require_image and not image_url:
        errors["image"] = "Please upload a photo for this piece."

    fields = {
        "name": name,
        "category": category,
        "sku": sku,
        "size": size,
        "swatch": swatch,
    }
    if price is not None:
        fields["price"] = price
    if image_url:
        fields["image"] = image_url
        fields["image_public_id"] = image_public_id

    return fields, errors


@admin_gallery_bp.route("/")
@admin_required
def gallery_list():
    photos = fetch_gallery_photos(default=[])
    # Newest first is the most useful order for an admin who just added
    # something and wants to confirm it. Mongo ObjectIds sort chronologically.
    photos = sorted(photos, key=lambda p: p.get("id", ""), reverse=True)
    return render_template(
        "admin/gallery_list.html",
        photos=photos,
        cloudinary_ready=is_configured(),
    )


@admin_gallery_bp.route("/new", methods=["GET", "POST"])
@admin_required
def gallery_new():
    if request.method == "POST":
        fields, errors = _validate_form(request.form, require_image=True)
        if errors:
            for message in errors.values():
                flash(message, "error")
            return render_template("admin/gallery_form.html", item=fields, errors=errors, mode="new")
        try:
            insert_gallery_photo(fields)
            clear_content_cache()
            flash("Gallery item added.", "success")
            return redirect(url_for("admin_gallery.gallery_list"))
        except Exception:
            current_app.logger.exception("Failed to insert gallery item")
            flash("Something went wrong saving this item. Please try again.", "error")
            return render_template("admin/gallery_form.html", item=fields, errors=errors, mode="new")

    return render_template("admin/gallery_form.html", item={}, errors={}, mode="new")


@admin_gallery_bp.route("/<item_id>/edit", methods=["GET", "POST"])
@admin_required
def gallery_edit(item_id):
    existing = fetch_gallery_photo_by_id(item_id)
    if not existing:
        flash("That gallery item no longer exists.", "error")
        return redirect(url_for("admin_gallery.gallery_list"))

    if request.method == "POST":
        fields, errors = _validate_form(request.form, require_image=False)
        if errors:
            for message in errors.values():
                flash(message, "error")
            merged = {**existing, **fields}
            return render_template("admin/gallery_form.html", item=merged, errors=errors, mode="edit", item_id=item_id)

        old_public_id = existing.get("image_public_id")
        new_public_id = fields.get("image_public_id")

        try:
            update_gallery_photo(item_id, fields)
            clear_content_cache()
            # Only clean up the old asset once the new one is confirmed
            # saved, and only if the image actually changed.
            if new_public_id and old_public_id and new_public_id != old_public_id:
                delete_asset(old_public_id)
            flash("Gallery item updated.", "success")
            return redirect(url_for("admin_gallery.gallery_list"))
        except Exception:
            current_app.logger.exception("Failed to update gallery item")
            flash("Something went wrong saving this item. Please try again.", "error")
            merged = {**existing, **fields}
            return render_template("admin/gallery_form.html", item=merged, errors=errors, mode="edit", item_id=item_id)

    return render_template("admin/gallery_form.html", item=existing, errors={}, mode="edit", item_id=item_id)


@admin_gallery_bp.route("/<item_id>/delete", methods=["POST"])
@admin_required
def gallery_delete(item_id):
    existing = fetch_gallery_photo_by_id(item_id)
    if not existing:
        flash("That gallery item no longer exists.", "error")
        return redirect(url_for("admin_gallery.gallery_list"))

    deleted = delete_gallery_photo(item_id)
    if deleted:
        clear_content_cache()
        public_id = existing.get("image_public_id")
        if public_id:
            delete_asset(public_id)
        flash("Gallery item deleted.", "success")
    else:
        flash("Couldn't delete that item -- it may already be gone.", "error")

    return redirect(url_for("admin_gallery.gallery_list"))


@admin_gallery_bp.route("/upload-signature", methods=["POST"])
@admin_required
def upload_signature():
    """Hands the browser everything it needs to upload directly to
    Cloudinary. No image bytes pass through this endpoint or Flask."""
    if not is_configured():
        return jsonify({"ok": False, "message": "Cloudinary is not configured on the server."}), 503

    folder = current_app.config.get("CLOUDINARY_GALLERY_FOLDER", "zewarish/gallery")
    payload = generate_upload_signature(folder)
    return jsonify({"ok": True, **payload})
