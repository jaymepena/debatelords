require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const axios = require("axios");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const path = require("path");

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;
const clientId = process.env.TILTIFY_CLIENT_ID;
const clientSecret = process.env.TILTIFY_CLIENT_SECRET;
const campaignId = process.env.TILTIFY_CAMPAIGN_ID;
const donosLastMins = 60;
const timeToCheck = 60;

app.use(express.static("public"));

// Helper function to get OAuth token
async function getOAuthToken() {
  try {
    const response = await axios.post("https://v5api.tiltify.com/oauth/token", {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    accessToken = response.data.access_token;
    console.log("OAuth token acquired:", accessToken);

    // Refresh the token when it expires
    setTimeout(getOAuthToken, (response.data.expires_in - 60) * 1000); // refresh 1 minute before expiry
  } catch (error) {
    console.error("Error fetching OAuth token:", error);
  }
}

app.get("/milestones", async (req, res) => {
  try {
    const response = await axios.get(
      `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/milestones`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const milestones = response.data.data.map((milestone) => ({
      name: milestone.name,
      amount: parseFloat(milestone.amount.value),
    }));

    res.json(milestones);
  } catch (error) {
    console.error("Error fetching milestones:", error);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

app.get("/campaign-id", (req, res) => {
  res.json({ campaignId: process.env.TILTIFY_CAMPAIGN_ID });
});

let accessToken = null;
let currentAmount = 0;
let donationGoal = 0;
const donationFile = "donations.json";

// Debounce helper to delay actions (prevents multiple triggers during file edits)
let debounceTimeout = null;
const debounce = (func, delay) => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(func, delay);
};

const loadDonations = () => {
  try {
    if (fs.existsSync(donationFile)) {
      const savedData = fs.readFileSync(donationFile, "utf-8");
      const parsedData = JSON.parse(savedData);
      currentAmount = parsedData.total || 0;
      donationGoal = parsedData.goal || 5000;
      console.log(
        `Loaded donations: $${currentAmount}, Goal: $${donationGoal}`
      );
    }
  } catch (error) {
    console.error("Error reading or parsing donations.json:", error.message);
  }
};

// Call it once when the server starts
loadDonations();

app.get("/current-donations", (req, res) => {
  res.json({ total: currentAmount, goal: donationGoal });
});

// Watch for changes to the donations.json file with debounce and error handling
fs.watch(donationFile, (eventType) => {
  if (eventType === "change") {
    debounce(() => {
      loadDonations(); // Load new total and goal from the file
      io.emit("goalUpdate", { newGoal: donationGoal });
      io.emit("newDonation", { amount: currentAmount });
    }, 500); // 500ms delay to ensure file is fully written
  }
});

// Load existing donations and goal from the file (if it exists)
if (fs.existsSync(donationFile)) {
  const savedData = JSON.parse(fs.readFileSync(donationFile, "utf-8"));
  currentAmount = savedData.total || 0; // Set the new total directly
  donationGoal = savedData.goal || 5000; // Set the new goal directly
  console.log(
    `Loaded total donations: $${currentAmount}, goal: $${donationGoal}`
  );
} else {
  console.log("No existing donations file found, starting fresh.");
}

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Function to load data from JSON file for the scores
function loadData() {
  const dataFile = "scores.json";
  let data = {};

  try {
    // Load existing data from scores.json
    data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    // Ensure default structures exist
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
      data.timer = {
        remainingTime: 60,
        isRunning: false,
        startTimestamp: null,
        lastSelectedTime: 60,
      };
    }
  } catch (err) {
    console.error("Error reading scores.json:", err);
    data = {
      players: {
        1: { name: "Name 1", muted: false },
        2: { name: "Name 2", muted: false },
        3: { name: "Name 3", muted: false },
        4: { name: "Name 4", muted: false },
        5: { name: "Name 5", muted: false },
      },
      scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      timer: {
        remainingTime: 60,
        isRunning: false,
        startTimestamp: null,
        lastSelectedTime: 60,
      },
    };
  }
  return data;
}

/**
 * I had to Google what to do for the
 * broken scores/mutes and it says I was doing a "shallow merge",
 * or only merging the top-level properties of objects. So here you go,
 * enjoy the deepMerge, the function that will update changes
 * to the scores, players, or mutes and not the unassociated things.
 * Shallow Merge - overwrite the entire object
 * Deep Merge - overwrite specific portions of the scores.json
 */
function deepMerge(target, source) {
  for (let key in source) {
    if (source[key] && typeof source[key] === "object") {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

io.on("connection", (socket) => {
  console.log("A user connected");

  let data = loadData();
  socket.emit("initData", data);

  socket.on("scoreUpdate", (update) => {
    if (data.scores && data.scores[update.panel] !== undefined) {
      data.scores[update.panel] = update.score;

      io.emit("updateScore", update);

      savePartialDataToFile({ scores: data.scores });
    } else {
      console.error("Score update error: Invalid panel or score data");
    }
  });

  socket.on("muteUpdate", (update) => {
    const playerId = update.player;

    if (data.players && data.players[playerId]) {
      data.players[playerId].muted = update.muted;

      io.emit("updateMute", { player: playerId, muted: update.muted });

      savePartialDataToFile({ players: data.players });
    } else {
      console.error("Mute update error: Invalid player data");
    }
  });

  socket.on("nameUpdate", (update) => {
    const playerId = update.playerId;
    const playerName = update.name;

    if (data.players && data.players[playerId]) {
      data.players[playerId].name = playerName;

      io.emit("updateName", { playerId, name: playerName });

      savePartialDataToFile({ players: data.players });
    }
  });

  function updateTimer(data) {
    if (data.timer.isRunning) {
      const elapsedTime = (Date.now() - data.timer.startTimestamp) / 1000;
      data.timer.remainingTime = Math.max(
        0,
        data.timer.remainingTime - elapsedTime
      );
      data.timer.startTimestamp = Date.now();

      io.emit("timerUpdate", data.timer);

      savePartialDataToFile(data);

      if (data.timer.remainingTime > 0) {
        setTimeout(() => updateTimer(data), 1000);
      } else {
        data.timer.isRunning = false;
        savePartialDataToFile(data);
      }
    }
  }

  socket.on("startTimer", (timerData) => {
    if (!data.timer.isRunning) {
      data.timer.isRunning = true;
      data.timer.startTimestamp = Date.now();
      data.timer.remainingTime = timerData.remainingTime;
      data.timer.lastSelectedTime = timerData.remainingTime;

      io.emit("timerUpdate", data.timer);
      updateTimer(data);
    }
  });

  socket.on("pauseTimer", () => {
    if (data.timer.isRunning) {
      data.timer.isRunning = false;
      const elapsedTime = (Date.now() - data.timer.startTimestamp) / 1000;
      data.timer.remainingTime = Math.max(
        0,
        data.timer.remainingTime - elapsedTime
      );

      io.emit("timerUpdate", data.timer); // Emit the updated timer state
      savePartialDataToFile(data);
    }
  });

  socket.on("resetTimer", () => {
    data.timer.isRunning = false;
    data.timer.remainingTime = data.timer.lastSelectedTime;

    io.emit("timerUpdate", data.timer);
    savePartialDataToFile(data);
  });

  function savePartialDataToFile(updatedData) {
    const dataFile = "scores.json";
    try {
      const currentData = loadData();
      const mergedData = deepMerge(currentData, updatedData);

      fs.writeFileSync(dataFile, JSON.stringify(mergedData, null, 2));
      console.log("Data saved successfully");
    } catch (err) {
      console.error("Error writing data to file:", err);
    }
  }
});

// Function to handle donations from Tiltify webhook
// Fetch the campaign total on a timer (e.g., every 60 seconds)
async function fetchCurrentTotal() {
  try {
    const response = await axios.get(
      `https://v5api.tiltify.com/api/public/campaigns/${campaignId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const amountRaised = parseFloat(response.data.data.amount_raised.value);
    donationGoal = parseFloat(response.data.data.goal.value);
    console.log(`Total amount raised: $${amountRaised}`);
    console.log(`Goal: $${donationGoal}`);

    if (amountRaised !== currentAmount) {
      currentAmount = amountRaised;

      // Save updated total amount to the file
      fs.writeFileSync(
        donationFile,
        JSON.stringify({ total: currentAmount, goal: donationGoal }, null, 2)
      );

      // Notify clients of the new total amount
      io.emit("newDonation", { amount: currentAmount });
    }
  } catch (error) {
    console.error(
      "Error fetching current total from Tiltify:",
      error.response ? error.response.data : error.message
    );
  }
}

// Set up a recurring check every 3 seconds
setInterval(fetchCurrentTotal, 3 * 1000); // 60,000 ms = 60 seconds

async function getMilestones() {
  try {
    const response = await axios.get(
      `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/milestones`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log("Full milestones response:", response.data);

    const milestones = response.data.data.map((milestone) => ({
      ...milestone,
      amount: parseFloat(milestone.amount.value),
    }));

    return milestones;
  } catch (error) {
    console.error(
      "Error fetching milestones data:",
      error.response ? error.response.data : error.message
    );
    return []; // Return empty array on error
  }
}

// Function to get top donations data
async function getTopDonators() {
  try {
    const oneHourAgo = new Date(
      Date.now() - donosLastMins * timeToCheck * 1000
    ).toISOString();

    const response = await axios.get(
      `https://v5api.tiltify.com/api/public/campaigns/${campaignId}/donations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const donations = response.data.data;

    if (!donations) {
      console.error("No donations found");
      return [];
    }

    // Extract amount from the nested object
    const recentDonations = donations
      .map((donation) => {
        const amount = donation.amount?.value; // Adjust based on the exact structure of the amount object
        return {
          ...donation,
          amount: amount ? parseFloat(amount) : 0, // Ensure amount is a number
        };
      })
      .filter(
        (donation) => new Date(donation.created_at) > new Date(oneHourAgo)
      );

    const topDonators = recentDonations
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((donation) => ({
        donor_name: donation.donor_name,
        amount: donation.amount,
        donor_comment: donation.donor_comment || "null",
        completed_at: donation.completed_at,
      }));

    console.log("Top 5 Donators in the last hour:");
    topDonators.forEach((donor) => {
      console.log(`- ${donor.donor_name}: $${donor.amount}`);
    });

    return topDonators;
  } catch (error) {
    console.error(
      "Error fetching donations:",
      error.response ? error.response.data : error.message
    );
    return []; // Return empty array on error
  }
}

// Endpoint to fetch campaign data, milestones, and top donators
app.get("/campaign", async (req, res) => {
  try {
    const milestones = await getMilestones();
    const topDonators = await getTopDonators();
    const sortedMilestones = milestones.sort((a, b) => a.amount - b.amount); // Sort by milestone amount
    const currentMilestone = sortedMilestones
      .filter((m) => m.amount <= currentAmount)
      .slice(-1)[0]; // Get the most recent milestone
    const nextMilestone = sortedMilestones.find(
      (m) => m.amount > currentAmount
    ); // Get the next milestone
    res.json({
      currentAmount,
      currentMilestone: currentMilestone || null,
      nextMilestone: nextMilestone || null,
      topDonators: topDonators || [],
    });
  } catch (error) {
    console.error("Error fetching campaign data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server and acquire the initial OAuth token
server.listen(PORT, HOST, async () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  await getOAuthToken(); // Fetch OAuth token on server start
  fetchCurrentTotal()
});
