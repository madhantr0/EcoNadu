# 🌳 EcoNadu — Tamil Nadu Living Forest & Satellite Sanctuary

> **Turn daily tree planting & watering into a streak-driven mission across all 38 districts of Tamil Nadu—powered by live NASA VIIRS satellite heat maps, 2-angle plant liveness verification, SHA-256 hash-chained proofs, and a 100% Zero-Database peer-to-peer architecture.**

![Status](https://img.shields.io/badge/Deployment-Netlify%20%2F%20Vercel%20HTTPS-10b981?style=for-the-badge)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Database%20P2P%20Mesh-fbbf24?style=for-the-badge)
![Coverage](https://img.shields.io/badge/Region-All%2038%20Districts%20of%20Tamil%20Nadu-059669?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-SHA--256%20%2B%20Zero--Trust%20XSS%20Guard-34d399?style=for-the-badge)

---

## 🌍 Project Vision & Why EcoNadu Exists

Modern social platforms keep millions of people engaged every day through **streaks, scores, badges, and friendly competition**. **EcoNadu** channels that exact daily habit loop into real-world climate action for **Tamil Nadu**:

1. **Zero-Cost, Zero-Database Scalability:** Student and civic projects often fail when central server or database bills grow. EcoNadu uses **zero central SQL/NoSQL servers**—every user's tree photos and cryptographic ledger stay on their own device and personal Google Drive, while devices sync live via a decentralized **Gun.js P2P mesh**.
2. **Data-Driven Planting Where It Matters Most:** Instead of planting blindly, users inspect real-time **NASA GIBS VIIRS satellite layers** and **Open-Meteo micro-climate telemetry** to spot urban heat islands (`+3.1°C` to `+4.3°C` anomalies) and deploy to red **"Saviour Needed"** beacons for bonus XP.
3. **Community Accountability Across All 38 Districts:** Every district maintains its own **Weekly Top 10 Eco-Warriors** leaderboard alongside the statewide **Tamil Nadu Top 50 Weekly Saviours** honour roll.

---

## ✨ Core Features

### 1. 🛰️ Live NASA VIIRS & Open-Meteo Satellite Radar
* **All 38 Districts of Tamil Nadu:** Instant district switcher covering every district from *Chennai* and *Coimbatore* to *Madurai*, *Nilgiris*, *Thanjavur*, and *Kanniyakumari*.
* **Multi-Layer Interactive Map (Leaflet):** Switch smoothly between **NASA GIBS VIIRS True Color** satellite imagery, **Urban Heat Island** thermal anomaly zones, and **Active Canopy** coverage.
* **Real-Time Micro-Climate Feed:** Streams live temperature, relative humidity, soil moisture, and wind speed directly from the Open-Meteo API with zero API key required.
* **Pokémon GO-Style Rescue Beacons:** Tap pulsing red distress beacons on the map to lock onto heat-stressed neighborhoods and earn a **+500 XP** rescue bonus.

### 2. 📸 Face-ID Style 2-Angle Live Plant Liveness Scanner
* **Step 1 — Chlorophyll Canopy Lock:** Analyzes live camera pixels inside a glowing circular AR reticle to verify real green plant foliage.
* **Step 2 — 3D Parallax Angle Shift:** Prompts the user to tilt the phone slightly left/right and measures frame-to-frame depth delta—blocking static photos of screens or printed pictures.
* **GPS Geofencing & Anti-Spoof:** Enforces Tamil Nadu geographic boundaries (`8.05°N–13.60°N`, `76.20°E–80.38°E`) and verifies that daily watering check-ins occur within **35 meters** of the originally planted sapling.

### 3. ⛓️ Cryptographic SHA-256 Proof-of-Green Ledger
* Every planted tree or daily watering check-in mints a **SHA-256 hash-chained block** linking `prevHash + district + GPS coordinates + timestamp + image digest`.
* On every app startup, `SecurityGuard` re-verifies the entire hash chain to detect tampering, and users can export their ledger as `.json` at any time.

### 4. 📡 Zero-Database Multi-Device P2P Sync & Observer Mode
* **Real-Time District Mesh:** Powered by **Gun.js** and `BroadcastChannel`. When two phones select the same Tamil Nadu district, they automatically see each other's live warrior cards, custom avatars, tree pins on the map, and leaderboard rankings.
* **Observer Mode:** Visitors can explore live satellite maps, district heat zones, and the Top 50 Saviours immediately without signing in or entering API keys.

### 5. 🏆 Instagram-Style Profiles, Quests, 12 Badges & Downloadable E-Certificate
* **Custom Post-Login Profile:** Upload a custom profile photo (auto-compressed & MIME-validated), set an eco-bio, and tap any warrior in your district to inspect their unlocked badges and SHA-256 seal.
* **Daily Eco-Quests & 12 Badges:** Unlock badges like *First Sprout*, *SHA-256 Keeper*, *Cauvery Guard*, *Vana Kavalan*, and *Banyan Legend*.
* **XP Rewards Store & Official E-Certificate:** Redeem earned XP for the *Chola Gold Avatar Crown*, *24h Streak Freeze Shield*, *District Nursery Sapling Pass*, or generate and download a **SHA-256 signed PNG Certificate of Eco-Saviour Honour**.

---

## 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   USER'S DEVICE (Single-File PWA)                    │
│                                                                      │
│  ┌────────────────────┐   ┌───────────────────┐   ┌───────────────┐  │
│  │ 2-Angle AR Camera  │─▶│ Web Crypto SHA-256 │─▶│ LocalStorage / │  │
│  │ & Chlorophyll Scan │   │   Hash Chainer    │   │ Personal Drive │  │
│  └────────────────────┘   └───────────────────┘   └───────────────┘  │
│                                    │                                 │
│                          ┌─────────▼─────────┐                       │
│                          │   SecurityGuard   │                       │
│                          │ (XSS, Geofence &  │                       │
│                          │  Schema Filter)   │                       │
│                          └─────────┬─────────┘                       │
└────────────────────────────────────┼─────────────────────────────────┘
                                     │ Lightweight JSON Summary Only
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
   │  NASA GIBS VIIRS   │ │  Gun.js P2P Relay  │ │    Open-Meteo      │
   │  Satellite Tiles   │ │ (38-District Mesh) │ │ Live Weather API   │
   └────────────────────┘ └────────────────────┘ └────────────────────┘
```

---

## 🛡️ Security & Privacy Hardening (`SecurityGuard`)

* **Zero Central Data Collection:** Photos, GPS histories, and optional API keys remain strictly inside the user's own browser storage / Google Drive.
* **Zero SQL Injection Surface:** With no central SQL database, remote SQL injection is eliminated by design.
* **Stored XSS & Profanity Neutralization:** All warrior names, bios, custom photos, and incoming Gun.js peer packets pass through strict HTML entity escaping, profanity/impersonation blocklists, numeric range caps, and MIME regex checks before touching the DOM.
* **HTTPS-Only Relay Enforcement:** Custom P2P relay URLs configured in the **Bring-Your-Own-API (BYO-API) Vault** are validated to require `https://`.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend & UI** | HTML5, Tailwind CSS, Vanilla ES6+ | Single-file progressive web app with Velvet Emerald & Gold glassmorphism |
| **Mapping & Satellite** | Leaflet.js + NASA GIBS WMTS (VIIRS) | Interactive 38-district satellite & urban heat island radar |
| **Live Micro-Climate** | Open-Meteo REST API | Real-time temperature, humidity, soil moisture & wind speed |
| **Cryptography** | Browser Web Crypto API (`SHA-256`) | Tamper-evident Proof-of-Green hash chaining & certificate seals |
| **P2P Networking** | Gun.js + `BroadcastChannel` API | Zero-database multi-device district sync & leaderboards |

---

## 🚀 Deployment Guide (GitHub + Netlify / Vercel)

1. **Upload to GitHub:**
   * Create a new repository named `econadu`.
   * Upload `index.html` and this `README.md` to the root of the repository.
2. **Deploy Live on HTTPS (Required for Mobile Camera & GPS):**
   * **Netlify:** Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → choose your `econadu` repository → click **Deploy site**.
   * **Vercel:** Go to [vercel.com](https://vercel.com) → **Add New Project** → import `econadu` → click **Deploy**.
3. **Share & Test Multi-Device Sync:**
   * Open your live `https://...` URL on two phones, select the same Tamil Nadu district, and watch live warrior profiles, tree map pins, and leaderboard scores sync automatically.

---

## 📜 License

Open-source student & community climate-tech initiative built for a greener **Tamil Nadu**.