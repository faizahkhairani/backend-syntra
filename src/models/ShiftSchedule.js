const mongoose = require("mongoose");

const shiftScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: [true, "Shift is required"],
    },
    date: {
      type: String, // format "YYYY-MM-DD"
      required: [true, "Date is required"],
    },
  },
  { timestamps: true }
);

// 1 user tidak boleh dapat shift yang sama di hari yang sama
shiftScheduleSchema.index({ userId: 1, shiftId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("ShiftSchedule", shiftScheduleSchema);