import type { CapacitorConfig } from "@capacitor/cli";

// Android app for the old phone in the case: the Vite build (dist/) in a WebView,
// plus native Bluetooth, keep-awake and fullscreen. See docs/phone-setup.md.
const config: CapacitorConfig = {
  appId: "de.redqueencase.app",
  appName: "Red Queen",
  webDir: "dist",
  // Debug builds log every plugin call and result to the Android log, including the
  // config file with the API key. Never turn this back on.
  loggingBehavior: "none",
  // webContentsDebuggingEnabled is left unset on purpose: Capacitor then allows
  // chrome://inspect only in debug builds (npm run phone). A release APK (npm run release)
  // can't be inspected, so nobody can read the stored API key out of it over USB.
  plugins: {
    // MainActivity hides the system bars itself; Capacitor's own inset handling would pad
    // the page by the camera notch and leave a white strip in landscape.
    SystemBars: {
      insetsHandling: "disable",
    },
    BluetoothLe: {
      displayStrings: {
        scanning: "Searching for the case…",
        cancel: "Cancel",
        availableDevices: "Cases nearby",
        noDeviceFound: "No case found",
      },
    },
  },
};

export default config;
