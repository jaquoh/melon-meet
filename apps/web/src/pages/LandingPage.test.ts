import { describe, expect, it } from "vitest";

import { getLandingAuthPanelToggleState } from "./landing-auth-state";

describe("landing authentication panel", () => {
  it("reopens in login mode after the signup panel is closed", () => {
    expect(getLandingAuthPanelToggleState(true)).toEqual({
      mode: "login",
      showAuthPanel: false,
    });
    expect(getLandingAuthPanelToggleState(false)).toEqual({
      mode: "login",
      showAuthPanel: true,
    });
  });
});
