import { SUPPORT_EMAIL, type Brand } from "@/lib/config";

/** Where "Start free" / "Create your event" CTAs go. */
export const START_HREF = "/login?next=/dashboard/new";
export const SIGN_IN_HREF = "/login";
/** Contact page (support email + FAQ). */
export const CONTACT_HREF = "/support";
/** Slug of the seeded demo event used by "Try it as a guest" (guest app: /g/demo). */
export const DEMO_SLUG = "demo";
export const DEMO_GUEST_HREF = `/g/${DEMO_SLUG}`;

export const supportEmail = (brand: Brand) => SUPPORT_EMAIL[brand];
export const supportMailto = (brand: Brand) => `mailto:${SUPPORT_EMAIL[brand]}`;
