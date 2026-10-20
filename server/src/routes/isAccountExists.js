const Router = require("express").Router();
const User = require("../models/UserModel");
const verifyIdToken = require("../services/firebase");

Router.post("/authentication", async (req, res) => {
  try {
    const authorization = req.headers.authorization || "";
    const userToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!userToken) return res.status(401).json({ success: false, message: "Authentication required" });
    const decodedToken = await verifyIdToken(userToken);
    if (decodedToken?.uid) {
      if (decodedToken.email) {
        const user = await User.findOne({ email: decodedToken.email }).lean();
        if (user) {
          res.status(200).send({ success: true, isSignedIn: true });
        } else {
          res.status(200).send({ success: true, isSignedIn: false });
        }
      } else {
        res.status(200).send({ success: true, isSignedIn: false });
      }
    } else {
      res.status(401).json({ success: false, message: "INVALID TOKEN!" });
    }
  } catch (error) {
    res.status(401).send({ success: false, message: "Authentication failed" });
  }
});

module.exports = Router;
