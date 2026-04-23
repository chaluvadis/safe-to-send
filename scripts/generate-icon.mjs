import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync(new URL("../icon.svg", import.meta.url), "utf8");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 256 } });
const rendered = resvg.render();
const pngBuffer = rendered.asPng();
writeFileSync(new URL("../icon.png", import.meta.url), pngBuffer);
console.log("✅ icon.png generated at 256×256");
