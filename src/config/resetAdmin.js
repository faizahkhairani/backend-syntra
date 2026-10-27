require("dotenv").config()
const User = require("../models/User")
const connectDB = require("./database")

const reset = async () => {
  await connectDB()

  const admin = await User.findOne({ email: "admin@petshop.com" })
  if (!admin) {
    console.log("Admin tidak ditemukan")
    process.exit()
  }

  admin.password = "admin123" // pre-save hook yang hash
  await admin.save()

  console.log("Password admin direset ke: admin123")
  process.exit()
}

reset()