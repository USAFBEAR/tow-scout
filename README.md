# Tow Scout

Scouts mark illegally parked vehicles on a live map. Tow drivers get alerted, claim spots, and clear them.

## Run
```
cd /workspace/tow-scout
npm install
npm start          # http://localhost:3000  (PORT=xxxx npm start to change it)
```

## Test scout and driver together
1. Open http://localhost:3000 in one browser (or a normal window). Enter a name and pick **Scout**.
2. Open it in a second browser or a private window. Each one stores its own name and role in localStorage. Pick **Tow Driver**. You can open more windows for more drivers or scouts.
3. Scout: tap the map, add notes and up to 5 photos (optional), then tap **Send to drivers**.
4. Every driver gets a toast, a sound, a 🔔 badge and an entry in the alert list. Tapping the alert centers the map on the spot. The popup shows the photos and an **Open in Google Maps** link.
5. Driver: tap **I'm in route**. If a second driver tries the same spot, they see "A driver is already in route". The driver who claimed it can **Release** it.
6. Driver: tap **Taken** or **No longer there**. The marker disappears for everyone.

Scouts see every marker but get no alerts. Use **Switch** in the header to change your name or role.

## Data
- Markers: `data/markers.json` (closed markers are kept for history)
- Photos: `uploads/` (images only, max 5, 15 MB each)

## Caveats (MVP)
- There are no real accounts. Names aren't verified, so two drivers using the same name count as the same person.
- Phones need HTTPS (or localhost) for geolocation and system notifications. To use it in the field, deploy it behind HTTPS (for example Render/Fly, or a tunnel like cloudflared).
- Alerts arrive only while the app is open (in a tab or the background). There's no push to a closed app.
