const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("./models/User");
const History = require("./models/History");

const app = express();

app.use(express.json());
app.use(cors());

// ✅ Serve frontend
app.use(express.static("public"));

/* =========================
   🔗 MongoDB Connection
========================= */
mongoose.connect("mongodb://localhost:27017/aiStudyApp")
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

/* =========================
   🤖 AI GENERATE (FIXED + FALLBACK)
========================= */
app.post("/api/generate", async (req, res) => {
  const { topic, email } = req.body;

  let model = "models/gemini-2.5-flash";

  try {
    let response;

    try {
      // 🔥 MAIN MODEL
      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${process.env.API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `
Explain the topic "${topic}" in a detailed and structured way.

Format your response using markdown:

## 📘 Introduction
Explain the concept clearly in simple terms.

## 🧠 Detailed Explanation
Give in-depth explanation with examples.

## 🔑 Key Points
- Include multiple important points

## 🌍 Real-Life Applications
Give practical real-world uses.

## ⚖️ Advantages & Disadvantages
Explain both pros and cons.

## 📊 Summary
Give a short recap.

## ❓ Interview Questions (with answers)
Provide 5-7 important questions and answers.
`
                }
              ]
            }
          ]
        }
      );

    } catch (err) {
      console.log("⚠️ Switching to fallback model...");

      // 🔥 FALLBACK MODEL (STABLE)
      model = "models/gemini-2.0-flash";

      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${process.env.API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `Explain clearly and simply: ${topic}`
                }
              ]
            }
          ]
        }
      );
    }

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // 💾 SAVE HISTORY
    if (email && text) {
      await History.create({
        email,
        topic,
        response: text
      });
    }

    res.json({ result: text || "⚠️ No response from AI" });

  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);

    const msg = error.response?.data?.error?.message;

    if (msg && msg.includes("high demand")) {
      res.json({
        result: "⚠️ Server busy. Please try again in a few seconds."
      });
    } else {
      res.json({
        result: "❌ AI error. Please try again later."
      });
    }
  }
});

/* =========================
   📜 GET USER HISTORY
========================= */
app.get("/api/history/:email", async (req, res) => {
  const email = req.params.email;

  try {
    const data = await History.find({ email }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.json([]);
  }
});

/* =========================
   🔐 REGISTER
========================= */
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      return res.json({ message: "User already exists ❌" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword
    });

    await user.save();

    res.json({ message: "User registered successfully ✅" });

  } catch (err) {
    res.json({ message: "Error registering user ❌" });
  }
});

/* =========================
   🔑 LOGIN
========================= */
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message: "User not found ❌" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ message: "Wrong password ❌" });
    }

    res.json({ message: "Login successful ✅" });

  } catch (err) {
    res.json({ message: "Login error ❌" });
  }
});

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} 🚀`);
});