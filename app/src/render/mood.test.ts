import { describe, expect, it } from "vitest";
import { ExpressionPicker, MOOD_RULES } from "./mood.js";

function createPicker() {
  let time = 0;
  const picker = new ExpressionPicker(() => time);
  picker.reset(10);
  picker.setPhase("running");
  return { picker, advance: (ms: number) => (time += ms) };
}

describe("ExpressionPicker", () => {
  it("follows the agent state", () => {
    const { picker } = createPicker();
    expect(picker.current).toBe("neutral");
    picker.setAgentState("thinking");
    expect(picker.current).toBe("processing");
    picker.setAgentState("speaking");
    expect(picker.current).toBe("speaking");
    picker.setAgentState("listening");
    expect(picker.current).toBe("neutral");
  });

  it("gets angry on a sharp trust drop, for a while", () => {
    const { picker, advance } = createPicker();
    picker.onTrust(40);
    picker.onTrust(25);
    picker.setAgentState("speaking");
    expect(picker.current).toBe("angry");
    advance(MOOD_RULES.reactionHoldMs);
    expect(picker.current).toBe("speaking");
  });

  it("shows interest on a sharp trust rise, but not on small changes", () => {
    const { picker } = createPicker();
    picker.onTrust(20);
    expect(picker.current).toBe("neutral");
    picker.onTrust(70);
    expect(picker.current).toBe("interest");
  });

  it("shows the ending regardless of reactions", () => {
    const { picker } = createPicker();
    picker.onTrust(40);
    picker.onTrust(10);
    picker.setPhase("failed");
    expect(picker.current).toBe("victory");
    picker.setPhase("won");
    expect(picker.current).toBe("concession");
  });
});
