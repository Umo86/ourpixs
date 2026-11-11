# BizimResimler web (Next.js)

One Next.js 15 app serves both domains:

| Domain | Brand | Language |
| --- | --- | --- |
| **bizimresimler.com** (main) | BizimResimler | Follows the visitor's phone/browser on first visit (Turkish → TR, anything else → EN) |
| ourpixs.com (English alias) | Our Pixs | English by default |

The EN/TR switch (`lang` cookie) always wins; `?lang=en|tr` on any URL pins a language. Any other host (`*.vercel.app`, previews, localhost) uses `DEFAULT_BRAND` (default `bizimresimler`). Brand, occasion, price and email settings live in `src/lib/config.ts`.

Contact and sender address for both brands: `hello@bizimresimler.com`.

## Develop

```bash
cp .env.example .env.local   # fill in values (see comments in the file)
npm install
npm run dev                  # http://localhost:3000 (BizimResimler)
```

Before every push:

```bash
npx tsc --noEmit
npm run build
npx eslint src
```

Project conventions: [`../../AGENTS.md`](../../AGENTS.md). Going live: [`../../docs/SETUP.md`](../../docs/SETUP.md). Mobile API contract: [`../../docs/API.md`](../../docs/API.md).
