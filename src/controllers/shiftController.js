import Shift from "../models/Shift.js"
import ErrorResponse from "../utils/errorResponse.js"


export const getAllShifts = async (req, res, next) => {
    try {
        const shifts = await Shift.find().sort({start_time: 1})

        res.status(200).json({
            success: true,
            count: shifts.length,
            data: shifts
        })
    } catch (error) {
        next(error)
    }
}

export const getShiftById = async (req, res, next) => {
    try {
        const shifts = await Shift.findById(req.params.id)
        if(!shifts){
            return next(new ErrorResponse("Shift not found", 404))
        }

        res.status(200).json({
            success: true,
            data: shifts
        })
    } catch (error) {
        next(error)
    }
}

export const createShift = async (req, res, next) => {
    try {
        const {
            name,
            start_time,
            end_time,
            late_tolerance,
        } = req.body

        if(!name || !start_time || !end_time) {
            return next(
                new ErrorResponse("name, start_time, end_time are required", 400)
            )
        }
        // validasi format waktu HH:mm
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
        return next(
            new ErrorResponse("Time format must be HH:mm (e.g. 08:00)", 400)
        );
        }

        // cek duplikat nama shift
        const existing = await Shift.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
        });
            if (existing) {
            return next(new ErrorResponse(`Shift '${name}' already exists`, 409));
        }

        // cek apakah jam nya lintas hari
        const isOvernight = end_time < start_time;
        if(start_time === end_time) {
            return next(
                new ErrorResponse("Start time and end time cannot be the same", 400)
            )
        }
        const shift = await Shift.create({
            name,
            start_time,
            end_time,
            late_tolerance: late_tolerance ?? 15,
            overnight: isOvernight,
        });

        res.status(201).json({
            success: true,
            message: "Shift created successfully",
            data: shift,
        }); 
    } catch (error) {
        next(error)
    }
}

export const updateShift = async (req, res, next) => {
    try {
        const {
            name,
            start_time,
            end_time,
            late_tolerance,
        } = req.body

        let shift = await Shift.findById(req.params.id);
        if (!shift) {
            return next(new ErrorResponse("Shift not found", 404));
        }

         // validasi format waktu kalau dikirim
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (start_time && !timeRegex.test(start_time)) {
            return next(new ErrorResponse("start_time format must be HH:mm", 400));
        }
        if (end_time && !timeRegex.test(end_time)) {
            return next(new ErrorResponse("end_time format must be HH:mm", 400));
        }

        // cek duplikat nama (exclude diri sendiri)
        if (name) {
            const duplicate = await Shift.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
            _id: { $ne: req.params.id },
        });
        if (duplicate) {
            return next(new ErrorResponse(`Shift '${name}' already exists`, 409));
        }
        }
        // hitung ulang overnight kalau start/end berubah
        // newStart = "09:00" || "08:00" → "09:00" ✔
        // newEnd   = undefined || "16:00" → "16:00" ✔
        const newStart = start_time || shift.start_time;
        const newEnd = end_time || shift.end_time;

        const isOvernight = newEnd < newStart

        shift = await Shift.findByIdAndUpdate(
        req.params.id,
        {
            // misal ada req name = "Shift Pagi"
            ...(name && { name }), // → { name: "Shift Malam" }
            ...(start_time && { start_time }),
            ...(end_time && { end_time }),
            ...(late_tolerance !== undefined && { late_tolerance }),
            overnight: isOvernight,
        },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Shift updated successfully",
            data: shift,
        });

    } catch (error) {
        next(error)
    }
}

// export const deleteShift = async (req, res, next) => {
//     try {
//         const shift = await Shift.findById(req.params.id);
//     if (!shift) {
//       return next(new ErrorResponse("Shift not found", 404));
//     }

//     // cek apakah shift masih dipakai di shift_schedules
//     const isInUse = await ShiftSchedule.findOne({ shiftId: req.params.id });
//     if (isInUse) {
//       return next(
//         new ErrorResponse(
//           "Cannot delete shift that is already assigned to employees",
//           400
//         )
//       );
//     }

//     await shift.deleteOne();

//     res.status(200).json({
//       success: true,
//       message: "Shift deleted successfully",
//     });
//     } catch (error) {
//         next(error)
//     }
// }