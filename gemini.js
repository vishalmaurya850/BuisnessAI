import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in the environment variables.");
}

async function fetchModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = "https://generativelanguage.googleapis.com/v1beta/models";
  
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment variables.");
    }
  
    try {
      const response = await fetch(`${url}?key=${apiKey}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
  
      const data = await response.json();
      console.log("Available models:", data.models);
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  }
  
  fetchModels();