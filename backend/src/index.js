import express from "express";
import cors from "cors";
import multer from "multer";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import * as XLSX from "xlsx";
import archiver from "archiver";
import libre from "libreoffice-convert";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

function docxToPdfAsync(docxBuffer) {
  return new Promise((resolve, reject) => {
    libre.convert(docxBuffer, ".pdf", undefined, (err, pdfBuffer) => {
      if (err) reject(err);
      else resolve(pdfBuffer);
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function normalizeRow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = typeof k === "string" ? k.trim() : String(k);
    out[key] = v == null ? "" : String(v).trim();
  }
  return out;
}

function parseDataFile(buffer, mimetype, originalname) {
  const ext = (originalname || "").toLowerCase().split(".").pop();
  const wb = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    cellDates: true,
  });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("Spreadsheet has no sheets.");
  const sheet = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(normalizeRow);
}

function generateDocx(templateBuffer, row) {
  const content = Buffer.isBuffer(templateBuffer)
    ? templateBuffer.toString("binary")
    : templateBuffer;
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(row);
  return doc.getZip().generate({ type: "nodebuffer" });
}

function sanitizeFilename(value) {
  if (value == null || typeof value !== "string") return "";
  const s = String(value)
    .trim()
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return s || "";
}

function getBaseNames(rows) {
  if (!rows.length) return [];
  const firstCol = Object.keys(rows[0])[0];
  if (!firstCol) return rows.map((_, i) => `report_${i + 1}`);
  const seen = new Map();
  return rows.map((row, i) => {
    const raw = row[firstCol] ?? "";
    const base = sanitizeFilename(raw) || `report_${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

async function docxToPdf(docxBuffer) {
  return docxToPdfAsync(docxBuffer);
}

app.use(cors());
app.use(express.json());

app.post("/api/generate", upload.fields([{ name: "template" }, { name: "data" }]), async (req, res) => {
  try {
    const templateFile = req.files?.template?.[0];
    const dataFile = req.files?.data?.[0];

    if (!templateFile) {
      return res.status(400).json({ error: "Missing template file. Upload a .docx file." });
    }
    if (!dataFile) {
      return res.status(400).json({ error: "Missing data file. Upload a .csv or .xlsx file." });
    }

    const templateExt = (templateFile.originalname || "").toLowerCase().split(".").pop();
    if (templateExt !== "docx") {
      return res.status(400).json({ error: "Template must be a .docx file." });
    }

    const dataExt = (dataFile.originalname || "").toLowerCase().split(".").pop();
    if (dataExt !== "csv" && dataExt !== "xlsx") {
      return res.status(400).json({ error: "Data file must be .csv or .xlsx." });
    }

    let rows;
    try {
      rows = parseDataFile(dataFile.buffer, dataFile.mimetype, dataFile.originalname);
    } catch (e) {
      return res.status(400).json({
        error: "Invalid spreadsheet. Could not parse data file.",
        detail: e.message,
      });
    }

    if (!rows.length) {
      return res.status(400).json({ error: "Data file has no rows (only headers or empty)." });
    }

    const outputFormat = (req.query.outputFormat || "docx").toLowerCase();
    if (!["docx", "pdf", "both"].includes(outputFormat)) {
      return res.status(400).json({
        error: "Invalid outputFormat. Use docx, pdf, or both.",
      });
    }

    const baseNames = getBaseNames(rows);
    const files = [];

    for (let i = 0; i < rows.length; i++) {
      let docxBuf;
      try {
        docxBuf = generateDocx(templateFile.buffer, rows[i]);
      } catch (e) {
        return res.status(400).json({
          error: "Template error when generating a document.",
          detail: e.message || String(e),
          rowIndex: i + 1,
        });
      }

      const base = baseNames[i];
      if (outputFormat === "docx" || outputFormat === "both") {
        files.push({ name: `${base}.docx`, buffer: docxBuf });
      }
      if (outputFormat === "pdf" || outputFormat === "both") {
        try {
          const pdfBuf = await docxToPdf(docxBuf);
          files.push({ name: `${base}.pdf`, buffer: pdfBuf });
        } catch (e) {
          const msg = e.message || String(e);
          const isLibreMissing =
            /soffice|libreoffice|command not found|ENOENT|spawn/i.test(msg) || msg.includes("not found");
          return res.status(500).json({
            error: isLibreMissing
              ? "PDF conversion failed: LibreOffice is not installed or not on the system PATH. Install LibreOffice (https://www.libreoffice.org/) and ensure it can be run from the command line."
              : "PDF conversion failed. LibreOffice must be installed on the server for PDF output.",
            detail: msg,
          });
        }
      }
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="reports.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      res.status(500).json({ error: "Failed to create ZIP.", detail: err.message });
    });
    archive.pipe(res);

    for (const { name, buffer } of files) {
      archive.append(buffer, { name });
    }
    await archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error.",
      detail: err.message || String(err),
    });
  }
});

const publicDir = process.env.PUBLIC_DIR || join(__dirname, "..", "..", "frontend", "dist");
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(publicDir, "index.html"));
  });
}
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
