document.addEventListener('DOMContentLoaded', (event) => {
  const socket = io(); // Initialize socket.io

  // Helper function to format score
  function formatScore(score) {
    if (score >= 0) {
      return score.toString().padStart(3, '0');
    } else {
      return `-${Math.abs(score).toString().padStart(2, '0')}`;
    }
  }
  
  // Listen for the initial data when the page loads
  socket.on("initData", (data) => {
    Object.keys(data.scores).forEach((panelId) => {
      let scoreElement = document.getElementById(`score-text-${panelId}`);
      if (scoreElement) {
        scoreElement.textContent = formatScore(data.scores[panelId]);
      }
    });
  });
  
  // Handle score increase
  document.querySelectorAll('.up-arrow').forEach(button => {
    button.addEventListener('click', function() {
      const scorePanel = this.closest('.arrow').id.split('-')[2]; // Extract score panel number
      let scoreElement = document.getElementById(`score-text-${scorePanel}`);
      let currentScore = parseInt(scoreElement.textContent);
      
      currentScore += 1; // Increment score
      scoreElement.textContent = formatScore(currentScore);
      
      // Emit score change to server
      socket.emit('scoreUpdate', { panel: scorePanel, score: currentScore });
    });
  });

  // Handle score decrease
  document.querySelectorAll('.down-arrow').forEach(button => {
    button.addEventListener('click', function() {
      const scorePanel = this.closest('.arrow').id.split('-')[2]; // Extract score panel number
      let scoreElement = document.getElementById(`score-text-${scorePanel}`);
      let currentScore = parseInt(scoreElement.textContent);

      currentScore -= 1; // Decrement score
      scoreElement.textContent = formatScore(currentScore);
      
      // Emit score change to server
      socket.emit('scoreUpdate', { panel: scorePanel, score: currentScore });
    });
  });

  // Listen for score updates from the server
  socket.on('updateScore', (data) => {
    let scoreElement = document.getElementById(`score-text-${data.panel}`);
    scoreElement.textContent = formatScore(data.score);
  });
});
