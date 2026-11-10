# Bill of materials (2026 build)

Everything needed to build the Red Queen case. Wiring and pin map: [hardware.md](hardware.md).

- **Links** are shop searches (Amazon.de and AliExpress), not specific listings, so they don't go stale. AliExpress is cheaper but takes 1–3 weeks; with the 2026-11-15 deadline, order from Amazon or a local shop if it's urgent.
- **Prices** are rough estimates per line, not quotes.

## Electronics

### Controller and modules

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| E1 | ESP32-C3 Super Mini | 1 (+1 spare) | Case controller, BLE. Buy two, they're cheap and easy to kill | 4 | [Amazon](https://www.amazon.de/s?k=ESP32-C3+Super+Mini) · [AliExpress](https://de.aliexpress.com/w/wholesale-esp32-c3-super-mini.html) |
| E3 | DRV8833 motor driver breakout | 1 | Drawer motor. Some boards label nSLEEP as EEP or STBY | 3 | [Amazon](https://www.amazon.de/s?k=DRV8833+Motortreiber) · [AliExpress](https://de.aliexpress.com/w/wholesale-drv8833.html) |
| E6 | Logic-level N-MOSFET | 1 | Mist maker switch IRLZ34N / IRLZ44N (TO-220). | 1 | [Amazon](https://www.amazon.de/s?k=IRLZ44N) · [AliExpress](https://de.aliexpress.com/w/wholesale-irlz44n.html) |
| E7 | WS2812 (NeoPixel) LEDs | 28 | One chain: 15 inside the case, 8 in the logo, 5 in the drawer | – | [Amazon](https://www.amazon.de/s?k=WS2812B+LED+Streifen+5V) · [AliExpress](https://de.aliexpress.com/w/wholesale-ws2812b-strip.html) |
| E8 | DC gear motor, 3–6 V | 1 | N20 with 50–200 rpm, or a TT motor. Under 0.5 A stall at 5 V | 4 | [Amazon](https://www.amazon.de/s?k=N20+Getriebemotor+6V) · [AliExpress](https://de.aliexpress.com/w/wholesale-n20-gear-motor.html) |
| E9 | Ultrasonic mist maker, 5 V, with driver board | 1 (+1 spare disc) | USB / 5 V "atomizer" module, ~0.3–0.5 A. The discs wear out, a spare helps | 4 | [Amazon](https://www.amazon.de/s?k=Ultraschall+Vernebler+Modul+5V) · [AliExpress](https://de.aliexpress.com/w/wholesale-ultrasonic-atomizer-5v-module.html) |
| E10 | Micro switch | 2 | "Drawer closed" end switch; the second one is optional ("drawer open") or a spare | 2 | [Amazon](https://www.amazon.de/s?k=Mikroschalter+Hebel) · [AliExpress](https://de.aliexpress.com/w/wholesale-micro-switch-lever.html) |
| E12 | Lid switch | 1 | Micro switch or reed switch + magnet; closed while the lid is shut | 1 | [Amazon](https://www.amazon.de/s?k=Reedkontakt+Magnet) · [AliExpress](https://de.aliexpress.com/w/wholesale-reed-switch-magnet.html) |
| E14 | Electrolytic capacitor 100–470 µF, ≥ 10 V | 1 | At the mist maker board | 0.3 | [Amazon](https://www.amazon.de/s?k=Elko+470uF+16V) |
| E16 | Resistor 330 Ω | 1 | NeoPixel data line | – | [Amazon](https://www.amazon.de/s?k=Widerstand+Sortiment) |
| E18 | Resistor 10 kΩ | 1 | MOSFET gate pull-down | – | (same assortment) |

### Power and wiring

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| E24 | USB-C power bank, 10000 mAh, ≥ 3 A, **two outputs** | 1 | One output for the phone, one for the 5 V line. Must not switch off at low current | 25 | [Amazon](https://www.amazon.de/s?k=Powerbank+10000mAh+45W+USB-C) |
| E25 | USB cable for the phone (USB-C) | 1 | Short, 20–30 cm | 5 | [Amazon](https://www.amazon.de/s?k=USB-C+Kabel+kurz+30cm) |
| E26 | USB breakout or cut USB cable for the 5 V line | 1 | USB-A or USB-C plug to bare wires / screw terminals, rated ≥ 2 A | 4 | [Amazon](https://www.amazon.de/s?k=USB+Stecker+Breakout+Schraubklemme) · [AliExpress](https://de.aliexpress.com/w/wholesale-usb-male-terminal-adapter.html) |
| E27 | Power switch, inline or panel (optional) | 1 | Cuts the 5 V line to the controller and loads | 2 | [Amazon](https://www.amazon.de/s?k=Kippschalter+Mini) |
| E29 | Female pin headers | 2 × 8 pin + extras | So the C3 and breakouts plug in and stay replaceable | 2 | [Amazon](https://www.amazon.de/s?k=Buchsenleiste+2.54mm) |
| E30 | Breadboard with 400 dots | 1 | To put all the electronics together | 
| E31 | Silicone wire, 22–26 AWG, several colours | 1 set | 22 AWG for the 5 V / GND runs, 26 AWG for signals | 8 | [Amazon](https://www.amazon.de/s?k=Silikonkabel+22AWG+Set) |
| E33 | Heat-shrink tubing assortment | 1 | | 5 | [Amazon](https://www.amazon.de/s?k=Schrumpfschlauch+Sortiment) |

## Phone
| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| E34 | Samsung Galaxy A40 | 1 | Display, speaker and mic, runs the app ([phone-setup.md](phone-setup.md)) | – | – |
| E35 | Main phone as WiFi hotspot | 1 | Internet for the voice agent | – | – |

## Hardware and material

### Case and props

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| H1 | Prop case with foam insert | 1 | 150 mm x 260 mm | – | – |
| H2 | Vial (glass tube) | 1 + 1 spare | I found one with dried flowers inside, size is to be measured | 1 | bought at Action Store, can also be found here: https://maxx10group.pasaz24.pl/product/Suszone-kwiaty-w-szklanych-tubach-3009209-Dried-flowers-in-glass-tubes-s185887 or on [Amazon](https://www.amazon.de/-/en/comforder-Flowers-Flower-Decoration-Natural/dp/B09HY2ZV1J) |
| H24 | Aquarium tubing, 8 mm OD / 6 mm ID | 1 m | Used for the vial | 3 | [Amazon](https://www.amazon.de/s?k=Aquarienschlauch+6%2F8mm) · [AliExpress](https://de.aliexpress.com/w/wholesale-aquarium-tube-6mm-8mm.html) |
| H4 | Antidote vial(s) for the drawer | 1-24 | Small vials, different colour from the virus | 13 | [Amazon](https://www.amazon.de/dp/B0F9NYPPLY?ref=ppx_yo2ov_dt_b_fed_asin_title) |

### Drawer mechanism

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| H8 | Drawer body | 1 | 3D printed, or 3–4 mm plywood / MDF | 5 | [Amazon](https://www.amazon.de/s?k=Sperrholz+3mm+A4) |
| H9 | Drawer guides | 1 pair | Mini drawer slides, or printed / aluminium angle rails | 6 | [Amazon](https://www.amazon.de/s?k=Aluminium+Winkelprofil+10x10) |
| H10 | Drive wheel / pulley for the motor shaft | 1 | Matches the shaft (N20: 3 mm D-shaft), or 3D printed | 3 | [Amazon](https://www.amazon.de/s?k=N20+Rad+3mm) |
| H11 | Rubber bands / O-rings | several | Slip drive; keep spares, they wear and lose tension | 3 | [Amazon](https://www.amazon.de/s?k=O-Ring+Sortiment) |
| H12 | Motor mount | 1 | N20 clamp bracket or 3D printed | 2 | [Amazon](https://www.amazon.de/s?k=N20+Motor+Halterung) |

### Mist

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| H13 | Small water reservoir | 1 | Sealed or splash-proof cup for the mist disc, well away from the electronics | 3 | – |
| H14 | Wick / cotton sticks | several | Many 5 V atomizer kits feed the disc through a wick | – | (usually in the mist kit) |
| H15 | Distilled water | 1 L | Keeps the disc clean, no mineral residue | 2 | – |
| H16 | Short tube or channel to the drawer | 1 | Guides the mist out where the drawer opens | 3 | – |

### Mounting and fasteners

| # | Part | Qty | Spec / note | ≈ € | Links |
|---|---|---|---|---|---|
| H17 | Phone mount in the lid | 1 | 3D printed frame or a cheap holder taken apart; landscape | 5 | [Amazon](https://www.amazon.de/s?k=Handyhalterung+Klemme) |
| H19 | M2 / M3 screws, nuts and spacers | 1 set | For the perfboard, breakouts and brackets | 10 | [Amazon](https://www.amazon.de/s?k=M3+Abstandshalter+Set) |
| H20 | Double-sided foam tape | 1 roll | Power bank, perfboard, small parts | 5 | [Amazon](https://www.amazon.de/s?k=doppelseitiges+Klebeband+Schaum) |
| H21 | Hot glue | – | Strain relief, switches, LED strips | – | – |
| H22 | Cable ties and adhesive cable mounts | 1 set | | 5 | [Amazon](https://www.amazon.de/s?k=Kabelbinder+Klebesockel) |
| H23 | Velcro strap | 1 | Keeps the power bank removable for charging | 4 | [Amazon](https://www.amazon.de/s?k=Klettband+mit+Schnalle) |

## Tools

Not part of the build cost, listed so nothing's missing on build day: soldering iron and solder, multimeter, wire stripper, side cutter, hot glue gun, drill, USB-C data cable for flashing the C3, 3D printer (optional, for H8–H10, H12 and H17; the files are in [cad/](../cad/README.md)).

## Rough total

Parts still to buy, without tools: about **€150–200** (Amazon), or noticeably less from AliExpress if there's time to wait. The power bank (E24) is the largest single item.
