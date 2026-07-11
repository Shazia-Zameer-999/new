"""
db.py
-----
Single shared MongoDB connection, built from MONGODB_URI in .env
(zewarish-db.5ce4muw.mongodb.net -> "zewarish" database).

Only two collections are read through here: `filters` and `gallery`.
Everything else in /content still comes from the local JSON files —
this module is intentionally narrow.
"""
import os
from functools import lru_cache

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient
import certifi
from pymongo.errors import PyMongoError


@lru_cache(maxsize=1)
def get_db():
    """Cached Mongo connection. The database name ('zewarish') is read
    straight out of the URI path, so nothing else needs to be configured."""
    uri = os.environ.get("MONGODB_URI")
    print("Connecting to MongoDB at", uri)
    if not uri:
        raise RuntimeError("MONGODB_URI is not set — check your .env file")
    client = MongoClient(

    uri,

    tlsCAFile=certifi.where(),

    serverSelectionTimeoutMS=5000,

)
    return client.get_default_database()


def fetch_filters(default=None):
    """`filters` collection holds one document: { filters: [...] }."""
    try:
        doc = get_db().filters.find_one({})
        return doc.get("filters", default or []) if doc else (default or [])
    except PyMongoError as exc:
        print("Mongo error fetching filters:", exc)
        return default or []


def add_gallery_filter(category: str) -> bool:
    """Ensures `category` exists in the `filters` collection's single
    `filters` array. Called whenever the gallery admin form is submitted
    with a category that isn't already a known filter.

    Case-insensitive check (so "earrings" doesn't create a duplicate of
    "Earrings"), but the value is stored exactly as the admin typed it.
    Upserts the singleton filters document if it doesn't exist yet.

    Returns True if a new filter was actually added, False if it already
    existed (or the input was blank / a Mongo error occurred).
    """
    category = (category or "").strip()
    if not category:
        return False
    try:
        doc = get_db().filters.find_one({}, {"filters": 1}) or {}
        current = doc.get("filters", [])
        if any(str(c).strip().lower() == category.lower() for c in current):
            return False
        get_db().filters.update_one(
            {}, {"$addToSet": {"filters": category}}, upsert=True
        )
        return True
    except PyMongoError as exc:
        print("Mongo error adding filter:", exc)
        return False


def remove_filter_if_unused(category: str, keep=("All",)) -> bool:
    """Pulls `category` out of the `filters` array, but only if no gallery
    item uses it anymore. Meant to be called *after* a delete/edit that may
    have just removed the last product in a category, so the filter pill
    doesn't linger empty on the live site. Never removes anything in `keep`.

    Returns True if the filter was actually removed, False if it's still
    in use, wasn't there, was protected, or a Mongo error occurred.
    """
    category = (category or "").strip()
    if not category or category in keep:
        return False
    try:
        still_in_use = get_db().gallery.count_documents({"category": category}) > 0
        if still_in_use:
            return False
        result = get_db().filters.update_one({}, {"$pull": {"filters": category}})
        return result.modified_count > 0
    except PyMongoError as exc:
        print("Mongo error removing filter:", exc)
        return False


def fetch_gallery_photos(default=None):
    """`gallery` collection holds one document per photo/item."""
    try:
        photos = []
        for doc in get_db().gallery.find({}):
            doc["id"] = str(doc.pop("_id"))
            photos.append(doc)
        return photos
    except PyMongoError as exc:
        print("Mongo error fetching gallery photos:", exc)
        return default or []


# ---------------------------------------------------------------------------
# Gallery admin CRUD. Narrow and specific on purpose -- this is the only
# collection the admin dashboard is allowed to touch (see project brief:
# "only for managing Gallery items, do not add any other CMS features").
# ---------------------------------------------------------------------------

def fetch_gallery_photo_by_id(item_id: str):
    """Single gallery document by its Mongo _id, or None if missing/invalid."""
    try:
        oid = ObjectId(item_id)
    except (InvalidId, TypeError):
        return None
    try:
        doc = get_db().gallery.find_one({"_id": oid})
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        return doc
    except PyMongoError as exc:
        print("Mongo error fetching gallery photo:", exc)
        return None


def insert_gallery_photo(fields: dict) -> str:
    """Insert a new gallery document. Returns the new item's id as a string.
    Raises PyMongoError on failure -- callers decide how to surface that."""
    result = get_db().gallery.insert_one(fields)
    return str(result.inserted_id)


def update_gallery_photo(item_id: str, fields: dict) -> bool:
    """Update an existing gallery document by id. Returns True if a
    document was matched (even if the new values equal the old ones)."""
    try:
        oid = ObjectId(item_id)
    except (InvalidId, TypeError):
        return False
    result = get_db().gallery.update_one({"_id": oid}, {"$set": fields})
    return result.matched_count > 0


def delete_gallery_photo(item_id: str) -> bool:
    """Delete a gallery document by id. Returns True if a document was
    actually removed."""
    try:
        oid = ObjectId(item_id)
    except (InvalidId, TypeError):
        return False
    result = get_db().gallery.delete_one({"_id": oid})
    return result.deleted_count > 0
