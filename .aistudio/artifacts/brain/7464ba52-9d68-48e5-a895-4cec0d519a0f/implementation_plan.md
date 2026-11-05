# Implementation Plan: Set DJ PIN to 1234 in .env

Configure the server's `DJ_PIN` environment variable to `1234` so the DJ Booth (`/dj`) and Stage Player (`/player`) can authenticate, unlock controls, and allow changing the PIN at any time.

## Proposed Changes

### 1. Environment Configuration
- Create a `.env` file containing `DJ_PIN="1234"`.
- Ensure `.env.example` remains updated with documentation for `DJ_PIN`.
- Verify `server.ts` loads environment variables via `dotenv` upon startup.

### 2. Verification & Testing
- Restart the development server so `process.env.DJ_PIN` is loaded.
- Test `POST /api/admin/verify-pin` with PIN `1234` using `curl` to verify it returns a valid bearer session token (`{ success: true, token: "..." }`).
- Test wrong PIN attempts to ensure 401 unauthorized and rate-limiting are intact.
- Verify authentication and unlocking on `/dj` and `/player`.

### 3. Usage Guidance
- Document how to unlock with `1234`.
- Explain how to update the PIN dynamically via the DJ Booth ("Console Tools > Change PIN") or by editing the `.env` file.
