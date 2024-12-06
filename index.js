import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Client } from '@gradio/client';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Helper function to generate random number within range
function getRandomNumber(min, max, decimals = 0) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

// Function to generate simulated health metrics
function generateHealthMetrics() {
  return {
    glucoseLevel: getRandomNumber(70, 400, 1), // mg/dL
    diabeticNephropathy: "No",
    intraocularPressure: getRandomNumber(10, 30, 1) // mmHg
  };
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(
  cors({
    origin: ["https://cash-taka.vercel.app", "http://localhost:5174", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b6ckjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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
        const gradioClient = await Client.connect("sartizAyon/iubat");
        const result = await gradioClient.predict("/predict", {
          image: imageBlob,
        });

        // Extract the prediction with highest confidence
        const predictions = result.data[0].confidences;
        const mainPrediction = predictions.reduce((prev, current) => 
          (prev.confidence > current.confidence) ? prev : current
        );

        // Generate the formatted response
        const response = {
          success: true,
          prediction: {
            diabeticRetinopathy: {
              diagnosis: mainPrediction.label,
              confidence: (mainPrediction.confidence * 100).toFixed(1) + "%"
            },
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});