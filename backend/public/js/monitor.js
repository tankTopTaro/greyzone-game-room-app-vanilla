import WebSocketService from "./WebSocketService.js"
import { preloadAudio, playAudio } from "./PreloadAndPlayAudio.js"
import { formatDate, formatTime } from "./FormatDateAndTime.js"

document.title = `GRA | Monitor`

const WS_URL = `ws://${window.location.hostname}:8082`
const CLIENT = 'monitor'

const GFA_CONFIG = {
   HOSTNAME: '192.168.5.108',
   PORT: 3001
}

let wsService = null

let room = undefined
let lights = undefined
let scale = undefined
let lightsAreDrawn = false
let bufferedLightUpdates = []
let yellowDots = []
let clearDotsInterval = undefined

const countdownElement = document.getElementById('countdown')
const roomInfoElement = document.getElementById('roomInfo')
const statusElement = document.getElementById('status')
const bookRoomUntilElement = document.getElementById('bookRoomUntil')
const teamNameElement = document.getElementById('team-name')
const roomPlayersElement = document.getElementById('room-players')
const canvas = document.getElementById('canvas1')
const ctx = canvas.getContext('2d')

// WebSocket
function startListeningToSocket() {
    function handleWebSocketMessage(data) {
        console.log('Received webSocket message:', data)
        const messageHandlers = {
            //'bookRoomCountdown': () => console.log(data.remainingTime),
            'bookRoomExpired': () => {
                renderStatusData(data.message)
                resetDisplay()
                PrepareRoom()
            },
            'bookRoomWarning': () => () => {
                renderStatusData(data.message)
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
               PrepareRoom()
               drawRoom()
               resetDisplay()
            },
            'facilitySessionExpired': () => {
                renderStatusData(data.message)
            },
            'isUpcomingGameSession': () => console.log(data),
            'levelCompleted': () => {
                renderStatusData(data.message)
                playAudio(data['cache-audio-file-and-play'])
            },
            'levelFailed': () => {
                renderStatusData(data.message)
                playAudio(data['cache-audio-file-and-play'])
            },
            'newLevelStarts': () => {
               resetDisplay()
               renderGameStatesData(data)
            },
            'offerNextLevel': () => {
               PrepareRoom()
               renderStatusData(data.message)
            },
            'offerSameLevel': () => {
               PrepareRoom()
               renderStatusData(data.message)
            },
            'playerSuccess': () => {
                playAudio(data['cache-audio-file-and-play'])
            },
            'playerFailed': () => console.log('playerFailed'),
            'roomDisabled': () => renderStatusData(data.message),
            'storedGameStates': () => {
                const states = data.data
                renderGameStatesData(states)
            },
            'timeIsUp': () => renderStatusData(data.message),
            'updateCountdown': () => {
                renderCountdownData(data.countdown)
            },
            'updateLight': () => {
               console.log(data)
               handleUpdateLight(data)
            },
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
         PrepareRoom()
      }
    }

    window.addEventListener('focus',() => {
      if (wsService && !wsService.isConnected()) {
         console.log('WebSocket closed on focus. Re-initializing...')
         PrepareRoom()
      }
    })

    window.addEventListener('load', initWebSocket)

    window.addEventListener('beforeunload', cleanupWebSocket)
}

// Canvas, Room and Lights Preparations and Cleaning
async function downloadRoom() {
    const response = await fetch('/get/roomData')
    const json = await response.json()
    console.log(json)
    room = json.room
    lights = json.lights
}

async function drawRoom() {
   console.log('drawing room...')
    canvas.width = window.innerWidth
    scale = canvas.width / room.width
    canvas.height = room.height * scale

    ctx.fillStyle = 'rgb(43, 51, 55)'
    ctx.fillRect(0,0,canvas.width,canvas.height)

    lights.forEach((light) => {
        if(light.color === undefined){
            light.color = [0,0,0]
            light.onClick = 'ignore'
        }
        drawLight(light)
    })
}

function drawLight(light) {
   console.log('drawing light...')
    if(light.type === 'ledSwitch'){
        ctx.fillStyle = 'rgb('+light.color[0]+', '+light.color[1]+', '+light.color[2]+')'
        ctx.fillRect(
            light.posX * scale,
            light.posY * scale,
            light.width * scale,
            light.height * scale
        )
    } else if(light.type === 'screen'){
        ctx.fillStyle = 'rgb(0, 0, 0)'
        ctx.fillRect(
            light.posX * scale,
            light.posY * scale,
            light.width * scale,
            light.height * scale
        )
        ctx.font = '22px Arial'; // Font size and type
        ctx.fillStyle = 'white'; // Text color
        ctx.textAlign = 'center'; // Horizontal alignment
        ctx.textBaseline = 'middle'; // Vertical alignment
        const text = ''+(light.color[0] === 0 ? '' : (light.color[0]+',') ) + (light.color[1] === 0 ? '' : (light.color[1]+',') ) + (light.color[2] === 0 ? '' : light.color[2] )
        ctx.fillText(text, light.posX * scale + (light.width * scale /2) -1, light.posY * scale + (light.height * scale /2) +2 )
    }
}

