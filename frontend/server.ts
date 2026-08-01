import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock dev route fallbacks when running frontend server standalone without FastAPI
  app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    return res.json({
      text: `[System Analysis for: "${message}"]\n\nI've analyzed your knowledge graph query regarding compliance risk. Our automated system highlights potential HIPAA & GDPR exposure areas in uploaded records. Key findings include:\n\n• Risk 1: Unencrypted identifiers found in file metadata\n• Risk 2: Missing Business Associate Agreement (BAA) log for external vendors\n• Risk 3: Elevated administrative access permissions`,
      confidence: 96,
      sourceContext: ["HIPAA_SubPart_C.pdf", "GDPR_Art_12_Review.pdf"],
      nodes: ["Patient_PHI", "AWS_S3_Bucket", "Admin_Access"],
      citations: ["HIPAA §164.308", "Internal_Audit_v2"],
    });
  });

  app.post("/api/analyze", async (req, res) => {
    const { docName, docType } = req.body;
    return res.json({
      summary: `Parsed document '${docName || "Upload"}' (${docType || "PDF"}). Identified 12 entities and 3 potential risk nodes.`,
      riskScore: "B+",
      compliant: true,
      entities: ["FinCEN", "Customer_Data", "SSN_Unmasked", "S3_Drive"],
      insights: [
        "No active data breaches detected in primary partition.",
        "Recommendation: Apply automated masking for 4 entity fields.",
      ],
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
