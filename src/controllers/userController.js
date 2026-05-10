import User from "../models/User.js"
import LeaveQuota from "../models/LeaveQuota.js"
import LeaveRequest from "../models/LeaveRequest.js"
import Attendance from "../models/Attendance.js"
import ShiftSchedule from "../models/ShiftSchedule.js"
import ErrorResponse from "../utils/errorResponse.js"
import { calcRemainingQuota } from "../utils/leaveHelper.js"


// ─────────────────────────────────────────
// @desc    Get all employees
// @route   GET /api/users
// @access  Private / Admin
// ─────────────────────────────────────────

export const getAllUsers = async (req, res, next) => {
    try {
        const { department, search } = req.query

        // nampung query dari depan kalo kosong berati gaada filter
        const filter = {}
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const users = await User.find(filter)
        .sort({createdAt: -1})

        res.status(200).json({
            success: true,
            total: users.length,
            data: users
        })
    } catch (error) {
        next(error)
    }
}


// ─────────────────────────────────────────
// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private / Admin
// ─────────────────────────────────────────

export const getUserById = async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id)
      //                                ↑
      //                     Mongoose otomatis convert string → ObjectId
      //                     jadi user._id = ObjectId dari id yang sama

      if(!user){
          return next(new ErrorResponse("User not found", 404))
      }

      const year = new Date().getFullYear()
      const quota = await LeaveQuota.findOne({userId: user._id, year})

      const leaveInfo = quota
      ? await calcRemainingQuota(user._id, year, quota.total_quota, LeaveRequest)
      : {total: 14, used: 0, remaining: 14}

      res.status(200).json({
          success: true,
          data: {
              ...user.toObject(),
              leaveQuota: {
              year,
              ...leaveInfo,
              },
          },
      });
    } catch (error) {
      next(error)
  }
}

// ─────────────────────────────────────────
// @desc    Create employee (by admin)
// @route   POST /api/users
// @access  Private / Admin
// ─────────────────────────────────────────

export const createUser = async (req, res, next) => {
    try {
        const { name, email, password, department, phone, gender, role } = req.body;

    if (!name || !email || !password) {
      return next(
        new ErrorResponse("name, email, and password are required", 400)
      );
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return next(new ErrorResponse("Email already exists", 409));
    }

    // validasi password minimal 6 karakter
    if (password.length < 6) {
      return next(
        new ErrorResponse("Password must be at least 6 characters", 400)
      );
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department,
      phone,
      gender,
    });

    // auto-buat leave quota untuk tahun ini
    const year = new Date().getFullYear();
    await LeaveQuota.create({
      userId: user._id,
      year,
      total_quota: 14,
    });

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone,
        gender: user.gender,
      },
    });
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Update employee
// @route   PUT /api/users/:id
// @access  Private / Admin
// ─────────────────────────────────────────

export const updateUser = async (req, res, next) => {
    try {
        const { name, email, department, phone, gender } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return next(new ErrorResponse("User not found", 404));
        }

        // cek duplikat email kalau email diubah
        if (email && email !== user.email) {
            // User.findOne({ email: "budi@gmail.com", _id: { $ne: "userId123" } })
            // cek duplikasi email selain user id yg ada di url
            const duplicate = await User.findOne({
                email,
                _id: { $ne: req.params.id }, // tanpa $ne — user bisa dianggap duplikat dengan dirinya sendiri
            });
            if (duplicate) {
                return next(new ErrorResponse("Email already exists", 409));
            }
        }

        const updated = await User.findByIdAndUpdate(
        req.params.id, // ID user yang mau di-update (dari URL)
            {
                // name = "Budi"  → { name: "Budi" } 
                ...(name && { name }), // kalau name ada → jadikan { name: value }
                ...(email && { email }),
                ...(department && { department }),
                ...(phone && { phone }),
                ...(gender && { gender }),
            },
            { returnDocument: "after", runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: updated,
        });
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Delete employee
// @route   DELETE /api/users/:id
// @access  Private / Admin
// ─────────────────────────────────────────
export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return next(new ErrorResponse("User not found", 404));
        }

        // hapus semua data terkait user
        await Promise.all([
            Attendance.deleteMany({ userId: req.params.id }),
            LeaveRequest.deleteMany({ userId: req.params.id }),
            LeaveQuota.deleteMany({ userId: req.params.id }),
            ShiftSchedule.deleteMany({ userId: req.params.id }),
        ]);

        await user.deleteOne();

        res.status(200).json({
            success: true,
            message: "Employee and all related data deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────
// @desc    Reset password employee (by admin)
// @route   PATCH /api/users/:id/reset-password
// @access  Private / Admin
// ─────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return next(new ErrorResponse("newPassword is required", 400));
    }

    if (newPassword.length < 6) {
      return next(
        new ErrorResponse("Password must be at least 6 characters", 400)
      );
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `Password for ${user.name} has been reset successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// @desc    Update password milik sendiri
// @route   PATCH /api/users/change-password
// @access  Private / Employee & Admin
// ─────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return next(
        new ErrorResponse("oldPassword and newPassword are required", 400)
      );
    }

    if (newPassword.length < 6) {
      return next(
        new ErrorResponse("Password must be at least 6 characters", 400)
      );
    }

    const user = await User.findById(req.user._id).select("+password");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return next(new ErrorResponse("Old password is incorrect", 401));
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};