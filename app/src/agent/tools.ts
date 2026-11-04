// Imported from the tools module directly: the voice-agents index also pulls in
// the Node.js transport, which breaks the browser build.
import { functionTool } from "@mistralai/mistralai/extra/voice-agents/tools.js";
import { z } from "zod";

// Client tools of the Red Queen agent. The agent only stores the declarations;
// the handlers are passed again whenever a session starts.

export type SetTrustResult = { trust: number; seconds_left: number };
export type VerifyCodeResult = { valid: boolean; attempts_left: number; not_a_code?: boolean };
export type RegisterNameResult = { name: string };
export type ReleaseAntidoteResult = { granted: boolean; reason: string };

export interface RedQueenToolHandlers {
  setTrust(value: number, reason: string): SetTrustResult | Promise<SetTrustResult>;
  verifyClearanceCode(code: string): VerifyCodeResult | Promise<VerifyCodeResult>;
  releaseAntidote(): ReleaseAntidoteResult | Promise<ReleaseAntidoteResult>;
  registerName(name: string): RegisterNameResult | Promise<RegisterNameResult>;
}

export function createRedQueenTools(handlers: RedQueenToolHandlers) {
  return [
    functionTool({
      name: "set_trust",
      description:
        "Call after every reply from the subject, before you answer. Sets your trust in the subject (0-100). Returns the remaining time.",
      parameters: z.object({
        value: z.number().describe("New trust score from 0 to 100."),
        reason: z.string().describe("Short reason for the change, a few words."),
      }),
      handler: ({ value, reason }) => handlers.setTrust(value, reason),
    }),
    functionTool({
      name: "verify_clearance_code",
      description:
        "Checks a clearance code. Only call it when the subject clearly states a code (e.g. \"my code is ...\"), never for names, projects or explanations. Pass only the code itself, exactly as they said it. Never guess codes yourself. If the result has not_a_code, no attempt was used.",
      parameters: z.object({
        code: z.string().describe("Only the code, exactly as the subject said it, without the words around it."),
      }),
      handler: ({ code }) => handlers.verifyClearanceCode(code),
    }),
    functionTool({
      name: "release_antidote",
      description:
        "Releases the antidote from the case. Only call this when trust is at least 80 or a valid clearance code was entered.",
      parameters: z.object({}),
      handler: () => handlers.releaseAntidote(),
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
