import Attendance from "../models/Attendance.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import ErrorResponse from "../utils/errorResponse.js";
import { isWithinOfficeRadius } from "../utils/locationHelper.js";
import { getCurrentDate, getCurrentTime, determineStatus, calcWorkDuration } from "../utils/timeHelper.js";

// ─────────────────────────────────────────
// @desc    Check-in
// @route   POST /api/attendance/checkin
// @access  Private / Employee
// ─────────────────────────────────────────

export const checkIn = async (req, res, next) => {
    try {
        // {
        //   "shiftScheduleId": "SS1",
        //   "latitude": -6.2090,
        //   "longitude": 106.8460
        // }
        const {shiftScheduleId, latitude, longitude} = req.body
        // validasi field wajib
        if (!shiftScheduleId || latitude == null || longitude == null) {
            return next(
                new ErrorResponse("shiftScheduleId, latitude, and longitude are required", 400)
            );
        }

         // validasi lokasi
        const location = isWithinOfficeRadius(latitude, longitude);
        if (!location.isValid) {
            return next(
                new ErrorResponse(
                `You are too far from the office. Distance: ${location.distance}m, allowed: ${location.allowedRadius}m`,
                400
            )
        );
        }

        // cek shift schedule exist dan milik user ini
        const schedule = await ShiftSchedule.findById(shiftScheduleId).populate("shiftId");
        if (!schedule) {
            return next(new ErrorResponse("Shift schedule not found", 404));
        }
        if (schedule.userId.toString() !== req.user._id.toString()) {
            return next(new ErrorResponse("This shift schedule does not belong to you", 403));
        }

        // cek tanggal schedule sesuai hari ini
        // Schedule date = 2026-04-17
        // Today = 2026-04-17
        const today = getCurrentDate();
        if (schedule.date !== today) {
            return next(
                new ErrorResponse(`This shift is scheduled for ${schedule.date}, not today`, 400)
            );
        }

         // cek sudah check-in belum
        const existing = await Attendance.findOne({
            userId: req.user._id,
            shiftScheduleId,
        });
        if (existing?.checkIn?.time) {
            return next(new ErrorResponse("You have already checked in for this shift", 400));
        }

        // validasi waktu pas check in
        const currentTime = getCurrentTime(); // "08:10"
        const status = determineStatus(
            currentTime, // "08:10"
            schedule.shiftId.start_time, // "08:00"
            schedule.shiftId.late_tolerance // "30 menit"
        );

        // upsert — buat baru atau update kalau udah ada dokumen (misal dari sistem absen otomatis)
        const attendance = await Attendance.findOneAndUpdate(
            // apakah user ini sudah punya absensi untuk jadwal ini?
            { userId: req.user._id, shiftScheduleId }, 
            {
                userId: req.user._id,
                shiftScheduleId,
                date: today,
                checkIn: {
                time: currentTime,
                latitude,
                longitude,
                },
                status,
            },
            { upsert: true, new: true, runValidators: true }
        ).populate({
            path: "shiftScheduleId",
            populate: { path: "shiftId", select: "name start_time end_time" },
        });

        res.status(200).json({
            success: true,
            message: `Clock in successful = status ${status}`,
            data: attendance
        })
    } catch (error) {
        next(error)
    }
}


// ─────────────────────────────────────────
// @desc    Check-out
// @route   POST /api/attendance/checkout
// @access  Private / Employee
// ─────────────────────────────────────────

