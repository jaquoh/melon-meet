export type LandingAuthMode = "login" | "signup";

export function getLandingAuthPanelToggleState(showAuthPanel: boolean): {
  mode: LandingAuthMode;
  showAuthPanel: boolean;
} {
  return {
    mode: "login",
    showAuthPanel: !showAuthPanel,
  };
}
