import type { Language } from "../agent/config.js";

// Standby screen: a rotating 3D logo and the label of the sample in the case.

const OWN_LOGO = "/standby/logo.png"; // optional, git-ignored
const DEFAULT_LOGO = "/standby/emblem.svg"; // original emblem
const LAYERS = 14; // stacked copies that give the logo its thickness
const THICKNESS_PX = 14;

const SPECIMEN: Record<Language, string[]> = {
  en: [
    "CONTAINMENT UNIT 07",
    "SPECIMEN: T-VIRUS, PROTOTYPE STRAIN",
    "CLASS: BIOHAZARD LEVEL 4",
    "Mutagenic viral agent. Transmission by contact with the sample.",
    "Do not open the vial. Do not remove the sample from containment.",
    "Security monitoring: ACTIVE",
  ],
  de: [
    "SICHERHEITSBEHÄLTER 07",
    "PROBE: T-VIRUS, PROTOTYP-STAMM",
    "KLASSE: BIOLOGISCHE SCHUTZSTUFE 4",
    "Mutagener viraler Erreger. Übertragung durch Kontakt mit der Probe.",
    "Ampulle nicht öffnen. Probe nicht aus der Eindämmung entfernen.",
    "Sicherheitsüberwachung: AKTIV",
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
    ...SPECIMEN[language].map((text, index) => {
      const line = document.createElement("div");
      line.textContent = text;
      line.style.animationDelay = `${0.4 + index * 0.35}s`;
      if (index < 3) line.className = "heading";
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
