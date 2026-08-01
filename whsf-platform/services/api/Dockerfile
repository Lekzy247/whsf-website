FROM python:3.13-slim AS build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY pyproject.toml README.md ./
COPY app ./app
RUN python -m venv /opt/venv && /opt/venv/bin/pip install .

FROM python:3.13-slim AS runtime
ENV PATH=/opt/venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN addgroup --system whsf && adduser --system --ingroup whsf whsf
COPY --from=build /opt/venv /opt/venv
COPY --chown=whsf:whsf app ./app
USER whsf
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=10.0.0.0/8,172.16.0.0/12"]
