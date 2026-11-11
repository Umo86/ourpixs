/** iOS universal links for the Expo app: /g/* opens the app when installed. Served on both domains. */
export const dynamic = "force-dynamic";

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const appID = `${team || "TEAMID"}.com.ourpixs.app`;
  const body = {
    applinks: { apps: [], details: [{ appIDs: [appID], appID, paths: ["/g/*"], components: [{ "/": "/g/*" }] }] },
    webcredentials: { apps: [appID] },
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
}
