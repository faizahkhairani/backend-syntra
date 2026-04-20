const mongoose = require("mongoose");

const leaveQuotaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
    },
    total_quota: {
      type: Number,
      default: 14,
    },
  },
  { timestamps: true }
);

// 1 user hanya boleh punya 1 quota per tahun
leaveQuotaSchema.index({ userId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("LeaveQuota", leaveQuotaSchema);