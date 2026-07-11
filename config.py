import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key-change-in-production")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
    JSON_SORT_KEYS = False
    TEMPLATES_AUTO_RELOAD = os.environ.get("FLASK_ENV") == "development"

    # NOTE: this limit only applies to bodies Flask itself receives (forms,
    # JSON, the small metadata POSTs the gallery admin makes). Uploaded
    # photos never pass through Flask/Vercel at all -- the browser uploads
    # them straight to Cloudinary -- so this stays untouched and small on
    # purpose; raising it is not needed and would only weaken protection
    # against unrelated abuse of other routes (e.g. /contact).
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024

    # Cloudinary (image storage/CDN for the Gallery admin). All three must
    # be set in production; see .env.example.
    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
    # Where gallery photos live inside the Cloudinary account. Namespacing
    # them makes it trivial to spot/clean up if this ever needs migrating.
    CLOUDINARY_GALLERY_FOLDER = os.environ.get("CLOUDINARY_GALLERY_FOLDER", "zewarish/gallery")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
