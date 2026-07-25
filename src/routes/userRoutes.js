const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");
const demoGuard = require("../middleware/demoGuard");

router.use(protect);
router.use(demoGuard);

// admin only
router.route("/")
  .get(authorize("admin"), getAllUsers)
  .post(authorize("admin"), createUser);

router.route("/:id")
  .get(authorize("admin"), getUserById)
  .put(authorize("admin"), updateUser)
  .delete(authorize("admin"), deleteUser)

router.patch("/:id/reset-password", authorize("admin"), resetPassword);


module.exports = router;