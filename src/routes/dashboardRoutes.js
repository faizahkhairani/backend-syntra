const express = require("express");
const router = express.Router();
const {
  getSummary,
  getDailyRecap,
  getWeeklyAttendance,
  getLeaveSummary
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");
const demoGuard = require("../middleware/demoGuard");

router.use(protect);
router.use(demoGuard);
router.use(authorize("admin"));

router.get("/summary", getSummary);
router.get("/attendance-weekly", getWeeklyAttendance);
router.get("/daily-recap", getDailyRecap);
router.get("/leave-summary", getLeaveSummary);

module.exports = router;