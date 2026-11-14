/**
 * TEST ONLY: a small stateful fake of the Stripe API for the e2e run (the app's real `stripe` library talks to it when
 * STRIPE_FAKE=1, see src/lib/stripe.ts). Covers what billing.ts and guest-purchase.ts use:
 *   POST /v1/checkout/sessions, GET /v1/checkout/sessions/:id (expand payment_intent.latest_charge),
 *   POST /v1/checkout/sessions/:id/expire, GET /v1/charges/:id, GET /v1/payment_intents/:id
 * The session's `url` is a local Checkout page (/pay/:id). "Pay" marks it paid, posts a correctly signed
 * checkout.session.completed webhook to the app (stripe.webhooks.generateTestHeaderString with STRIPE_WEBHOOK_SECRET)
 * and redirects to success_url, so the real webhook code path runs. Test controls:
 *   POST /test/refund { paymentIntent | session, amount? } → refunds (full by default) and posts charge.refunded
 *   POST /test/webhook { session, type? } → re-sends a session event (replay tests)
 *   GET  /test/sessions → every session (debugging)
 * Run with --require test/harness/clock.cjs so signature timestamps follow the fake clock.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";

const PORT = Number(process.env.STRIPE_FAKE_PORT || 12111);
const PUBLIC = process.env.STRIPE_FAKE_PUBLIC_URL || `http://127.0.0.1:${PORT}`;
const WEBHOOK_URL = process.env.STRIPE_FAKE_WEBHOOK_URL;
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe("sk_test_fake");

const sessions = new Map();
const intents = new Map();
const charges = new Map();
const id = (p) => `${p}_test_${randomBytes(12).toString("hex")}`;
const now = () => Math.floor(Date.now() / 1000);

/** Stripe's form encoding: a[b][0][c]=v → nested objects/arrays. */
function parseForm(body) {
  const out = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const path = k.replace(/\]/g, "").split("[");
    let cur = out;
    path.forEach((p, i) => {
      const last = i === path.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(path[i + 1]);
      if (last) cur[p] = v;
      else cur = cur[p] ??= nextIsIndex ? [] : {};
    });
  }
  return out;
}

function sessionView(s, expand = []) {
  const v = { ...s };
  if (s.payment_intent && expand.some((e) => e.startsWith("payment_intent"))) {
    const pi = { ...intents.get(s.payment_intent) };
    if (expand.includes("payment_intent.latest_charge") && pi.latest_charge) pi.latest_charge = { ...charges.get(pi.latest_charge) };
    v.payment_intent = pi;
  }
  return v;
}

async function sendWebhook(type, object) {
  const payload = JSON.stringify({ id: id("evt"), object: "event", api_version: "2025-01-01", created: now(), livemode: false, type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: now() });
  const res = await fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": header }, body: payload });
  const text = await res.text();
  console.log(`[stripe-fake] webhook ${type} → ${res.status} ${text.slice(0, 200)}`);
  return { status: res.status, body: text };
}

function pay(s, email) {
  const amount = s.amount_total;
  const pi = { id: id("pi"), object: "payment_intent", amount, currency: s.currency, status: "succeeded", metadata: s.payment_intent_data_metadata ?? {}, latest_charge: null, livemode: false };
  const ch = { id: id("ch"), object: "charge", amount, amount_refunded: 0, refunded: false, currency: s.currency, payment_intent: pi.id, paid: true, status: "succeeded", livemode: false, metadata: pi.metadata };
  pi.latest_charge = ch.id;
  intents.set(pi.id, pi);
  charges.set(ch.id, ch);
  Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: pi.id, customer_details: { email: email || s.customer_email || null } });
}

