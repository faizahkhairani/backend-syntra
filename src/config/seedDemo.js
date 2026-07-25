// scripts/seedDemo.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

const seedDemo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // hapus demo user lama kalau ada, biar gak duplikat pas dijalanin ulang
    await User.deleteMany({ isDemo: true });

    // JANGAN pre-hash manual di sini — biarin pre("save") hook di model yang hash
    await User.create({
      name: "Demo Admin",
      email: "demo.admin@syntra.app",
      password: "demo123",
      role: "admin",
      isDemo: true,
    });

    await User.create({
      name: "Demo Karyawan",
      email: "demo.karyawan@syntra.app",
      password: "demo123",
      role: "employee",
      isDemo: true,
    });

    console.log("Demo users created");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seedDemo();