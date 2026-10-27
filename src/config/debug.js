require("dotenv").config()
const mongoose = require("mongoose")
const User = require("../models/User")
const connectDB = require("./database")

const debug = async () => {
  await connectDB()

  console.log("Database       :", mongoose.connection.name)
  console.log("Collection User:", User.collection.name)

  const collections = await mongoose.connection.db.listCollections().toArray()
  console.log("Semua collection:", collections.map((c) => c.name))

  const users = await User.find({}, "name email role")
  console.log("Isi users:", users)

  process.exit()
}

debug()