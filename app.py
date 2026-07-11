import logging
import os
from dotenv import load_dotenv

load_dotenv()  # add this before anything reads os.environ

from flask import Flask
from config import CONFIG_MAP
from blueprints.main import main_bp
from blueprints.admin_gallery import admin_gallery_bp
from utils.cloudinary_utils import configure as configure_cloudinary, optimized_url
from utils.content_loader import load_all_content
import resend
from flask import request, redirect, url_for, flash, jsonify
import html

resend.api_key = os.environ.get("RESEND_API_KEY")


def create_app():
    env = os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__)
    app.config.from_object(CONFIG_MAP.get(env, CONFIG_MAP["development"]))

    if not app.debug:
        logging.basicConfig(level=logging.INFO)

    configure_cloudinary(app)
    # Used by templates/sections/gallery.html to serve every gallery photo
    # pre-compressed, in the best format the browser supports, via
    # Cloudinary's CDN -- pure string manipulation, no extra request.
    app.jinja_env.filters["cloudinary_url"] = optimized_url

    @app.context_processor
    def inject_content():
        """Every template in every blueprint can use `content.<file>.<key>`
        directly, e.g. {{ content.business.name }}. Registered at the app
        level (not on a single blueprint) so it's available uniformly --
        Flask only applies a blueprint's own @context_processor to requests
        handled by that same blueprint, which would otherwise leave the
        admin_gallery blueprint's templates without `content`."""
        return {"content": load_all_content()}

    app.register_blueprint(main_bp)
    app.register_blueprint(admin_gallery_bp)

    @app.errorhandler(404)
    def not_found(e):
        return "Page not found. <a href='/'>Return home</a>", 404

    @app.errorhandler(500)
    def server_error(e):
        app.logger.exception("Server error")
        return "Something went wrong. Please try again shortly.", 500

    @app.route("/contact", methods=["POST"])
    def contact():
        data = request.get_json(silent=True) or {}

        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        phone = data.get("phone", "").strip()
        category = data.get("service", "").strip()
        message = data.get("notes", "").strip()

        if not name:
            return jsonify({"ok": False, "message": "Name is required."}), 400

        # Escape user input before dropping it into HTML email
        safe_name = html.escape(name)
        safe_email = html.escape(email) if email else "Not provided"
        safe_phone = html.escape(phone) if phone else "Not provided"
        safe_category = html.escape(category) if category else "Not specified"
        safe_message = html.escape(message).replace("\n", "<br>") if message else "No message"

        html_body = f"""
        <h2>New Jewellery Enquiry</h2>
        <p><strong>Name:</strong> {safe_name}</p>
        <p><strong>Email:</strong> {safe_email}</p>
        <p><strong>Phone:</strong> {safe_phone}</p>
        <p><strong>Category:</strong> {safe_category}</p>
        <p><strong>Message:</strong><br>{safe_message}</p>
        """

        try:
            params = {
                "from": "Website Contact <onboarding@resend.dev>",
                "to": ["zewarishhh@gmail.com"],
                "subject": f"New Enquiry from {name}",
                "html": html_body,
            }
            if email:
                params["reply_to"] = email

            resend.Emails.send(params)
            return jsonify({"ok": True, "message": "Thanks! We'll be in touch soon."})
        except Exception as e:
            print("Resend error:", e)
            return jsonify({"ok": False, "message": "Something went wrong. Please try again."}), 500
    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG", True))
