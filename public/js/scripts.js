document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const countdownTimeElement = document.getElementById('countdown-time');
  const countdownPathElement = document.getElementById('countdown-path');
  const startButton = document.getElementById('timer-start');
  const stopButton = document.getElementById('timer-stop');
  const resetButton = document.getElementById('timer-reset');
  const presetButtons = document.querySelectorAll('.preset-button');
  const customTimeInput = document.getElementById('custom-time-input');
  const muteButtons = document.querySelectorAll('.mute-button');

  let originalTime = 60;
  let remainingTime = originalTime;
  let isRunning = false;
  let lastUpdateTime = Date.now();

  // Helper functions
  const updateTimerDisplay = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    countdownTimeElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const updatePieChart = (time, startTime) => {
    const cx = 200, cy = 200, radius = 190;
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
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
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

  // Socket event listeners
  socket.on('initData', (data) => {
    if (data.timer) {
      ({ remainingTime, isRunning, lastSelectedTime: originalTime } = data.timer);
      updateTimerDisplay(remainingTime);
      updatePieChart(remainingTime, originalTime);
      if (isRunning) requestAnimationFrame(syncTimerUpdate);
    }

    // Initialize mute buttons and player names
    Object.keys(data.players).forEach(playerId => {
      const playerData = data.players[playerId];
      const muteButton = document.querySelector(`#mute-button-${playerId} .mute-button`);
      const namePanel = document.querySelector(`#name-panel-${playerId}`);

      if (muteButton && namePanel) {
        muteButton.classList.toggle('active', playerData.muted);
        namePanel.classList.toggle('muted', playerData.muted);
      }

      const nameText = namePanel.querySelector('.name-text');
      if (nameText) nameText.textContent = playerData.name;
    });
  });

  socket.on('timerUpdate', (timerData) => {
    ({ remainingTime, isRunning, lastSelectedTime: originalTime } = timerData);
    lastUpdateTime = Date.now();
    updateTimerDisplay(remainingTime);
    updatePieChart(remainingTime, originalTime);
    if (isRunning) requestAnimationFrame(syncTimerUpdate);
  });

  socket.on('updateMute', (data) => {
    const muteButton = document.querySelector(`#mute-button-${data.player} .mute-button`);
    const namePanel = document.querySelector(`#name-panel-${data.player}`);
    if (muteButton && namePanel) {
      muteButton.classList.toggle('active', data.muted);
      namePanel.classList.toggle('muted', data.muted);
    }
  });

  // Button event listeners
  startButton.addEventListener('click', () => socket.emit("startTimer", { remainingTime }));
  stopButton.addEventListener('click', () => socket.emit("pauseTimer"));
  resetButton.addEventListener('click', () => socket.emit("resetTimer"));

  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const time = parseInt(button.getAttribute('data-time'));
      originalTime = time;
      remainingTime = time;
      updateTimerDisplay(time);
      updatePieChart(time, time);
    });
  });

  customTimeInput.addEventListener('click', () => {
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

  // Mute button event listeners
  muteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const playerId = button.getAttribute('data-player');
      const isMuted = button.classList.toggle('active');
      const namePanel = document.querySelector(`#name-panel-${playerId}`);
      if (namePanel) namePanel.classList.toggle('muted', isMuted);
      socket.emit('muteUpdate', { player: playerId, muted: isMuted });
    });
  });
});
