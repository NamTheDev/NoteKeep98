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
