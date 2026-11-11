import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCodeLib from "qrcode";
import { Platform, Share } from "react-native";

/** Builds a crisp vector QR as an SVG string (used in the printable card). */
export function qrSvg(value: string, size = 600, fg = "#0A0A0A", bg = "#FFFFFF"): string {
  const qr = QRCodeLib.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  const total = n + quiet * 2;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export type CardText = { brand: string; title: string; scan: string; footer: string; codeLabel: string; code: string; url: string };

/** A5-ish table card, V2 style: black/white/royal blue, heavy headline + Bodoni italic accent. */
export function cardHtml(c: CardText): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital@1&family=Inter+Tight:wght@500;800;900&display=swap" rel="stylesheet">
<style>
@page { size: A5; margin: 0; }
body { margin:0; font-family:'Inter Tight',-apple-system,Helvetica,Arial,sans-serif; color:#0A0A0A; }
.card { box-sizing:border-box; width:148mm; height:210mm; padding:14mm 12mm; display:flex; flex-direction:column; align-items:center; justify-content:space-between; text-align:center; }
.brand { font-family:'Bodoni Moda',Didot,serif; font-style:italic; font-size:20pt; }
.brand span { color:#2347E0; }
h1 { margin:0; font-weight:900; font-size:30pt; line-height:1; letter-spacing:-1px; }
.scan { font-weight:800; font-size:15pt; margin:0; }
.scan em { font-family:'Bodoni Moda',Didot,serif; font-weight:400; color:#2347E0; }
.qr { width:92mm; height:92mm; padding:4mm; border-radius:8mm; border:2px solid #0A0A0A; }
.qr svg { width:100%; height:100%; }
.code { font-weight:800; font-size:12pt; }
.code small { display:block; font-weight:500; color:#3A3A3A; font-size:9pt; }
.foot { font-size:9.5pt; color:#3A3A3A; }
</style></head><body><div class="card">
<div class="brand">${esc(c.brand)}<span>.</span></div>
<h1>${esc(c.title)}</h1>
<div class="qr">${qrSvg(c.url, 600)}</div>
<p class="scan">${esc(c.scan)}</p>
<div class="code"><small>${esc(c.codeLabel)}</small>${esc(c.code)}</div>
<div class="foot">${esc(c.footer)}<br>${esc(c.url)}</div>
</div></body></html>`;
}

export async function printCard(c: CardText) {
  await Print.printAsync({ html: cardHtml(c) });
}

/** Shares the card as a PDF (falls back to sharing the link). */
export async function shareCardPdf(c: CardText) {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    await Share.share({ message: c.url });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: cardHtml(c) });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: c.title });
}

/** Writes a base64 PNG (from react-native-qrcode-svg's toDataURL) to cache and opens the share sheet. */
export async function sharePngBase64(base64: string, slug: string, fallbackUrl: string) {
  if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
    await Share.share({ message: fallbackUrl });
    return;
  }
  const file = new File(Paths.cache, `bizimresimler-qr-${slug}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: "base64" });
  await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png" });
}
