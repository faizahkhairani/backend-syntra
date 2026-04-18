const express = require("express");
const router = express.Router();
const {
  checkIn,
  checkOut,
//   getMyAttendance,
//   getAllAttendance,
} = require("../controllers/attendanceController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/checkin", checkIn);
router.post("/checkout", checkOut);
// router.get("/my-attendance", getMyAttendance);
// router.get("/", authorize("admin"), getAllAttendance);

module.exports = router;