async function PrepareRoom() {
    await downloadRoom()
    await drawRoom()
    lightsAreDrawn = true
    applyBufferedLightUpdates()
}

function handleUpdateLight(data) {
    let light = data
    if(lightsAreDrawn){
        lights[light.lightId].color = light.color
        lights[light.lightId].onClick = light.onClick
        drawLight(lights[light.lightId])
    }
    else{
        bufferedLightUpdates.push(light)
    }
}

function applyBufferedLightUpdates() {
    bufferedLightUpdates.forEach((light) => {
        lights[light.lightId].color = light.color
        drawLight(lights[light.lightId])
        }
    )
    bufferedLightUpdates = []
}

function handleCanvasResize() {
    // Update the canvas size to match the new window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawRoom()
}

function clearDots(x, y, radius) {
    // Save the current drawing state
    ctx.save();

    // Create a clipping path in the shape of the circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.closePath()

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over'; 
    ctx.restore();
}

function clearAndDrawRoom() {
    yellowDots.forEach((dot) => {
        clearDots(dot.x, dot.y, dot.radius)

        // Redraw the affected lights
        const affectedLights = lights.filter(light => {
            const lightX = light.posX * scale;
            const lightY = light.posY * scale;
            const lightW = light.width * scale;
            const lightH = light.height * scale;

            // Check for overlap, considering the entire light area, not just the dot center
            return (
                dot.x + dot.radius >= lightX &&
                dot.x - dot.radius <= lightX + lightW &&
                dot.y + dot.radius >= lightY &&
                dot.y - dot.radius <= lightY + lightH
            );
        });

        // Redraw just those lights
        affectedLights.forEach(drawLight);
    });

    yellowDots = [];
}

clearDotsInterval = setInterval(clearAndDrawRoom, 4000)

// Click events
function ReportLightClickAction(light) {
    wsService.send({
        type: 'lightClickAction', 
        lightId: light.id,
        whileColorWas: light.color
    })
}

function handleCanvasClick(event) {
    const x = (event.clientX - canvas.getBoundingClientRect().left) * (canvas.width / canvas.offsetWidth)
    const y = (event.clientY - canvas.getBoundingClientRect().top) * (canvas.height / canvas.offsetHeight)
    const xScaled = x / scale
    const yScaled = y / scale

    // draw a circle to witness the click
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    yellowDots.push({ x, y, radius: 12 });

    // Find out who is clicked
    // scanning reversely because the last lights drawn are z-up
    let clickedLight = false
    for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i]
        if(light.shape === 'rectangle'
            && xScaled >= light.posX && xScaled <= light.posX + light.width
            && yScaled >= light.posY && yScaled <= light.posY + light.height
        ){
            clickedLight = light
            if(clickedLight.onClick === 'ignore'){
                console.log('click ignored')
                console.log(light.color)
            }
            else{
                console.log('click sent (whileColorWas: '+clickedLight.color+' whileOnClickWas: '+clickedLight.onClick+')')
                ReportLightClickAction(clickedLight)
            }
            break;
        }
    }
    //console.log('clicked x:'+x+' y:'+y+' | xScaled:'+xScaled+' yScaled:'+yScaled)
}

// DOM renders
function renderGameStatesData(data) {
    countdownElement.textContent = formatTime(data.countdown)
    roomInfoElement.textContent = `Room: ${data.roomType} > Rule: ${data.rule} > Level: ${data.level}`
    bookRoomUntilElement.textContent = `Book Room Until: ${formatDate(data.book_room_until)}`
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

function renderStatusData(data) {
    statusElement.textContent = data

    setTimeout(() => {
        statusElement.textContent = ''
    }, 5000)
}

function renderCountdownData(countdown) {
    countdownElement.textContent = formatTime(countdown)
}

function resetDisplay() {
    countdownElement.textContent = '00:00'
    roomInfoElement.textContent = ''
    bookRoomUntilElement.textContent = ''
    teamNameElement.textContent = ''
    roomPlayersElement.innerHTML = ''
}

// Event Listeners
canvas.addEventListener('resize', handleCanvasResize)
canvas.addEventListener('click', handleCanvasClick)

lightsAreDrawn = false
startListeningToSocket()
PrepareRoom()