const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function payPage(s) {
  const price = `£${(s.amount_total / 100).toFixed(2)}`;
  const item = s.line_items?.[0]?.price_data?.product_data?.name ?? "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fake Checkout</title>
<style>body{font-family:system-ui;margin:0;padding:24px;max-width:420px}button,input{font-size:18px;padding:14px;width:100%;box-sizing:border-box;margin:8px 0;min-height:48px}</style></head>
<body><h1>Fake Stripe Checkout (test)</h1><p id="item">${esc(item)}</p><p id="amount" data-pence="${s.amount_total}">${price}</p>
<p id="status">${esc(s.status)}</p>
<form method="post" action="/pay/${s.id}">
${s.customer_email ? `<p id="email">${esc(s.customer_email)}</p>` : `<label>Email <input type="email" name="email" id="email" required></label>`}
<button type="submit" id="pay">Pay ${price}</button></form>
<a id="cancel" href="${esc(s.cancel_url)}">Cancel</a></body></html>`;
}

const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const sendJson = (res, status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const notFound = (res, what) => sendJson(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: `No such ${what}` } });

createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    const body = await readBody(req);
    const p = u.pathname;
    let m;
    if (req.method === "POST" && p === "/v1/checkout/sessions") {
      const f = parseForm(body);
      const li = f.line_items?.[0];
      const s = {
        id: id("cs"), object: "checkout.session", mode: f.mode, status: "open", payment_status: "unpaid", livemode: false,
        amount_total: Number(li?.price_data?.unit_amount ?? 0) * Number(li?.quantity ?? 1), currency: li?.price_data?.currency,
        metadata: f.metadata ?? {}, payment_intent_data_metadata: f.payment_intent_data?.metadata ?? {}, client_reference_id: f.client_reference_id ?? null,
        customer_email: f.customer_email ?? null, customer_details: null, locale: f.locale ?? null, success_url: f.success_url, cancel_url: f.cancel_url,
        expires_at: f.expires_at ? Number(f.expires_at) : now() + 86400, payment_intent: null, line_items: f.line_items, custom_text: f.custom_text,
        created: now(),
      };
      s.url = `${PUBLIC}/pay/${s.id}`;
      sessions.set(s.id, s);
      return sendJson(res, 200, s);
    }
    if ((m = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(p)) && req.method === "GET") {
      const s = sessions.get(m[1]);
      if (!s) return notFound(res, "checkout.session");
      const expand = [...u.searchParams.entries()].filter(([k]) => k.startsWith("expand")).map(([, v]) => v);
      return sendJson(res, 200, sessionView(s, expand));
    }
    if ((m = /^\/v1\/checkout\/sessions\/([^/]+)\/expire$/.exec(p)) && req.method === "POST") {
      const s = sessions.get(m[1]);
      if (!s) return notFound(res, "checkout.session");
      if (s.status !== "open") return sendJson(res, 400, { error: { type: "invalid_request_error", message: "Only open sessions can be expired" } });
      s.status = "expired";
      return sendJson(res, 200, s);
    }
    if ((m = /^\/v1\/charges\/([^/]+)$/.exec(p))) return charges.has(m[1]) ? sendJson(res, 200, charges.get(m[1])) : notFound(res, "charge");
    if ((m = /^\/v1\/payment_intents\/([^/]+)$/.exec(p))) return intents.has(m[1]) ? sendJson(res, 200, intents.get(m[1])) : notFound(res, "payment_intent");

    if ((m = /^\/pay\/([^/]+)$/.exec(p))) {
      const s = sessions.get(m[1]);
      if (!s) { res.writeHead(404); return res.end("no such session"); }
      if (req.method === "GET") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(payPage(s)); }
      if (s.status !== "open" || s.expires_at < now()) { res.writeHead(410, { "Content-Type": "text/plain" }); return res.end(`session ${s.status}`); }
      pay(s, new URLSearchParams(body).get("email"));
      await sendWebhook("checkout.session.completed", sessionView(s));
      res.writeHead(303, { Location: s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id) });
      return res.end();
    }

    if (p === "/test/refund" && req.method === "POST") {
      const f = JSON.parse(body || "{}");
      const piId = f.paymentIntent ?? sessions.get(f.session)?.payment_intent;
      const pi = intents.get(piId);
      if (!pi) return notFound(res, "payment_intent");
      const ch = charges.get(pi.latest_charge);
      ch.amount_refunded = Math.min(ch.amount, ch.amount_refunded + (f.amount ?? ch.amount));
      ch.refunded = ch.amount_refunded >= ch.amount;
      const hook = await sendWebhook("charge.refunded", ch);
      return sendJson(res, 200, { charge: ch, webhook: hook });
    }
    if (p === "/test/webhook" && req.method === "POST") {
      const f = JSON.parse(body || "{}");
      const s = sessions.get(f.session);
      if (!s) return notFound(res, "checkout.session");
      return sendJson(res, 200, await sendWebhook(f.type ?? "checkout.session.completed", sessionView(s)));
    }
    if (p === "/test/sessions") return sendJson(res, 200, [...sessions.values()].map((s) => sessionView(s, ["payment_intent.latest_charge"])));
    notFound(res, p);
  } catch (e) {
    console.error("[stripe-fake]", e);
    sendJson(res, 500, { error: { type: "api_error", message: String(e) } });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`[stripe-fake] listening on ${PORT}`));
