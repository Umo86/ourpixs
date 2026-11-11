/** Android App Links for com.ourpixs.app (fingerprints from ANDROID_SHA256_FINGERPRINTS, comma-separated). */
export const dynamic = "force-dynamic";

export function GET() {
  const prints = (process.env.ANDROID_SHA256_FINGERPRINTS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const body = [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: "com.ourpixs.app", sha256_cert_fingerprints: prints },
  }];
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
}
