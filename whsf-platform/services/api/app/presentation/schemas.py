from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    service: str
    status: Literal["ok", "degraded"]
    version: str
    timestamp: datetime
