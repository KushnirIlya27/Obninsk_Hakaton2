"""File-backed SQLite is required for meaningful concurrent transaction tests."""

from .settings import *  # noqa: F403

DATABASES["default"]["TEST"] = {"NAME": BASE_DIR / "test_concurrency.sqlite3"}
