import WebSocketService from "./WebSocketService.js"
import { playAudio, preloadAudio } from "./PreloadAndPlayAudio.js"
import { formatDate, formatTime } from "./FormatDateAndTime.js"

document.title = `GRA | Room`

const WS_URL = `ws://${window.location.hostname}:8082`
const CLIENT = 'room-screen'

const GFA_CONFIG = {
    HOSTNAME: '192.168.5.108',
    PORT: 3001
 }

let wsService = null

const countdownElement = document.getElementById('countdown')
const colorSequenceElement = document.getElementById('color-sequence')
const roomInfoElement = document.getElementById('room-info')
const teamNameElement = document.getElementById('team-name')
const roomPlayersElement = document.getElementById('room-players')
const roomMessageElement = document.getElementById('room-message')

let currentSpanIndex = 0;

function startListeningToSocket() {
    function handleWebSocketMessage(data) {
      console.log(data)
        const messageHandlers = {
            //'bookRoomCountdown': () => console.log(data.remainingTime),
            'bookRoomExpired': () => {
                renderRoomMessageData(data.message)
                resetDisplay()
            },
            'bookRoomWarning': () => () => {
                renderRoomMessageData(data.message)
            },
            'colorNames': () => {
                playAudio(data['cache-audio-file-and-play'])
            },
            'colorNamesEnd': () => {
                wsService.send({
                    type: 'colorNamesEnd'
                })
            },
            'endAndExit': () => {
               renderRoomMessageData('Please exit the room')
               resetSpanColors()
               setTimeout(() => {
                  resetDisplay()
               }, 5000)
            },
            'facilitySessionExpired': () => {
                renderRoomMessageData(data.message)
            },
            'isUpcomingGameSession': () => console.log(data),
            'levelCompleted': () => {
                renderRoomMessageData(data.message)
                playAudio(data['cache-audio-file-and-play'])
            },
            'levelFailed': () => {
                renderRoomMessageData(data.message)
                playAudio(data['cache-audio-file-and-play'])
            },
            'newLevelStarts': () => {
               resetSpanColors()
               renderGameStatesData(data)
            },
            'offerNextLevel': () => {
               renderRoomMessageData(data.message)
            },
            'offerSameLevel': () => {
               renderRoomMessageData(data.message)
            },
            'playerSuccess': () => {
                playAudio(data['cache-audio-file-and-play'])
                setColorToSpan(data.color)
            },
            'playerFailed': () => {
               setColorToSpan(data.color)
               playAudio(data['cache-audio-file-and-play'])
            },
            'roomDisabled': () => renderRoomMessageData(data.message),
            'storedGameStates': () => {
                const states = data.data
                renderGameStatesData(states)
            },
            'timeIsUp': () => renderRoomMessageData(data.message),
            'updateCountdown': () => {
                renderCountdownData(data.countdown)
            },
            'updateLight': () => handleUpdateLight(data),
            'updatePreparationInterval': () => {
                renderCountdownData(data.countdown)
                if (data['cache-audio-file']) preloadAudio(data['cache-audio-file'])

                if (data['play-audio-file']) playAudio(data['play-audio-file'])
            }
         }
   
         if (!messageHandlers[data.type]) {console.warn(`No handler for this message type ${data.type}`)}
   
         messageHandlers[data.type]()
    }

   function initWebSocket() {
      if (!wsService) {
         wsService = new WebSocketService(WS_URL, CLIENT)
         wsService.connect()
      }

      wsService.addListener(handleWebSocketMessage)
    }

    function cleanupWebSocket() {
      if (wsService) {
         wsService.removeListener(handleWebSocketMessage)
         wsService.close()
         wsService = null
      }
    }

    window.addEventListener('load', initWebSocket)
    window.addEventListener('beforeunload', cleanupWebSocket)
}

// DOM renders
function renderGameStatesData(data) {
    countdownElement.textContent = formatTime(data.countdown)
    roomInfoElement.textContent = `Room: ${data.roomType} > Rule: ${data.rule} > Level: ${data.level}`
    teamNameElement.textContent = data.team?.name

    roomPlayersElement.innerHTML = ''

    data.players.forEach((player) => {
        const li = document.createElement('li')
        li.classList.add('list-item')
        li.classList.add('mb-1')

        // Create an image element for the avatar
        const avatarImg = document.createElement('img');
        avatarImg.src = `http://${GFA_CONFIG.HOSTNAME}:${GFA_CONFIG.PORT}/api/images/players/${player.id}.jpg` || 'https://placehold.co/40x40?text=No+Image';
        avatarImg.alt = `${player.nick_name || 'Unknown'}'s avatar`;
        avatarImg.classList.add('avatar');

        // Create a container for players info
        const playerInfo = document.createElement('div');
        playerInfo.classList.add('d-flex');
        playerInfo.classList.add('flex-column');
        playerInfo.classList.add('align-items-start');

        // Create a span for the player's details
        const playerDetails = document.createElement('span');
        playerDetails.textContent = `${player.nick_name || 'Unknown'}`;

        // Create a span for the player's score
        /* const playerScore = document.createElement('span');
        const storedPlayerScored = JSON.parse(localStorage.getItem('playerScored'));

        if(storedPlayerScored){
            playerScore.textContent = `Score: ${storedPlayerScored.playerScore}`
        }

        playerScore.textContent = `Score: ${player.score}`; */
        

        // Append player details and score to the player info container
        playerInfo.appendChild(playerDetails);
        // playerInfo.appendChild(playerScore);

        // Append avatar and info to the list item
        li.appendChild(avatarImg);
        li.appendChild(playerInfo);

        // Append the list item to the container
        roomPlayersElement.appendChild(li);

        roomPlayersElement.offsetHeight; // Force reflow
    })

            // Handle color sequence visibility
   if (data.roomType === 'basketball') {
      colorSequenceElement.classList.remove('invisible');
      colorSequenceElement.classList.add('visible');
   } else {
      colorSequenceElement.classList.remove('visible');
      colorSequenceElement.classList.add('invisible');
   }
}

function renderRoomMessageData(data) {
    roomMessageElement.textContent = data

    setTimeout(() => {
        roomMessageElement.textContent = ''
    }, 5000)
}

function renderCountdownData(countdown) {
   countdownElement.textContent = formatTime(countdown)
}

function resetDisplay() {
   countdownElement.textContent = ''
   roomInfoElement.textContent = ''
   teamNameElement.textContent = ''
   roomPlayersElement.innerHTML = ''
   roomMessageElement.textContent = ''
   colorSequenceElement.classList.remove('visible');
   colorSequenceElement.classList.add('invisible');
}

function setColorToSpan(color) {
   const spans = colorSequenceElement.querySelectorAll('span');

   if (spans.length > 0 && color) {
       const [r, g, b] = color;

       console.log('r', r, 'g', g, 'b', b);

       // Find the first empty span (one without a background color)
       const emptySpan = Array.from(spans).find(span => !span.style.backgroundColor);

       if (emptySpan) {
           // Set the color for the first empty span
           emptySpan.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
       } else {
           // If all spans are filled, reset them and use the first span
           resetSpanColors();
           spans[0].style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
       }
   }
}

function resetSpanColors() {
   const spans = colorSequenceElement.querySelectorAll('span');
   spans.forEach(span => {
       span.style.backgroundColor = '';  // Clear the background color
   });
   currentSpanIndex = 0; // Reset the index if you want to start from the first span
}

startListeningToSocket()