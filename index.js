const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
dotenv.config();

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose Schemas and Models
const userSchema = new mongoose.Schema({
  supabaseId: String,
  email: String,
  // other user information if needed
});

const todoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  completed: Boolean,
});

const sessionSchema = new mongoose.Schema({
  userId: String,
  loginTime: Date,
  logoutTime: Date,
  ipAddress: String,
});

const User = mongoose.model("User", userSchema);
const Todo = mongoose.model("Todo", todoSchema);
const Session = mongoose.model("Session", sessionSchema);

// Middleware
app.use(express.json());

// Middleware for authentication and authorization
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token provided" });

  try {
    const { user, error } = await supabase.auth.getUser(token);
    if (error) return res.status(401).json({ message: "Invalid token" });

    req.userId = user.id;
    next();
  } catch (err) {
    res.status(500).json({ message: "Failed to authenticate token" });
  }
};

// API Endpoints

// Register a new user

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { user, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    const newUser = new User({ supabaseId: user.id, email });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    res.status(500).json({ message: "User registration failed" });
  }
});

// Log in an existing user and create a session
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { session, error } = await supabase.auth.signIn({ email, password });
    if (error) return res.status(400).json({ error: error.message });
git
    const newSession = new Session({
      userId: session.user.id,
      loginTime: new Date(),
      ipAddress: req.ip,
    });
    await newSession.save();

    const token = jwt.sign({ id: session.user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "User logged in successfully", token });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// Create a new to-do item
app.post("/todo", authenticate, async (req, res) => {
  const { text, completed } = req.body;

  try {
    const newTodo = new Todo({
      user: req.userId,
      text,
      completed,
    });
    await newTodo.save();

    res
      .status(201)
      .json({ message: "To-do item created successfully", todo: newTodo });
  } catch (err) {
    res.status(500).json({ message: "Failed to create to-do item" });
  }
});

// Retrieve all to-do items for the logged-in user

app.get("/todos", authenticate, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.userId });
    res.status(200).json({ todos });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve to-do items" });
  }
});

// Update a to-do item by ID
app.put("/todos/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body;

  try {
    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      { text, completed },
      { new: true, runValidators: true }
    );
    if (!updatedTodo)
      return res.status(404).json({ message: "To-do item not found" });
    if (updatedTodo.user.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });

    res
      .status(200)
      .json({ message: "To-do item updated successfully", todo: updatedTodo });
  } catch (err) {
    res.status(500).json({ message: "Failed to update to-do item" });
  }
});

// Delete a to-do item by ID
app.delete("/todos/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedTodo = await Todo.findByIdAndDelete(id);
    if (!deletedTodo)
      return res.status(404).json({ message: "To-do item not found" });
    if (deletedTodo.user.toString() !== req.userId)
      return res.status(403).json({ message: "Not authorized" });

    res.status(200).json({ message: "To-do item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete to-do item" });
  }
});

// Retrieve all user sessions
app.get("/sessions", async (req, res) => {
  try {
    const sessions = await Session.find();
    res.status(200).json({ sessions });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve sessions" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});