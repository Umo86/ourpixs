# App Review notes and demo account

Sign-in is passwordless (email → 6-digit code). Reviewers can't read our email, so we use a fixed **review account**.

## How the review bypass works

| Piece | Where | What it does |
|---|---|---|
| `REVIEW_EMAIL` | **web** env (server) | The one email address allowed to use the fixed code, e.g. `appreview@ourpixs.com`. |
| `REVIEW_CODE` | **web** env (server, secret) | Fixed 6-digit code for that email only, e.g. a random `482913`. Never in the app bundle. |
| `EXPO_PUBLIC_REVIEW_EMAIL` | **mobile** env (EAS build) | Same address as `REVIEW_EMAIL`. When typed on the sign-in screen, the app shows the hint "Review account: enter the code from the App Review notes" and moves to the code step even if email sending fails. |

**Mobile side (done):** `src/app/login.tsx` + `REVIEW_EMAIL` in `src/config.ts`. The app never contains the code.

**Web side (to do, apps/web — `/api/v1/auth/*`):**
1. `POST /api/v1/auth/request-code`: if `email === REVIEW_EMAIL`, return `{ ok: true }` without emailing (or email as normal).
2. `POST /api/v1/auth/verify`: if both `REVIEW_EMAIL` and `REVIEW_CODE` are set, `email === REVIEW_EMAIL` and `code === REVIEW_CODE` (constant-time compare), issue the normal JWT for that host. Any other email must follow the normal path. Keep the normal rate limiting.
3. Seed the review host with one sample event (photos, a few challenges, guestbook messages) so the reviewer sees a populated album. Paid features need the event on the `buyuk` plan.
4. Rotate `REVIEW_CODE` after each review if you want; update App Store Connect / Play Console at the same time.

## Paste into App Store Connect → App Review Information → Notes

```
Sign-in is passwordless: the app emails a 6-digit code.
For review please use:
  Email: <REVIEW_EMAIL>
  Code:  <REVIEW_CODE>
This account already has a sample event ("Elif & Can's Wedding") with photos, challenges and guestbook messages.

What to try:
1. Welcome → "Host an event" → sign in with the details above.
2. Open the event: Album (tap to view, long-press to select → favourite / hide / save / delete), Upload, QR, Guestbook, Challenges, Live wall, Settings.
3. Guest side: Welcome → "Join an event by QR" → type the event code shown on the QR tab (e.g. elif-can) → enter a name, accept → Feed, Upload, Challenges, Guestbook.
   Guests do not need the app; normally they scan the QR with the phone camera and use our website.

User-generated content: albums are private to each event (only people with the event QR/link and PIN, if set, can see them).
Guests must accept terms before uploading, can delete their own uploads (Feed → My uploads) and can report any photo (viewer → Report, which emails our moderation team).
Hosts can hide or delete any upload, require approval before uploads are shown, and set a guest PIN.

The app contains no purchases and no links to external purchasing.
Permissions: camera (scan QR, take photos), photo library (pick photos to upload; add-only to save downloads), notifications (new uploads, optional).
```

Google Play Console → App content → App access: choose "All or some functionality is restricted", add the same credentials and steps.

## Common rejection risks we've already handled
- **4.2 minimum functionality**: native camera, QR scanning, upload queue, camera-roll saving, push notifications.
- **3.1.1 payments**: store builds hide the Stripe upgrade buttons (`EXPO_PUBLIC_EXTERNAL_CHECKOUT=0` in the `production` EAS profile). Don't turn it on for store builds.
- **5.1.1(v) account deletion**: Settings → "Delete my account" opens a pre-filled deletion request email. Apple prefers an in-app flow; see checklist item "Account deletion endpoint".
- **1.2 UGC**: report, hide, delete, approval mode, PIN. Blocking a specific guest needs a backend endpoint (see checklist).
