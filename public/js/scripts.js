document.addEventListener('DOMContentLoaded', (event) => {
  const socket = io();
  const countdownTimeElement = document.getElementById('countdown-time');
  const countdownPathElement = document.getElementById('countdown-path');
  const startButton = document.getElementById('timer-start');
  const stopButton = document.getElementById('timer-stop');
  const resetButton = document.getElementById('timer-reset');
  const presetButtons = document.querySelectorAll('.preset-button');
  const customTimeInput = document.getElementById('custom-time-input');
  const muteButtons = document.querySelectorAll('.mute-button'); // Select paths with class 'mute-button'

  let originalTime = 60;
  let remainingTime = originalTime;
  let isRunning = false;
  let lastUpdateTime = Date.now();

  function updateTimerDisplay(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    countdownTimeElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  function updatePieChart(time, startTime) {
    const cx = 200;
    const cy = 200;
    const radius = 190;
    const percentage = time / startTime;

    const endAngle = percentage * 360;
    const start = polarToCartesian(cx, cy, radius, 0);
    const end = polarToCartesian(cx, cy, radius, endAngle);

    const largeArcFlag = endAngle <= 180 ? "0" : "1";

    const d = [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y,
      "L", cx, cy,
      "Z"
    ].join(" ");

    countdownPathElement.setAttribute("d", d);
  }

  function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;

    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  function syncTimerUpdate() {
    if (isRunning) {
      const now = Date.now();
      const delta = (now - lastUpdateTime) / 1000;  // Time in seconds since last update
      remainingTime = Math.max(0, remainingTime - delta);
      lastUpdateTime = now;

      updateTimerDisplay(remainingTime);
      updatePieChart(remainingTime, originalTime);

      if (remainingTime > 0) {
        requestAnimationFrame(syncTimerUpdate);
      } else {
        isRunning = false;  // Stop if the countdown reaches zero
      }
    }
  }

  startButton.addEventListener('click', function() {
    socket.emit("startTimer", { remainingTime });
  });

  stopButton.addEventListener('click', function() {
    socket.emit("pauseTimer");
  });

  resetButton.addEventListener('click', function() {
    socket.emit("resetTimer");
  });

  presetButtons.forEach(button => {
    button.addEventListener('click', function() {
      const time = parseInt(this.getAttribute('data-time'));
      originalTime = time;
      remainingTime = time;
      updateTimerDisplay(time);
      updatePieChart(time, time);
    });
  });

  customTimeInput.addEventListener('click', function() {
    const userInput = prompt("Enter custom time in MM:SS format:", "01:00");
    if (userInput) {
      const [minutes, seconds] = userInput.split(':').map(Number);

      if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
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

  // Initialize mute buttons and other states from server data
  socket.on('initData', (data) => {
    if (data.timer) {
      remainingTime = data.timer.remainingTime;
      isRunning = data.timer.isRunning;
      originalTime = data.timer.lastSelectedTime;  // Sync original time with server's last selected time
      lastUpdateTime = Date.now();
      updateTimerDisplay(remainingTime);
      updatePieChart(remainingTime, originalTime);

      if (isRunning) {
        syncTimerUpdate();
      }
    }

    // Initialize mute buttons and names based on server data
    Object.keys(data.players).forEach(playerId => {
      const playerData = data.players[playerId];
      const muteButton = document.querySelector(`#mute-button-${playerId} .mute-button`);
      const namePanel = document.querySelector(`#name-panel-${playerId}`);

      if (muteButton && namePanel) {
        if (playerData.muted) {
          muteButton.classList.add('active');
          namePanel.classList.add('muted');
        } else {
          muteButton.classList.remove('active');
          namePanel.classList.remove('muted');
        }
      }

      // Set player names directly from JSON data
      const nameText = namePanel.querySelector('.name-text');
      if (nameText) {
        nameText.textContent = playerData.name;  // Display the name
      }
    });
  });

  socket.on('timerUpdate', (timerData) => {
    remainingTime = timerData.remainingTime;
    isRunning = timerData.isRunning;
    originalTime = timerData.lastSelectedTime;  // Sync with server's last selected time
    lastUpdateTime = Date.now();

    updateTimerDisplay(remainingTime);
    updatePieChart(remainingTime, originalTime);

    if (isRunning) {
      syncTimerUpdate();
    }
  });

  // Event listeners for Mute buttons
  muteButtons.forEach(button => {
    button.addEventListener('click', function() {
      const playerId = this.getAttribute('data-player');
      const isMuted = this.classList.toggle('active'); // Toggle active state
      const namePanel = document.querySelector(`#name-panel-${playerId}`);

      if (namePanel) {
        namePanel.classList.toggle('muted', isMuted);
      }

      socket.emit('muteUpdate', { player: playerId, muted: isMuted });
    });
  });

  // Update mute button state from server
  socket.on('updateMute', (data) => {
    const muteButton = document.querySelector(`#mute-button-${data.player} .mute-button`);
    const namePanel = document.querySelector(`#name-panel-${data.player}`);

    if (muteButton && namePanel) {
      if (data.muted) {
        muteButton.classList.add('active');
        namePanel.classList.add('muted');
      } else {
        muteButton.classList.remove('active');
        namePanel.classList.remove('muted');
      }
    }
  });
});
