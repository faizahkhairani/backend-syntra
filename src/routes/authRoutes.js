const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const demoGuard = require("../middleware/demoGuard");

router.post("/register", protect, demoGuard, authorize("admin"), register);
router.post("/login", login);
router.get("/me", protect, getMe);

module.exports = router;