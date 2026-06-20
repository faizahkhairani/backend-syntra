import User from "../models/User.js"
import LeaveQuota from "../models/LeaveQuota.js"
import LeaveRequest from "../models/LeaveRequest.js"
import Attendance from "../models/Attendance.js"
import ShiftSchedule from "../models/ShiftSchedule.js"
import ErrorResponse from "../utils/errorResponse.js"
import { getCurrentDate, getCurrentTime } from "../utils/timeHelper.js"

// ─────────────────────────────────────────
// @desc    Dashboard summary (admin)
// @route   GET /api/dashboard/summary
// @access  Private / Admin
// ─────────────────────────────────────────

export const getSummary = async (req, res, next) => {
    try {
        const today = getCurrentDate();
        const currentTime = getCurrentTime();

        const [
            totalEmployees,
            pendingLeaves,
            attendanceSummary,
        ] = await Promise.all([
            User.countDocuments(),
            LeaveRequest.countDocuments({ status: "pending" }),

            ShiftSchedule.aggregate([
                { $match: { date: today } },
                {
                    $lookup: {
                    from: "attendances",
                    localField: "_id",
                    foreignField: "shiftScheduleId",
                    as: "attendance",
                    },
                },
                {
                    $lookup: {
                    from: "shifts",
                    localField: "shiftId",
                    foreignField: "_id",
                    as: "shift",
                    },
                },
                { $unwind: "$shift" },
                {
                    $addFields: {
                    attendanceData: { $arrayElemAt: ["$attendance", 0] },
                    },
                },
                {
                    $addFields: {
                    // ← jauh lebih simpel — cuma present, late, atau null
                    computedStatus: {
                        $cond: {
                        if: { $ifNull: ["$attendanceData.checkIn.time", false] },
                        then: "$attendanceData.status", // "present" atau "late"
                        else: null                      // belum/tidak absen → null
                        }
                    }
                    }
                },
                {
                    $group: {
                    _id: null,
                    totalShifts: { $sum: 1 },
                    present: {
                        $sum: { $cond: [{ $eq: ["$computedStatus", "present"] }, 1, 0] }
                    },
                    late: {
                        $sum: { $cond: [{ $eq: ["$computedStatus", "late"] }, 1, 0] }
                    },
                    // ← absent sekarang = semua yang null (belum absen + tidak hadir digabung)
                        notAbsen: {
                            $sum: { $cond: [{ $eq: ["$computedStatus", null] }, 1, 0] }
                        },
                    },
                },
                {
                    $project: {
                    _id: 0,
                    totalShifts: 1,
                    present: 1,
                    late: 1,
                    notAbsen: 1,
                    },
                },
            ])
        ])

        // kalau tidak ada jadwal hari ini, attendanceSummary = []
        const summary = attendanceSummary[0] || {
            totalShifts: 0,
            present: 0,
            late: 0,
            notAbsen: 0,
        };

        res.status(200).json({
            success: true,
            data: {
                today,
                employees: {
                    total: totalEmployees,
                },
                attendance: {
                    totalShifts: summary.totalShifts,
                    present: summary.present,
                    late: summary.late,
                    notAbsen: summary.notAbsen,
                },
                leaves: {
                    pending: pendingLeaves,
                },
            },
        });       
    } catch (error) {
        next(error)
    }
}


// shift_schedules + attendances + shifts

//  shiftSchedule 1                                                 
//   _id: "scheduleId1"                                             
//   userId: "budiId"                                               
//   date: "2025-04-30"                                             
//   attendanceData: { checkIn: { time: "08:05" }, status: "present" 
//   shift: { name: "Shift Pagi", end_time: "14:30", overnight: false}

//  shiftSchedule 2                                                 
//   _id: "scheduleId2"                                             
//   userId: "andiId"                                               
//   date: "2025-04-30"                                             
//   attendanceData: null  ← belum absen                            
//   shift: { name: "Shift Sore", end_time: "21:00", overnight: false}

//  shiftSchedule 3                                                 
//   _id: "scheduleId3"                                             
//   userId: "sitiId"                                               
//   date: "2025-04-30"                                             
//   attendanceData: { checkIn: { time: "21:15" }, status: "late" } 
//   shift: { name: "Shift Malam", end_time: "08:00", overnight: true}

// $cond itu if/else di MongoDB
    // $cond: { if: kondisi, then: nilai_kalau_true, else: nilai_kalau_false }

    // // logikanya:
    // if (attendanceData.checkIn.time ada) {
    // computedStatus = attendanceData.status  // "present" atau "late"
    // } else if (shift.overnight === true) {
    // computedStatus = "not_yet"  // shift malam — skip dulu
    // } else if (currentTime > shift.end_time) {
    // computedStatus = "absent"   // shift sudah lewat, tidak check-in
    // } else {
    // computedStatus = "not_yet"  // shift belum selesai
    // }

export const getDailyRecap = async (req, res, next) => {
    try {
        const { date } = req.query;
        const targetDate = date || getCurrentDate();

        // ambil semua jadwal shift hari ini
        const schedules = await ShiftSchedule.find({ date: targetDate })
        .populate("userId", "name email department")
        .populate("shiftId", "name start_time end_time");

        if (schedules.length === 0) {
        return res.status(200).json({
            success: true,
            date: targetDate,
            count: 0,
            data: [],
        });
        }

        // ambil semua attendance sekaligus — hindari N+1
        const scheduleIds = schedules.map((s) => s._id);
        const attendances = await Attendance.find({
            shiftScheduleId: { $in: scheduleIds },
        });

        // buat map untuk lookup O(1)
        const attendanceMap = {};
            attendances.forEach((att) => {
            attendanceMap[att.shiftScheduleId.toString()] = att;
        });

        const result = schedules.map((schedule) => {
        const attendance = attendanceMap[schedule._id.toString()] || null;

        return {
            employee: schedule.userId,
            shift: schedule.shiftId,
            checkIn: attendance?.checkIn?.time || null,
            checkOut: attendance?.checkOut?.time || null,
            status: attendance?.status || null,
            workDuration: attendance?.workDuration || 0,
            workDurationFormatted: attendance?.workDuration
            ? `${Math.floor(attendance.workDuration / 60)}h ${attendance.workDuration % 60}m`
            : "-",
        };
        });

        // summary
        const summary = {
            total: result.length,
            present: result.filter((r) => r.status === "present").length,
            late: result.filter((r) => r.status === "late").length,
            notAbsen: result.filter((r) => r.status === null).length,
        };

        res.status(200).json({
            success: true,
            date: targetDate,
            summary,
            data: result,
        });
  } catch (error) {
    next(error);
  }
}