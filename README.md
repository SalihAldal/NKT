# NKT - Ne Kadar Tanıyorsun

Production-ready React Native + Expo mobil uygulama ve admin panel.

## Kurulum

```bash
npm install
cp .env.example .env
npm start
```

## Scripts

- `npm start` - Expo dev server
- `npm run android` - Android build
- `npm run ios` - iOS build
- `npm run prebuild` - Native klasörleri oluştur
- `npm run typecheck` - TypeScript kontrol
- `npm run lint` - ESLint
- `npm run admin:dev` - Admin panel

## Mimari

- `src/` - Mobil uygulama kaynak kodu
- `admin/` - Web admin paneli
- `config/` - Environment yapılandırması

## Deep Links

- `nkt://test/:shareCode`
- `https://taniyormusun.app/test/:shareCode`
- `https://taniyormusun.app/invite/:userId`
