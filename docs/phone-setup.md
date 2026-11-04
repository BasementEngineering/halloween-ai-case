# Phone setup (Galaxy A40)

The old phone in the case runs the web app as an Android app, built with [Capacitor](https://capacitorjs.com). The app adds what the browser can't do reliably:
- the screen stays on,
- fullscreen without status or navigation bar,
- native Bluetooth, which connects to the case by itself, also after a restart,
- the mic permission is asked at the first start, not in the middle of a game.

On the laptop, `npm run dev` still runs the same app in Chrome with the test console.

## Prepare the phone (once)

1. Update the phone as far as it goes (the A40 gets Android 11), and update **Chrome** and **Android System WebView** in the Play Store. The app runs inside the WebView.
2. Turn on the developer options: Settings → About phone → Software information → tap **Build number** 7 times.
3. Settings → Developer options → turn on **USB debugging**.
4. Connect the phone by USB and confirm **Allow USB debugging?** on the phone (tick "Always allow from this computer").
5. Keep **Bluetooth** and **Location** on. Android 11 only finds Bluetooth LE devices while location is on, and the app asks for the location permission for that.
6. Settings → Apps → Red Queen → Battery → **Unrestricted** (after the first install), so Android doesn't put the app to sleep.

## Build and install

From `app/`:

```sh
npm run phone          # builds the app, installs it on the phone and starts it
npm run phone:config   # copies the key, agent IDs and clearance code from .env to the phone
```

`npm run phone:config` is only needed once, and again when a value in `.env` changes. It needs the app installed first. Without a laptop, use the setup screen instead (below).

Requirements on the laptop: Android Studio (for the Android SDK and its bundled JDK). The scripts find both in their default locations, or set `ANDROID_HOME` and `JAVA_HOME`. The first build downloads Gradle and a Java 21 toolchain and takes a few minutes.

## Where the secrets live

- **Not in the APK** and not in the repo. The setup screen, or `npm run phone:config` over USB, writes them straight into the app's private storage (`files/config.json`). Other apps can't read it there.
- Android backup is turned off for the app, so the file doesn't end up in a cloud backup.
- Anyone with the unlocked phone and USB debugging could still read it out. That's acceptable for a prop that stays with you. If the phone or the APK is ever handed out, switch to a small server that holds the key (option B in the roadmap) and revoke the key.

## Setup screen (no laptop needed)

For an APK installed without the repo. It opens by itself when the app has no config, and otherwise from the hardware test (tap the top-left corner 5 times, then **Setup**):

1. Paste a Mistral API key (from console.mistral.ai). A saved key stays if the field is left empty.
2. **Load voices** and pick her voice: your own cloned voices are listed first, then Mistral's presets.
3. Enter the clearance code you print for the players. It needs at least one digit (see the code rules in [redqueen-persona.md](redqueen-persona.md)).
4. **Save and set up agents** creates the agents `red-queen` and `red-queen-de` in that Mistral account, or updates them if they exist, with the persona and tools bundled in the app. It writes `files/config.json`, generates the voice lines (below) and restarts the app.

### Voice lines

The APK contains no Red Queen recordings. The setup screen generates her pre-recorded lines (17 per language) with the chosen voice and the same Mistral account, and stores them in the app's private files (`files/voicelines/`, about 2 MB, roughly a minute and a half). The case computer WARDEN-3 uses Mistral preset voices; its lines are bundled in the APK and generated alongside as well.

- **Generate voice lines** makes only what is missing or changed (another voice, or a line edited in [redqueen-voicelines.md](redqueen-voicelines.md)).
- **Regenerate all** makes every line again, e.g. for a better take.
- A line rejected by Mistral's moderation is listed; the others are kept.

If her lines are missing at startup, the setup screen opens. A build from the repo with lines from `npm run voicelines` in `app/public/voicelines/` plays those instead; they're git-ignored, so they never end up in the repo.

## Using it

- The app starts in kiosk view: only the Red Queen's screen.
- **Language:** hold the standby screen for 2 s to switch between English and German. The sample label fades in again in the new language. The choice is remembered.
- **Case link:** at the first start the app searches for "RedQueenCase" and connects to the first one it finds. It remembers it and reconnects by itself. If that case can't be reached three times in a row, it searches again (e.g. after swapping the ESP32). Tap the dot in the corner to pick a case by hand.
- **Debugging:** with the phone on USB, open `chrome://inspect` in Chrome on the laptop to see the app's console and the test console's event log.

## Kiosk lock (optional)

So guests can't leave the app: Settings → Security → **Pin windows** (app pinning) → on. Then open the app, open the recent apps view, tap the app icon → **Pin this app**. To unpin, hold Back and Recents.
