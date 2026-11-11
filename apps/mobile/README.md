# Our Pixs mobile (Expo, iOS + Android)

The host app for **Our Pixs / Bizim Resimler**: create events, get a QR code, manage the album. Anyone can also join an event by scanning its QR code. It talks to the web app's JSON API (`/api/v1`, contract in [`../../docs/API.md`](../../docs/API.md)).

- Expo SDK 58, Expo Router (typed routes), TypeScript strict, React Compiler
- Standalone npm project (not a workspace). Product config is copied from `apps/web/src/lib/config.ts` into `src/config.ts`; keep them in sync.

## Run locally

```bash
cd apps/mobile
npm install
npx expo start            # press i / a, or scan with a development build
```

**Expo Go vs development build.** Most screens run in Expo Go, but the app uses native modules and config (camera barcode scanning, notifications, associated domains, Android intent filters, iOS locales) that need a **development build** to behave like production:

```bash
npx eas-cli@latest build --profile development --platform ios      # or android; install on device
npx expo start --dev-client
# local alternative (Xcode / Android Studio installed): npx expo run:ios | run:android
```

Point at a local web API:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start   # use your LAN IP, not localhost, on a real phone
```

**Demo mode** (no backend; every screen filled with sample data — for screenshots and UI work):

```bash
EXPO_PUBLIC_DEMO=1 npx expo start
# open a screen directly: ourpixs://demo/album?lang=tr  (see store/screenshot-plan.md for the list)
```

### Checks

```bash
npx tsc --noEmit
npx expo-doctor                     # needs network to reach the Expo API
npx expo export --platform ios      # bundling smoke test (also: android, web)
node store/check-metadata.mjs       # store text length limits
```

## Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | app | `https://ourpixs.com` | API base URL |
| `EXPO_PUBLIC_DEMO` | app | off | `1` = built-in demo data, `/demo/<screen>` deep links |
| `EXPO_PUBLIC_SHOW_PREVIEW_CODE` | app | on in `__DEV__` | Show the `previewCode` the API returns when email isn't configured |
| `EXPO_PUBLIC_EXTERNAL_CHECKOUT` | app | off | `1` = show a "Choose a plan" button that opens the website pricing page. **Keep off in store builds** (Apple 3.1.1 / Play payments policy); store builds show plan status only, with no prices |
| `EXPO_PUBLIC_REVIEW_EMAIL` | app | none | App Review account email (see `store/review-notes.md`) |
| `EXPO_PUBLIC_SUPPORT_EMAIL_EN` / `_TR` | app | hello@ourpixs.com / merhaba@bizimresimler.com | Contact links |
| `APP_VARIANT` | build | `production` | `development` / `preview` change the bundle ID and name so they install side by side |
| `EAS_PROJECT_ID` | build | none | Set after `eas init`; required for push tokens |
| `EAS_OWNER` | build | none | Expo account/organisation |

The `eas.json` profiles already set the right values per build.

