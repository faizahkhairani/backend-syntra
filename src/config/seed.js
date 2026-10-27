require("dotenv").config()
const connectDB = require("./database")
const User = require("../models/User")

const seed = async () => {
  await connectDB()

  const existing = await User.findOne({ email: "admin@petshop.com" })
  if (existing) {
    console.log("Admin sudah ada, seed dilewati")
    process.exit()
  }

  // pakai create() supaya pre-save hook yang hash password
  await User.create({
    name: "Admin Petshop",
    email: "admin@petshop.com",
    password: "admin42135",
    role: "admin",
    department: "HR",
    phone: "081200000000",
    gender: "Female", // wajib, karena field gender sekarang required
  })

  console.log("Admin dibuat: admin@petshop.com / admin123")
  process.exit()
}

seed().catch((err) => {
  console.error("Seed gagal:", err.message)
  process.exit(1)
})