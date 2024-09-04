require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use environment variables for host and port
const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Initialize data from a JSON file or set default values
let data = {};
const dataFile = "scores.json";

try {
  data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!data.players) {
    data.players = {
      1: { name: "Name 1", muted: false },
      2: { name: "Name 2", muted: false },
      3: { name: "Name 3", muted: false },
      4: { name: "Name 4", muted: false },
      5: { name: "Name 5", muted: false },
    };
  }
  if (!data.scores) {
    data.scores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
  if (!data.timer) {
    data.timer = { remainingTime: 60, isRunning: false, startTimestamp: null, lastSelectedTime: 60 };
  }
} catch (err) {
  data = {
    players: {
      1: { name: "Name 1", muted: false },
      2: { name: "Name 2", muted: false },
      3: { name: "Name 3", muted: false },
      4: { name: "Name 4", muted: false },
      5: { name: "Name 5", muted: false },
    },
    scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    timer: { remainingTime: 60, isRunning: false, startTimestamp: null, lastSelectedTime: 60 },
  };
}

// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.emit('initData', data);

  socket.on("scoreUpdate", (update) => {
    data.scores[update.panel] = update.score;

    io.emit("updateScore", update);
    saveDataToFile();
  });

  socket.on("muteUpdate", (update) => {
    const playerId = update.player;
    const isMuted = update.muted;

    if (data.players && data.players[playerId]) {
      data.players[playerId].muted = isMuted;
      io.emit("updateMute", { player: playerId, muted: isMuted });
      saveDataToFile();
    }
  });

  socket.on("nameUpdate", (update) => {
    const playerId = update.playerId;
    const playerName = update.name;

    if (data.players && data.players[playerId]) {
      data.players[playerId].name = playerName;
      io.emit("updateName", { playerId, name: playerName });
      saveDataToFile();
    }
  });

  socket.on("startTimer", (timerData) => {
    if (!data.timer.isRunning) {
      data.timer.isRunning = true;
      data.timer.startTimestamp = Date.now();
      data.timer.remainingTime = timerData.remainingTime;
      data.timer.lastSelectedTime = timerData.remainingTime; // Update last selected time on start

      io.emit("timerUpdate", data.timer);

      updateTimer();
    }
  });

  socket.on("pauseTimer", () => {
    if (data.timer.isRunning) {
      data.timer.isRunning = false;
      const elapsedTime = (Date.now() - data.timer.startTimestamp) / 1000;
      data.timer.remainingTime = Math.max(0, data.timer.remainingTime - elapsedTime);
      io.emit("timerUpdate", data.timer);
      saveDataToFile();
    }
  });

  socket.on("resetTimer", () => {
    data.timer.isRunning = false;
    data.timer.remainingTime = data.timer.lastSelectedTime; // Reset to the last selected time
    io.emit("timerUpdate", data.timer);
    saveDataToFile();
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

function saveDataToFile() {
  fs.writeFile(dataFile, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error("Error writing data to file:", err);
    } else {
      console.log("Data saved successfully");
    }
  });
}

function updateTimer() {
  if (data.timer.isRunning) {
    const elapsedTime = (Date.now() - data.timer.startTimestamp) / 1000;
    data.timer.remainingTime = Math.max(0, data.timer.remainingTime - elapsedTime);
    data.timer.startTimestamp = Date.now();

    io.emit("timerUpdate", data.timer);

    if (data.timer.remainingTime > 0) {
      setTimeout(updateTimer, 1000);
    } else {
      data.timer.isRunning = false;
      saveDataToFile();
    }
  }
}

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
