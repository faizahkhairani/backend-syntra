const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    shiftScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShiftSchedule",
      required: [true, "Shift schedule is required"],
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: [true, "Date is required"],
    },
    checkIn: {
      time: { type: String, default: null },       // "08:05"
      photo: { type: String, default: null },       // opsional
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    checkOut: {
      time: { type: String, default: null },
      photo: { type: String, default: null },       // opsional
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ["present", "late", "absent"],
      default: "absent",
    },
    workDuration: {
      type: Number, // dalam menit
      default: null,
    },
  },
  { timestamps: true }
);

// 1 user tidak boleh absen 2x untuk shift schedule yang sama
attendanceSchema.index({ userId: 1, shiftScheduleId: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);