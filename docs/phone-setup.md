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

`npm run phone:config` is only needed once, and again when a value in `.env` changes. It needs the app installed first.

Requirements on the laptop: Android Studio (for the Android SDK and its bundled JDK). The scripts find both in their default locations, or set `ANDROID_HOME` and `JAVA_HOME`. The first build downloads Gradle and a Java 21 toolchain and takes a few minutes.

## Where the secrets live

- **Not in the APK** and not in the repo. `npm run phone:config` writes them over USB straight into the app's private storage (`files/config.json`). Other apps can't read it there.
- Android backup is turned off for the app, so the file doesn't end up in a cloud backup.
- Anyone with the unlocked phone and USB debugging could still read it out. That's acceptable for a prop that stays with you. If the phone or the APK is ever handed out, switch to a small server that holds the key (option B in the roadmap) and revoke the key.

Without the config, the screen shows "not set up: run npm run phone:config".

## Using it

- The app starts in kiosk view: only the Red Queen's screen.
- **Language:** hold the standby screen for 2 s to switch between English and German. The sample label fades in again in the new language. The choice is remembered.
- **Case link:** at the first start the app searches for "RedQueenCase" and connects to the first one it finds. It remembers it and reconnects by itself. If that case can't be reached three times in a row, it searches again (e.g. after swapping the ESP32). Tap the dot in the corner to pick a case by hand.
- **Debugging:** with the phone on USB, open `chrome://inspect` in Chrome on the laptop to see the app's console and the test console's event log.

## Kiosk lock (optional)

So guests can't leave the app: Settings → Security → **Pin windows** (app pinning) → on. Then open the app, open the recent apps view, tap the app icon → **Pin this app**. To unpin, hold Back and Recents.
