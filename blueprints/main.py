"""
blueprints/main.py
-------------------
The public-facing single-page site. Kept as a Flask Blueprint so a future
admin blueprint (or a second business vertical) can be registered
alongside it without touching this file.
"""
import json
import os
import re
from datetime import date as date_cls, datetime
from uuid import uuid4

from flask import (
    Blueprint,
    Response,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from utils.auth import is_admin
from utils.content_loader import load_all_content
from utils.seo_helpers import build_local_business_schema

main_bp = Blueprint("main", __name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
APPOINTMENTS_FILE = os.path.join(DATA_DIR, "appointments.json")
NEWSLETTER_FILE = os.path.join(DATA_DIR, "newsletter.json")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,15}$")


def _ensure_data_files():
    os.makedirs(DATA_DIR, exist_ok=True)
    for f in (APPOINTMENTS_FILE, NEWSLETTER_FILE):
        if not os.path.exists(f):
            with open(f, "w", encoding="utf-8") as fh:
                json.dump([], fh)


def _read_json(path: str) -> list:
    _ensure_data_files()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        current_app.logger.exception("Failed to read data file: %s", path)
        return []


def _write_json(path: str, records: list):
    _ensure_data_files()
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)


def _append_json(path: str, record: dict):
    records = _read_json(path)
    records.append(record)
    _write_json(path, records)


