import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));

  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQ-PTvW5vLirBLPv5RJ_ZX0EGuDgvzkHEU8ssSBQCuecqzp0xas7g4qzwsEIxBY3lc/exec';

  // API routes FIRST
  app.get("/api/data", async (req, res) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) {
        throw new Error(`Google Apps Script HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching data from Google Apps Script:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      });
      if (!response.ok) {
        throw new Error(`Google Apps Script HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error saving data to Google Apps Script:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
