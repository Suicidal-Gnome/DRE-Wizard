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
  const recorder = d.Witnesses || d.Arresting_Officer || "a witness";
  const locationPieces = [];
  if (d.Eval_Location) locationPieces.push(d.Eval_Location);
  const jurisdiction = [d.Location_County, d.Location_State].filter(Boolean).join(", ");
  if (jurisdiction) locationPieces.push(jurisdiction);
  const loc = locationPieces.length ? ` at ${locationPieces.join(", ")}` : "";
  const dt = [d.Eval_Date, d.Eval_Time].filter(Boolean).join(" ");
  parts.push(
    `On ${dt}${loc}, I conducted a Drug Influence Evaluation of ${name}. ${recorder} was present as recorder/witness.`
  );

  if (d.What_Eaten) {
    const when = d.When_Eaten ? ` (${d.When_Eaten})` : "";
    parts.push(`Subject reported eating ${d.What_Eaten}${when}.`);
  }
  const drinking = [];
  if (d.What_Drinking) drinking.push(`type: ${d.What_Drinking}`);
  if (d.When_Drinking) drinking.push(`when: ${d.When_Drinking}`);
  if (d.Last_Drink) drinking.push(`last drink: ${d.Last_Drink}`);
  if (drinking.length) parts.push(`Alcohol use — ${drinking.join("; ")}.`);
  if (d.Breath_Result) parts.push(`Breath test result: ${d.Breath_Result}.`);
  if (d.Breath_Refused) parts.push("Subject refused the breath test.");

  const medical = [];
  if (d.Sick_Injured === "Yes") medical.push(`Sick/injured: ${d.Sick_Notes || "Yes"}.`);
  if (d.Diabetic_Epileptic === "Yes")
    medical.push(`Diabetic/Epileptic: ${d.Diabetic_Eplieptic_Notes || "Yes"}.`);
  if (d.Meds_Drugs === "Yes") medical.push(`Medications/Drugs reported: ${d.Meds_Drugs_Notes || "Yes"}.`);
  if (medical.length) parts.push(medical.join(" "));

  const hgn = [];
  if (d.HGN_Pursuit_L || d.HGN_Pursuit_R)
    hgn.push(`Lack of smooth pursuit (L:${d.HGN_Pursuit_L || "N/A"} / R:${d.HGN_Pursuit_R || "N/A"})`);
  if (d.HGN_Max_L || d.HGN_Max_R)
    hgn.push(`Distinct & sustained at max deviation (L:${d.HGN_Max_L || "N/A"} / R:${d.HGN_Max_R || "N/A"})`);
  if (d.HGN_Angle_L || d.HGN_Angle_R)
    hgn.push(`Angle of onset (L:${d.HGN_Angle_L || "N/A"} / R:${d.HGN_Angle_R || "N/A"})`);
  if (d.Vertical_Nyst === "Yes") hgn.push("Vertical gaze nystagmus present");
  if (d.LOC) hgn.push(`Lack of convergence: ${d.LOC}`);
  if (hgn.length) parts.push(`HGN/VGN findings — ${hgn.join("; ")}.`);

  if (d.MRB_Time || d.MRB_Notes) {
    const pieces = [];
    if (d.MRB_Time) pieces.push(`time estimation ${d.MRB_Time}s`);
    if (d.MRB_1) pieces.push(`front/back sway ${d.MRB_1}`);
    if (d.MRB_2) pieces.push(`side sway ${d.MRB_2}`);
    if (d.MRB_Refused) pieces.push("test refused");
    if (d.MRB_NotGiven) pieces.push("test not given");
    if (d.MRB_Notes) pieces.push(d.MRB_Notes);
    parts.push(`Modified Romberg: ${pieces.join("; ")}.`);
  }

  const watPieces = [];
  if (d.WAT_Refused) watPieces.push("refused");
  if (d.WAT_NotGiven) watPieces.push("not given");
  ["WAT_Balance", "WAT_Too_Soon", "WAT_Stops_1", "WAT_Stops_2", "WAT_Miss_1", "WAT_Miss_2", "WAT_Off_1", "WAT_Off_2", "WAT_Arms_1", "WAT_Arms_2", "WAT_Steps_1", "WAT_Steps_2"].forEach(field => {
    if (d[field]) watPieces.push(`${field.replace(/WAT_/g, "").replace(/_/g, " ").toLowerCase()}: ${d[field]}`);
  });
  if (d.WAT_Turn) watPieces.push(`turn: ${d.WAT_Turn}`);
  if (d.WAT_Cant_Do) watPieces.push(`unable to perform: ${d.WAT_Cant_Do}`);
  if (d.WAT_Notes) watPieces.push(d.WAT_Notes);
  if (watPieces.length) parts.push(`Walk and Turn: ${watPieces.join("; ")}.`);

  const olsPieces = [];
  ["L", "R"].forEach(side => {
    const prefix = `OLS_${side}_`;
    const clues = [];
    if (d[`${prefix}Count`]) clues.push(`count ${d[`${prefix}Count`]}`);
    ["Sway", "Arms", "Hop", "Down"].forEach(key => {
      if (d[`${prefix}${key}`]) clues.push(key.toLowerCase());
    });
    if (d[`${prefix}Refused`]) clues.push("refused");
    if (d[`${prefix}Not_Given`]) clues.push("not given");
    if (clues.length) olsPieces.push(`${side === "L" ? "Left" : "Right"} leg: ${clues.join(", ")}`);
  });
  if (olsPieces.length) parts.push(`One Leg Stand: ${olsPieces.join("; ")}.`);

  if (d.FTN_Refused || d.FTN_Not_Given) {
    const ftn = [];
    if (d.FTN_Refused) ftn.push("refused");
    if (d.FTN_Not_Given) ftn.push("not given");
    parts.push(`Finger to Nose: ${ftn.join("; ")}.`);
  }

  const vitals = [];
  if (d.Pulse1_Display) vitals.push(`first pulse ${d.Pulse1_Display}`);
  if (d.Pulse2_Display) vitals.push(`second pulse ${d.Pulse2_Display}`);
  if (d.Pulse3_Display) vitals.push(`third pulse ${d.Pulse3_Display}`);
  if (d.BP) vitals.push(`blood pressure ${d.BP}`);
  if (d.Body_Temp) vitals.push(`temperature ${d.Body_Temp}`);
  if (vitals.length) parts.push(`Vitals: ${vitals.join("; ")}.`);

  const pupil = [];
  if (d.Pupil_Room) pupil.push(`room ${d.Pupil_Room}`);
  if (d.Pupil_Dark) pupil.push(`dark ${d.Pupil_Dark}`);
  if (d.Pupil_Direct) pupil.push(`direct ${d.Pupil_Direct}`);
  if (d.Pupil_Direct_Range) pupil.push(`direct range ${d.Pupil_Direct_Range}`);
  if (pupil.length) parts.push(`Pupil sizes: ${pupil.join("; ")}.`);

  if (d.Chemical_Test) parts.push(`Chemical tests: ${d.Chemical_Test}.`);

  const opinionFlags = [
    "Not_Impaired",
    "Medical",
    "Alcohol",
    "CNS_Depressant",
    "CNS_Stimulant",
    "Hallucinogen",
    "Dissociative_Anesthetic",
    "Narcotic_Analgesic",
    "Inhalant",
    "Cannabis"
  ].filter(flag => d[flag]);
  if (opinionFlags.length) parts.push(`Categories indicated: ${opinionFlags.join(", ")}.`);
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
