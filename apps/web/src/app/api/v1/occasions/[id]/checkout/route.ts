import { z } from "zod";
import { route, json, readJson, ApiError } from "@/lib/http";
import { requireMember } from "@/lib/auth";
import { PLANS, UPGRADE_TEK_TO_BUYUK_PENCE, brandBaseUrl } from "@/lib/config";
import { db, schema } from "@/db";
import { paymentsEnabled, stripe } from "@/lib/stripe";
import { requestLocale } from "@/lib/request";

const RANK = { free: 0, tek: 1, buyuk: 2 } as const;

export const POST = route<{ id: string }>(async (req, { id }) => {
  const { host, occasion } = await requireMember(id);
  const { plan } = await readJson(req, z.object({ plan: z.enum(["tek", "buyuk"]) }));
  if (!paymentsEnabled()) throw new ApiError(503, "payments_unavailable", "Payments are coming soon");
  if (occasion.status === "archived") throw new ApiError(403, "upload_closed", "This album has expired");
  if (RANK[occasion.plan] >= RANK[plan]) throw new ApiError(409, "already_on_plan", "This event already has that plan");
  const amount = occasion.plan === "tek" && plan === "buyuk" ? UPGRADE_TEK_TO_BUYUK_PENCE : PLANS[plan].pricePence;
  const locale = requestLocale(req);
  const base = brandBaseUrl(occasion.brand);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: host.email,
    locale: locale === "tr" ? "tr" : "en-GB",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: amount,
        product_data: { name: `${PLANS[plan].name[locale]} — ${occasion.title}`.slice(0, 250) },
      },
    }],
    metadata: { occasionId: occasion.id, plan, hostId: host.id },
    payment_intent_data: { metadata: { occasionId: occasion.id, plan } },
    success_url: `${base}/dashboard/${occasion.id}/settings?paid=1`,
    cancel_url: `${base}/dashboard/${occasion.id}/settings?cancelled=1`,
  });
  await db.insert(schema.orders).values({
    occasionId: occasion.id, hostId: host.id, stripeSessionId: session.id, plan, amountPence: amount, currency: "gbp", status: "pending",
  });
  if (!session.url) throw new ApiError(502, "payments_unavailable", "Could not start checkout");
  return json({ url: session.url });
});
