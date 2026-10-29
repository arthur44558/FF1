from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class ProviderSendResult:
    status: str
    provider_message_id: str
    error_code: str | None = None


class ProviderSendError(Exception):
    def __init__(self, code: str, *, retryable: bool, outcome_unknown: bool = False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable
        self.outcome_unknown = outcome_unknown


class FakeMessagingProvider:
    """Development adapter. It records a fake acceptance and performs no network request."""

    async def send_template(
        self,
        destination: str,
        template_key: str,
        variables: dict[str, str],
        idempotency_key: str,
    ) -> ProviderSendResult:
        del destination, template_key, variables, idempotency_key
        return ProviderSendResult(status="accepted", provider_message_id=f"fake-{uuid4()}")

    async def get_status(self, provider_message_id: str) -> str:
        del provider_message_id
        return "unknown"
