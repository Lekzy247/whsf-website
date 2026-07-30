from datetime import UTC, datetime

from app.domain.health import ServiceHealth


class GetServiceHealth:
    def __init__(self, service: str, version: str) -> None:
        self._service = service
        self._version = version

    def execute(self) -> ServiceHealth:
        return ServiceHealth(
            service=self._service,
            status="ok",
            version=self._version,
            timestamp=datetime.now(UTC),
        )
