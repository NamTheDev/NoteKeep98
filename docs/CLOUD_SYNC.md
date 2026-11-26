# Cloud synchronization

The only public frontend is https://namthedev.github.io/keep/. Railway is a backend API and WebSocket service, with persistent SQLite. Railway's root redirects to the canonical Pages site. The Pages build injects the public API base URL. Local development without cloud configuration remains local-only.

## Authentication
Private invitation-based workspace creation, reusable pairing token, independent device sessions and display-once owner recovery key. HTTPS requests use explicit bearer authorization with credentials omitted. WebSockets check the exact Pages origin and authenticate via the first frame, not a URL query string. CORS permits only the configured origin. Session bearer is kept in a separate IndexedDB store and excluded from note exports. GitHub Pages project paths share an origin; scripts from other apps on the same hostname must be trusted. HttpOnly cross-site cookies are not used because third-party cookie restrictions make them unreliable.

## Sync
Saved note changes use WebSocket events, revision cursors, acknowledgements, and conflict preservation. The active journal uses localStorage for optimistic notes and pending operations; the separate IndexedDB note/outbox prototype is not yet wired into the live client. Web Locks prevent simultaneous writers across tabs. Keep the original local-only data and export backups before importing important notes. No end-to-end encryption, offline app-shell guarantee, automatic history compaction or automated backup/restore guarantee yet.

## Verification
CI tests the cross-origin Pages-style frontend against a separate Bun backend, pairing two browser contexts, bidirectional saved-note propagation and revocation. Public smoke tests verify the Pages feature configuration, API health, redirect and CORS. Owner recovery or a pairing token is required to move an existing Railway-origin session to Pages; credentials and browser storage cannot cross origins automatically.
