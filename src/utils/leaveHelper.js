// hitung durasi hari antara 2 tanggal (inclusive)
const calcLeaveDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 inclusive
  return diffDays;
};

// hitung sisa cuti dari leave_requests yang approved
const calcRemainingQuota = async (userId, year, totalQuota, LeaveRequest) => {
  const result = await LeaveRequest.aggregate([
    {
      // filter yang cuti nya di approve dan type nya annual
      $match: {
        userId: userId,
        status: "approved",
        type: "annual", // hanya cuti tahunan yang potong quota
        startDate: { $regex: `^${year}` },
      },
    },
    {
      // hitung durasinya 
      $group: {
        _id: null,
        totalUsed: { $sum: "$duration" },
      },
    },
  ]);

  const used = result[0]?.totalUsed || 0;
  const remaining = totalQuota - used;

  return { total: totalQuota, used, remaining };
};

// aturan per tipe cuti
const LEAVE_RULES = {
  annual: {
    label: "Cuti Tahunan",
    deductsQuota: true,
    fixedDuration: null,   // durasi bebas
    maxDuration: null,     // max ditentukan dari sisa quota
  },
  sick: {
    label: "Sakit",
    deductsQuota: false,
    fixedDuration: null,
    maxDuration: null,     // bebas, asal ada surat dokter
  },
  permit: {
    label: "Izin",
    deductsQuota: false,
    fixedDuration: null,
    maxDuration: null,        // max 3 hari
  },
  maternity: {
    label: "Cuti Melahirkan",
    deductsQuota: false,
    fixedDuration: 90,     // auto 90 hari dari startDate
    maxDuration: 90,
  },
};

module.exports = { LEAVE_RULES, calcLeaveDuration, calcRemainingQuota };