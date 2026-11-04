import type { Language } from "../agent/config.js";

// Standby screen: a rotating 3D logo and the label of the sample in the case.

const OWN_LOGO = "/standby/logo.png"; // optional, git-ignored
const DEFAULT_LOGO = "/standby/emblem.svg"; // original emblem
const LAYERS = 14; // stacked copies that give the logo its thickness
const THICKNESS_PX = 14;

// Each line has a style: unit header, the virus name (large), details, and the guarding
// system with its status at the bottom.
type LabelLine = { text: string; kind: "unit" | "virus" | "strain" | "class" | "note" | "system" | "status" };

const SPECIMEN: Record<Language, LabelLine[]> = {
  en: [
    { text: "CONTAINMENT UNIT 07", kind: "unit" },
    { text: "T-VIRUS", kind: "virus" },
    { text: "PROTOTYPE STRAIN", kind: "strain" },
    { text: "BIOHAZARD LEVEL 4", kind: "class" },
    { text: "Mutagenic viral agent. Transmission by contact with the sample.", kind: "note" },
    { text: "WARDEN-3 SECURITY SYSTEM", kind: "system" },
    { text: "STATUS: ACTIVE", kind: "status" },
  ],
  de: [
    { text: "SICHERHEITSBEHÄLTER 07", kind: "unit" },
    { text: "T-VIRUS", kind: "virus" },
    { text: "PROTOTYP-STAMM", kind: "strain" },
    { text: "BIOLOGISCHE SCHUTZSTUFE 4", kind: "class" },
    { text: "Mutagener viraler Erreger. Übertragung durch Kontakt mit der Probe.", kind: "note" },
    { text: "SICHERHEITSSYSTEM WARDEN-3", kind: "system" },
    { text: "STATUS: AKTIV", kind: "status" },
  ],
};

export async function buildEmblem(container: HTMLElement) {
  const src = (await imageExists(OWN_LOGO)) ? OWN_LOGO : DEFAULT_LOGO;
  container.replaceChildren();
  for (let i = 0; i < LAYERS; i++) {
    const layer = document.createElement("img");
    layer.src = src;
    layer.alt = "";
    const z = (i / (LAYERS - 1) - 0.5) * THICKNESS_PX;
    layer.style.transform = `translateZ(${z}px)`;
    // Front and back faces bright, the layers in between form a darker edge.
    const isFace = i === 0 || i === LAYERS - 1;
    if (!isFace) layer.style.filter = "brightness(0.45)";
    container.append(layer);
  }
}

export function showSpecimen(container: HTMLElement, language: Language) {
  container.replaceChildren(
    ...SPECIMEN[language].map(({ text, kind }, index) => {
      const line = document.createElement("div");
      line.textContent = text;
      line.className = kind;
      line.style.animationDelay = `${0.4 + index * 0.35}s`;
      return line;
    }),
  );
}

function imageExists(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}
