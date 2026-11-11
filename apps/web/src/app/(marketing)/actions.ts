"use server";
import { z } from "zod";
import { getBrand, getLocale } from "@/i18n";

export type EnquiryField = "name" | "email" | "type" | "message";
export type EnquiryState = {
  status: "idle" | "ok" | "error";
  /** "validation" = field errors; "server" = could not save */
  code?: "validation" | "server";
  fields?: EnquiryField[];
};

const schema = z.object({
  kind: z.enum(["partner", "contact"]),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  company: z.string().trim().max(160).optional(),
  type: z.enum(["venue", "dj", "photographer", "planner", "other"]),
  message: z.string().trim().max(2000).optional(),
});

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

/** Saves a partner / contact enquiry into `leads`. */
export async function submitEnquiry(_prev: EnquiryState, fd: FormData): Promise<EnquiryState> {
  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (str(fd, "website")) return { status: "ok" };

  const parsed = schema.safeParse({
    kind: str(fd, "kind") || "partner",
    name: str(fd, "name"),
    email: str(fd, "email").trim(),
    company: str(fd, "company") || undefined,
    type: str(fd, "type"),
    message: str(fd, "message") || undefined,
  });
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path[0]))].filter(
      (p): p is EnquiryField => p === "name" || p === "email" || p === "type" || p === "message",
    );
    return { status: "error", code: "validation", fields };
  }
  const d = parsed.data;
  try {
    // Lazy import so pages never need DATABASE_URL at build time.
    const { db, schema: s } = await import("@/db");
    const [brand, locale] = await Promise.all([getBrand(), getLocale()]);
    await db.insert(s.leads).values({
      kind: d.kind,
      email: d.email.toLowerCase(),
      name: d.name,
      data: { company: d.company ?? null, type: d.type, message: d.message ?? null, brand, locale },
    });
    return { status: "ok" };
  } catch (e) {
    console.error("submitEnquiry failed", e);
    return { status: "error", code: "server" };
  }
}
