const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const axios = require("axios");
const CryptoJS = require("crypto-js");
const nodemailer = require("nodemailer");

app.use(cors()); // allow requests from frontend
app.use(express.json()); // parse JSON bodies

const secretKey = process.env.SECRET_KEY;
app.post("/api/fetch-data", async (req, res) => {
  const { payload } = req.body;
  const bytes = CryptoJS.AES.decrypt(payload, secretKey);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  const { name, token, chat_Id, ipToken } = decryptedData;
  const resInfo = await fetch(`https://ipinfo.io/json?${ipToken}=demo`); // Replace demo with your real token
  const data = await resInfo.json();

  const mapLink = `https://www.google.com/maps?q=${data.loc}`;
  const message = `👋 New visitor!\nName:${name}\nLocation: ${data.city}, ${data.region}, ${data.country}\n🗺️ Map: ${mapLink}`;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chat_Id,
      text: message,
    });
    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to send message" });
  }
});

const transporter = nodemailer.createTransport({
  service: "gmail", // You can use "Outlook", "Yahoo", or other providers
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email app password
  },
});

app.post("/api/send-mail", async (req, res) => {
  const { name, email, message } = req.body;

  const mailOptions = {
    from: `${name} ${email}`, // ✅ Sender name before email
    to: process.env.EMAIL_USER,
    subject: `New Contact from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    replyTo: email, // ✅ Ensures replies go to the sender
  };

  console.log(mailOptions);
  try {
    await transporter.sendMail(mailOptions);
    res
      .status(200)
      .json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email sending failed:", error);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
