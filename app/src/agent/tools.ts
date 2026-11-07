// Imported from the tools module directly: the voice-agents index also pulls in
// the Node.js transport, which breaks the browser build.
import { functionTool } from "@mistralai/mistralai/extra/voice-agents/tools.js";
import { z } from "zod";

// Client tools of the Red Queen agent. The agent only stores the declarations;
// the handlers are passed again whenever a session starts.

// antidote_released: the app has opened the drawer (trust reached the threshold, or a
// valid code). The win is the app's decision; she only announces it.
export type SetTrustResult = { trust: number; seconds_left: number; antidote_released: boolean };
export type VerifyCodeResult = { valid: boolean; attempts_left: number; not_a_code?: boolean; antidote_released?: boolean };
export type RegisterNameResult = { name: string };

export interface RedQueenToolHandlers {
  setTrust(value: number, reason: string): SetTrustResult | Promise<SetTrustResult>;
  verifyClearanceCode(code: string): VerifyCodeResult | Promise<VerifyCodeResult>;
  registerName(name: string): RegisterNameResult | Promise<RegisterNameResult>;
}

export function createRedQueenTools(handlers: RedQueenToolHandlers) {
  return [
    functionTool({
      name: "set_trust",
      description:
        "Call after every reply from the subject, before you answer. Sets your trust in the subject (0-100). Returns the remaining time, and antidote_released: true once trust has reached 80 and the case has released the antidote.",
      parameters: z.object({
        value: z.number().describe("New trust score from 0 to 100."),
        reason: z.string().describe("Short reason for the change, a few words."),
      }),
      handler: ({ value, reason }) => handlers.setTrust(value, reason),
    }),
    functionTool({
      name: "verify_clearance_code",
      description:
        "Checks a clearance code. Only call it when the subject clearly states a code (e.g. \"my code is ...\"), never for names, projects or explanations. Pass only the code itself, exactly as they said it. Never guess codes yourself. If the result has not_a_code, no attempt was used. A valid code releases the antidote at once (antidote_released: true).",
      parameters: z.object({
        code: z.string().describe("Only the code, exactly as the subject said it, without the words around it."),
      }),
      handler: ({ code }) => handlers.verifyClearanceCode(code),
    }),
    functionTool({
      name: "register_name",
      description:
        "Call as soon as the subject tells you their name, and again if they correct it. Records it for the facility log.",
      parameters: z.object({
        name: z.string().describe("The subject's name as they said it, e.g. \"Dr. Jane Doe\"."),
      }),
      handler: ({ name }) => handlers.registerName(name),
    }),
  ];
}
