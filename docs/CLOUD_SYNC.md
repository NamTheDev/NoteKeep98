# Cloud synchronization (implementation in progress)

Approved scope: optional accountless synchronization of saved notes, labels, reminders,
checklists, archive and trash; immediate WebSockets; GitHub Pages remains local-only.
Railway will serve the same frontend and API on one origin, with SQLite on a persistent
volume. Cloud access is not enabled by these foundation modules.

## Approved defaults
- Invitation-only workspace creation; 10 devices, 5,000 notes, 50 MB live data.
- 150 MB separate history budget; 90-day history and automatic offline reconciliation;
  tombstones retained at least 180 days. Older clients must take a snapshot and preserve
  pending edits separately, never replay blindly.
- 256-bit random opaque credentials, SHA-256 digests, reusable pairing grant until
  revoked, independent owner and device session families, renewable sessions with
  90-day inactivity timeout. No IP-derived secrets. Owner recovery key displayed once.
- 120 mutations/minute/device, 256 KiB per ordinary message, 10 pairing attempts/minute
  and five recovery attempts/15 minutes (additional aggregate limits needed).
- No CRDT or per-keystroke collaboration; no end-to-end encryption in this release.

## Implementation state
The shared protocol, conservative three-way merge and SQLite credential/revision transaction modules are initial foundations only. The database module is not exposed over HTTP or WebSockets yet. Recovery, rotation, live socket revocation, history compaction and total storage limits still require implementation.
Text merge handles independent contiguous changes; overlapping or ambiguous changes
return conflicts. No note is silently overwritten. Full synchronization requires
transactional revision storage, durable outbox, authenticated server, cursor recovery,
conflict UI, deletion handling and verification. Checklist reordering and global label
operations need explicit protocol semantics before production.

## Release gates
Verify owner recovery, pairing revocation and active socket termination, origin/CSRF,
idempotency, stale offline reconciliation, backup/restore, data migration and multi-tab
coordination. Do not enable cloud mode until those gates pass. Confirm Railway billing
and persistent storage before deployment. Existing local-only behavior is unaffected.

The IndexedDB foundation provides an atomic per-workspace optimistic note/outbox write,
acknowledgement transaction, and monotonic cursor. The browser test checks reopen,
workspace isolation, later local edits, duplicate acknowledgements and cursor gaps.
It is not wired into the current app. Snapshot installation, legacy migration,
queued-edit rebasing, tab leadership and the app shell remain to be implemented.

## Live test implementation
The same-origin Railway deployment exposes workspace creation, pairing, owner recovery,
token rotation/revocation, device removal, session logout, snapshot, and WebSocket
resume/mutation APIs. The private deployment admits one workspace using a Railway
invitation secret. GitHub Pages does not receive the cloud feature marker.

This is a test release, not the completed durability specification: the active
browser client currently uses a single localStorage journal for atomic optimistic
state and queue persistence, with a Web Locks writer and read-only secondary tabs.
The previously tested IndexedDB outbox is not yet integrated into the app. Browser
quota is therefore smaller than the cloud quota. No service worker/offline shell,
automatic history compaction, backup automation, or end-to-end encryption yet.
Conflict recovery preserves an edit as a separate note; arbitrary multi-hunk merge
and manual merged-text editing are not included. Export JSON backups before testing
important data. The cloud database must reside on the attached volume.
