# Release checklist (in order)

Owner: the person with the Apple Developer and Google Play accounts. Items marked **web** need apps/web work first.

## A. Backend prerequisites (web)
1. **web** Deploy `/api/v1/*` per `docs/API.md`, including `POST /api/v1/occasions/:id/uploads/complete` (the app assumes this mirror of the guest route for host uploads).
2. **web** Review account: `REVIEW_EMAIL` + `REVIEW_CODE` honoured in `/api/v1/auth/verify`, plus a seeded sample event on an account with an active subscription (see review-notes.md).
3. **web** Universal links: serve these with `Content-Type: application/json`, no redirects, on **bizimresimler.com, www.bizimresimler.com, ourpixs.com, www.ourpixs.com** (done: `apps/web/src/app/.well-known/*`, from `APPLE_TEAM_ID` / `ANDROID_SHA256_FINGERPRINTS`):
   - `/.well-known/apple-app-site-association` →
     `{"applinks":{"details":[{"appIDs":["<TEAMID>.com.bizimresimler.app"],"components":[{"/":"/g/*"}]}]}}`
   - `/.well-known/assetlinks.json` →
     `[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"com.bizimresimler.app","sha256_cert_fingerprints":["<PLAY APP SIGNING SHA-256>"]}}]`
     (fingerprint: Play Console → Setup → App signing, after the first upload).
4. **web** Pages that the store listing links to: `/support` (contact details), `/privacy` (UK GDPR policy; English and Turkish on bizimresimler.com, `?lang=en|tr`), `/terms`, `/account/delete` (Play requires a web deletion page).
5. **web** Account deletion: an in-app-triggerable endpoint (e.g. `DELETE /api/v1/me`) is strongly recommended for Apple 5.1.1(v). The app currently opens a pre-filled email request; switch to the endpoint when it exists.
6. **web** Decide EXIF location: strip GPS on upload (recommended) or declare Location (privacy.md).
7. **web** (UGC 1.2) "Remove guest" endpoint so hosts can block an abusive guest; then add the button to the app.
8. **web** Push sending: store Expo push tokens from `/api/v1/push-tokens` and send `{ occasionId }` in the notification `data` (the app opens that event on tap).
9. **web** Make sure `GET /api/v1/me` returns `subscription`, host occasions return `access`, guest payloads return `uploadsOpen`, and download endpoints answer 402 `{ "error": "plan_required" }` when locked (docs/API.md). The app's shapes are in `src/api/types.ts` (`Subscription`, `OccasionAccess`).

## B. One-time setup
10. Replace placeholder art: `assets/images/{icon,adaptive-icon,adaptive-icon-monochrome,splash-icon,notification-icon,favicon}.png` (regenerate or design; keep sizes). The icon must have no transparency.
11. `cd apps/mobile && npx eas-cli@latest login && npx eas-cli@latest init` → copy the project ID into EAS env `EAS_PROJECT_ID` (push tokens need it).
12. EAS environment variables (production): `EAS_PROJECT_ID`, `EXPO_PUBLIC_REVIEW_EMAIL` (same as the server's `REVIEW_EMAIL`). Optional: `EXPO_PUBLIC_API_URL`.
13. Apple Developer: register bundle IDs `com.bizimresimler.app` (+ `.preview`, `.dev` for internal builds) with **Associated Domains** and **Push Notifications**. `eas credentials -p ios` creates certificates, profiles and the APNs key.
14. App Store Connect → New App: name "BizimResimler", primary language English (UK), bundle `com.bizimresimler.app`, SKU `bizimresimler-ios`. Add Turkish localisation (name "BizimResimler" too).
15. Put the App Store Connect Apple ID in `eas.json → submit.production.ios.ascAppId` and your team ID in `appleTeamId`.
16. Google Play Console → Create app: "BizimResimler", default language English (UK), App, Free, package `com.bizimresimler.app`. Add Turkish (tr-TR).
17. Google Cloud service account with Play Console access (Release manager) → save JSON as `apps/mobile/google-service-account.json` (git-ignored).

## C. Build and upload
18. `npx eas-cli@latest build -p ios --profile production` then `npx eas-cli@latest submit -p ios --profile production --latest` (TestFlight).
19. `npx eas-cli@latest build -p android --profile production` then `npx eas-cli@latest submit -p android --profile production --latest`. First upload lands as a **draft on the internal track** (`releaseStatus: draft`, required while the app is unpublished).
20. Install from TestFlight / internal testing and run the smoke test in README.md (sign in, create event, scan the QR from another phone, upload, save to Photos, push arrives, universal link opens the join screen).

## D. Listing (App Store Connect)
21. Metadata: `cd store && fastlane ios metadata` (or paste from `store/fastlane/metadata/{en-GB,tr}`). Run `node store/check-metadata.mjs` first.
22. Screenshots: 6.9" set (and 6.5" if asked) per screenshot-plan.md, both languages.
23. App Privacy: answers in privacy.md. Privacy Policy URL.
24. Age Rating: content-rating.md.
25. Category: Photo & Video (secondary: Lifestyle). Price: Free. Availability: all territories (or UK + Türkiye first).
26. App Review Information: contact, demo account (review email + code), notes from review-notes.md.
27. Export compliance: the build already declares `ITSAppUsesNonExemptEncryption = false` (HTTPS only).
28. Select the processed build → Add for Review → Submit for Review. Choose manual release.

## E. Listing (Play Console)
29. Store listing: `cd store && fastlane android metadata` (or paste from `store/fastlane/metadata/android/*`), icon 512×512, feature graphic 1024×500, phone screenshots.
30. App content: Privacy policy URL; App access (review account); Ads: No; Content rating (IARC, content-rating.md); Target audience 18+; Data safety (privacy.md); Government app: No; Financial features: None; Health: No. Photo and video permissions: none requested (system Photo Picker).
31. Countries: UK + Türkiye (+ others). Pricing: Free.
32. Closed testing: new personal developer accounts must run a closed test with ≥12 testers for 14 days before production access. Plan for this.
33. Promote internal → closed → production when ready. Use a staged rollout (e.g. 20%).

## F. After approval
34. Release (App Store: "Release this version"; Play: roll out). Check the listing in both stores and both languages.
35. Verify universal links on a real device from a fresh install (tap an `https://bizimresimler.com/g/<slug>` link, and an `https://ourpixs.com/g/<slug>` one, in Notes/Messages).
36. Monitor reviews and crash reports in App Store Connect / Play Console (consider adding Sentry later and updating the privacy answers).
