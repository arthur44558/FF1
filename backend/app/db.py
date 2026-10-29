from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


raw_url = settings.database_url
if raw_url.startswith("postgresql://") and "+psycopg" not in raw_url:
    normalized_url = raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
else:
    normalized_url = raw_url

engine_kwargs = {"pool_pre_ping": True}
if normalized_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_engine(
    normalized_url,
    **engine_kwargs,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
