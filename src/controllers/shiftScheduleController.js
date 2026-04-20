import ShiftSchedule from "../models/ShiftSchedule.js";
import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js"
import ErrorResponse from "../utils/errorResponse.js";
import User from "../models/User.js"
import { getCurrentDate } from "../utils/timeHelper.js";

// ─────────────────────────────────────────
// @desc    Assign shift ke karyawan
// @route   POST /api/shift-schedules
// @access  Private / Admin
// ─────────────────────────────────────────
export const assignShift = async (req, res, next) => {
    try {
        const {userId, shiftId, date} = req.body
        // validasi field wajib
        if (!userId || !shiftId || !date) {
            return next(
                new ErrorResponse("userId, shiftId, and date are required", 400)
            );
        }
        // validasi format date YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return next(
                new ErrorResponse("Date format must be YYYY-MM-DD (e.g. 2025-04-10)", 400)
            );
        }

        // cek user exist dan rolenya employee
        const user = await User.findById(userId);
        if (!user) {
            return next(new ErrorResponse("User not found", 404));
        }
        if (user.role !== "employee") {
            return next(new ErrorResponse("Shift can only be assigned to employees", 400));
        }

        // cek shift ada atau ngga
        const shift = await Shift.findById(shiftId)
        if(!shift){
            return next(new ErrorResponse("Shift not found", 404));
        }

        // cek duplikat — 1 user tidak boleh shift yang sama di hari yang sama
        const duplicate = await ShiftSchedule.findOne({ userId, shiftId, date });
        if (duplicate) {
        return next(
            new ErrorResponse(
                `${user.name} already assigned to ${shift.name} on ${date}`,
                409
            ));
        }

        // cek maksimal 2 shift per hari per user
        // countDocuments({ userId: "U1", date: "2026-04-17" })
        const shiftsToday = await ShiftSchedule.countDocuments({ userId, date });
        if (shiftsToday >= 2) {
            return next(
            new ErrorResponse(
                `${user.name} already has 2 shifts on ${date}`,
                400
            ));
        }

        const schedule = await ShiftSchedule.create({
            userId, shiftId, date
        })

        const populated = await ShiftSchedule.findById(schedule._id)
        .populate("userId", "name email department")
        .populate("shiftId", "name start_time end_time");

        res.status(201).json({
            success: true,
            message: "Shift assigned successfully",
            data: populated,
        });
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get semua jadwal shift (admin)
// @route   GET /api/shift-schedules
// @access  Private / Admin
// ─────────────────────────────────────────

export const getAllSchedules = async (req, res, next) => {
    try {
        // req.query ketika frontend ambil data 
        const { userId, date } = req.query
         // filter opsional by date dan userId
        const filter = {};
        if (date) filter.date = date;
        if (userId) filter.userId = userId;

        const schedule = await ShiftSchedule.find(filter)
        // ambil dari tabel user
        .populate("userId", "name email department")
        // ambil dari tabel shift
        .populate("shiftId", "start_time end_time name overnight")

        res.status(200).json({
            success: true,
            count: schedule.length,
            data: schedule
        })
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get jadwal shift milik karyawan sendiri
// @route   GET /api/shift-schedules/my-schedule
// @access  Private / Employee
// ─────────────────────────────────────────

export const getMySchedule = async (req, res, next) => {
    try {
        const { month, year } = req.query

        // ambil data schedule milik user yang sedang login
        const filter = { userId: req.user._id };

        // filter by bulan dan tahun kalau dikirim
        // contoh: ?month=04&year=2025 → cari date yang mulai "2025-04"
        if (month && year) {
            const paddedMonth = String(month).padStart(2, "0");
            filter.date = { $regex: `^${year}-${paddedMonth}` };
        }

        // ambil data schedule milik user yang sedang login dari filter
        const schedules = await ShiftSchedule.find(filter)
        .populate("shiftId", "start_time end_time name overnight late_tolerance")
            // urutkan dari yg paling lama ke baru
        .sort({ date: 1 })

        res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules
        })
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get jadwal shift hari ini (untuk keperluan check-in)
// @route   GET /api/shift-schedules/today
// @access  Private / Employee
// ─────────────────────────────────────────

// export const getTodaySchedule = async (req, res, next) => {
//     try {
//         // const today = new Date().toLocaleDateString("en-CA") // "2025-04-10"
//         const today = new Date().toISOString().split("T")[0]; // "2025-04-10"

//         // “Ambil semua shift milik user yg sedang login ini di tanggal hari ini”
//         const schedules = await ShiftSchedule.find({
//             // userId: 1
//             userId: req.user._id,
//             date: today,
//         }).populate("shiftId", "start_time end_time name overnight late_tolerance")
//             .sort({ createdAt: -1 })

//         res.status(200).json({
//             success: true,
//             count: schedules.length,
//             data: schedules

//         })
//     } catch (error) {
//         next(error)
//     }
// }

export const getTodaySchedule = async (req, res, next) => {
    try {
        const today = getCurrentDate();

        const schedules = await ShiftSchedule.find({
          userId: req.user._id,
          date: today,
      }).populate("shiftId", "name start_time end_time overnight late_tolerance");

        // cek attendance untuk setiap shift schedule
        const result = await Promise.all(
            schedules.map(async (schedule) => {
                const attendance = await Attendance.findOne({
                    userId: req.user._id,
                    shiftScheduleId: schedule._id,
                });

                return {
                    ...schedule.toObject(),
                    attendanceStatus: {
                        isCheckedIn: !!attendance?.checkIn?.time,   // true / false
                        isCheckedOut: !!attendance?.checkOut?.time, // true / false
                        checkInTime: attendance?.checkIn?.time || null,
                        checkOutTime: attendance?.checkOut?.time || null,
                        status: attendance?.status || null,         // present / late / absent
                    },
                };
            })
        );

        res.status(200).json({
            success: true,
          count: result.length,
          data: result,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────
// @desc    Hapus jadwal shift
// @route   DELETE /api/shift-schedules/:id
// @access  Private / Admin
// ─────────────────────────────────────────

// export const deleteSchedule = async (req, res, next) => {
//     try {
//         const schedule = await ShiftSchedule.findById(req.params.id)
//         if (!schedule) {
//       return next(new ErrorResponse("Schedule not found", 404));
//     }

//     // cek apakah sudah ada absensi untuk jadwal ini
//     const Attendance = require("../models/Attendance");
//     const hasAttendance = await Attendance.findOne({
//       shiftScheduleId: req.params.id,
//     });
//     if (hasAttendance) {
//       return next(
//         new ErrorResponse(
//           "Cannot delete schedule that already has attendance record",
//           400
//         )
//       );
//     }

//     await schedule.deleteOne();

//     res.status(200).json({
//         success: true,
//         message: "Schedule deleted successfully"
//     })

//     } catch (error) {
//         next(error)
//     }
// }