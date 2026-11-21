# EcoNadu

Plant a sapling in Tamil Nadu, verify it with GPS and a SHA-256 ledger, and share it with your district.

## Folder structure

```
econadu/
├── index.html        Login scene + app (feed, explore, plant, badges, profile)
├── css/
│   └── style.css     Day/night theme, scene, app styles
├── js/
│   ├── config.js     Settings: Google Client ID, districts, Tamil Nadu bounds
│   └── app.js        All app logic
├── assets/
│   └── icon.svg      App icon
└── README.md
```

## Run locally

From this folder, run one of these, then open http://localhost:8000:

```bash
python -m http.server 8000
```

Google sign-in will not work when you open index.html straight from the file system. Use a local server or a deployed https site.

## Set up Google login (required once)

1. Go to Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID.
2. Application type: **Web application**.
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8000`
   - your live site, for example `https://econadu.netlify.app`
4. Copy the Client ID (ends with `.apps.googleusercontent.com`) into `js/config.js`:

```js
GOOGLE_CLIENT_ID: 'your-id.apps.googleusercontent.com',
```

## Deploy

- **Netlify:** drag the `econadu` folder onto app.netlify.com/drop, or connect your GitHub repo. No build step.
- **GitHub:** push this folder's contents to the repo root. Enable GitHub Pages or import into Netlify/Vercel.

After deploying, add the live URL to the Authorized JavaScript origins in step 3.

## How planting is verified

1. Shot 1 (close-up) and Shot 2 (after stepping sideways), both taken with the camera.
2. Both shots need a green plant, a different angle, and no reuse of an old photo.
3. GPS on both shots, accurate to 30 m, within 40 m of each other, inside Tamil Nadu.
4. The phone must move between shots (motion sensor). Set `REQUIRE_MOTION: false` in config.js only for desktop testing.
5. Captions and names pass community rules. Links and abusive words are rejected.
6. Max 5 posts per day per device.

## Privacy

- Photos are re-encoded in the browser, which removes hidden GPS and camera data from the image.
- Public posts show a location rounded to about 1 km. Exact coordinates stay in your private ledger.
- Google email is not stored. Only your display name and photo are kept.
- No analytics or tracking.

## Theme

- **Real sun (auto):** day or night at the chosen district, using the sun's real position.
- **Day / Night:** manual.
- **Time-lapse cycle:** the sky runs faster (60×, 600×, or 3600×).

## Security limits (read this)

Everything above runs in the browser, so a skilled person can bypass it. To enforce these rules for real (true uniqueness, moderation, blocking abusers, and private data), you need a server, for example Supabase or Firebase with security rules. Until then, treat this as a community app, not a verified registry.

## Notes

- Posts, photos, likes and the ledger are stored in the browser (localStorage).
- Posts sync between devices through Gun.js when `GUN_PEERS` is set in `js/config.js`. Public relays can be slow or offline. Set your own relay for reliable sync.
- Planting requires Google sign-in and GPS inside Tamil Nadu. Guests can browse.
- `_headers` sets a Content Security Policy and other security headers on Netlify. If Google sign-in or maps break after deploy, check the browser console and add the blocked domain to that file.
