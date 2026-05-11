import { z } from "zod";

export const pricingSchema = z.enum(["free", "paid"]);
export const visibilitySchema = z.enum(["public", "private"]);
export const groupRoleSchema = z.enum(["owner", "admin", "member"]);
export const recurrenceTypeSchema = z.enum(["once", "weekly"]);
export const membershipRequestStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const reportReasonSchema = z.enum([
  "spam",
  "harassment",
  "hate_or_threats",
  "sexual_content",
  "scam_or_phishing",
  "safety_concern",
  "impersonation",
  "underage_concern",
  "other",
]);
export const reportTargetTypeSchema = z.enum([
  "profile",
  "group",
  "meeting",
  "group_post",
  "meeting_post",
  "invite_abuse",
]);

function isPrivateIpv4Host(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const octets = match.slice(1).map((entry) => Number(entry));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isBlockedPublicUrlHostname(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "[::1]" ||
    isPrivateIpv4Host(normalizedHostname)
  );
}

function normalizePublicHttpsUrl(value: string) {
  const trimmed = value.trim();
  const url = new URL(trimmed);
  if (url.protocol !== "https:") {
    throw new Error("Use an https URL.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }
  if (!url.hostname || isBlockedPublicUrlHostname(url.hostname)) {
    throw new Error("URL must point to a public host.");
  }
  url.hash = "";
  return url.toString();
}

export const publicHttpsUrlSchema = z.string().trim().min(1).transform((value, ctx) => {
  try {
    return normalizePublicHttpsUrl(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Enter a valid public https URL.",
    });
    return z.NEVER;
  }
});

const optionalPublicHttpsUrlSchema = publicHttpsUrlSchema.optional().or(z.literal("")).nullable();

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  turnstileToken: z.string().trim().min(1).optional().nullable(),
});

export const playingLevelPattern = /^(?:\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)?$/;

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(500).default(""),
  homeArea: z.string().trim().max(120).default(""),
  playingLevel: z.string().trim().max(20).regex(playingLevelPattern, "Use values like 3, 3.5, 2-3, or 3.5-4.").default(""),
  avatarUrl: optionalPublicHttpsUrlSchema,
  isProfilePublic: z.boolean().default(false),
  showEmailPublicly: z.boolean().default(false),
});

export const groupCreateSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(10).max(1000),
  visibility: visibilitySchema,
  activityLabel: z.string().trim().max(80).optional().or(z.literal("")).nullable(),
  messengerUrl: optionalPublicHttpsUrlSchema,
  heroImageUrl: optionalPublicHttpsUrlSchema,
});

export const groupUpdateSchema = groupCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided.",
);

export const groupPostSchema = z.object({
  content: z.string().trim().min(1).max(400),
});

export const roleUpdateSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const friendRequestSchema = z
  .object({
    targetUserId: z.string().uuid().optional(),
    targetEmail: z.string().email().optional(),
  })
  .refine(
    (value) => Boolean(value.targetUserId || value.targetEmail),
    "Provide a target email or user id.",
  );

export const recurrenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("once"),
  }),
  z.object({
    type: z.literal("weekly"),
    timezone: z.string().min(1).default("Europe/Berlin"),
    untilDate: z.string().date().optional().nullable(),
  }),
]);

export const meetingCreateSchema = z
  .object({
    groupId: z.string().uuid(),
    shortName: z.string().trim().min(2).max(24),
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
    activityLabel: z.string().trim().max(80).optional().or(z.literal("")).nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    venueId: z.string().optional().nullable(),
    locationName: z.string().trim().min(2).max(120),
    locationAddress: z.string().trim().min(2).max(160),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    pricing: pricingSchema,
    costPerPerson: z.number().min(0).max(500).optional().nullable(),
    capacity: z.number().int().min(2).max(200),
    heroImageUrl: optionalPublicHttpsUrlSchema,
    recurrence: recurrenceSchema,
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: "Meeting end time must be after the start time.",
    path: ["endsAt"],
  });

