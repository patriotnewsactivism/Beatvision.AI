# Security Specification - BeatVision AI

## Data Invariants
1. A VideoBlueprint must always have a `userId` that matches the authenticated user.
2. `createdAt` must be the server time.
3. Users can only read and write their own blueprints.
4. Users can only read and write their own user profile.

## The Dirty Dozen Payloads (Rejection Targets)
1. Creating a blueprint with a different `userId`.
2. Updating a blueprint's `userId`.
3. Writing a blueprint without a `title`.
4. Writing a blueprint with a massive `title` string (over 256 chars).
5. Writing a blueprint with more than 50 storyboard scenes (resource exhaustion).
6. Writing a blueprint with an invalid `timestamp` format.
7. Reading all blueprints without a filter.
8. Updating a blueprint's `createdAt` field after creation.
9. Creating a user profile for a different UID.
10. Writing a color palette with 100+ colors.
11. Injecting a massive string into a document ID.
12. Modifying another user's blueprint by knowing its ID.

## Test Strategy
- Verify `userId` ownership.
- Verify schema validation (field presence, types, sizes).
- Verify immutability of `userId` and `createdAt`.
