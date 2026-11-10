# Bill of materials

Everything needed to build the Red Queen case. Wiring and pin map: [hardware.md](hardware.md). Printed parts: [cad/](../cad/README.md).

- **Links** are shop searches (Amazon.de and AliExpress), not specific listings, so they don't go stale. AliExpress is cheaper but takes 1–3 weeks.
- **Prices** are rough estimates per line, not quotes.

## Electronics

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| E1 | ESP32-C3 Super Mini | 1 (+1 spare) | Case controller, Bluetooth LE. Buy two, they're cheap and easy to kill | 4 | [Amazon](https://www.amazon.de/s?k=ESP32-C3+Super+Mini) · [AliExpress](https://de.aliexpress.com/w/wholesale-esp32-c3-super-mini.html) |
| E2 | DRV8833 motor driver breakout | 1 | Drawer motor. Some boards label nSLEEP as EEP or STBY | 3 | [Amazon](https://www.amazon.de/s?k=DRV8833+Motortreiber) · [AliExpress](https://de.aliexpress.com/w/wholesale-drv8833.html) |
| E3 | N20 gear motor, 6 V, 50–200 rpm | 1 | Drives the drawer through the printed gear and rack | 4 | [Amazon](https://www.amazon.de/s?k=N20+Getriebemotor+6V) · [AliExpress](https://de.aliexpress.com/w/wholesale-n20-gear-motor.html) |
| E4 | Ultrasonic mist maker module, 5 V | 1 (+1 spare disc) | USB / 5 V "atomizer" with driver board, ~0.3–0.5 A. The discs wear out | 4 | [Amazon](https://www.amazon.de/s?k=Ultraschall+Vernebler+Modul+5V) · [AliExpress](https://de.aliexpress.com/w/wholesale-ultrasonic-atomizer-5v-module.html) |
| E5 | Logic-level N-MOSFET | 1 | Switches the mist maker. IRLZ44N / IRLZ34N (not the IRF520 modules, they don't switch at 3.3 V) | 1 | [Amazon](https://www.amazon.de/s?k=IRLZ44N) · [AliExpress](https://de.aliexpress.com/w/wholesale-irlz44n.html) |
| E6 | WS2812B (NeoPixel) LED strip, 5 V, 60 LEDs/m | 1 m | 48 LEDs on one data line: 2 × 15 inside the case (in parallel), 8 behind the logo, 2 × 5 in the drawer (in parallel) | 8 | [Amazon](https://www.amazon.de/s?k=WS2812B+LED+Streifen+5V+60) · [AliExpress](https://de.aliexpress.com/w/wholesale-ws2812b-strip.html) |
| E7 | Tactile push button, 6 × 6 mm | 2 | Drawer end switches "closed" and "open", pressed by the printed levers | 1 | [Amazon](https://www.amazon.de/s?k=Taster+6x6mm) · [AliExpress](https://de.aliexpress.com/w/wholesale-tactile-switch-6x6.html) |
| E8 | Reed switch + magnet, normally closed | 1 | Lid switch. I used this one in a plastic housing | 5 | [Amazon](https://www.amazon.de/dp/B088CQL44X) |
| E9 | Electrolytic capacitor 470 µF, ≥ 10 V | 2 | One on the 5 V line, one on the 3.3 V line | 1 | [Amazon](https://www.amazon.de/s?k=Elko+470uF+16V) |
| E10 | Resistors | 3 | 330 Ω (LED data line), 100 Ω (MOSFET gate), 10 kΩ (gate pull-down) | 1 | [Amazon](https://www.amazon.de/s?k=Widerstand+Sortiment) |

## Power and wiring

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| P1 | USB power bank, 10 000 mAh, ≥ 3 A, **two USB-A outputs** | 1 | Powers everything: one output for the electronics, one for the phone. At most 22 mm thick to fit. This one is very similar to mine | 20 | [Amazon](https://amzn.eu/d/02qYJnRh) |
| P2 | USB cable to cut | 3 | One from the power bank to the breadboard, one to the phone (USB-A to USB-C), one from the charging port to the power bank's input | 8 | [Amazon](https://www.amazon.de/s?k=USB-A+auf+USB-C+Kabel+kurz) |
| P3 | Small switch | 2 | One soldered into each of the two cables, so electronics and phone switch on separately | 3 | [Amazon](https://www.amazon.de/s?k=Kippschalter+Mini) |
| P4 | Micro USB socket on a small board | 1 | Charging port, glued into the case wall and wired to the power bank's input. I took mine from another board; a micro USB breakout works too | 2 | [Amazon](https://www.amazon.de/s?k=Micro+USB+Buchse+Breakout) · [AliExpress](https://de.aliexpress.com/w/wholesale-micro-usb-breakout.html) |
| P5 | Breadboard, 400 holes | 2 | One for the electronics, the power rail of the second one for more 5 V / 3.3 V / GND pins | 5 | [Amazon](https://www.amazon.de/s?k=Breadboard+400) |
| P6 | Jumper wires and male pin headers | 1 set | Every external part (LEDs, switches, motor, power) gets a pin header so it just plugs in | 6 | [Amazon](https://www.amazon.de/s?k=Jumper+Kabel+Stiftleiste+Set) |
| P7 | Silicone wire, 22–26 AWG, several colours | 1 set | 22 AWG for 5 V / GND, 26 AWG for signals | 8 | [Amazon](https://www.amazon.de/s?k=Silikonkabel+22AWG+Set) |
| P8 | Heat-shrink tubing assortment | 1 | | 5 | [Amazon](https://www.amazon.de/s?k=Schrumpfschlauch+Sortiment) |

## Phone

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| T1 | Old Android phone | 1 | Screen, speaker and mic, runs the Warden III app. Android 7 or newer; mine is a Galaxy A40 (2019) on Android 11 ([phone-setup.md](phone-setup.md)) | – | – |
| T2 | Internet | – | Wi-Fi or a hotspot from another phone, for the voice agent | – | – |
| T3 | Mistral AI account | – | Pay per use, a game costs a few cents | – | [console.mistral.ai](https://console.mistral.ai) |

## Case and props

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| C1 | Aluminium case with foam insert | 1 | About 260 × 150 × 85 mm. Room for the phone in the lid and the drawer in the side. Mine came from the used market | 15 | – |
| C2 | Handcuffs | 1 | To "strap" the case to your wrist | 8 | [Amazon](https://www.amazon.de/dp/B08V1S292Z) |
| C3 | Glass tube vial | 1 | Mine is a decorative tube with dried flowers, open at one end (Action) | 2 | [Amazon](https://www.amazon.de/-/en/comforder-Flowers-Flower-Decoration-Natural/dp/B09HY2ZV1J) |
| C4 | Aquarium tubing, 6 mm ID / 8 mm OD | 0.5 m | The double helix inside the vial | 3 | [Amazon](https://www.amazon.de/s?k=Aquarienschlauch+6%2F8mm) · [AliExpress](https://de.aliexpress.com/w/wholesale-aquarium-tube-6mm-8mm.html) |
| C5 | Glowsticks | 2 per game | Thin enough to slide into the tubing. Fresh ones for every party | 5 | [Amazon](https://www.amazon.de/s?k=Knicklichter) |
| C6 | Aluminium tape | 1 roll | Contact rings on the vial and contact surfaces in the holder | 4 | [Amazon](https://www.amazon.de/s?k=Aluminium+Klebeband) |
| C7 | Antidote vials, 22 × 80 mm | 1+ | Small glass tubes with a cork, for a drink or sweets | 13 | [Amazon](https://www.amazon.de/dp/B0F9NYPPLY) |
| C8 | Milky (opal) acrylic sheet + logo sticker | 1 | Covers the logo cutout, lit from behind | 5 | [Amazon](https://www.amazon.de/s?k=Acrylglas+opal+3mm) |
| C9 | Foam sheet | 1 | Plates for the phone in the lid and the cover over the electronics | 5 | [Amazon](https://www.amazon.de/s?k=Schaumstoffplatte+schwarz) |
| C10 | Black tape | 1 roll | Lines the inside walls of the case | 3 | [Amazon](https://www.amazon.de/s?k=Gewebeband+schwarz) |

## Printed parts and small stuff

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| M1 | 3D-printed parts | 1 set | Vial parts and holders, drawer mechanism, fog chamber and reservoir, phone cover, corner pieces. Files and list: [cad/](../cad/README.md) | 5 | – |
| M2 | Small sponge + pipette | 1 + 1 | The sponge holds the water in the reservoir, the pipette refills it through the hole | 3 | – |
| M3 | Distilled water | 1 L | Keeps the mist disc clean | 2 | – |
| M4 | Small rubber band | 1 | Keeps the drawer's LED cable under tension | – | – |
| M5 | M3 screw | 1 | Adjusts the end switch position | – | – |
| M6 | Hot glue, two-part epoxy, Velcro | – | Hot glue for most parts, epoxy for the phone cover on the foam, Velcro on the foam plates | 8 | – |

## Tools

Not part of the build cost: soldering iron and solder, multimeter, wire stripper, side cutter, hot glue gun, sharp knife (for the case and the foam), drill, USB-C data cable for flashing the ESP32-C3, 3D printer.

## Rough total

About **€160** from Amazon without the phone and the tools, noticeably less from AliExpress if there's time to wait. The power bank and the case are the largest items.
