import WebSocketService from "./WebSocketService.js"
import { playAudio, preloadAudio } from "./PreloadAndPlayAudio.js"
import { formatDate, formatTime } from "./FormatDateAndTime.js"

document.title = `GRA | Room`

const WS_URL = `ws://${window.location.hostname}:8082`
const CLIENT = 'room'

let wsService = null

const lifesContainerElement = document.getElementById('lifes-container')
const countdownElement = document.getElementById('countdown')
const colorSequenceElement = document.getElementById('color-sequence')
const roomInfoElement = document.getElementById('room-info')
const roomPlayersElement = document.getElementById('room-players')
const roomMessageContainer = document.getElementById('room-message')

const heartSVG = `<svg id="heart" xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-heart">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                </svg>`

const heartbreakSVG = `<svg id="heart-broken" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-heart-broken">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                    <path d="M12 6l-2 4l4 3l-2 4v3" />
                    </svg>` 

let currentSpanIndex = 0;

function startListeningToSocket() {
    function handleWebSocketMessage(data) {
        const messageHandlers = {
            //'bookRoomCountdown': () => console.log(data.remainingTime),
            'bookRoomExpired': () => {
                renderRoomMessageData(data.message)
            },
            'bookRoomWarning': () => () => {
                renderRoomMessageData(data.message)
            },
            'colorNames': () => {
                playAudio(data['cache-audio-file-and-play'])
            },
            'colorNamesEnd': () => {
                wsService.current.send({
                    type: 'colorNamesEnd'
                })
            },
            'endAndExit': () => {
                resetDisplay()
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
            },
            'playerFailed': () => console.log('playerFailed'),
            'roomDisabled': () => renderRoomMessageData(data.message),
            'storedGameStates': () => {
                const states = data.data
                renderGameStatesData(states)
            },
            'timeIsUp': () => renderRoomMessageData(data.message),
            'updateCountdown': () => {
                renderCountdownData(data.countdown)
            },
            'updateLifes': () => {
                renderLifesData(data.lifes)
                playAudio(data['cache-audio-file-and-play'])
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
    renderLifesData(data.lifes)
    countdownElement.textContent = formatTime(data.countdown)
    roomInfoElement.textContent = `Room: ${data.roomType} > Rule: ${data.rule} > Level: ${data.level}`
    bookRoomUntilElement.textContent = formatDate(data.bookRoomUntil)
    teamNameElement.textContent = data.team?.name

    roomPlayersElement.innerHTML = ''

    data.players.forEach((player) => {
        const li = document.createElement('li')
        li.classList.add('list-item')

        // Create an image element for the avatar
        const avatarImg = document.createElement('img');
        avatarImg.src = `http://192.168.254.100:3001/api/images/players/${player.id}.jpg` || 'https://placehold.co/40x40?text=No+Image';
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
}

function renderRoomMessageData(data) {
    statusElement.textContent = data

    setTimeout(() => {
        statusElement.textContent = ''
    }, 2000)
}

function renderCountdownData(countdown) {
    countdownElement.textContent = formatTime(countdown)
}

function renderLifesData(lifes) {
    const totalHearts = 5

    // Clear the container only if it's empty (first render)
    if (lifesContainerElement.children.length === 0) {
        for (let i = 0; i < totalHearts; i++) {
            const heart = document.createElement('div');
            heart.classList.add('heart-slot'); // uniform container class

            const icon = document.createElement('div');
            icon.classList.add('heart');
            icon.innerHTML = heartSVG;

            heart.appendChild(icon);
            lifesContainerElement.appendChild(heart);
        }
    }

    // Loop through each slot and update its contents
    const slots = lifesContainerElement.querySelectorAll('.heart-slot');
    slots.forEach((slot, index) => {
        const current = slot.firstChild;
        if (index < lifes) {
            // Should be a full heart
            if (!current.classList.contains('heart')) {
                const heart = document.createElement('div');
                heart.classList.add('heart');
                heart.innerHTML = heartSVG;

                // Replace heartbreak with heart
                slot.replaceChild(heart, current);
            }
        } else {
            // Should be a heartbreak
            if (!current.classList.contains('heart-broken')) {
                const heartbreak = document.createElement('div');
                heartbreak.classList.add('heart-broken');
                heartbreak.innerHTML = heartbreakSVG;

                // Add animation to current (heart loss)
                current.classList.add('heart-lost');

                setTimeout(() => {
                    if (slot.contains(current)) {
                        slot.replaceChild(heartbreak, current);
                    }
                }, 500); // match animation duration
            }
        }
    });
}

function resetDisplay() {
    lifesElement.textContent = '5'
    countdownElement.textContent = '00:00'
    roomInfoElement.textContent = ''
    bookRoomUntilElement.textContent = ''
    teamNameElement.textContent = ''
    roomPlayersElement.innerHTML = ''
}

startListeningToSocket()