// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import "./App.css";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "client")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const usersInRoom = {};

// Store meeting schedules (in-memory or use DB)
const meetingSchedules = [];

io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  socket.on("join-room", (roomID, username) => {
    socket.join(roomID);
    socket.data = { roomID, username };

    usersInRoom[roomID] = usersInRoom[roomID] || {};
    usersInRoom[roomID][socket.id] = username;

    // Notify others with animation trigger
    socket.to(roomID).emit("user-connected", {
      userID: socket.id,
      username,
      animated: true,
    });

    // Send back current users to new one
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

  socket.on("notification", ({ message, roomID }) => {
    io.to(roomID).emit("notification", { message });
  });

  socket.on("schedule-meeting", ({ date, topic, host }) => {
    meetingSchedules.push({ date, topic, host });
    io.emit("meeting-scheduled", { date, topic, host });
  });

  socket.on("signal", ({ userToSignal, callerID, signal, username }) => {
    io.to(userToSignal).emit("signal", {
      from: callerID,
      signal,
      username,
    });
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
      username: socket.data.username,
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
      username: socket.data.username,
    });
  });

  socket.on("disconnecting", () => {
    const rooms = socket.rooms;
    for (const roomID of rooms) {
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

// Endpoint to get all scheduled meetings (Optional)
app.get("/api/meetings", (req, res) => {
  res.json(meetingSchedules);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

const usersInRoom = {};

io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  socket.on("join-room", (roomID, username) => {
    socket.join(roomID);
    usersInRoom[roomID] = usersInRoom[roomID] || {};
    usersInRoom[roomID][socket.id] = username;

    // Notify others in room
    socket.to(roomID).emit("user-connected", {
      userID: socket.id,
      username,
    });

    socket.on("create-breakout", ({ breakoutID, users }) => {
      users.forEach((userID) => {
        io.to(userID).emit("assigned-to-breakout", breakoutID);
      });
    });

    socket.on("return-to-main", () => {
      socket.leave(socket.roomID);
      socket.join("main-room"); // or save original room
      socket.roomID = "main-room";
    });

    // Notify new user about existing users
    Object.entries(usersInRoom[roomID]).forEach(([id, name]) => {
      if (id !== socket.id) {
        socket.emit("user-connected", { userID: id, username: name });
      }
    });

    io.to(roomID).emit("update-users", Object.values(usersInRoom[roomID]));
  });

  socket.on("signal", ({ userToSignal, callerID, signal, username }) => {
    io.to(userToSignal).emit("signal", {
      from: callerID,
      signal,
      username,
    });
  });

  socket.on("chat-message", (msg) => {
    const { roomID } = msg;
    io.to(roomID).emit("chat-message", msg);
  });

  socket.on("send-file", ({ fileName, fileData, username, roomID }) => {
    // Relay to all in room
    io.to(roomID).emit("receive-file", { fileName, fileData, username });
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

    socket.on("disconnect", () => {
      socket.to(socket.roomID).emit("user-disconnected", socket.id);
    });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomID, username) => {
    socket.join(roomID);
    socket.data = { roomID, username };
    io.to(roomID).emit("user-connected", { userID: socket.id, username });
  });

  socket.on("join-breakout", (breakoutID) => {
    const oldRoom = socket.data.roomID;
    socket.leave(oldRoom);
    socket.join(breakoutID);
    socket.data.roomID = breakoutID;
    io.to(oldRoom).emit("user-disconnected", socket.id);
    io.to(breakoutID).emit("user-connected", {
      userID: socket.id,
      username: socket.data.username,
    });
  });
});


const startRecording = () => {
  const stream = userVideo.current.srcObject;
  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
  };

  mediaRecorder.start();

  setTimeout(() => mediaRecorder.stop(), 10000); // Auto-stop after 10 sec
};


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
