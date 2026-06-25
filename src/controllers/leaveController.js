import LeaveRequest from "../models/LeaveRequest.js";
import LeaveQuota from "../models/LeaveQuota.js";
import ErrorResponse from "../utils/errorResponse.js";
import { calcLeaveDuration, LEAVE_RULES, calcRemainingQuota } from "../utils/leaveHelper.js";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import ShiftSchedule from "../models/ShiftSchedule.js";

// ─────────────────────────────────────────
// @desc    Get quota cuti milik sendiri
// @route   GET /api/leaves/my-quota
// @access  Private / Employee
// ─────────────────────────────────────────
export const getMyQuota = async (req, res, next) => {
    try {
        const year = new Date().getFullYear()

        let quota = await LeaveQuota.findOne({
            userId: req.user._id,
            year,
        })

        if(!quota){
            quota = await LeaveQuota.create({
                userId: req.user._id,
                year,
                total_quota: 14
            })
        }

        // hitung jatah cuti user yg login
        const {total, used, remaining} = await calcRemainingQuota(
            req.user._id, // siapa user nya
            year, // tahun berapa
            quota.total_quota, // jatah cuti
            LeaveRequest // ambil model untuk akses data cuti user
        )

        res.status(200).json({
        success: true,
        data: {
            year,
            total_quota: total,
            used,
            remaining,
        },
    });
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Ajukan cuti
// @route   POST /api/leaves
// @access  Private / Employee
// ─────────────────────────────────────────

export const createLeaveRequest = async (req, res, next) => {
    try {
        const { type, startDate, reason } = req.body;
        let { endDate } = req.body;
        console.log(type)
        console.log(startDate)
        console.log(reason)
        console.log(endDate)

        if(!type || !startDate || !reason){
            return next(
                new ErrorResponse("type, startDate, reason are required", 400)
            )
        }

        // const type = "maternity";
        // LEAVE_RULES["maternity"]
        const rule = LEAVE_RULES[type];
        if (!rule) {
            return next(new ErrorResponse("Invalid leave type", 400));
        }
        console.log(rule)

        // validasi format startDate
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(startDate)) {
            return next(new ErrorResponse("Date format must be YYYY-MM-DD", 400));
        }

        // kalau fixedDuration → endDate dihitung otomatis, frontend tidak perlu kirim
        if (rule.fixedDuration) {
            const start = new Date(startDate);
            start.setDate(start.getDate() + rule.fixedDuration - 1);
            endDate = start.toISOString().split("T")[0]; // auto-calculate
        }

        // kalau bukan fixedDuration → endDate wajib dikirim
        if (!rule.fixedDuration && !endDate) {
            return next(new ErrorResponse("endDate is required for this leave type", 400));
        }

        if (!dateRegex.test(endDate)) {
            return next(new ErrorResponse("Date format must be YYYY-MM-DD", 400));
        }

        // validasi endDate tidak sebelum startDate
        if (new Date(endDate) < new Date(startDate)) {
            return next(new ErrorResponse("endDate cannot be before startDate", 400));
        }

        // validasi startDate tidak di masa lalu
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(startDate) < today) {
            return next(new ErrorResponse("Cannot apply leave for past dates", 400));
        }

        // ngitung durasi cuti yang diajukan
        const duration = calcLeaveDuration(startDate, endDate);
        console.log(duration)

        // ambil tahun dari start date cuti nya
        const year = new Date(startDate).getFullYear();

        // kalo annual maka cek tabel kuota cuti lalu hitung lagi
        if(rule.deductsQuota) {
            let quota = await LeaveQuota.findOne({userId: req.user._id, year})
            if(!quota){
                quota = await LeaveQuota.create({
                userId: req.user._id,
                year,
                total_quota: 14,
            });
            }
            console.log(quota)

            // hitung lagi sisa kuota nya dan kasih result sisa kuota
            const { remaining } = await calcRemainingQuota(
                // kirim ini ke fungsi hitung kuota 
                req.user._id,
                year,
                quota.total_quota,
                LeaveRequest
            );
            console.log(remaining)

            if (duration > remaining) {
                return next(
                new ErrorResponse(
                    `Insufficient leave quota. Requested: ${duration} days, remaining: ${remaining} days`,
                    400
                )
                );
            }
        }

        // cek overlap tanggal
        const overlap = await LeaveRequest.findOne({
            userId: req.user._id,
            status: { $ne: "rejected" }, // yg bukan reject di check 
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
        });

        if (overlap) {
        return next(
            new ErrorResponse(
            `You already have a leave request on overlapping dates (${overlap.startDate} - ${overlap.endDate})`,
            409
            )
        );
        }

        const leaveRequest = await LeaveRequest.create({
            userId: req.user._id,
            type,
            startDate,
            endDate,   // sudah dihitung otomatis kalau maternity/religious
            duration,
            reason,
        });

        res.status(201).json({
            success: true,
            message: "Leave request submitted successfully",
            data: {
                ...leaveRequest.toObject(),
                typeLabel: rule.label,         // "Cuti Melahirkan"
                deductsQuota: rule.deductsQuota,
            },
        });

    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get riwayat cuti milik sendiri
// @route   GET /api/leaves/my-requests
// @access  Private / Employee
// ─────────────────────────────────────────


export const getMyLeaveRequests = async (req, res, next) => {
    try {
        // GET /leave/my-request?page=2&limit=10
        // page = 2, limit = 10
        const { status, year, page = 1, limit = 5 } = req.query
        const filter = {userId: req.user._id}
        if (status) filter.status = status;
        if (year) filter.startDate = { $regex: `^${year}` };

        const skip = (Number(page) - 1) * Number(limit)

        const [data, total] = await Promise.all([
            LeaveRequest.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip) // 10
                .limit(Number(limit)), // 10
            LeaveRequest.countDocuments(filter) // Hitung seluruh leave request milik user login
        ])

        res.status(200).json({
            success: true,
            data, // yg sudah diquery sesuai page & limit [data ke-11 sampai data ke-20]
            pagination: {
                total, // 45
                page: Number(page), // 2
                limit: Number(limit), // 10
                totalPages: Math.ceil(total / Number(limit)), // 45 / 10 = 4.5
            }
        })
    } catch (error) {
        next(error)
    }
}


// ─────────────────────────────────────────
// @desc    Get semua cuti (admin)
// @route   GET /api/leaves
// @access  Private / Admin
// ─────────────────────────────────────────
export const getAllLeaveRequests = async (req, res, next) => {
    try {
        const { status, userId, year } = req.query

        const filter = {};
        if (status) filter.status = status;
        if (userId) filter.userId = userId;
        if (year) filter.startDate = { $regex: `^${year}` };

        const requests = await LeaveRequest.find(filter)
        .populate("userId", "name email department")
        .populate("reviewedBy", "name")
        .sort({createdAt: -1})

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests,
        });
    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Approve / Reject cuti
// @route   PATCH /api/leaves/:id/review
// @access  Private / Admin
// ─────────────────────────────────────────

export const reviewLeaveRequest = async (req, res, next) => {
    try {
        const {status, rejectReason} = req.body
        console.log(status)

        if(!status){
            return next(new ErrorResponse("Status is Required", 400))
        }

        if(!["approved", "rejected"].includes(status)){
            return next(new ErrorResponse("Status must be approved or rejected", 400));
        }

        if(status === "rejected" && !rejectReason){
            return next(new ErrorResponse("Reject reason is required when rejecting", 400));
        }

        const leaveRequest = await LeaveRequest.findById(req.params.id)
        console.log(req.params.id)
        if(!leaveRequest){
            return next(new ErrorResponse("Leave request not found", 404));
        }

        if (leaveRequest.status !== "pending") {
        return next(
            new ErrorResponse(
            `Leave request has already been ${leaveRequest.status}`,
            400
            )
        );
        }

        leaveRequest.status = status;
        leaveRequest.reviewedBy = req.user._id;
        leaveRequest.reviewedAt = new Date()
        if(status === "rejected") leaveRequest.rejectReason = rejectReason;

        await leaveRequest.save()

        await leaveRequest.populate("userId", "name email");
        await leaveRequest.populate("reviewedBy", "name");

        res.status(200).json({
            success: true,
            message: `Leave request ${status} successfully`,
            data: leaveRequest,
        });
    } catch (error) {
        next(error)
    }
}


// ─────────────────────────────────────────
// @desc    Cancel cuti (oleh karyawan sendiri)
// @route   PATCH /api/leaves/:id/cancel
// @access  Private / Employee
// ─────────────────────────────────────────
export const cancelLeaveRequest = async (req, res, next) => {
    try {
        const leaveRequest = await LeaveRequest.findById(req.params.id)

        if(!leaveRequest){
            return next(
                new ErrorResponse("Leave Request not found", 400)
            )
        }

        if(leaveRequest.userId.toString() !== req.user._id.toString()){
            return next(
                new ErrorResponse("You are not authorize to cancel this leave", 403)
            )
        }

        if(leaveRequest.status !== "pending"){
            return next(
                new ErrorResponse(`Cannot cancel leave request that already ${leaveRequest.status}`, 400)
            )
        }

        await leaveRequest.deleteOne()

        res.status(200).json({
            success: true,
            message: "Leave request cancelled successfully"
        })


    } catch (error) {
        next(error)
    }
}

// ─────────────────────────────────────────
// @desc    Get quota semua karyawan (admin)
// @route   GET /api/leaves/quotas
// @access  Private / Admin
// ─────────────────────────────────────────

export const getAllQuotas = async (req, res, next) => {
    try {
        // kalo ada req year ?year=2025 pake itu kalo ga ambil tahun sekarang
        const year = req.query.year || new Date().getFullYear();
        console.log(year)
        // ambil data kuota semua user dari tahun lalu populate untuk dapetin informasi lengkap setiap user
        const quotas = await LeaveQuota.find({year}).populate
        ("userId", "name email department")
        console.log(quotas)

        // hitung sisa kuota tiap user 
        const result = await Promise.all( // promise all untuk nunggu semua perhitungan selesai dulu
            quotas.map(async (q) => {
                const { used, remaining, total } = await calcRemainingQuota(
                    q.userId._id, // ambil id nya aja untuk fungsi hitung kuota
                    year,
                    q.total_quota,
                    LeaveRequest
                );
                return{
                    user: q.userId, // q.userId ini untuk ngambil informasi lengkap
                    year: q.year,
                    total_quota: total,
                    used,
                    remaining
                }
            })
        )
        console.log(result)

        res.status(200).json({
            success: true,
            count: result.length,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}

// @desc    Get all leave types
// @route   GET /api/leaves/types
// @access  Private / Employee

export const getLeaveTypes = async (req, res, next) => {
    try {
        const types = Object.entries(LEAVE_RULES).map(([key, rule]) => ({
            value: key,
            label: rule.label,
            deductsQuota: rule.deductsQuota,
            fixedDuration: rule.fixedDuration,
            maxDuration: rule.maxDuration
        }))

        res.status(200).json({
            success: true,
            data: types
        })
    } catch (error) {
        next(error)
    }
}

export const getLeaveRecommendations = async (req, res, next) => {
    try {
        // 1. Ambil semua pending leave requests
        const pendingLeaves = await LeaveRequest.find({ status: "pending" })
            .populate("userId", "name email department");

        if (pendingLeaves.length === 0) {
            return res.status(200).json({ success: true, count: 0, data: [] });
        }

        // 2. Ambil range 3 bulan terakhir
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        const startDate = threeMonthsAgo.toISOString().split("T")[0]; // "YYYY-MM-DD"
        const endDate = now.toISOString().split("T")[0];

        // 3. Ambil semua userId yang punya pending leave
        const userIds = [...new Set(pendingLeaves.map((l) => l.userId._id.toString()))];

        // 4. Fetch semua data sekaligus (hindari N+1)
        const [quotas, attendances, shiftSchedules] = await Promise.all([
            LeaveQuota.find({ userId: { $in: userIds }, year: now.getFullYear() }),
            Attendance.find({
                userId: { $in: userIds },
                date: { $gte: startDate, $lte: endDate },
            }),
            ShiftSchedule.find({ // sebagai acuan untuk menghitung total shift 
                userId: { $in: userIds },
                date: { $gte: startDate, $lte: endDate },
            }),
        ]);
        // console.log(quotas)

        // 5. Hitung remaining quota tiap user pakai calcRemainingQuota
        const quotaMap = {};
        await Promise.all(
            quotas.map(async (q) => {
                const { remaining } = await calcRemainingQuota(
                    q.userId,
                    now.getFullYear(),
                    q.total_quota,
                    LeaveRequest
                );
                quotaMap[q.userId.toString()] = remaining;
            })
        );

        // 6. Buat map userId → total shift di-assign dari ShiftSchedule
        const scheduleMap = {};
        shiftSchedules.forEach((s) => {
            const uid = s.userId.toString();
            if (!scheduleMap[uid]) scheduleMap[uid] = 0;
            scheduleMap[uid]++;
        });

        // 7. Buat map userId → { hadirCount, telatCount } dari Attendance
        const attendanceMap = {};
        attendances.forEach((att) => {
            const uid = att.userId.toString();
            if (!attendanceMap[uid]) {
                attendanceMap[uid] = { hadirCount: 0, telatCount: 0 };
            }
            if (att.status === "present") attendanceMap[uid].hadirCount++;
            if (att.status === "late") {
                attendanceMap[uid].hadirCount++;
                attendanceMap[uid].telatCount++;
            }
        });

        // 7. Hitung C1, C2, C3 tiap karyawan
        const criteriaData = userIds.map((uid) => {
            const quota = quotaMap[uid] ?? 0;
            const att = attendanceMap[uid] ?? { hadirCount: 0, telatCount: 0 };
            const totalAssigned = scheduleMap[uid] ?? 0; // ← dari ShiftSchedule
            const kehadiran = totalAssigned > 0
                ? (att.hadirCount / totalAssigned) * 100
                : 0;

            return {
                userId: uid,
                c1: quota,               // sisa quota (benefit)
                c2: kehadiran,           // % kehadiran (benefit)
                c3: att.telatCount,      // jumlah telat (cost)
            };
        });
        console.log("scheduleMap:", scheduleMap);
        console.log("attendanceMap:", attendanceMap);
        console.log("criteriaData:", criteriaData);

        // 8. Normalisasi SAW
        const maxC1 = Math.max(...criteriaData.map((d) => d.c1));
        const maxC2 = Math.max(...criteriaData.map((d) => d.c2));
        const minC3 = Math.min(...criteriaData.map((d) => d.c3 + 1)); // +1 hindari div/0

        const W1 = 0.4; // bobot C1
        const W2 = 0.4; // bobot C2
        const W3 = 0.2; // bobot C3

        const scoreMap = {};
        criteriaData.forEach((d) => {
            const r1 = maxC1 > 0 ? d.c1 / maxC1 : 0;
            const r2 = maxC2 > 0 ? d.c2 / maxC2 : 0;
            const r3 = minC3 / (d.c3 + 1); // cost normalisasi

            const score = (r1 * W1) + (r2 * W2) + (r3 * W3);

            scoreMap[d.userId] = {
                score: parseFloat(score.toFixed(2)),
                criteria: {
                    sisaQuota: d.c1,
                    kehadiran: parseFloat(d.c2.toFixed(1)),
                    keterlambatan: d.c3,
                },
            };
        });

        // 9. Sisipkan skor ke tiap leave request + sort by skor
        const result = pendingLeaves
            .map((leave) => {
                const uid = leave.userId._id.toString();
                return {
                    ...leave.toObject(),
                    saw: scoreMap[uid] ?? { score: 0, criteria: {} },
                };
            })
            .sort((a, b) => b.saw.score - a.saw.score)
            .map((leave, index) => ({
                ...leave,
                saw: { ...leave.saw, rank: index + 1 },
            }));

        res.status(200).json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
