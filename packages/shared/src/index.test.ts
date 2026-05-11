import { describe, expect, it } from "vitest";

import {
  groupCreateSchema,
  meetingCreateSchema,
  profileUpdateSchema,
  publicHttpsUrlSchema,
} from "./index";

describe("public URL validation", () => {
  it("normalizes public https URLs and removes fragments", () => {
    expect(publicHttpsUrlSchema.parse(" https://Example.com/path?q=1#frag ")).toBe("https://example.com/path?q=1");
  });

  it("rejects non-https URLs and local/private hosts", () => {
    expect(publicHttpsUrlSchema.safeParse("http://example.com").success).toBe(false);
    expect(publicHttpsUrlSchema.safeParse("https://localhost:3000/avatar.png").success).toBe(false);
    expect(publicHttpsUrlSchema.safeParse("https://192.168.1.8/image.png").success).toBe(false);
    expect(publicHttpsUrlSchema.safeParse("https://user:pass@example.com/image.png").success).toBe(false);
  });

  it("applies the same URL rule to profile, group, and meeting payloads", () => {
    expect(
      profileUpdateSchema.safeParse({
        avatarUrl: "https://cdn.example.com/avatar.png",
        bio: "",
        displayName: "Melon Demo",
        homeArea: "",
        isProfilePublic: false,
        playingLevel: "",
        showEmailPublicly: false,
      }).success,
    ).toBe(true);

    expect(
      groupCreateSchema.safeParse({
        activityLabel: "",
        description: "Friendly beach volleyball group in Berlin.",
        heroImageUrl: "https://10.0.0.2/banner.jpg",
        messengerUrl: "https://t.me/melonmeet",
        name: "Melon Crew",
        slug: "melon-crew",
        visibility: "public",
      }).success,
    ).toBe(false);

    expect(
      meetingCreateSchema.safeParse({
        activityLabel: "",
        capacity: 12,
        costPerPerson: null,
        description: "",
        endsAt: "2026-05-11T18:00:00.000Z",
        groupId: "7f18fd0c-4d1d-46cc-b4e8-826bb254cde4",
        heroImageUrl: "https://images.example.com/meetup.jpg",
        latitude: 52.52,
        locationAddress: "Berlin",
        locationName: "Beach court",
        longitude: 13.405,
        pricing: "free",
        recurrence: { type: "once" },
        shortName: "Open Play",
        startsAt: "2026-05-11T16:00:00.000Z",
        title: "After work beach session",
        venueId: null,
      }).success,
    ).toBe(true);
  });
});
