// Startup animation of the Red Queen: terminal lines appear on the screen
// while the voice session connects. The last line waits for `ready`.

const STEP_MS = 650;

const LINES = [
  "RED QUEEN // SECURITY INTELLIGENCE",
  "LOADING CONTAINMENT PROTOCOLS ........ OK",
  "BIOHAZARD LEVEL 4 CONFIRMED",
  "SUBJECT EXPOSURE DETECTED",
  "ESTABLISHING VOICE LINK ........",
];
const ONLINE = "ONLINE";

export async function runBootSequence(
  element: HTMLElement,
  ready: Promise<unknown>,
  onStep: (index: number) => void,
): Promise<void> {
  element.replaceChildren();
  element.hidden = false;

  for (const [index, text] of LINES.entries()) {
    addLine(element, text);
    onStep(index);
    await sleep(STEP_MS);
  }
  await ready.catch(() => undefined);
  addLine(element, ONLINE).classList.add("online");
  onStep(LINES.length);
  await sleep(STEP_MS * 1.5);
  element.hidden = true;
}

function addLine(element: HTMLElement, text: string): HTMLElement {
  const line = document.createElement("div");
  line.textContent = text;
  element.append(line);
  return line;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
