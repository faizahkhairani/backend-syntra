const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// tambah di bawah app.use(express.urlencoded...)
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const shiftRoutes = require("./routes/shiftRoutes")
app.use("/api/shifts", shiftRoutes)

const shiftScheduleRoutes = require("./routes/shiftScheduleRoutes");
app.use("/api/shift-schedules", shiftScheduleRoutes);

const attendanceRoutes = require("./routes/attendanceRoutes");
app.use("/api/attendance", attendanceRoutes);

const leaveRoutes = require("./routes/leaveRoutes");
app.use("/api/leaves", leaveRoutes);
// test route
app.get("/", (req, res) => {
  res.json({ message: "Attendance API is running" });
});

app.use(errorHandler);
module.exports = app;