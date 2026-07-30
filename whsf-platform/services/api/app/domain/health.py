from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True, slots=True)
class ServiceHealth:
    service: str
    status: Literal["ok", "degraded"]
    version: str
    timestamp: datetime
