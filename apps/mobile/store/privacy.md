# Privacy answers

Applies to the app as built (no analytics, ads, crash-reporting or tracking SDKs; no IDFA; `NSPrivacyTracking: false` in the iOS privacy manifest). If you add Sentry, analytics or similar, update both forms.

Privacy policy URLs: https://ourpixs.com/privacy (EN) · https://bizimresimler.com/privacy (TR translation of the same UK policy).

## Decision needed first: photo location metadata
Originals are uploaded untouched, so phone photos can carry **EXIF GPS location**. Either:
- **(recommended)** strip GPS EXIF on the server when an original is stored (web: on `uploads/complete`), and keep the answers below; or
- keep it, and add **Location → Precise Location** (App Functionality, linked, not tracking) to both forms.

## Apple App Store → App Privacy ("nutrition label")

**Do you or your third-party partners collect data from this app?** Yes.

| Data type | Collected | Linked to the user | Used for tracking | Purposes |
|---|---|---|---|---|
| Contact Info → Email Address | Yes (hosts) | Yes | No | App Functionality |
| Contact Info → Name | Yes (host name, guest display name) | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality |
| User Content → Other User Content (guestbook notes) | Yes | Yes | No | App Functionality |
| Identifiers → User ID (account ID; per-event guest token) | Yes | Yes | No | App Functionality |
| Identifiers → Device ID | No (Expo push token is not a device ID; declare it under User ID if Apple asks) | | | |
| Purchases | No (the app has no purchases) | | | |
| Location | No (see decision above) | | | |
| Usage Data, Diagnostics, Health, Financial, Contacts, Browsing/Search History, Sensitive Info | No | | | |

Tracking: **No.** We don't link data with third-party data for advertising or share it with data brokers.

## Google Play → Data safety

- **Does your app collect or share any of the required user data types?** Yes.
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only; uploads use HTTPS presigned URLs).
- **Do you provide a way for users to request that their data is deleted?** Yes. In-app: Settings → Delete my account. Web link (required by Play): `https://ourpixs.com/account/delete` (create it; see checklist). Guests: delete own uploads in the app; hosts: delete an event (removes all its media).

| Category → type | Collected | Shared | Optional? | Purpose | Processed ephemerally |
|---|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required for hosts | App functionality, Account management | No |
| Personal info → Name | Yes | No | Required (guest display name) | App functionality | No |
| Photos and videos → Photos | Yes | No | Optional (user chooses to upload) | App functionality | No |
| Photos and videos → Videos | Yes | No | Optional | App functionality | No |
| Messages → Other in-app messages (guestbook) | Yes | No | Optional | App functionality | No |
| App info and performance | No | | | | |
| Device or other IDs | Yes (push token, guest token) | No | Optional (push) / required (guest token) | App functionality | No |
| Location | No (see decision above) | | | | |
| Financial info | No | | | | |

"Shared" = No: storage (Cloudflare R2 / Vercel Blob), database (Neon), email (Resend) and push (Expo/APNs/FCM) act as our **service providers/processors**, which Play does not count as sharing.

**Families / children:** target audience 18+ for hosts; the app is not directed at children. Answer "No" to "Is your app designed for children".

## Data retention (state it in the policy)
- Event media: kept for the plan's storage period (Free 30 days, One Day 1 year, Big Day 3 years), then deleted.
- Account: until the host deletes it (or asks us to; we act within 30 days).
- Guest identity: random per-event token stored on the device; server keeps only its hash.
