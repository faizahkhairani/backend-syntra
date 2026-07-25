const express = require("express");
const router = express.Router();
const {
  getMyQuota,
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  reviewLeaveRequest,
  cancelLeaveRequest,
  getAllQuotas,
  getLeaveTypes,
  getLeaveRecommendations
} = require("../controllers/leaveController");
const { protect, authorize } = require("../middleware/auth");
const demoGuard = require("../middleware/demoGuard");

router.use(protect);
router.use(demoGuard);

// employee
router.get("/my-quota", getMyQuota);
router.get("/types", getLeaveTypes)
router.get("/my-requests", getMyLeaveRequests);
router.post("/", createLeaveRequest);
router.patch("/:id/cancel", cancelLeaveRequest);

// admin
router.get("/", authorize("admin"), getAllLeaveRequests);
router.get("/quotas", authorize("admin"), getAllQuotas);
router.get("/recommendations", authorize("admin"), getLeaveRecommendations);
router.patch("/:id/review", authorize("admin"), reviewLeaveRequest);

module.exports = router;