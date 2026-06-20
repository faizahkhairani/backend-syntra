require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("./database");

const seed = async () => {
  try {
    await connectDB();

    // hapus admin lama biar ga duplicate
    await User.deleteMany({ email: "admin@petshop.com" });

    // buat admin baru (password akan otomatis di-hash dari pre("save"))
    const admin = await User.create({
      name: "Admin",
      email: "admin@petshop.com",
      password: "admin123", // 🔥 auto hash dari schema
      role: "admin",
      department: "HR",
      phone: "08123456789",
    });

    console.log("✅ Admin seeded:");
    console.log({
      email: admin.email,
      password: "admin123", // hanya untuk info
    });

    process.exit();
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seed();