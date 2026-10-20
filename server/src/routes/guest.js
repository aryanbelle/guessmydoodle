const router = require("express").Router();
const { createGuest } = require("../services/guestAuth");

router.post("/guest", (req, res) => {
  try {
    const guest = createGuest(req.body?.nickname);
    res.status(201).json(guest);
  } catch (error) {
    res.status(error.message.startsWith("Set GUEST_TOKEN_SECRET") ? 503 : 400).json({ success: false, message: error.message });
  }
});

module.exports = router;
