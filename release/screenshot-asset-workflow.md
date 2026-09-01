# NKT Store Screenshot Asset Workflow

Use existing NKT UI screens — no mock data or debug text in captures.

## Required Screens (capture from staging/production-like build)

1. Splash / onboarding
2. Home
3. Quiz create
4. Room lobby (5 players)
5. Game in progress
6. Final result / leaderboard
7. Premium paywall
8. Friends / social

## iOS Sizes

| Device class | Resolution | Use case |
|--------------|------------|----------|
| 6.7" | 1290 × 2796 | iPhone 15 Pro Max class |
| 6.1" | 1179 × 2556 | iPhone 15 Pro class |
| 5.5" | 1242 × 2208 | Legacy / optional |

Export via Xcode Simulator → Screenshot, or `eas build` + device capture.

## Android Sizes

| Form factor | Min resolution |
|-------------|----------------|
| Phone | 1080 × 1920 |
| 7" tablet | 1200 × 1920 |
| 10" tablet | 1600 × 2560 |

## Export Steps

1. Build staging profile: `eas build --profile staging`
2. Install on target device/simulator
3. Use real-looking but non-production test accounts
4. Capture each required screen
5. Verify: no `localhost`, no `super123`, no placeholder text, no debug overlays
6. Store in `release/assets/screenshots/{ios|android}/` (gitignored — do not commit test user data)

## Branding

- Dark theme (#0A0A0F background)
- NKT logo visible where appropriate
- Turkish UI text
- No lorem ipsum
