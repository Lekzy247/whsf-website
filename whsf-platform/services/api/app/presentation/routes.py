from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.health import GetServiceHealth
from app.core.config import Settings, get_settings
from app.presentation.schemas import HealthResponse

router = APIRouter(tags=["service"])


SettingsDependency = Annotated[Settings, Depends(get_settings)]


def health_use_case(settings: SettingsDependency) -> GetServiceHealth:
    return GetServiceHealth(settings.service_name, settings.version)


HealthUseCaseDependency = Annotated[GetServiceHealth, Depends(health_use_case)]


@router.get("/health", response_model=HealthResponse)
async def health(use_case: HealthUseCaseDependency) -> HealthResponse:
    return HealthResponse.model_validate(use_case.execute())


@router.get("/live", include_in_schema=False)
async def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", include_in_schema=False)
async def ready() -> dict[str, str]:
    # Dependency probes are added when the first persistence-backed module is activated.
    return {"status": "ok"}


v1_router = APIRouter(prefix="/v1")


@v1_router.get("/meta", tags=["platform"])
async def platform_meta(settings: SettingsDependency) -> dict[str, str]:
    return {"name": "WHSF Humanitarian Platform", "environment": settings.environment}
