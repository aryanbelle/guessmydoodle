const router = require("express").Router();
const User = require("../models/UserModel");
const verifyIdToken = require("../services/firebase");

router.post("/newuser", async (req, res) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const nickname = String(req.body?.nickname || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24);
  const age = Number(req.body?.age);
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  if (!nickname || !Number.isInteger(age) || age < 8 || age > 100) {
    return res.status(400).json({ success: false, message: "Enter a nickname and a valid age." });
  }

  try {
    const decoded = await verifyIdToken(token);
    if (!decoded.email) return res.status(400).json({ success: false, message: "A verified email is required." });
    const existing = await User.findOne({ $or: [{ email: decoded.email }, { nickname }] }).lean();
    if (existing) return res.status(409).json({ success: false, message: "That account or nickname already exists." });
    await User.create({ nickname, email: decoded.email, age });
    return res.status(201).json({ success: true, message: "User account created!" });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "That account or nickname already exists." });
    console.error("Account creation failed:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create user account." });
  }
});

module.exports = router;
