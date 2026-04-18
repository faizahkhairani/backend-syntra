const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Shift name is required"],
      trim: true,
    },
    start_time: {
      type: String, // format "HH:mm"
      required: [true, "Start time is required"],
    },
    end_time: {
      type: String,
      required: [true, "End time is required"],
    },
    late_tolerance: {
      type: Number, // dalam menit
      default: 15,
    },
    overnight: {
      type: Boolean, // ← true kalau shift melewati tengah malam
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shift", shiftSchema);