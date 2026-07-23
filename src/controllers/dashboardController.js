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


const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export const getWeeklyAttendance = async (req, res) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // mulai Senin
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const results = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$date" }, // 1=Minggu ... 7=Sabtu
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // inisialisasi 7 hari (Senin-Minggu) dengan default 0
    const weekMap = {};
    for (let i = 1; i <= 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + (i - 1));
      const label = DAY_LABELS[d.getDay()];
      weekMap[label] = { day: label, hadir: 0, terlambat: 0, absen: 0 };
    }

    // isi dari hasil aggregate
    results.forEach((r) => {
      const jsDay = r._id.dayOfWeek - 1; // convert Mongo (1-7, Min-Sab) ke JS getDay (0-6)
      const label = DAY_LABELS[jsDay];
      if (!weekMap[label]) return;

      if (r._id.status === "present") weekMap[label].hadir += r.count;
      else if (r._id.status === "late") weekMap[label].terlambat += r.count;
      else if (r._id.status === "absent") weekMap[label].absen += r.count;
    });

    res.json(Object.values(weekMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data absensi mingguan" });
  }
};

export const getLeaveSummary = async (req, res) => {
  try {
    const results = await LeaveRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = { pending: 0, approved: 0, rejected: 0 };
    results.forEach((r) => {
      if (summary.hasOwnProperty(r._id)) {
        summary[r._id] = r.count;
      }
    });

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil ringkasan cuti" });
  }
};