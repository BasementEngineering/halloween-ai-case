import type { IncomingMessage, ServerResponse } from "node:http";
import { Mistral } from "@mistralai/mistralai";
import type { Plugin } from "vite";
import { AGENTS, LANGUAGES, type Language } from "../src/agent/config.js";
import { codesMatch } from "../src/game/code.js";
import { requireEnv } from "./env.js";

// Dev-server API. Keeps the API key and the clearance code out of the browser.
//   POST   /api/voice-session          { tools, language } -> session from the language's agent
//   DELETE /api/voice-session?sessionId close it
//   POST   /api/verify-code            { code } -> { valid }
export function redQueenApi(): Plugin {
  return {
    name: "red-queen-api",
    configureServer(server) {
      const client = new Mistral({ apiKey: requireEnv("MISTRAL_API_KEY") });
      const clearanceCode = requireEnv("RED_QUEEN_CLEARANCE_CODE");

      server.middlewares.use("/api", async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://localhost");

          if (url.pathname === "/voice-session" && req.method === "POST") {
            const { tools, language = "en" } = await readJson(req);
            if (!LANGUAGES.includes(language)) return sendJson(res, 400, { error: `unknown language ${language}` });
            // Read per request, so a missing agent only fails when that language is used.
            const agentId = requireEnv(AGENTS[language as Language].envVar);
            const session = await client.audio.sessions.create({ agentId, tools });
            return sendJson(res, 200, session);
          }

          if (url.pathname === "/voice-session" && req.method === "DELETE") {
            const sessionId = url.searchParams.get("sessionId");
            if (!sessionId) return sendJson(res, 400, { error: "sessionId missing" });
            await client.audio.sessions.close({ sessionId });
            res.statusCode = 204;
            return res.end();
          }

          if (url.pathname === "/verify-code" && req.method === "POST") {
            const { code } = await readJson(req);
            return sendJson(res, 200, { valid: codesMatch(String(code ?? ""), clearanceCode) });
          }

          sendJson(res, 404, { error: "not found" });
        } catch (error) {
          console.error("[red-queen-api]", error);
          sendJson(res, 500, { error: String(error) });
        }
      });
    },
  };
}

async function readJson(req: IncomingMessage): Promise<Record<string, any>> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}
