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
  android: {
    // Only for debugging the WebView from chrome://inspect on the laptop.
    webContentsDebuggingEnabled: true,
  },
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
