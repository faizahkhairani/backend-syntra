// proses absensi dari check-in → check-out → hitung durasi → tentuin status
// konversi "HH:mm" ke menit sejak tengah malam
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}; // fungsi untuk ngubah jam menjadi menit
// contoh -> 08:00 = 480 menit

// hitung durasi kerja dalam menit (handle overnight)
const calcWorkDuration = (checkInTime, checkOutTime) => {
  const inMinutes = timeToMinutes(checkInTime);
  const outMinutes = timeToMinutes(checkOutTime);

  // jam keluar lebih kecil = check-out setelah tengah malam
  if (outMinutes < inMinutes) {
    // misal masuk 21:00 (1260 menit), keluar 08:00 (480 menit)
    return 1440 - inMinutes + outMinutes; // 1440 = total menit sehari
    // = (1440 - 1260) + 480
    // = 180 + 480
    // = 660 menit (11 jam)
  }

  return outMinutes - inMinutes;
};

const isShiftStarted = (currentTime, startTime) => {
  return currentTime >= startTime
}

const isShiftEnded = (currentTime, endTime, overnight) => {
  if (overnight) {
    // shift malam — ended kalau currentTime sudah lewat endTime keesokan harinya
    // simpelnya: kalau currentTime < startTime berarti sudah pagi = shift selesai
    return currentTime >= endTime && currentTime < "12:00"
  }
  return currentTime > endTime
}

// tentukan status: present atau late
const determineStatus = (checkInTime, shiftStartTime, lateTolerance) => {
  const checkInMinutes = timeToMinutes(checkInTime);
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  const toleranceMinutes = lateTolerance ?? 15; // 0 = tanpa toleransi

  // check in jam 08.10 <  08.00 + 30
  return checkInMinutes <= shiftStartMinutes + toleranceMinutes
    ? "present"
    : "late";
};

// format menit ke "Xh Ym"
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

// get current time "HH:mm" — selalu WIB, tidak tergantung timezone server
// en-GB supaya pemisahnya ":" (id-ID menghasilkan "08.05" dan merusak timeToMinutes)
const getCurrentTime = () => {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  }); // contoh: "08:05"
};

// get current date "YYYY-MM-DD"
const getCurrentDate = () => {
  return new Date()
    .toLocaleDateString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Jakarta",
    })
    .split("/")
    .reverse()
    .join("-");
};

// tahun berjalan (WIB)
const getCurrentYear = () => Number(getCurrentDate().slice(0, 4));

// geser tanggal "YYYY-MM-DD" sekian hari
const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

module.exports = {
  timeToMinutes,
  calcWorkDuration,
  determineStatus,
  formatDuration,
  getCurrentTime,
  getCurrentDate,
  getCurrentYear,
  addDays,
};