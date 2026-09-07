# Click Tabs Mobile (React Native / Expo)

Cross-platform client for the Click Tabs **mobile API**.  
You can run everything in a **browser** — no Android Studio, emulator, or device required.

Spec: [`../docs/FUNCTIONALITY_SPEC.md`](../docs/FUNCTIONALITY_SPEC.md)

---

## Quick start (Web only)

### 1. Start the Laravel API

In a separate terminal:

```bash
cd production
php artisan serve
```

API default: `http://127.0.0.1:8000`

### 2. Install & run the app in the browser

```bash
cd mobile
npm install
npm run web
```

Expo opens the app in your browser (usually **http://localhost:8081**).

If the port is busy:

```bash
npx expo start --web --port 8083
```

Then open **http://localhost:8083**.

### 3. Sign in

| Persona | How |
|--------|-----|
| **Staff / Caregiver** | Email + password |
| **Patient** | Email + DOB (`YYYY-MM-DD`) or MRN |

---

## Setup details

```bash
cd mobile
npm install
```

### API URL (web)

On web / iOS simulator the app defaults to:

```text
http://127.0.0.1:8000/api
```

Override if Laravel runs elsewhere:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npm run web
```

(No trailing `/api` — the app appends it.)

---

## Run options

### Web (recommended for local UI work)

```bash
npm run web
```

Or:

```bash
npx expo start --web
```

Press `w` in the Expo terminal if Metro is already running without web.

### Expo Dev Tools (optional)

```bash
npx expo start
```

Then choose **web** (`w`). You do **not** need Android (`a`) or iOS (`i`).

### Android / iOS (optional)

Only if you want a native build later:

```bash
npm run android   # needs Android emulator/device
npm run ios       # macOS + Xcode / simulator
```

Physical device example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000 npm run android
```

Android emulator uses `http://10.0.2.2:8000` automatically.

---

## Troubleshooting (web)

| Issue | Fix |
|------|-----|
| Blank page / Metro error | Stop other Expo processes; retry `npm run web` |
| Port already in use | `npx expo start --web --port 8083` |
| Login / API fails | Confirm `php artisan serve` is running; check browser Network tab for `/api/...` |
| CORS / network error | Use `127.0.0.1` consistently; set `EXPO_PUBLIC_API_URL` if needed |
| Favicon / logo stale | Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R) |
| Logout confirm | On web, browser `confirm()` is used instead of native alerts |

---

## Personas & main screens

1. **Staff** — Home, Patients, Schedule, Messages (email compose), Menu (account, EVV, time, mileage, logout)  
2. **Patient** — Home, schedule, meds, messages, profile  

---

## Notes

- Scope is the mobile API in `production/routes/mobile-api.php` (not the full web EMR: OASIS, billing, claims, etc.).
- EVV check-in/out needs location permission and a linked Employee record on the backend.
- Brand assets: SVG logos / favicon under `assets/` (mobile) and `production/public/` (web app).
