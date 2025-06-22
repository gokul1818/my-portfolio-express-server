const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const secretKey = process.env.SECRET_KEY;
let currentLevel = null;

// 🌐 Visitor IP & Telegram Notification
app.post("/api/fetch-data", async (req, res) => {
  try {
    const { payload } = req.body;

    const bytes = CryptoJS.AES.decrypt(payload, secretKey);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    const { name, token, chat_Id, apiIPToken } = decryptedData;

    const clientIP =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const geoResponse = await axios.get("https://apiip.net/api/check", {
      params: {
        ip: clientIP,
        accessKey: apiIPToken,
      },
    });

    const data = geoResponse.data;
    const mapLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
    const message = `👋 New visitor!
Name: ${name}
IP: ${data.ip}
📍Location: ${data.city}, ${data.regionName}, ${data.countryName}
🗺️ Map: ${mapLink}`;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chat_Id,
      text: message,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error in fetch-data:", error.message);
    res.status(500).json({ error: "Failed to fetch or send visitor data" });
  }
});

// 📧 Contact Form Mailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post("/api/send-mail", async (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: `${name} <${email}>`,
    to: process.env.EMAIL_USER,
    subject: `New Contact from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    replyTo: email,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email sending failed:", error);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
});

// 📡 Water Level Receiver (from ESP8266)
app.post("/api/level", (req, res) => {
  const { level } = req.body;
  console.log('level: ', level);

  if (typeof level === "number") {
    currentLevel = level;
    console.log("Received water level:", level);

    // Broadcast to WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ level }));
      }
    });

    res.sendStatus(200);
  } else {
    res.status(400).json({ error: "Invalid data" });
  }
});

// 🔄 Optional: WebSocket Ping Keep-Alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);
  
// 🚀 Start Server with WebSocket
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server + WebSocket listening on port ${PORT}`);
});
