Kotlin / Kotlin Multiplatform Version
=====================================

This folder will contain the refactored Kotlin/Kotlin Multiplatform implementation of the genealogy (gia phả) tool.

Proposed structure (can be refined later):

- `core/` – Shared KMP module with domain models, use cases, and validation logic.
- `backend/` – JVM backend (e.g., Ktor or Spring Boot) exposing HTTP APIs and talking to Postgres.
- `web/` – Web client (either Kotlin/JS or integration with an existing JS/TS frontend).
- `mobile/` – Optional mobile targets (Android/iOS) using the shared `core` module.

At this stage, this is only a placeholder to lock in the high-level layout.

