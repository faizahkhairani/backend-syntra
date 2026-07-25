const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

const demoGuard = (req, res, next) => {
  if (req.user?.isDemo && !READ_METHODS.includes(req.method)) {
    return res.status(403).json({
      message: "Ini akun demo (read-only). Aksi ini dinonaktifkan untuk menjaga data demo tetap konsisten.",
    });
  }
  next();
};

module.exports = demoGuard;