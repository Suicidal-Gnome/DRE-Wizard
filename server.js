import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function buildNarrative(input = {}) {
  const d = input || {};
  const parts = [];
  const name = d.Subject_Name || "the subject";
  const recorder = d.Recorder || d.Arresting_Officer || "a witness";
  const locationParts = [];
  if (d.Location) locationParts.push(d.Location);
  const jurisdiction = [d.Location_County, d.Location_State].filter(Boolean).join(", ");
  if (jurisdiction) locationParts.push(jurisdiction);
  const loc = locationParts.length ? ` at ${locationParts.join(", ")}` : "";
  const dt = [d.Eval_Date, d.Eval_Time].filter(Boolean).join(" ");
  parts.push(
    `On ${dt}${loc}, I conducted a Drug Influence Evaluation of ${name}. ${recorder} was present as recorder/witness.`
  );
  if (d.Food_When) parts.push(`Subject reported eating: ${d.Food_When}.`);
  const drinkDetails = [];
  if (d.Drinking_When) drinkDetails.push(`when drinking: ${d.Drinking_When}`);
  if (d.Drinking_HowMuch) drinkDetails.push(`amount consumed: ${d.Drinking_HowMuch}`);
  if (d.Drinking_LastTime) drinkDetails.push(`time of last drink: ${d.Drinking_LastTime}`);
  if (drinkDetails.length) parts.push(`Alcohol use details — ${drinkDetails.join("; ")}.`);
  if (d.Breath_Result) parts.push(`Breath test: ${d.Breath_Result}.`);
  if (d.Ingestion) parts.push(`Signs of ingestion observed: ${d.Ingestion}.`);
  if (d.Medication_Drugs) parts.push(`Medication/Drugs reported: ${d.Medication_Drugs}.`);

  const sfst = [];
  if (d.WnT) sfst.push(`Walk-and-Turn: ${d.WnT}`);
  if (d.OLS) sfst.push(`One-Leg Stand: ${d.OLS}`);
  if (d.Romberg) sfst.push(`Romberg: ${d.Romberg}`);
  if (d.MRomberg) sfst.push(`Modified Romberg: ${d.MRomberg}`);
  if (d.FTN) sfst.push(`Finger-to-Nose: ${d.FTN}`);
  if (sfst.length) parts.push(`Psychophysical tests: ${sfst.join("; ")}.`);

  const clin = [];
  if (d.HGN_Left || d.HGN_Right) clin.push(`HGN ${[d.HGN_Left, d.HGN_Right].filter(Boolean).join("/")}`);
  if (d.VGN) clin.push(`VGN ${d.VGN}`);
  if (d.LOC) clin.push(`Lack of Convergence ${d.LOC}`);
  if (clin.length) parts.push(`Clinical indicators: ${clin.join("; ")}.`);

  const vit = [];
  if (d.Pulse1 || d.Pulse2 || d.Pulse3)
    vit.push(`Pulse(s) ${[d.Pulse1, d.Pulse2, d.Pulse3].filter(Boolean).join(", ")}`);
  if (d.BP) vit.push(`Blood pressure ${d.BP}`);
  if (d.Temp) vit.push(`Temperature ${d.Temp}`);
  if (vit.length) parts.push(`Vitals: ${vit.join("; ")}.`);

  const pup = [];
  if (d.Pupil_Room) pup.push(`Room ${d.Pupil_Room}`);
  if (d.Pupil_Dark) pup.push(`Dark ${d.Pupil_Dark}`);
  if (d.Pupil_Near) pup.push(`Near ${d.Pupil_Near}`);
  if (d.Pupil_LightReact) pup.push(`Light reaction ${d.Pupil_LightReact}`);
  if (pup.length) parts.push(`Pupils: ${pup.join("; ")}.`);

  if (d.Oral_Fluid || d.Urine || d.Blood)
    parts.push(
      `Toxicology: Oral=${d.Oral_Fluid || "N/A"}, Urine=${d.Urine || "N/A"}, Blood=${d.Blood || "N/A"}.`
    );
  if (d.Indicated) parts.push(`Drug categories indicated: ${d.Indicated}.`);
  if (d.Opinion) parts.push(`Opinion: ${d.Opinion}.`);

  return parts.join(" ");
}

app.post("/pdf", async (req, res) => {
  try {
    const data = { ...(req.body || {}) };
    data.Narrative = buildNarrative(data);
    const html = await ejs.renderFile(
      path.join(__dirname, "templates/face-sheet.ejs"),
      { data },
      { async: true }
    );
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    await browser.close();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="dre-report-${Date.now()}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "PDF generation error" });
  }
});

app.post("/narrative", (req, res) => {
  const narrative = buildNarrative(req.body || {});
  res.json({ narrative });
});

app.listen(process.env.PORT || 3000, () => console.log("DRE wizard server running"));
