# Mobile / JSON API contract (`/api/v1`)

Base URL: `https://ourpixs.com` (or `https://bizimresimler.com`; same backend). All bodies JSON. Errors: `{ "error": { "code": string, "message": string } }` with a 4xx/5xx status.
Auth: `Authorization: Bearer <jwt>` (same JWT as the web `op_session` cookie, 30-day expiry).

## Auth
- `POST /api/v1/auth/request-code` `{ email, locale?: "en"|"tr", brand?: "ourpixs"|"bizimresimler" }` → `{ ok: true, previewCode?: string }` (previewCode only when PREVIEW_SHOW_CODE=1 and email not configured)
- `POST /api/v1/auth/verify` `{ email, code }` → `{ token, host: Host }`
- `GET /api/v1/me` → `{ host: Host }`
- `PATCH /api/v1/me` `{ name?, locale? }` → `{ host }`
- `POST /api/v1/push-tokens` `{ token, platform: "ios"|"android" }` → `{ ok: true }`

## Occasions (host)
- `GET /api/v1/occasions` → `{ occasions: OccasionSummary[] }`
- `POST /api/v1/occasions` `{ type, title, honorees: string[], startsOn?: "YYYY-MM-DD", venueName?, city?, theme?, days?: {name, date?}[] }` → `{ occasion: Occasion }`
- `GET /api/v1/occasions/:id` → `{ occasion: Occasion, stats: Stats }`
- `PATCH /api/v1/occasions/:id` `{ title?, honorees?, startsOn?, venueName?, city?, theme?, approvalMode?, revealMode?, revealAt?, uploadOpensAt?, uploadClosesAt?, pin?: string|null, disposableShots?: number|null }` → `{ occasion }`
- `DELETE /api/v1/occasions/:id` → `{ ok: true }`
- `GET /api/v1/occasions/:id/media?cursor=&dayId=&moment=&guestId=&kind=photo|video&filter=favourites|hidden|pending` → `{ items: MediaItem[], nextCursor: string|null }`
- `PATCH /api/v1/occasions/:id/media` `{ ids: string[], action: "hide"|"show"|"delete"|"favourite"|"unfavourite"|"approve" }` → `{ ok: true }`
- `POST /api/v1/occasions/:id/uploads` (host uploads) — same shape as the guest uploads endpoint below
- `GET /api/v1/occasions/:id/messages` → `{ messages: Message[] }`
- `GET|POST|DELETE /api/v1/occasions/:id/missions` → `{ missions: Mission[] }` (POST `{ title }`, DELETE `?missionId=`)
- `GET|POST /api/v1/occasions/:id/share-links` → `{ links: ShareLink[] }` (POST `{ label?, scope }`)
- `POST /api/v1/occasions/:id/checkout` `{ plan: "tek"|"buyuk" }` → `{ url }` (Stripe Checkout URL; open in browser)

## Guest (web guest app + mobile "join by QR")
Guest auth is a cookie on web; on mobile pass header `X-Guest-Token: <token>` returned by join.
- `GET /api/v1/g/:slug` → `{ occasion: PublicOccasion }` (requires PIN cookie/header `X-Occasion-Pin` if set)
- `POST /api/v1/g/:slug/join` `{ name, consent: true, pin? }` → `{ guestToken, guest: { id, displayName } }`
- `GET /api/v1/g/:slug/feed?after=<iso>&cursor=` → `{ items: MediaItem[], nextCursor }`
- `POST /api/v1/g/:slug/uploads` `{ files: { clientId, name, mime, bytes, kind, width?, height?, durationS?, dayId?, momentTag?, missionId?, fromDisposable?, hasDisplay: boolean, hasThumb: boolean }[] }` → `{ uploads: { clientId, mediaId, original: { url, method: "PUT", headers }, display?: {...}, thumb?: {...} }[] }`
- `POST /api/v1/g/:slug/uploads/complete` `{ mediaIds: string[] }` → `{ ok: true }`
- `POST /api/v1/g/:slug/reactions` `{ mediaId }` → `{ reacted: boolean, count: number }` (toggles)
- `GET /api/v1/g/:slug/missions` → `{ missions: (Mission & { done: boolean, doneCount: number })[] }`
- `POST /api/v1/g/:slug/messages` `{ kind: "text"|"voice"|"video", body?, mediaKey? }` → `{ message }`
- `GET /api/v1/g/:slug/mine` → `{ items: MediaItem[] }`; `DELETE /api/v1/g/:slug/mine?mediaId=`

## Types
```ts
type Host = { id: string; email: string; name: string|null; locale: "en"|"tr"; brand: "ourpixs"|"bizimresimler" };
type OccasionSummary = { id; slug; type; title; startsOn: string|null; plan: "free"|"tek"|"buyuk"; coverUrl: string|null; mediaCount: number; guestCount: number; role: "owner"|"cohost" };
type Occasion = OccasionSummary & { honorees: string[]; venueName; city; theme; brand; approvalMode: boolean; revealMode: "live"|"next_morning"; revealAt; uploadOpensAt; uploadClosesAt; hasPin: boolean; disposableShots: number|null; storageExpiresAt; days: { id; name; date; sortOrder }[]; guestUrl: string; wallUrl: string };
type Stats = { guests: number; photos: number; videos: number; messages: number; bytes: number; pendingApproval: number };
type PublicOccasion = { slug; type; title; honorees; startsOn; venueName; city; theme; brand; plan; days; moments: string[]; liveWall: boolean; missionsEnabled: boolean; disposableShots: number|null; voiceGuestbook: boolean; uploadOpen: boolean; revealMode; revealAt };
type MediaItem = { id; kind: "photo"|"video"|"voice"; thumbUrl: string|null; displayUrl: string|null; originalUrl?: string; width; height; durationS; momentTag; dayId; guestName: string|null; reactionCount: number; reactedByMe?: boolean; favourite?: boolean; visibility?: string; approved?: boolean; createdAt: string };
type Mission = { id; title; sortOrder };
type Message = { id; kind; body; mediaUrl: string|null; durationS; guestName: string|null; createdAt };
type ShareLink = { id; token; url; scope; label; expiresAt };
```
URLs in responses are short-lived signed URLs (1 hour).
