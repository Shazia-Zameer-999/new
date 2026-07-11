"""
auth.py
-------
The site's only auth system: a single shared admin password, gated by a
Flask session flag. Both the existing appointments/newsletter admin and
the new Gallery admin reuse this exact mechanism -- no second login, no
second password, one session cookie.
"""
from functools import wraps

from flask import redirect, session, url_for


def is_admin() -> bool:
    return session.get("is_admin") is True


def admin_required(view):
    """Redirect to the shared /admin login if the session isn't
    authenticated. Use on any admin-only route."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if not is_admin():
            return redirect(url_for("main.admin_login"))
        return view(*args, **kwargs)

    return wrapped