export const checkOut = async (req, res, next) => {
    try {
        // {
        //   "shiftScheduleId": "SS1",
        //   "latitude": -6.2090,
        //   "longitude": 106.8460
        // }
        const {shiftScheduleId, latitude, longitude} = req.body
        // validasi field wajib
        if (!shiftScheduleId || latitude == null || longitude == null) {
            return next(
                new ErrorResponse("shiftScheduleId, latitude, and longitude are required", 400)
            );
        }
        console.log("Absen untuk shift ini: ",shiftScheduleId)
        console.log("lokasi: ",latitude)
        console.log("lokasi: ",longitude)

        // validasi lokasi
        const location = isWithinOfficeRadius(latitude, longitude);
        if (!location.isValid) {
            return next(
                new ErrorResponse(
                `You are too far from the office. Distance: ${location.distance}m, allowed: ${location.allowedRadius}m`,
                400
            )
        );
        }
        console.log(location)

        // cek apakah dia sudah check in dan absen nya ada
        const attendance = await Attendance.findOne({
            // ambil data absensi, data shift schedule nya dan data shift didalamnya
            userId: req.user._id, // ambil dari id yg sedang login
            shiftScheduleId, // req dari body
        }).populate({
            path: "shiftScheduleId",
            populate: { path: "shiftId", select: "name start_time end_time overnight"}
        })

        // cek udh absen belom
        if (!attendance) {
            return next(new ErrorResponse("Please check-in first", 400));
        }
        // cek waktu dia check in
        if (!attendance.checkIn?.time) {
            return next(new ErrorResponse("Please check-in first", 400));
        }
        // cek udah check out belom
        if (attendance.checkOut?.time) {
            return next(new ErrorResponse("You have already checked out for this shift", 400));
        }

        console.log(attendance)

        const currentTime = getCurrentTime();
        console.log(currentTime)
        // ambil data shift yg mau di check out
        const shift = attendance.shiftScheduleId.shiftId;
        console.log(shift)

        // hitung waktu kerja dari check in
        const workDuration = calcWorkDuration(
            attendance.checkIn.time,
            currentTime,
            shift.overnight
        )
        console.log(workDuration)

        attendance.checkOut = { time: currentTime, latitude, longitude };
        attendance.workDuration = workDuration;
        await attendance.save();

        res.status(200).json({
            success: true,
            // gabungin 2 hal jadi 1 objek
            data: {
                ...attendance.toObject(), // toObject -> karena data dari mongoose doc harus di convert ke object
                workDurationFormatted: `${Math.floor(workDuration / 60)}h ${workDuration % 60}m`,
            },
            status: "Check Out Successfully"
        })

    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get riwayat absensi milik sendiri
// @route   GET /api/attendance/my-attendance
// @access  Private / Employee
// ─────────────────────────────────────────

export const getMyAttendance = async (req, res, next) => {
    try {
        const { month, year } = req.query

        const filter = { userId: req.user._id }
        console.log(filter)

        if (month && year) {
            const paddedMonth = String(month).padStart(2, "0");
            filter.date = { $regex: `^${year}-${paddedMonth}` };
        }

        const attendance = await Attendance.find(filter)
            .populate({
                path: "shiftScheduleId",
                populate: { path: "shiftId", select: "name start_time end_time late_tolerance overnight" }
            })
            // urutkan data dari yg terbaru 
            .sort({ date: -1 })
        // console.log(attendance)

        // untuk menghitung jumlah data tiap status absen
        const summary = {
            total: attendance.length,
            present: attendance.filter((a) => a.status === "present").length,
            late: attendance.filter((a) => a.status === "late").length,
            absent: attendance.filter((a) => a.status === "absent").length,
        }

        res.status(200).json({
            success: true,
            summary,
            data: attendance
        })
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get semua absensi (admin)
// @route   GET /api/attendance
// @access  Private / Admin
// ─────────────────────────────────────────

export const getAllAttendance = async (req, res, next) => {
    try {
        // kalo ada request dari depan 
        const { date, userId, status, month, year } = req.query

        const filter = {};
        if (date) filter.date = date;
        if (userId) filter.userId = userId;
        if (status) filter.status = status;
        if (month && year) {
            const paddedMonth = String(month).padStart(2, "0");
            filter.date = { $regex: `^${year}-${paddedMonth}` };
        }

        const attendances = await Attendance.find(filter)
            .populate("userId", "name email department")
            .populate({
                path: "shiftScheduleId",
                populate: { path: "shiftId", select: "name start_time end_time" }
            })
            .sort({ date: -1 }) // urutkan dari yg terbaru (desc)

        const summary = {
            total: attendances.length,
            present: attendances.filter((a) => a.status === "present").length,
            late: attendances.filter((a) => a.status === "late").length,
            absent: attendances.filter((a) => a.status === "absent").length,
        }

        res.status(200).json({
            success: true,
            summary,
            count: attendances.length,
            data: attendances
        })
    } catch (error) {
        next(error)
    }
}
