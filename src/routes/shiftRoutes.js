const express = require("express");
const router = express.Router();
const {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
} = require("../controllers/shiftController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.route("/")
  .get(getAllShifts)
  .post(authorize("admin"), createShift);

router.route("/:id")
  .get(getShiftById)
  .put(authorize("admin"), updateShift)
//   .delete(authorize("admin"), deleteShift);

module.exports = router;