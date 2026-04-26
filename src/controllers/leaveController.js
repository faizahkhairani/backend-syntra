import LeaveRequest from "../models/LeaveRequest.js";
import LeaveQuota from "../models/LeaveQuota.js";
import ErrorResponse from "../utils/errorResponse.js";
import { calcLeaveDuration, LEAVE_RULES, calcRemainingQuota } from "../utils/leaveHelper.js";
import mongoose from "mongoose";

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
            status: { $ne: "rejected" },
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
        const {status, year} = req.query
        const filter = {userId: req.user._id}
        if (status) filter.status = status;
        if (year) filter.startDate = { $regex: `^${year}` };

        const requests = await LeaveRequest.find(filter)
        .sort({ createdAt: -1})

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests
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
