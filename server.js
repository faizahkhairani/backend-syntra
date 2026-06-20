require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");
const spkRoutes = require('./src/routes/spkRoutes');

app.use('/api/spk', spkRoutes);

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});