import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @POST /api/auth/register — admin only
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department, phone } = req.body; // ← tambah field

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error("Email already exists");
      error.statusCode = 409;
      throw error;
    }

    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password,
      role,        // ← "admin" | "employee"
      department,  // ← divisi/bagian
      phone,       // ← nomor hp
    });

    // register tidak perlu return token
    // admin yang buat akun, bukan si user itu sendiri yang langsung login
    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });

  } catch (error) {
    next(error);
  }
};

// @POST /api/auth/login
// export const login = async (req, res, next) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       const error = new Error("Invalid email or password");
//       error.statusCode = 401;
//       return next(error);
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       const error = new Error("Invalid email or password");
//       error.statusCode = 401;
//       return next(error);
//     }

//     const token = jwt.sign(
//       { userId: user._id, role: user.role }, // ← tambah role di payload
//       JWT_SECRET,
//       { expiresIn: JWT_EXPIRES_IN }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Login successful",
//       data: {
//         token,
//         user: {
//           _id: user._id,
//           name: user.name,
//           email: user.email,
//           role: user.role,       // ← frontend butuh ini untuk routing
//           department: user.department,
//         },
//       },
//     });

//   } catch (error) {
//     next(error);
//   }
// };

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // validasi input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email dan password wajib diisi",
      });
    }

     // cari user + include password (karena select: false)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    // if (!user.password) {
    //   return res.status(500).json({
    //     message: "invalid credential",
    //   });
    // }

    // console.log("EMAIL INPUT:", email);
    // console.log("PASSWORD INPUT:", password);
    // console.log("USER DARI DB:", user);
    // console.log("PASSWORD DI DB:", user.password);

    // const test = await bcrypt.compare("admin123", user.password);
    // console.log("TEST ADMIN123:", test);
     const isPasswordValid = await bcrypt.compare(password, user.password); // bandingin password dari client sama password di db
    //  console.log("HASIL COMPARE:", isPasswordValid);
    if(!isPasswordValid){
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        return next(error);
    }



    // const isMatch = await user.matchPassword(password);

    // if (!isMatch) {
    //   return res.status(400).json({
    //     message: "Password salah",
    //   });
    // }

   res.status(200).json({
      success: true,
      token: generateToken(user._id),
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phone: user.phone
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// @GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
};