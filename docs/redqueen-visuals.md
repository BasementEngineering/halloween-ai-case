# Red Queen – Visuals

The Red Queen's look is an **original design**: a security AI that appears as a little girl's hologram. It's inspired by the genre, but it isn't a copy of the film character or of any real person. Don't use film stills, and don't name the film or any actor in the prompts.

The app adds the hologram effects live (red tint, scanlines, tearing, RGB split; see the renderer in step 1c). So the source images should be **clean**: neutral colours, a pure black background, and no glitch effects baked in.

## Screen look

This is the "AI on a monitor" style we're aiming for. It's a style, applied to our own character, and the shader in step 1c produces it:

| Element | Description | Done by |
|---|---|---|
| Monochrome red | Everything in deep red; highlights blow out to pink and white | Shader: colour grading by brightness |
| Projection grid | A fine square wire grid over the figure that follows the contours of face and body, like a projected mesh | Shader: grid modulated by brightness, slightly displaced so it wraps around shapes |
| Glow | Soft bloom around bright areas, slightly soft overall | Shader: bloom, light blur |
| Dark background | Figure floats in near-black, with faint noise | Source clips (black) + shader noise |
| Interference | Flicker, horizontal tearing, RGB split, stronger when she talks or gets angry | Shader, driven by voice volume and state |
| HUD | Small status text in a corner | App overlay |

Reference stills from the film stay private in `reference/`, which is git-ignored. They're never committed or published, and never used as input for image generation.

## Character design

| Trait | Design |
|---|---|
| Apparent age | About 9–10 years old |
| Hair | Platinum white, pulled back into a single tight braid, with a few loose strands |
| Face | Pale, symmetrical, calm. Large light grey eyes with a faint glow in the irises. Neutral, unreadable expression |
| Clothing | A plain high-collared tunic in matte charcoal, with a thin glowing seam line down the collar and a small hexagonal badge without any logo |
| Framing | Head and shoulders, centred, facing the camera |
| Mood | Clinical, eerily still, unsettlingly polite |

## Base image prompt

```
Portrait of an original sci-fi character: a calm little girl, about nine years old, who is the holographic avatar of a facility security AI. Platinum white hair pulled back into a single tight braid, a few loose strands. Pale, symmetrical face, large light grey eyes with a faint inner glow, perfectly neutral, unreadable expression, looking straight into the camera. Plain high-collared matte charcoal tunic with a thin glowing seam along the collar and a small blank hexagonal badge. Head-and-shoulders framing, centred, facing forward, perfectly still. Soft even studio light from the front, pure black background, no props. Clean, photorealistic, sharp focus, cinematic, eerie and clinical atmosphere.
```

**Negative prompt** (for tools that support one):

```
text, logo, watermark, red tint, glitch, scanlines, background objects, hands, smile, extra limbs, blurry, cartoon, anime
```

**Settings:**
- Aspect ratio **9:16** (portrait, for the phone held upright) or **16:9** if the phone lies sideways in the lid. Decide once you know how the phone sits in the case.
- Generate several variants and pick one face. All later clips should start from **this one image**, so she always looks the same.

## Expressions

The app picks an expression from the agent state and the game. The images are in `app/public/redqueen/`, and the mapping is in `app/src/render/expressions.ts`.

| Expression | When | Image | Falls back to |
|---|---|---|---|
| `neutral` | Listening (default) | `neutral.jpg` | – |
| `speaking` | She talks | `speaking.jpg` | – |
| `processing` | Thinking before a reply | – | `neutral` |
| `angry` | Threats, hacking, wrong code, trust drops sharply | `angry.jpg` | – |
| `interest` | Good argument, trust rises sharply | – | `neutral` |
| `victory` | Time is up | `victory.jpg` | – |
| `concession` | Antidote released | – | `victory` |

To add a missing image, put it in the folder and add it to `IMAGES` in `expressions.ts`.

## Expression variants

Generate these from the base image using image-to-image / edit, so the face stays identical:

| File | Change |
|---|---|
| `idle` | The base image itself |
| `angry` | `same girl, same framing, eyes slightly narrowed, head tilted down a little, cold disapproving stare` |
| `granted` | `same girl, same framing, the faintest hint of a smile, eyes half closed` |

## Video clips (image-to-video)

Use the base image as the start frame for every clip. All clips share the same rules, so they cut together and loop cleanly:

- Static, locked-off camera: no zoom, pan or camera shake.
- Head-and-shoulders framing, as in the base image.
- Pure black background throughout.
- No colour effects or glitches. The shader adds the red screen look live.
- End on a frame close to the start frame, so the loops are seamless.

| File | Length | Motion prompt |
|---|---|---|
| `idle.mp4` | 5 s, loop | `The girl stands perfectly still and looks straight into the camera with a calm, unreadable expression. She blinks slowly once. Her head moves only a few millimetres, as if she is barely breathing. A few loose strands of hair drift very slightly. Static locked-off camera, pure black background, no colour change, ends in the same pose as it starts.` |
| `talking.mp4` | 5 s, loop | `The girl speaks calmly and precisely to the camera with small, clear mouth movements, as if explaining a rule. Her head stays almost still, with one slight tilt to the side and back. Her gaze never leaves the camera. She blinks once. Static locked-off camera, pure black background, no colour change, ends in the same pose as it starts.` |
| `thinking.mp4` | 4 s, loop | `The girl's eyes move slightly to the side as if reading data, then return to the camera. Her face stays completely calm, the head does not move. Static locked-off camera, pure black background, no colour change.` |
| `angry.mp4` | 4 s | `The girl slowly lowers her chin and narrows her eyes into a cold, disapproving stare at the camera. No other movement. Static locked-off camera, pure black background, no colour change.` |
| `granted.mp4` | 4 s | `The girl closes her eyes for a moment, then opens them and gives the faintest, almost invisible smile, then becomes neutral again. Static locked-off camera, pure black background, no colour change.` |
| `glitch-in.mp4` | 2 s | `The girl appears out of complete darkness: first a faint outline, then her face and shoulders become solid within two seconds. She is already looking at the camera. Static locked-off camera, pure black background.` |
| `glitch-out.mp4` | 2 s | `The girl fades into complete darkness, dissolving from the edges inward, while still looking at the camera. Static locked-off camera, pure black background.` |

The tearing and glitching in `glitch-in` and `glitch-out` come from the shader. The clips themselves only need a clean fade.

**Tips:**
- Video tools work best with one simple action per clip. Generate several takes and pick the calmest one.
- If a tool adds camera movement anyway, put `no camera movement` at the start of the prompt.
- If the face changes between clips, regenerate from the same base image instead of from the last frame of a previous clip.

### Optional: screen look baked into the clips

To preview the look before the shader exists, append this to any motion prompt. It's still our own character, with only the display style added:

```
Shown as a red monochrome hologram on a monitor: everything in deep red with pink-white highlights, a fine glowing square wire grid that wraps around the contours of her face and body like a projected mesh, soft bloom, faint flicker and scan lines.
```

For the final app, use the clean clips, so the shader controls the effects and can react to her voice.

Export as H.264 MP4, about 720 px on the short side, without sound. Put the files in `app/public/redqueen/`.
