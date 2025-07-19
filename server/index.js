// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Setup __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express setup
const app = express();
app.use(cors());
app.use(express.json());

// Serve the built React frontend
app.use(express.static(path.join(__dirname, "client/dist")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const usersInRoom = {};
const meetingSchedules = [];

io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  socket.on("join-room", (roomID, username) => {
    socket.join(roomID);
    socket.data = { roomID, username };

    usersInRoom[roomID] = usersInRoom[roomID] || {};
    usersInRoom[roomID][socket.id] = username;

    socket.to(roomID).emit("user-connected", {
      userID: socket.id,
      username,
      animated: true
    });

    Object.entries(usersInRoom[roomID]).forEach(([id, name]) => {
      if (id !== socket.id) {
        socket.emit("user-connected", { userID: id, username: name });
      }
    });

    io.to(roomID).emit("update-users", Object.values(usersInRoom[roomID]));
  });

  socket.on("chat-message", (msg) => {
    io.to(msg.roomID).emit("chat-message", msg);
  });

  socket.on("send-file", ({ fileName, fileData, username, roomID }) => {
    io.to(roomID).emit("receive-file", { fileName, fileData, username });
  });

  socket.on("signal", ({ userToSignal, callerID, signal, username }) => {
    io.to(userToSignal).emit("signal", {
      from: callerID,
      signal,
      username
    });
  });

  socket.on("notification", ({ message, roomID }) => {
    io.to(roomID).emit("notification", { message });
  });

  socket.on("schedule-meeting", ({ date, topic, host }) => {
    meetingSchedules.push({ date, topic, host });
    io.emit("meeting-scheduled", { date, topic, host });
  });

  socket.on("create-breakout", ({ breakoutID, users }) => {
    users.forEach((userID) => {
      io.to(userID).emit("assigned-to-breakout", breakoutID);
    });
  });

  socket.on("join-breakout", (breakoutID) => {
    const oldRoom = socket.data.roomID;
    socket.leave(oldRoom);
    socket.join(breakoutID);
    socket.data.roomID = breakoutID;

    io.to(oldRoom).emit("user-disconnected", socket.id);
    io.to(breakoutID).emit("user-connected", {
      userID: socket.id,
      username: socket.data.username
    });
  });

  socket.on("return-to-main", () => {
    const oldRoom = socket.data.roomID;
    socket.leave(oldRoom);
    socket.join("main-room");
    socket.data.roomID = "main-room";

    io.to(oldRoom).emit("user-disconnected", socket.id);
    io.to("main-room").emit("user-connected", {
      userID: socket.id,
      username: socket.data.username
    });
  });

  socket.on("disconnecting", () => {
    for (const roomID of socket.rooms) {
      if (roomID !== socket.id && usersInRoom[roomID]) {
        delete usersInRoom[roomID][socket.id];
        io.to(roomID).emit("user-disconnected", socket.id);
        io.to(roomID).emit("update-users", Object.values(usersInRoom[roomID]));
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Fallback to serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

// Optional API route
app.get("/api/meetings", (req, res) => {
  res.json(meetingSchedules);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