## Build and submit (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                   # once; set EAS_PROJECT_ID afterwards
npx eas-cli@latest build -p ios --profile production      # build numbers auto-increment (remote)
npx eas-cli@latest submit -p ios --profile production --latest      # → TestFlight / App Store Connect
npx eas-cli@latest build -p android --profile production  # .aab
npx eas-cli@latest submit -p android --profile production --latest  # → Play internal track, draft
```

Profiles: `development` (dev client, internal), `development-simulator`, `preview` (internal QA, APK), `screenshots` (preview + demo data, iOS simulator), `production` (store, auto-increment).
Before the first submit, fill `submit.production.ios.ascAppId` / `appleTeamId` in `eas.json` and put the Play service-account key at `apps/mobile/google-service-account.json` (git-ignored).

The full ordered list of manual App Store Connect / Play Console steps is in **[`store/checklist.md`](store/checklist.md)**.

## Store kit (`store/`)

| File | What |
|---|---|
| `fastlane/metadata/{en-GB,tr}/` | App Store listing (name, subtitle, promo text, description, keywords, what's new, URLs) in fastlane *deliver* layout |
| `fastlane/metadata/android/{en-GB,tr-TR}/` | Google Play listing (title, short and full description, changelog) in fastlane *supply* layout |
| `fastlane/Fastfile` | `fastlane ios metadata` / `fastlane android metadata` (text and screenshots only) |
| `review-notes.md` | App Review notes and the review-account bypass (mobile side done, web side to do) |
| `privacy.md` | App Store privacy label and Play Data safety answers |
| `content-rating.md` | IARC and Apple age-rating answers (UGC moderation) |
| `screenshot-plan.md` | 8 screens in gallery order with EN/TR captions and exact sizes |
| `capture_screenshots.py` | Playwright capture of the demo web export at store sizes + feature graphic |
| `checklist.md` | Every remaining manual step, in order |

### Listing copy (summary; full text in `store/fastlane/metadata`)

| | EN (en-GB) | TR |
|---|---|---|
| App Store name | Our Pixs: Event Photo Album | Bizim Resimler: Ortak Albüm |
| Subtitle | Guest photos from one QR code | Misafir fotoğrafları tek QR'da |
| Keywords | wedding,photo,sharing,guest,album,qr,event,party,camera,disposable,video,guestbook,henna | düğün,nişan,kına,fotoğraf,paylaşım,misafir,qr,etkinlik,sünnet,doğum günü,anı defteri,video |
| Play short description | Every guest's photos and videos in one private album. Guests just scan a QR. | Misafirlerin tüm fotoğraf ve videoları tek albümde. QR okut, yükle, bitti. |

On a Turkish iPhone the home-screen name is "Bizim Resimler" (`locales/tr.json`); elsewhere it is "Our Pixs".

### Privacy label (summary; full answers in `store/privacy.md`)
Collected, linked to the user, **not** used for tracking, all for App Functionality: email address, name, photos/videos, other user content (guestbook), user ID. No analytics, ads, diagnostics or location (decide on EXIF GPS stripping first). Encrypted in transit. Deletion on request (in-app request + web page).

### Screenshots to capture (details in `store/screenshot-plan.md`)
1 Album · 2 Guest join · 3 QR · 4 Guest feed · 5 Challenges · 6 Upload · 7 Guestbook · 8 Event settings. Sizes: iPhone 1290×2796 (6.9"/6.7") and 1284×2778 (6.5"); Android 1080×1920; Play feature graphic 1024×500. No iPad set (`supportsTablet: false`).

## App structure

```
src/
  app/                    Expo Router screens
    index.tsx             welcome (host / join), footer
    login.tsx             email → 6-digit code
    settings.tsx          language, notifications, sign out, joined events, legal, delete-account request, footer
    host/                 signed-in host area (guarded)
      index.tsx           my events (+ plan status banner)
      new.tsx             create wizard: type → names/title → date/venue/days → theme → QR
      [id]/               event tabs (one HostTabBar): album, upload, qr, guestbook, missions (Challenges), wall, settings
    join/                 scan QR / enter code → name + consent (+ PIN)
    g/[slug]/             guest tabs (GuestTabBar pill): feed, upload, missions, guestbook
    demo/[screen].tsx     demo deep links (EXPO_PUBLIC_DEMO=1 only)
  api/                    typed client (client.ts) + contract types (types.ts)
  upload/                 queue (concurrency 3, retries, progress), renditions (1600px display + 400px thumb JPEG), picker
  components/             AppHeader (every screen), Screen, Footer + LanguageSwitch, TabBars, Button, Card/Sticker/Pill,
                          Form (Field, Checkbox, Toggle, Chip, Segmented), MediaGrid, MediaViewer, UploadPanel,
                          CameraCapture, QrCard, PlanStatus (neutral plan status), EventBrand (guest header + theme colours), States
  i18n/                   en.ts, tr.ts (typed: tr must match en's keys), useI18n/useT
  auth/, host/, guest/    session + per-event contexts
  lib/                    secure storage, guest sessions, push, save-to-Photos, QR print/share, formatting
  demo/                   sample data + in-memory API for demo mode
```

**Design:** light host surfaces, dark guest surfaces; Inter Tight 400–900 + Bodoni Moda italic accents; royal blue `#2347E0`; pill buttons; 28px cards; ≥44pt touch targets; accessibility labels on every icon button. No screen draws its own header: all use `AppHeader` (guest screens via `GuestHeader`).

**Uploads:** each file gets a 1600px display and a 400px thumbnail (JPEG, generated on device). The app asks the API for presigned PUT URLs, uploads thumbnail → display → original straight to storage (3 files at a time, 3 attempts each with backoff), then calls `uploads/complete`. Progress is byte-weighted; the queue survives switching tabs.

## API assumptions to confirm with the backend
- Host uploads complete at `POST /api/v1/occasions/:id/uploads/complete` (contract only names the guest route).
- Display/thumbnail renditions are JPEG; the app sends `Content-Type` unless the presigned `headers` already include one.
- A PIN-protected event answers 401/403 with an error code or message containing "pin".
- Account subscription: `GET /api/v1/me` returns `subscription` (status, daysLeft, `canCreateEvents`, `canDownload`, `readOnly`…); host occasions return `access` (`canUpload`, `canDownload`, `readOnly`, `reason`); guest payloads return `uploadsOpen`. The app shows this neutrally (no prices, no purchase buttons or links).
- Locked downloads answer HTTP 402 `{ error: "plan_required" }`; the app shows "Downloads aren't available on this account yet."
- Push notification payload: `data.occasionId` (host) or `data.slug` (guest) opens that screen.
- Guest voice/video guestbook notes need a presign route for `mediaKey`; the app posts text notes only.

## Placeholders
- **App icon, adaptive icon, splash, notification icon, favicon** in `assets/images/` are generated placeholders (black with a white "OP." wordmark). Regenerate with `node scripts/generate-placeholder-assets.mjs` or replace with final artwork before release.
- Demo/welcome photos in `assets/demo/` are Pexels images (free licence), the same set as `apps/web/public/media`: Mario Amé, Novkov Visuals, Helena Lopes, Pavel Danilyuk, amine photographe, Askar Abayev, George Pak, Kampus Production.

## Manual smoke test (TestFlight / internal track)
1. Sign in with a real email; the code arrives; allow notifications.
2. Create a wedding with two days; the QR appears; share and print the card.
3. On a second phone, scan the QR with the camera app: the universal link opens the app's join screen (or the web guest app if not installed). Join, upload 5 photos and a video, complete a challenge, leave a note.
4. On the host phone: the album updates; a push arrives; long-press select → favourite, hide, save to Photos, delete; the viewer swipes and plays video.
5. Settings: approval on → new guest uploads show under "Waiting approval" → approve. Set and remove a PIN. Switch the language to Türkçe and back.
6. Delete the event.
