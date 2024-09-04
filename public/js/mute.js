document.addEventListener('DOMContentLoaded', (event) => {
    const socket = io();

    function toggleMute(playerId) {
        const muteButtonGroup = document.querySelector(`#mute-button-${playerId}`);
        const namePanel = document.querySelector(`#name-panel-${playerId}`);
        const muteButtonPath = muteButtonGroup.querySelector('.mute-button');
        const muteText = muteButtonGroup.querySelector('.mute-text');

        // Check if the button is currently active (muted)
        const isMuted = muteButtonGroup.classList.toggle('active');

        // Change styles based on mute state
        if (isMuted) {
            muteButtonPath.style.fill = 'red'; // Change button color to red
            muteText.style.fill = 'white'; // Change text color to white
            namePanel.querySelector('.name-panel').style.fill = 'red'; // Change name panel color to red
        } else {
            muteButtonPath.style.fill = 'grey'; // Reset button color to grey
            muteText.style.fill = 'black'; // Reset text color to black
            namePanel.querySelector('.name-panel').style.fill = '#9ed4fa'; // Reset name panel color to default
        }

        // Emit the updated mute state
        socket.emit('muteUpdate', { player: playerId, muted: isMuted });
    }

    // Add event listeners to the <g> elements, not the individual paths or text
    document.querySelectorAll('[id^="mute-button-"]').forEach(buttonGroup => {
        buttonGroup.addEventListener('click', function(event) {
            const playerId = this.id.split('-')[2];
            toggleMute(playerId);
        });
    });

    socket.on('updateMute', (data) => {
        const muteButtonGroup = document.querySelector(`#mute-button-${data.player}`);
        const namePanel = document.querySelector(`#name-panel-${data.player}`);
        const muteButtonPath = muteButtonGroup.querySelector('.mute-button');
        const muteText = muteButtonGroup.querySelector('.mute-text');

        if (data.muted) {
            muteButtonPath.style.fill = 'red'; // Change button color to red
            muteText.style.fill = 'white'; // Change text color to white
            namePanel.querySelector('.name-panel').style.fill = 'red'; // Change name panel color to red
        } else {
            muteButtonPath.style.fill = 'grey'; // Reset button color to grey
            muteText.style.fill = 'black'; // Reset text color to black
            namePanel.querySelector('.name-panel').style.fill = '#9ed4fa'; // Reset name panel color to default
        }
    });
});
