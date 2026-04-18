const express = require("express");
const router = express.Router();
const {
  assignShift,
  getAllSchedules,
  getMySchedule,
  getTodaySchedule
} = require("../controllers/shiftScheduleController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/my-schedule", getMySchedule);       // employee
router.get("/today", getTodaySchedule);           // employee (untuk check-in)
router.get("/", authorize("admin"), getAllSchedules);
router.post("/", authorize("admin"), assignShift);
// router.delete("/:id", authorize("admin"), deleteSchedule);

module.exports = router;