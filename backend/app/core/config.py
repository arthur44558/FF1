from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(Path(__file__).resolve().parent.parent.parent / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = "development"
    database_url: str = "postgresql+psycopg://followup:followup_dev_only@localhost:5432/followup"
    auth_mode: str = "development"
    dev_auth_secret: str = ""
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    oidc_jwks_url: str | None = None
    private_storage_dir: Path = Path("./private_scans")
    form_templates_path: Path = Path("./config/form_templates.json")
    max_scan_bytes: int = Field(default=12 * 1024 * 1024, ge=1024, le=50 * 1024 * 1024)
    contact_encryption_key: str = ""
    contact_fingerprint_key: str = ""
    provider_webhook_secret: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    messaging_provider: str = "fake"
    outbound_messaging_enabled: bool = False
    worker_poll_seconds: float = Field(default=5.0, ge=1.0, le=60.0)
    worker_batch_size: int = Field(default=25, ge=1, le=250)
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]

    @model_validator(mode="after")
    def validate_security_configuration(self) -> "Settings":
        if self.auth_mode not in {"development", "oidc"}:
            raise ValueError("AUTH_MODE must be development or oidc")
        if self.environment.lower() in {"production", "prod"}:
            if self.auth_mode != "oidc":
                raise ValueError("Production requires OIDC authentication")
            if not all((self.oidc_issuer, self.oidc_audience, self.oidc_jwks_url)):
                raise ValueError("Production requires OIDC issuer, audience and JWKS URL")
            if self.outbound_messaging_enabled or self.messaging_provider != "fake":
                raise ValueError("This release supports only the disabled/fake messaging provider")
            if not self.contact_encryption_key or not self.contact_fingerprint_key:
                raise ValueError("Production requires contact encryption and fingerprint keys")
            if "localhost" in self.database_url or "dev_only" in self.database_url:
                raise ValueError("Production requires a managed/non-development database URL")
        if self.auth_mode == "development" and self.dev_auth_secret:
            if len(self.dev_auth_secret.encode("utf-8")) < 32:
                raise ValueError("DEV_AUTH_SECRET must be at least 32 bytes")
        if self.contact_encryption_key:
            try:
                Fernet(self.contact_encryption_key.encode("ascii"))
            except (ValueError, UnicodeEncodeError) as exc:
                raise ValueError("CONTACT_ENCRYPTION_KEY must be a valid Fernet key") from exc
        if self.contact_fingerprint_key and len(self.contact_fingerprint_key.encode("utf-8")) < 32:
            raise ValueError("CONTACT_FINGERPRINT_KEY must be at least 32 bytes")
        if self.provider_webhook_secret and len(self.provider_webhook_secret.encode("utf-8")) < 32:
            raise ValueError("PROVIDER_WEBHOOK_SECRET must be at least 32 bytes")
        if self.messaging_provider != "fake":
            raise ValueError("Only the fake messaging provider is implemented")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
