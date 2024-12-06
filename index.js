import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const port = process.env.PORT || 3001;

const app = express();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GeminiApi);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: {
      response: {
        type: "object",
        properties: {
          message: { type: "string" },
          suggestions: {
            type: "array",
            items: { type: "string" }
          },
          timestamp: { type: "string" }
        },
        required: ["message", "suggestions", "timestamp"]
      }
    },
    required: ["response"]
  },
};

// Helper function to generate random number within range
function getRandomNumber(min, max, decimals = 0) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

// Function to generate simulated health metrics
function generateHealthMetrics() {
  return {
    glucoseLevel: getRandomNumber(70, 400, 1),
    diabeticNephropathy: "No",
    intraocularPressure: getRandomNumber(10, 30, 1)
  };
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b6ckjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// New endpoint for Gemini chat
app.post("/api/chat", async (req, res) => {
  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(req.body) }],
        }
      ],
    });

    const result = await chatSession.sendMessage(req.body.message);
    const response = JSON.parse(result.response.text());
    res.json(response);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process chat message",
      details: error.message
    });
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    app.post("/api/predict", upload.single("image"), async (req, res) => {
      console.log("Received request to /api/predict");
      
      try {
        if (!req.file) {
          console.log("No file received");
          return res.status(400).json({ error: "No image file provided" });
        }

        const imageBlob = new Blob([req.file.buffer], { type: req.file.mimetype });

        const response = {
          success: true,
          prediction: {
            ...generateHealthMetrics()
          }
        };

        res.json(response);

      } catch (error) {
        console.error("Prediction error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to process the image",
          details: error.message
        });
      }
    });

  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello DiabEye!");
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 

export default app;