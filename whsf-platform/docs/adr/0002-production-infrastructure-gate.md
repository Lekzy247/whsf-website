# ADR-0002: Gate stateful production infrastructure

- Status: Proposed
- Date: 2026-07-30

## Context

The brief requires Terraform and production readiness, but provider account topology, legal data residency, recovery objectives, traffic, ownership, and approved cost envelope are not yet recorded.

## Decision

Commit provider constraints, tagging, environment validation, containers, and local topology now. Do not create stateful cloud resources until WHSF approves:

- target accounts and regions;
- data classification and residency;
- RTO, RPO, backup, and retention;
- network and identity topology;
- budget and operational ownership.

## Consequences

Milestone 1 remains reproducible without presenting an assumed cloud design as approved production architecture. Milestone 2 must accept or replace this proposal before real infrastructure is provisioned.
