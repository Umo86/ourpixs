# Content rating answers

The app is a private photo album for a single event. Content is created by the host and invited guests. There's no public feed, no discovery of strangers, no chat between users, no location sharing, no purchases in the app.

## Google Play → IARC questionnaire
Category: **"All other app types"** (not a game). Then:

| Question | Answer |
|---|---|
| Violence, blood, sexuality, nudity, crude humour, profanity | No (the app itself contains none) |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling, simulated gambling | No |
| Does the app allow users to interact or exchange content with other users? | **Yes**: users share photos and text notes within a private event |
| Does the app share the user's current physical location with other users? | No (only if you decide to keep EXIF location; see privacy.md) |
| Does the app allow users to purchase digital goods? | No |
| Does the app contain any unrestricted internet access (browser)? | No (only our own pages: privacy, terms, live wall) |
| Is the app a news app? | No |
| Is the app primarily a web browser or search engine? | No |

Expected result: **PEGI 3 / ESRB Everyone / USK 0** with the interactive element **"Users Interact"**. Some regions may show 12+ for UGC; that's fine.

Moderation to describe if asked: hosts can hide or delete any upload and require approval before uploads appear; guests can delete their own uploads and report any photo (emails our moderation team); events can be PIN-protected.

## Apple → Age Rating (App Store Connect → App Information → Age Rating)

| Item | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Prolonged graphic or sadistic realistic violence | None |
| Profanity or crude humour | None |
| Mature or suggestive themes | None |
| Horror / fear themes | None |
| Medical or treatment information | None |
| Alcohol, tobacco or drug use or references | None |
| Simulated gambling | None |
| Sexual content or nudity | None |
| Graphic sexual content and nudity | None |
| Contests | None |
| Unrestricted web access | **No** |
| User-generated content | **Yes** |
| Messaging and chat | **No** (one-way guestbook notes to the host, no user-to-user chat). If Apple disagrees, answer Yes. |
| Advertising | No |
| Parental controls / age assurance | No |
| Gambling (real money) | No |
| Made for Kids | No |

Expected rating: **13+** (Apple's tier for apps with user-generated content). If your account still shows the old scale, expect 12+.

Guideline 1.2 checklist (UGC):
- [x] Filter / moderate: host approval mode; host hide/delete.
- [x] Report mechanism: guest viewer → Report.
- [ ] Block abusive users: hosts need a "remove this guest" action (backend endpoint required; see checklist).
- [x] Published contact info: hello@ourpixs.com / merhaba@bizimresimler.com, shown in the app footer and settings.
