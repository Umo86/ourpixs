# Screenshot plan

## Required sizes

| Store / slot | Pixels (portrait) | Notes |
|---|---|---|
| App Store — iPhone 6.9"/6.7" | **1290 × 2796** (1320 × 2868 also accepted) | Required. Up to 10 per language. |
| App Store — iPhone 6.5" | **1284 × 2778** | Provide if App Store Connect asks for it; otherwise it scales the 6.9" set. |
| App Store — iPad 13" | 2064 × 2752 | **Not needed**: `ios.supportsTablet: false`. |
| Google Play — phone | **1080 × 1920** (any 9:16 up to 3840 px) | 2–8 per language, PNG/JPEG, no alpha. |
| Google Play — feature graphic | **1024 × 500** | Required. `store/screenshots/raw/feature-graphic-{en,tr}.png`. |
| Google Play — app icon | 512 × 512 | Export from the final icon (the current icon is a placeholder). |

The first 3 screenshots get most of the views, so they carry the core promise.

## Gallery order (both platforms, both languages)

| # | Screen (demo link) | Headline EN | Headline TR |
|---|---|---|---|
| 1 | Host album: `bizimresimler://demo/album` | Every guest's photos. One album. | Tüm misafirlerin kareleri. Tek albüm. |
| 2 | Guest join: `bizimresimler://demo/join-event` | Guests just scan. No app, no sign-up. | Misafirler okutur. Uygulama yok, üyelik yok. |
| 3 | QR tab: `bizimresimler://demo/qr` | Your QR code, ready to print. | QR kodunuz yazdırmaya hazır. |
| 4 | Guest feed: `bizimresimler://demo/feed` | A live feed your guests will love. | Misafirlerin bayılacağı canlı akış. |
| 5 | Challenges: `bizimresimler://demo/guest-missions` | Photo challenges keep the party going. | Fotoğraf görevleriyle eğlence hiç durmasın. |
| 6 | Upload / camera: `bizimresimler://demo/guest-upload` | Full quality, straight from every phone. | Her telefondan, orijinal kalitede. |
| 7 | Guestbook: `bizimresimler://demo/guestbook` | Notes and voice memories for you. | Size özel notlar ve sesli anılar. |
| 8 | Settings: `bizimresimler://demo/settings` | You stay in control: approve, hide, PIN. | Kontrol sizde: onaylayın, gizleyin, PIN koyun. |

Optional extras (positions 9–10 on iOS): host home `demo/home`, create wizard `demo/new`, live wall `demo/wall`.

Add `?lang=tr` for the Turkish set, e.g. `bizimresimler://demo/album?lang=tr`.

## How to capture

**Quick drafts (any machine):** the web export renders the same React Native screens.
```bash
cd apps/mobile
EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_EXTERNAL_CHECKOUT=0 npx expo export --platform web --output-dir dist-web
python store/capture_screenshots.py              # → store/screenshots/raw/{ios-6.9,ios-6.5,android-phone}/{en,tr}/
python store/capture_screenshots.py --fastlane   # also copies into fastlane deliver/supply folders
```

**Final (recommended): native captures** so status bar, fonts and video thumbnails are exactly what users get.
```bash
eas build --profile screenshots --platform ios     # simulator-friendly build with EXPO_PUBLIC_DEMO=1
# iPhone 16 Pro Max simulator (1320×2868) or iPhone 15 Pro Max (1290×2796):
xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4
xcrun simctl openurl booted "bizimresimler://demo/album?lang=en" && sleep 3 && xcrun simctl io booted screenshot 01-album.png
# Android emulator (Pixel, 1080×1920 or 1080×2400 cropped to ≤2:1):
adb shell am start -a android.intent.action.VIEW -d "bizimresimler://demo/album?lang=en" && adb exec-out screencap -p > 01-album.png
```

**Captions:** put the headline above the UI (Inter Tight 900 white on black, the accent word in Bodoni italic `#8097FF`), 2 lines max. Frame in Figma/Canva from the raw captures. Don't use any external AI image generator.
