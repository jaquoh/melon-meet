import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TurnstileWidget } from "./TurnstileWidget";

describe("TurnstileWidget", () => {
  it("marks the widget with the Spin analytics action", () => {
    const markup = renderToStaticMarkup(
      createElement(TurnstileWidget, {
        onTokenChange: () => undefined,
        siteKey: "test-site-key",
      }),
    );

    expect(markup).toContain('class="cf-turnstile turnstile-widget"');
    expect(markup).toContain('data-action="turnstile-spin-v2"');
  });
});
