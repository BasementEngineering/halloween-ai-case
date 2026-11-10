# 3D-printed parts

Everything printed for the case: ready-to-print STLs, plus the whole Fusion 360 design exported as STEP and IGES for any CAD program. The electronics are in [docs/hardware.md](../docs/hardware.md), the parts to buy in [docs/bom.md](../docs/bom.md).

| Folder | Contents |
|---|---|
| [`stl/`](stl/) | One file per part |
| [`step/`](step/) | The whole design as STEP, to modify it in FreeCAD, Onshape, SolidWorks … |
| [`fusion/`](fusion/) | The same design as IGES |

## Parts

### Vial and sensor (`stl/VialAndSensor/`)

| File | Part |
|---|---|
| `VialTop_Part.stl` | Top of the vial, holds the upper ends of the two glowstick tubes. **Print 3** |
| `VialBottom_InnerPart.stl` | Glowstick holder glued into the bottom of the vial |
| `VialBottom_OuterPart.stl` | Cap over the bottom end of the vial |
| `VialHolder.stl` | Vial holder with the two contact surfaces (aluminium tape) |
| `VialHolder_Short.stl` | Shorter version of the holder |

### Antidote release mechanism (`stl/AntidoteReleaseMechanism/`)

| File | Part |
|---|---|
| `Drawer.stl` | The drawer for the antidote |
| `Drawer_Enclosure.stl` | Enclosure the drawer slides in, with the motor and the mist channel |
| `DrawerEnclosureCap.stl` | Cap for the enclosure |
| `Rack.stl` | Toothed rack that pushes the drawer, with dimples for the end switches |
| `RackCover.stl` | Cover over the rack, so no cable gets caught |
| `gear.stl` | Gear on the N20 motor shaft |
| `SwitchBase.stl`, `Switch.stl` | Holder and levers for the two end switches |
| `3mmSpacer.stl` | Spacer |
| `FogChamberCap.stl` | Cap of the chamber with the mist maker |
| `WaterReservoir.stl`, `WaterReservoirCap.stl` | Water reservoir with the sponge, refilled through a small hole from outside |

### Lid (`stl/`)

| File | Part |
|---|---|
| `PhoneCover.stl` | Cover over the phone, glued to the foam plate, with holes to press the phone's buttons |
| `CornerPiece.stl` | Corner pieces that keep the foam plate in the lid |

## Updating the files

- Export STLs from Fusion one body per file.
- Export STEP and IGES from the top-level design.
- Git stores every version of a binary file in full, so commit finished revisions rather than every small tweak.