export const meetingUpdateSchema = z
  .object({
    shortName: z.string().trim().min(2).max(24).optional(),
    title: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    activityLabel: z.string().trim().max(80).optional().nullable(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    venueId: z.string().optional().nullable(),
    locationName: z.string().trim().min(2).max(120).optional(),
    locationAddress: z.string().trim().min(2).max(160).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    pricing: pricingSchema.optional(),
    costPerPerson: z.number().min(0).max(500).optional().nullable(),
    capacity: z.number().int().min(2).max(200).optional(),
    heroImageUrl: optionalPublicHttpsUrlSchema,
    applyToSeries: z.boolean().optional(),
    seriesDates: z
      .array(
        z
          .object({
            startsAt: z.string().datetime(),
            endsAt: z.string().datetime(),
          })
          .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
            message: "Meeting end time must be after the start time.",
            path: ["endsAt"],
          }),
      )
      .optional(),
  })
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    {
      message: "Meeting end time must be after the start time.",
      path: ["endsAt"],
    },
  );

export const postSchema = z.object({
  content: z.string().trim().min(1).max(400),
});

export const mapQuerySchema = z.object({
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  pricing: z.enum(["all", "free", "paid"]).default("all"),
  openOnly: z.coerce.boolean().default(false),
});

export const reportCreateSchema = z.object({
  note: z.string().trim().max(500).optional().or(z.literal("")).nullable(),
  reason: reportReasonSchema,
  targetId: z.string().trim().min(1).max(120),
  targetType: reportTargetTypeSchema,
});

export type AuthInput = z.infer<typeof authSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type GroupPostInput = z.infer<typeof groupPostSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;
export type MeetingUpdateInput = z.infer<typeof meetingUpdateSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type MapQueryInput = z.infer<typeof mapQuerySchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export interface ViewerSummary {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  bio: string;
  homeArea: string;
  playingLevel: string;
  avatarUrl: string | null;
  isProfilePublic: boolean;
  showEmailPublicly: boolean;
}

export interface FriendSummary {
  id: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
  user: ViewerSummary;
}

export interface GroupSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "private";
  activityLabel: string | null;
  ownerUserId: string;
  memberCount: number;
  publicSessionCount: number;
  messengerUrl: string | null;
  heroImageUrl: string | null;
  viewerRole: "owner" | "admin" | "member" | null;
}

export interface MeetingSummary {
  id: string;
  groupId: string;
  groupName: string;
  groupVisibility: "public" | "private";
  ownerUserId: string;
  shortName: string;
  title: string;
  description: string | null;
  activityLabel: string | null;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  pricing: "free" | "paid";
  costPerPerson: number | null;
  capacity: number;
  claimedSpots: number;
  openSpots: number;
  heroImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: "active" | "cancelled" | "archived";
  venueId: string | null;
  seriesId: string | null;
  viewerCanEdit: boolean;
  viewerHasClaimed: boolean;
}

export interface VenueSummary {
  id: string;
  name: string;
  address: string;
  description: string;
  pricing: "free" | "paid";
  latitude: number;
  longitude: number;
  sourceUrl: string | null;
  sourceUrls: string[];
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  bookingUrl: string | null;
  openingHoursText: string | null;
  heroImageUrl: string | null;
  courtCountTotal: number | null;
  indoorCourtCount: number;
  outdoorCourtCount: number;
  accessType: "public" | "bookable" | "membership" | "entry_fee" | "mixed";
  environment: "indoor" | "outdoor" | "indoor_outdoor";
  seasonalityText: string | null;
  facts: {
    areaNotes: string[];
    equipment: string[];
    parkInspectorScore: number | null;
    playerLevel: string | null;
    surface: string | null;
  };
  amenities: string[];
  imageGallery: Array<{
    url: string;
    sourceUrl: string;
    credit: string;
    license: string;
    rightsStatus: "usable" | "requires_permission";
  }>;
  duplicateNotes: string | null;
  researchedAt: string | null;
}

export interface GroupPost {
  id: string;
  content: string;
  createdAt: string;
  author: ViewerSummary;
}

export interface MeetingPost {
  id: string;
  content: string;
  createdAt: string;
  author: ViewerSummary;
}

export interface MembershipRequestSummary {
  id: string;
  groupId: string;
  requester: ViewerSummary;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