def _json_download(filename: str, records: list) -> Response:
    payload = json.dumps(records, indent=2, ensure_ascii=False)
    return Response(
        payload,
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@main_bp.route("/")
def index():
    content = load_all_content()
    schema_json = build_local_business_schema(
        content.get("business", {}), content.get("seo", {}), content.get("testimonials", {})
    )
    return render_template("index.html", schema_json=schema_json)


@main_bp.route("/api/book", methods=["POST"])
def book_appointment():
    data = request.get_json(silent=True) or request.form
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    service = (data.get("service") or "").strip()
    preferred_date = (data.get("date") or "").strip()
    time_slot = (data.get("time") or "").strip()
    stylist = (data.get("stylist") or "Any Available").strip()
    notes = (data.get("notes") or "").strip()

    errors = {}
    if len(name) < 2:
        errors["name"] = "Please enter your full name."
    if not PHONE_RE.match(phone):
        errors["phone"] = "Please enter a valid phone number."
    if not service:
        errors["service"] = "Please choose a jewellery need."
    if not preferred_date:
        errors["date"] = "Please choose a date."
    if not time_slot:
        errors["time"] = "Please choose a time slot."
    try:
        selected_date = date_cls.fromisoformat(preferred_date)
        if selected_date < datetime.now().date():
            errors["date"] = "Please choose today or a future date."
    except ValueError:
        errors["date"] = "Please choose a valid date."

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    record = {
        "id": uuid4().hex,
        "name": name, "phone": phone, "service": service, "date": preferred_date,
        "time": time_slot, "stylist": stylist, "notes": notes,
        "status": "new",
        "submitted_at": datetime.utcnow().isoformat() + "Z",
    }
    try:
        _append_json(APPOINTMENTS_FILE, record)
    except OSError:
        current_app.logger.exception("Failed to persist appointment")
        return jsonify({"ok": False, "errors": {"_general": "Something went wrong. Please call us directly."}}), 500

    return jsonify({"ok": True, "message": "Consultation request received! We'll confirm by phone within a few hours."})


@main_bp.route("/api/newsletter", methods=["POST"])
def newsletter_signup():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    if not EMAIL_RE.match(email):
        return jsonify({"ok": False, "errors": {"email": "Please enter a valid email address."}}), 400
    try:
        subscribers = _read_json(NEWSLETTER_FILE)
        if any(row.get("email") == email for row in subscribers):
            return jsonify({"ok": True, "message": "You're already on the list."})
        subscribers.append({"id": uuid4().hex, "email": email, "subscribed_at": datetime.utcnow().isoformat() + "Z"})
        _write_json(NEWSLETTER_FILE, subscribers)
    except OSError:
        return jsonify({"ok": False, "errors": {"_general": "Something went wrong."}}), 500
    return jsonify({"ok": True, "message": "You're on the list."})


@main_bp.route("/admin", methods=["GET", "POST"])
def admin_login():
    if is_admin():
        return redirect(url_for("main.admin_dashboard"))

    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        if password == current_app.config.get("ADMIN_PASSWORD"):
            session["is_admin"] = True
            return redirect(url_for("main.admin_dashboard"))
        error = "Incorrect password."

    return render_template("admin/login.html", error=error)


@main_bp.route("/admin/dashboard")
def admin_dashboard():
    if not is_admin():
        return redirect(url_for("main.admin_login"))

    appointments = sorted(_read_json(APPOINTMENTS_FILE), key=lambda row: row.get("submitted_at", ""), reverse=True)
    subscribers = sorted(_read_json(NEWSLETTER_FILE), key=lambda row: row.get("subscribed_at", ""), reverse=True)
    stats = {
        "appointments": len(appointments),
        "new": sum(1 for row in appointments if row.get("status", "new") == "new"),
        "confirmed": sum(1 for row in appointments if row.get("status") == "confirmed"),
        "subscribers": len(subscribers),
    }
    return render_template("admin/dashboard.html", appointments=appointments, subscribers=subscribers, stats=stats)


@main_bp.route("/admin/appointment/<appointment_id>/status", methods=["POST"])
def admin_update_appointment(appointment_id):
    if not is_admin():
        return redirect(url_for("main.admin_login"))

    status = request.form.get("status", "new")
    if status not in {"new", "confirmed", "completed", "cancelled"}:
        status = "new"

    appointments = _read_json(APPOINTMENTS_FILE)
    for row in appointments:
        if row.get("id") == appointment_id:
            row["status"] = status
            row["updated_at"] = datetime.utcnow().isoformat() + "Z"
            break
    _write_json(APPOINTMENTS_FILE, appointments)
    return redirect(url_for("main.admin_dashboard"))


@main_bp.route("/admin/export/<kind>")
def admin_export(kind):
    if not is_admin():
        return redirect(url_for("main.admin_login"))

    if kind == "appointments":
        return _json_download("appointments.json", _read_json(APPOINTMENTS_FILE))
    if kind == "newsletter":
        return _json_download("newsletter.json", _read_json(NEWSLETTER_FILE))
    return redirect(url_for("main.admin_dashboard"))


@main_bp.route("/admin/logout")
def admin_logout():
    session.pop("is_admin", None)
    return redirect(url_for("main.admin_login"))


@main_bp.route("/robots.txt")
def robots():
    content = load_all_content()
    base = content.get("seo", {}).get("canonical_url", "/").rstrip("/")
    body = f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n"
    return Response(body, mimetype="text/plain")


@main_bp.route("/sitemap.xml")
def sitemap():
    content = load_all_content()
    base = content.get("seo", {}).get("canonical_url", "/").rstrip("/")
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>"
        "</urlset>"
    )
    return Response(xml, mimetype="application/xml")


@main_bp.route("/manifest.webmanifest")
def manifest():
    content = load_all_content()
    business = content.get("business", {})
    theme = content.get("theme", {})
    palette = theme.get("palette", {})
    payload = {
        "name": business.get("name", "Zewarish"),
        "short_name": business.get("short_name", "Zewarish"),
        "start_url": "/",
        "display": "standalone",
        "background_color": palette.get("ivory", "#ffffff"),
        "theme_color": palette.get("bordeaux", "#7A2438"),
        "icons": [{"src": "/static/images/icon.svg", "sizes": "any", "type": "image/svg+xml"}],
    }
    return jsonify(payload)


@main_bp.route("/healthz")
def healthz():
    return jsonify({"ok": True})
