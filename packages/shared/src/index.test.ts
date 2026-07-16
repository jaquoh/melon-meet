import { describe, expect, it } from "vitest";

import {
  CURRENT_POLICY_VERSIONS,
  groupCreateSchema,
  meetingCreateSchema,
  profileUpdateSchema,
  publicHttpsUrlSchema,
  signupSchema,
  venueCreateSchema,
  venueUpdateSchema,
} from "./index";

const validVenueInput = {
  accessType: "bookable" as const,
  address: "Teststraße 1, 10115 Berlin",
  amenities: ["showers", "changing rooms"],
  bookingUrl: "https://booking.example.com/courts",
  courtCountTotal: 3,
  description: "A well maintained beach volleyball venue in central Berlin.",
  duplicateNotes: null,
  environment: "indoor_outdoor" as const,
  facts: {
    areaNotes: ["Near the station"],
    equipment: ["fixed nets"],
    parkInspectorScore: 4.5,
    playerLevel: "All levels",
    surface: "Sand",
  },
  googleMapsUrl: "https://maps.example.com/test-venue",
  heroImageUrl: null,
  imageGallery: [],
  indoorCourtCount: 1,
  latitude: 52.52,
  longitude: 13.405,
  name: "Test Venue",
  openingHoursText: "Daily 09:00-22:00",
  outdoorCourtCount: 2,
  pricing: "paid" as const,
  researchedAt: "2026-07-15T10:00:00.000Z",
  seasonalityText: "Open year-round.",
  sourceUrl: "https://example.com/test-venue",
  sourceUrls: ["https://example.com/test-venue"],
  websiteUrl: "https://example.com",
};

describe("venue content validation", () => {
  it("accepts a complete curated venue and normalizes its id", () => {
    const venue = venueCreateSchema.parse({
      ...validVenueInput,
      id: "  venue-test-courts  ",
    });

    expect(venue.id).toBe("venue-test-courts");
    expect(venue.courtCountTotal).toBe(3);
  });

  it("rejects court totals that do not match indoor and outdoor counts", () => {
    const result = venueUpdateSchema.safeParse({
      ...validVenueInput,
      courtCountTotal: 4,
    });

    expect(result.success).toBe(false);
  });

  it("rejects private or non-https venue URLs", () => {
    expect(
      venueUpdateSchema.safeParse({
        ...validVenueInput,
        bookingUrl: "http://example.com/book",
      }).success,
    ).toBe(false);
    expect(
      venueUpdateSchema.safeParse({
        ...validVenueInput,
        websiteUrl: "https://192.168.1.5/venue",
      }).success,
    ).toBe(false);
  });
});

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

  it("accepts ordered image galleries for profiles, groups, and meetings", () => {
    const imageUrls = [
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.jpg#crop",
    ];

    expect(profileUpdateSchema.parse({
      avatarUrl: imageUrls[0],
      bio: "",
      displayName: "Melon Demo",
      homeArea: "",
      imageUrls,
      isProfilePublic: true,
      playingLevel: "",
      showEmailPublicly: false,
    }).imageUrls).toEqual([
      "https://images.example.com/one.jpg",
      "https://images.example.com/two.jpg",
    ]);

    expect(groupCreateSchema.safeParse({
      activityLabel: "Beach volleyball",
      description: "Friendly beach volleyball group in Berlin.",
      heroImageUrl: imageUrls[0],
      imageUrls,
      messengerUrl: null,
      name: "Melon Crew",
      slug: "melon-crew",
      visibility: "public",
    }).success).toBe(true);

    expect(meetingCreateSchema.safeParse({
      activityLabel: "Beach volleyball",
      capacity: 12,
      costPerPerson: null,
      description: "",
      endsAt: "2026-05-11T18:00:00.000Z",
      groupId: "7f18fd0c-4d1d-46cc-b4e8-826bb254cde4",
      heroImageUrl: imageUrls[0],
      imageUrls,
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
    }).success).toBe(true);
  });

  it("rejects private gallery URLs and galleries larger than twelve images", () => {
    const baseProfile = {
      avatarUrl: null,
      bio: "",
      displayName: "Melon Demo",
      homeArea: "",
      isProfilePublic: true,
      playingLevel: "",
      showEmailPublicly: false,
    };

    expect(profileUpdateSchema.safeParse({
      ...baseProfile,
      imageUrls: ["https://localhost/private.jpg"],
    }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({
      ...baseProfile,
      imageUrls: Array.from({ length: 13 }, (_, index) => `https://images.example.com/${index}.jpg`),
    }).success).toBe(false);
  });

  it("requires the current policy versions on signup", () => {
    expect(
      signupSchema.safeParse({
        acceptedAgeMinimum: true,
        acceptedPolicyVersions: {
          privacy: CURRENT_POLICY_VERSIONS.privacy,
          terms: CURRENT_POLICY_VERSIONS.terms,
        },
        email: "hello@example.com",
        password: "melonmelon",
        turnstileToken: null,
      }).success,
    ).toBe(true);

    expect(
      signupSchema.safeParse({
        acceptedAgeMinimum: true,
        acceptedPolicyVersions: {
          privacy: "2026-04-25",
          terms: CURRENT_POLICY_VERSIONS.terms,
        },
        email: "hello@example.com",
        password: "melonmelon",
        turnstileToken: null,
      }).success,
    ).toBe(false);

    expect(
      signupSchema.safeParse({
        acceptedAgeMinimum: false,
        acceptedPolicyVersions: {
          privacy: CURRENT_POLICY_VERSIONS.privacy,
          terms: CURRENT_POLICY_VERSIONS.terms,
        },
        email: "hello@example.com",
        password: "melonmelon",
        turnstileToken: null,
      }).success,
    ).toBe(false);
  });
});
