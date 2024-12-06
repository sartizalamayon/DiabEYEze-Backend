import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Client } from '@gradio/client';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Initialize dotenv
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for handling file uploads
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
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    // API endpoint for diabetic retinopathy prediction
    app.post("/api/predict", upload.single("image"), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image file provided" });
        }

        // Convert the buffer to a Blob
        const imageBlob = new Blob([req.file.buffer], { type: req.file.mimetype });

        // Connect to your Hugging Face space
        const gradioClient = await Client.connect("sartizAyon/iubat");

        // Make prediction
        const result = await gradioClient.predict("/predict", {
          image: imageBlob,
        });

        // Send the prediction result
        res.json({
          success: true,
          prediction: result.data,
        });

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