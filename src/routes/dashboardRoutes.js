const express = require("express");
const router = express.Router();
const {
  getSummary,
  getDailyRecap
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);
router.use(authorize("admin"));

router.get("/summary", getSummary);
// router.get("/attendance-recap", getAttendanceRecap);
router.get("/daily-recap", getDailyRecap);
// router.get("/leave-recap", getLeaveRecap);

module.exports = router;