from datetime import datetime, timezone

from sqlalchemy.orm import declarative_base


Base = declarative_base()


def utcnow_naive() -> datetime:
    """Return current UTC time as a timezone-naive datetime.

    PostgreSQL ``TIMESTAMP WITHOUT TIME ZONE`` columns (``DateTime`` without
    ``timezone=True``) reject timezone-aware Python datetimes when using the
    asyncpg driver.  This helper strips the ``tzinfo`` so the value is
    compatible with such columns while still representing UTC.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
