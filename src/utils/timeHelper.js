// proses absensi dari check-in → check-out → hitung durasi → tentuin status
// konversi "HH:mm" ke menit sejak tengah malam
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}; // fungsi untuk ngubah jam menjadi menit
// contoh -> 08:00 = 480 menit

// hitung durasi kerja dalam menit (handle overnight)
const calcWorkDuration = (checkInTime, checkOutTime, overnight) => {
  const inMinutes = timeToMinutes(checkInTime);
  const outMinutes = timeToMinutes(checkOutTime);

  if (overnight && outMinutes < inMinutes) {
    // misal masuk 21:00 (1260 menit), keluar 08:00 (480 menit)
    return 1440 - inMinutes + outMinutes; // 1440 = total menit sehari
    // = (1440 - 1260) + 480
    // = 180 + 480
    // = 660 menit (11 jam)
  }

  return outMinutes - inMinutes;
};

// tentukan status: present atau late
const determineStatus = (checkInTime, shiftStartTime, lateTolerance) => {
  const checkInMinutes = timeToMinutes(checkInTime);
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  const toleranceMinutes = lateTolerance || 30;

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

// get current time "HH:mm"
// const getCurrentTime = () => {
//   return new Date().toLocaleTimeString("id-ID", {
//     hour: "2-digit",
//     minute: "2-digit",
//     hour12: false,
//     timeZone: "Asia/Jakarta",
//   });
// };

const getCurrentTime = () => {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`; // contoh: "08:05"
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

module.exports = {
  timeToMinutes,
  calcWorkDuration,
  determineStatus,
  formatDuration,
  getCurrentTime,
  getCurrentDate,
};