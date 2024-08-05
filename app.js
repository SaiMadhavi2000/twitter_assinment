const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.Mongo_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

// Tweet schema and model
const tweetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Tweet = mongoose.model("Tweet", tweetSchema);

// Authentication middleware
const auth = (req, res, next) => {
  const token = req.header("Authorization").replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, "your_jwt_secret");
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// User registration
app.post("/api/users/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ message: "User registered successfully" });
});

// User login
app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user._id }, "your_jwt_secret");
  res.status(200).json({ token });
});

// Post a tweet
app.post("/api/tweets", auth, async (req, res) => {
  const { text } = req.body;
  const newTweet = new Tweet({ userId: req.user.userId, text });
  await newTweet.save();
  res.status(201).json(newTweet);
});

// Fetch user timeline
app.get("/api/users/:userId/timeline", async (req, res) => {
  const { userId } = req.params;
  const tweets = await Tweet.find({ userId }).sort({ createdAt: -1 });
  res.status(200).json(tweets);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Not Found" });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
