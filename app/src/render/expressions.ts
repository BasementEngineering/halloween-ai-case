// Red Queen expressions, see docs/redqueen-visuals.md#expressions
export type Expression =
  | "neutral"
  | "speaking"
  | "processing"
  | "angry"
  | "interest"
  | "victory"
  | "concession";

// Images in public/redqueen/. Add a file here when a specialised image exists.
const IMAGES: Partial<Record<Expression, string>> = {
  neutral: "neutral.jpg",
  speaking: "speaking.jpg",
  angry: "angry.jpg",
  victory: "victory.jpg",
};

// Expressions without their own image use the closest one that has one.
const FALLBACK: Partial<Record<Expression, Expression>> = {
  processing: "neutral",
  interest: "neutral",
  concession: "victory",
};

export function imageFor(expression: Expression): string {
  const file = IMAGES[expression] ?? IMAGES[FALLBACK[expression] ?? "neutral"] ?? IMAGES.neutral!;
  return `/redqueen/${file}`;
}
