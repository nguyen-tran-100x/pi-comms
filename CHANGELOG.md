# Changelog

## [0.1.1] - 2026-10-30

- Clarify routing validation errors with explicit new-message and reply forms, without inferring intent from conflicting fields or encouraging fabricated IDs.
- Document recovery from provider schemas that incorrectly require optional routing fields.
- Add offline regression coverage for serialized schemas and Google/OpenAI provider conversions.

## [0.1.0] - 2026-10-29

Initial public release.

- User-approved communication between existing Pi sessions, exact native identities and reusable reply handles.
- Independent batched asks with bounded waits, partial outcomes, late replies and exact-request response progress.
- Human-first intake: Pause, revoke, interruption and open contact decisions hold unadmitted replies.
- Plain-text tool results with structured evidence, full payload inspection and response links.
- Isolated artifact verification, Linux/macOS CI and versioned npm/GitHub release automation.

State is memory-only. Reloads/restarts lose approval and runtime linkage. Scripted native-session tests do not establish real-model compliance or human usability. Tested against Pi 1.4.0; other Pi versions are not claimed.
