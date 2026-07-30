# ADR-0001: Monorepo with independently owned service boundaries

- Status: Accepted
- Date: 2026-07-30

## Context

WHSF must evolve a public static website into a secure platform without interrupting current services. User journeys share contracts and design primitives, while regulated data and operational failure domains need clear ownership.

## Decision

Use a pnpm monorepo for JavaScript applications and reusable packages. Keep Python services in the same repository with independent packaging, runtime, tests, and deployment boundaries. The current static site remains outside `whsf-platform` until routes are migrated deliberately.

## Consequences

Contract and component changes can be validated together. Services still own persistence and releases. CI path filters keep unrelated static-site changes fast. Repository governance must prevent accidental coupling across service databases.
