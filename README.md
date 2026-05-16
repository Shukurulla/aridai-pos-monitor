# AridaiPOS Monitor

POS terminallarida ishlovchi Electron app — **online rejimda webview** (kepket-kz-cashier.vercel.app),
**offline rejimda native UI** orqali Local Server (LAN) bilan ishlaydi.

## Arxitektura

```
┌────────────────────────────────────────────────────────────┐
│           AridaiPOS Monitor (Electron)                     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Main process                                      │     │
│  │  • Mode detector (har 5s VPS health check)       │     │
│  │  • Auth (VPS /auth/login)                        │     │
│  │  • Hub client (Local Server LAN API)             │     │
│  │  • kv-store (auth, hubBaseUrl persisted)         │     │
│  └──────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Renderer (React)                                  │     │
│  │  ┌────────────────┐    ┌────────────────────┐   │     │
│  │  │ Online mode    │    │ Offline mode       │   │     │
│  │  │ <webview src=  │    │ Native UI:         │   │     │
│  │  │  kepket-kz-    │ OR │  Header + SideNav  │   │     │
│  │  │  cashier...>  │    │  Orders/Menu/etc.  │   │     │
│  │  └────────────────┘    └────────────────────┘   │     │
│  └──────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
       │ online                          │ offline
       ▼                                  ▼
[kepket-kz-cashier.vercel.app]   [Local Server LAN :3011]
```

## Setup

```bash
# 1. Install (talab qiladi Node 20 LTS, better-sqlite3 emas lekin Electron muhitida)
npm install

# 2. Dev
npm run dev
```

## Foydalanish

1. Login ekrani — kassir telefon raqami + paroli
2. VPS reachable bo'lsa — webview rejimida `kepket-kz-cashier.vercel.app` ochiladi
3. VPS uzilsa — offline UI darhol almashtiriladi
4. Offline UI Local Server (Hub) bilan LAN orqali ishlaydi

## Env vars

| Var | Default |
|-----|---------|
| `VPS_BASE_URL` | `https://kz.kepket.uz/api` |
| `VPS_HEALTH` | `https://kz.kepket.uz/api/health` |
| `CASHIER_URL` | `https://kepket-kz-cashier.vercel.app` |

## Hub URL

Default `http://localhost:3011`. Boshqa kompyuterda turgan Local Server'ga ulanish uchun:
**Настройки** sahifasidan → "URL локального сервера" → `http://192.168.1.10:3011` (Local Server IP).

## Status

| Bo'lim | Holat |
|--------|-------|
| Skeleton (auth, mode, hub-client) | ✅ Tayyor |
| Login | ✅ Tayyor |
| Online → webview | ✅ Tayyor |
| Offline → Header + SideNav | ✅ Tayyor |
| Orders page | ✅ Hub'dan o'qib ko'rsatadi |
| Menu page | ✅ Hub'dan o'qib ko'rsatadi |
| Saboy / Expenses / Advances / Reports | 🟡 Stub (UI tayyor, funksional yetishmaydi) |
| Settings | ✅ Hub URL sozlash mumkin |
| Order create offline | ❌ Keyingi bosqich |
| Payment offline | ❌ Keyingi bosqich |
| Print check (LAN printer) | ❌ Keyingi bosqich |
