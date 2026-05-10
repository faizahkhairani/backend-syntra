const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// admin only
router.route("/")
  .get(authorize("admin"), getAllUsers)
  .post(authorize("admin"), createUser);

router.route("/:id")
  .get(authorize("admin"), getUserById)
  .put(authorize("admin"), updateUser)
  .delete(authorize("admin"), deleteUser);


module.exports = router;