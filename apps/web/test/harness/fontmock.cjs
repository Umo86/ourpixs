// Generic next/font/google mock: answers every Google Fonts CSS URL with latin + latin-ext faces.
function css(url) {
  const u = new URL(url);
  const out = [];
  for (const fam of u.searchParams.getAll("family")) {
    const [rawName, axes = ""] = fam.split(":");
    const name = rawName.replace(/\+/g, " ");
    const italic = /ital/.test(axes);
    const spec = axes.split("@")[1] || "400";
    const tuples = spec.split(";").map((t) => t.split(","));
    for (const tu of tuples) {
      const style = italic && tu[0] === "1" ? "italic" : "normal";
      const weight = italic ? tu[1] : tu[0];
      for (const [subset, range] of [["latin-ext", "U+0100-02BA"], ["latin", "U+0000-00FF"]]) {
        out.push(`/* ${subset} */\n@font-face {\n  font-family: '${name}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/mock/${encodeURIComponent(name)}-${style}-${weight}-${subset}.woff2) format('woff2');\n  unicode-range: ${range};\n}`);
      }
    }
  }
  return out.join("\n");
}
module.exports = new Proxy({}, { get: (_t, key) => (typeof key === "string" && key.startsWith("http") ? css(key) : undefined) });
