document.addEventListener("DOMContentLoaded", () => {
  // Initialize socket.io
  const socket = io();

  // DOM Elements
  const countdownTimeElement = document.getElementById("countdown-time");
  const countdownPathElement = document.getElementById("countdown-path");
  const startButton = document.getElementById("timer-start");
  const stopButton = document.getElementById("timer-stop");
  const resetButton = document.getElementById("timer-reset");
  const presetButtons = document.querySelectorAll(".preset-button");
  const customTimeInput = document.getElementById("custom-time-input");
  const muteButtons = document.querySelectorAll(".mute-button");
  const progressBar = document.getElementById("current-amount");
  const raisedLabel = document.getElementById("current-raised");
  const goalLabel = document.getElementById("total-goal");
  const milestonesContainer = document.getElementById("milestones-container");
  const progressPercentageLabel = document.getElementById(
    "progress-percentage"
  );

  // Variables
  let originalTime = 60;
  let remainingTime = originalTime;
  let isRunning = false;
  let lastUpdateTime = Date.now();
  let totalGoal = 5000; // Default goal
  let currentAmount = 0;

  // Helper functions for timer and pie chart
  const updateTimerDisplay = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    countdownTimeElement.textContent = `${minutes}:${
      seconds < 10 ? "0" : ""
    }${seconds}`;
  };

  const updatePieChart = (time, startTime) => {
    const cx = 200,
      cy = 200,
      radius = 190;
    const percentage = time / startTime;
    const endAngle = percentage * 360;
    const start = polarToCartesian(cx, cy, radius, 0);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = endAngle <= 180 ? "0" : "1";
    const d = [
      "M",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      1,
      end.x,
      end.y,
      "L",
      cx,
      cy,
      "Z",
    ].join(" ");
    countdownPathElement.setAttribute("d", d);
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const syncTimerUpdate = () => {
    if (isRunning) {
      const now = Date.now();
      const delta = (now - lastUpdateTime) / 1000;
      remainingTime = Math.max(0, remainingTime - delta);
      lastUpdateTime = now;
      updateTimerDisplay(remainingTime);
      updatePieChart(remainingTime, originalTime);
      if (remainingTime > 0) {
        requestAnimationFrame(syncTimerUpdate);
      } else {
        isRunning = false;
      }
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    fetch("/current-donations")
      .then((response) => response.json())
      .then((data) => {
        currentAmount = parseFloat(data.total);
        totalGoal = parseFloat(data.goal); // Set the total goal from the JSON

        if (!isNaN(currentAmount) && !isNaN(totalGoal)) {
          fetchMilestones(totalGoal); // Fetch milestones and pass the overall goal to update the progress bar
        }
      })
      .catch((error) => {
        console.error("Error fetching current donations:", error);
      });
  });

  function updateProgressBar(currentAmount, milestones, overallGoal) {
    let previousMilestone = { amount: 0 }; // Default to 0 if no previous milestone
    let nextMilestone = null;

    // Ensure currentAmount and milestones are properly parsed and checked
    currentAmount = parseFloat(currentAmount) || 0;
    overallGoal = parseFloat(overallGoal) || 0;

    // Find the previous and next milestone
    for (let i = 0; i < milestones.length; i++) {
      if (currentAmount >= milestones[i].amount) {
        previousMilestone = milestones[i];
      } else {
        nextMilestone = milestones[i];
        break;
      }
    }

    // If there's no next milestone, set it to the overall goal
    if (!nextMilestone) {
      nextMilestone = { name: "Final Goal", amount: overallGoal };
    }

    const milestoneRange =
      parseFloat(nextMilestone.amount) - parseFloat(previousMilestone.amount);
    const progressInRange =
      currentAmount - parseFloat(previousMilestone.amount);
    const progressPercentage = (progressInRange / milestoneRange) * 100;

    const nextMilestonePercentage = Math.floor(
      (progressInRange / milestoneRange) * 100
    );
    
    progressPercentageLabel.textContent = `${nextMilestonePercentage}%`;

    // Ensure valid percentage for progress
    const progressBar = document.getElementById("current-amount");
    progressBar.style.width = `${Math.min(
      Math.max(progressPercentage, 0),
      100
    )}%`;

    // Safely format the amounts
    const formattedCurrentAmount = currentAmount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    const formattedPreviousMilestone = parseFloat(
      previousMilestone.amount
    ).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formattedNextMilestone = parseFloat(
      nextMilestone.amount
    ).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const formattedOverallGoal = overallGoal.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    // Split dollar sign and amount into separate spans for styling
    const splitDollarValue = (formattedValue) => {
      return `<span class="dollar-sign">$</span><span class="value">${formattedValue.slice(
        1
      )}</span>`;
    };

    // Update the text inside the progress bar and labels with the split dollar value
    progressBar.innerHTML = splitDollarValue(formattedCurrentAmount);
    document.getElementById("current-raised").innerHTML = splitDollarValue(
      formattedCurrentAmount
    );
    document.getElementById("current-milestone-raised").innerHTML =
      splitDollarValue(formattedNextMilestone);

    // Update the goal label with the overall goal
    document.getElementById("total-goal").innerHTML =
      splitDollarValue(formattedOverallGoal);
  }

  // Handle live updates when a new donation arrives
  socket.on("newDonation", (data) => {
    const newTotalAmount = parseFloat(data.amount);

    if (!isNaN(newTotalAmount)) {
      currentAmount = newTotalAmount; // Replace the current total with the new amount from the server

      // Fetch the latest milestones and update the progress bar
      fetch("/milestones")
        .then((response) => response.json())
        .then((milestones) => {
          updateProgressBar(currentAmount, milestones, totalGoal); // Call with the latest data
        })
        .catch((error) => {
          console.error("Error fetching milestones:", error);
        });
    }
  });

  function fetchMilestones(overallGoal) {
    fetch("/milestones") // Fetch milestones from the server
      .then((response) => response.json())
      .then((milestones) => {
        updateProgressBar(currentAmount, milestones, overallGoal); // Update the progress bar based on milestones
      })
      .catch((error) => {
        console.error("Error fetching milestones:", error);
      });
  }

  // Listen for the 'goalUpdate' event emitted from the server
  socket.on("goalUpdate", (data) => {
    const newGoal = parseFloat(data.newGoal);

    if (!isNaN(newGoal)) {
      totalGoal = newGoal; // Update the goal amount variable
      goalLabel.textContent = `$${totalGoal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}`; // Update the displayed goal
      updateProgressBar(currentAmount, totalGoal); // Update the progress bar based on new goal
    }
  });

  // Listen for new donation updates and replace the current amount
  socket.on("newDonation", (data) => {
    const newTotalAmount = parseFloat(data.amount);

    if (!isNaN(newTotalAmount)) {
      currentAmount = newTotalAmount; // Replace the current total with the new amount from the server
      updateProgressBar(currentAmount, totalGoal);
    }
  });

  // Timer-related socket events
  socket.on("initData", (data) => {
    if (data.timer) {
      ({
        remainingTime,
        isRunning,
        lastSelectedTime: originalTime,
      } = data.timer);
      updateTimerDisplay(remainingTime);
      updatePieChart(remainingTime, originalTime);
      if (isRunning) requestAnimationFrame(syncTimerUpdate);
    }

    // Initialize mute buttons and player names
    Object.keys(data.players).forEach((playerId) => {
      const playerData = data.players[playerId];
      const muteButton = document.querySelector(
        `#mute-button-${playerId} .mute-button`
      );
      const namePanel = document.querySelector(`#name-panel-${playerId}`);

      if (muteButton && namePanel) {
        muteButton.classList.toggle("active", playerData.muted);
        namePanel.classList.toggle("muted", playerData.muted);
      }

      const nameText = namePanel.querySelector(".name-text");
      if (nameText) nameText.textContent = playerData.name;
    });
  });

  socket.on("timerUpdate", (timerData) => {
    ({ remainingTime, isRunning, lastSelectedTime: originalTime } = timerData);
    lastUpdateTime = Date.now();
    updateTimerDisplay(remainingTime);
    updatePieChart(remainingTime, originalTime);
    if (isRunning) requestAnimationFrame(syncTimerUpdate);
  });

  socket.on("updateMute", (data) => {
    const muteButton = document.querySelector(
      `#mute-button-${data.player} .mute-button`
    );
    const namePanel = document.querySelector(`#name-panel-${data.player}`);
    if (muteButton && namePanel) {
      muteButton.classList.toggle("active", data.muted);
      namePanel.classList.toggle("muted", data.muted);
    }
  });

  // Button event listeners for the timer
  startButton.addEventListener("click", () =>
    socket.emit("startTimer", { remainingTime })
  );
  stopButton.addEventListener("click", () => socket.emit("pauseTimer"));
  resetButton.addEventListener("click", () => socket.emit("resetTimer"));

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const time = parseInt(button.getAttribute("data-time"));
      originalTime = time;
      remainingTime = time;
      updateTimerDisplay(time);
      updatePieChart(time, time);
      socket.emit("resetTimer");
    });
  });

  customTimeInput.addEventListener("click", () => {
    const userInput = prompt("Enter custom time in MM:SS format:", "01:00");
    if (userInput) {
      const [minutes, seconds] = userInput.split(":").map(Number);
      if (
        !isNaN(minutes) &&
        !isNaN(seconds) &&
        minutes >= 0 &&
        seconds >= 0 &&
        seconds < 60
      ) {
        const customTime = minutes * 60 + seconds;
        originalTime = customTime;
        remainingTime = customTime;
        updateTimerDisplay(customTime);
        updatePieChart(customTime, customTime);
      } else {
        alert("Invalid time format. Please enter time in MM:SS format.");
      }
    }
  });

  // Mute button event listeners
  muteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.getAttribute("data-player");
      const isMuted = button.classList.toggle("active");
      const namePanel = document.querySelector(`#name-panel-${playerId}`);
      if (namePanel) namePanel.classList.toggle("muted", isMuted);
      socket.emit("muteUpdate", { player: playerId, muted: isMuted });
    });
  });
});
