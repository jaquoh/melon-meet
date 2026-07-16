import { describe, expect, it } from "vitest";

import { normalizeGalleryImages, nextGalleryIndex } from "./ImageGallery";

describe("image gallery navigation", () => {
  it("removes blank and duplicate images while preserving order", () => {
    expect(normalizeGalleryImages([
      " https://images.example.com/one.jpg ",
      "",
      "https://images.example.com/two.jpg",
      "https://images.example.com/one.jpg",
    ])).toEqual([
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.jpg",
    ]);
  });

  it("wraps arrow navigation at both ends", () => {
    expect(nextGalleryIndex(0, -1, 3)).toBe(2);
    expect(nextGalleryIndex(2, 1, 3)).toBe(0);
    expect(nextGalleryIndex(1, 1, 3)).toBe(2);
    expect(nextGalleryIndex(0, 1, 0)).toBe(0);
  });
});
