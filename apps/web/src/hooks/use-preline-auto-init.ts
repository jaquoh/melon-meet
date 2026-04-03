import { useEffect } from "react";

declare global {
  interface Window {
    HSStaticMethods?: {
      autoInit: () => void;
    };
  }
}

export function usePrelineAutoInit() {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await import("preline/preline");
      if (!cancelled) {
        window.HSStaticMethods?.autoInit();
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  });
}
