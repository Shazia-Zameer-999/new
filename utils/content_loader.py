"""
content_loader.py
------------------
Loads every JSON file in /content into a single namespace so templates
never contain hardcoded copy. This is what makes the engine "reusable":
duplicate the project, edit the JSON files, done.
"""
import json
import os
from functools import lru_cache

from utils.db import fetch_filters, fetch_gallery_photos

CONTENT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "content")

# Maps content key -> filename (without extension)
CONTENT_FILES = [
    "business", "homepage", "services", "gallery", "pricing",
    "offers", "faq", "blog", "testimonials", "team",
    "theme", "seo", "navigation", "socials",
]


def _load_json(name: str) -> dict:
    path = os.path.join(CONTENT_DIR, f"{name}.json")
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_all_content() -> dict:
    """Loads and caches every content file. Cache is process-lifetime;
    call clear_content_cache() after an admin edit to force a reload.

    `gallery.filters` and `gallery.photos` are the two exceptions: those
    come live from MongoDB (the `filters` and `gallery` collections).
    Everything else in gallery.json (e.g. `section` copy) is untouched.
    The JSON values are kept as a fallback if MongoDB is unreachable.
    """
    data = {name: _load_json(name) for name in CONTENT_FILES}

    gallery = data.setdefault("gallery", {})
    gallery["filters"] = fetch_filters(default=gallery.get("filters", []))
    gallery["photos"] = fetch_gallery_photos(default=gallery.get("photos", []))

    return data


def clear_content_cache():
    load_all_content.cache_clear()


def get(key: str, default=None):
    """Convenience getter: get('business') -> dict from business.json"""
    return load_all_content().get(key, default)
