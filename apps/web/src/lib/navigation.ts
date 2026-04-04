import type { Location } from "react-router-dom";

export interface NavigationState {
  fromLabel: string;
  fromPath: string;
}

export function createNavigationState(
  location: Pick<Location, "pathname" | "search">,
  fromLabel: string,
): NavigationState {
  return {
    fromLabel,
    fromPath: `${location.pathname}${location.search}`,
  };
}

export function resolveNavigationState(
  state: unknown,
  fallbackPath: string,
  fallbackLabel: string,
): NavigationState {
  if (
    state &&
    typeof state === "object" &&
    "fromLabel" in state &&
    "fromPath" in state &&
    typeof state.fromLabel === "string" &&
    typeof state.fromPath === "string"
  ) {
    return {
      fromLabel: state.fromLabel,
      fromPath: state.fromPath,
    };
  }

  return {
    fromLabel: fallbackLabel,
    fromPath: fallbackPath,
  };
}
