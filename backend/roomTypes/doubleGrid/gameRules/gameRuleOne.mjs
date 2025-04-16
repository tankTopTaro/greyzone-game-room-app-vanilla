import { hsvToRgb } from '../../../utils/utils.js'
import Shape from '../../../classes/Shape.js'

const blueGreen1 = hsvToRgb([130,220,255])
const black = hsvToRgb([0,0,0])

export function getShapes(level) {
   const shapesAndPaths = {
      1: {
         "pathDots": [
            { "x": 25, "y": 0 },
            { "x": 100, "y": -180 },
            { "x": 200, "y": -340 },
            { "x": 300, "y": -420 },
            { "x": 400, "y": -474 },
            { "x": 500, "y": -500 },
            { "x": 595, "y": -474 },
            { "x": 690, "y": -420 },
            { "x": 785, "y": -340 },
            { "x": 880, "y": -180 },
            { "x": 955, "y": 0 },
            { "x": 880, "y": -180 },
            { "x": 785, "y": -340 },
            { "x": 690, "y": -420 },
            { "x": 595, "y": -474 },
            { "x": 500, "y": -500 },
            { "x": 400, "y": -474 },
            { "x": 300, "y": -420 },
            { "x": 200, "y": -340 },
            { "x": 100, "y": -180 },
            { "x": 25, "y": 0 }
        ],
        "shapes": [{ "x": 100, "y": 100, "width": 35, "height": 3000, "color": [255, 0, 0], "action": "report", "speed": 0.01 }]
      },
      2: {
         "pathDots": [
            { "x": 25, "y": 0 },
            { "x": 100, "y": -180 },
            { "x": 200, "y": -340 },
            { "x": 300, "y": -420 },
            { "x": 400, "y": -474 },
            { "x": 500, "y": -500 },
            { "x": 595, "y": -474 },
            { "x": 690, "y": -420 },
            { "x": 785, "y": -340 },
            { "x": 880, "y": -180 },
            { "x": 955, "y": 0 },
            { "x": 880, "y": -180 },
            { "x": 785, "y": -340 },
            { "x": 690, "y": -420 },
            { "x": 595, "y": -474 },
            { "x": 500, "y": -500 },
            { "x": 400, "y": -474 },
            { "x": 300, "y": -420 },
            { "x": 200, "y": -340 },
            { "x": 100, "y": -180 },
            { "x": 25, "y": 0 }
        ],
        "extraPathDots": [
            { "x": 0, "y": 25 },
            { "x": -50, "y": 100 },
            { "x": -150, "y": 250 },
            { "x": -300, "y": 400 },
            { "x": -450, "y": 450 },
            { "x": -500, "y": 450 },
            { "x": -450, "y": 400 },
            { "x": -300, "y": 250 },
            { "x": -150, "y": 100 },
            { "x": -50, "y": 50 },
            { "x": 0, "y": 25 }
        ],
        "shapes": [
            { "x": 100, "y": 100, "width": 35, "height": 3000, "color": [255, 0, 0], "action": "report", "speed": 0.01 },
            { "x": 100, "y": 100, "width": 3000, "height": 35, "color": [255, 0, 0], "action": "report", "speed": 0.01 }
        ]
      }, 
      3: {
         "pathDots": [
            { "x": 0, "y": 0 },
            { "x": 25, "y": 0 },
            { "x": 100, "y": 0 },
            { "x": 200, "y": 0 },
            { "x": 300, "y": 0 },
            { "x": 400, "y": 0 },
            { "x": 500, "y": 0 },
            { "x": 595, "y": 0 },
            { "x": 690, "y": 0 },
            { "x": 785, "y": 0 },
            { "x": 785, "y": 100 },
            { "x": 785, "y": 250 },
            { "x": 785, "y": 300 },
            { "x": 690, "y": 300 },
            { "x": 595, "y": 300 },
            { "x": 500, "y": 300 },
            { "x": 400, "y": 300 },
            { "x": 300, "y": 300 },
            { "x": 200, "y": 300 }, 
            { "x": 100, "y": 300 },
            { "x": 25, "y": 300 },
            { "x": 0, "y": 300 },
            { "x": 0, "y": 250 },
            { "x": 0, "y": 100 },
            { "x": 0, "y": 25 },
            { "x": 0, "y": 0 }
        ],
        "safeDots": [
            { "x": 0, "y": 0 }
        ],
        "shapes": [
            { "x": 150, "y": 150, "width": 150, "height": 150, "color": [255, 0, 0], "action": "report", "speed": 0.01 },
            { "x": 320, "y": 320, "width": 560, "height": 90, "color": [0, 255, 0], "action": "ignore", "speed": 0 }
        ]
      }
   }

   return shapesAndPaths[level]
}

export function prepareGameLogic(game) {

   const numbersSequence = makeNumberSequence(12)

   console.log('TEST: numbersSequence: ', numbersSequence)

   game.room.lightGroups.wallScreens.forEach((light, i) => {
      light.color = [0, 0, numbersSequence[i]]
   })

   game.room.lightGroups.wallButtons.forEach((light, i) => {
      light.color = blueGreen1
      light.onClick = 'report'
      game.lightIdsSequence[numbersSequence[i]] = light.id
   })

   game.lightIdsSequence.splice(0, 1)
}

export function handlePhysicalElementAction(physicalElementId, whileColorWas, game) {
   if (game.room.lightGroups['mainFloor'].includes(physicalElementId)) {
      handleMainFloorClick(physicalElementId, whileColorWas, game)
   } else if (game.room.lightGroups['wallButtons'].includes(physicalElementId)) {
      handleWallButtonClick(physicalElementId, game)
   }
}

function makeNumberSequence(size) {
   const numbersSequence = Array.from({ length: size }, (_, i) => i + 1)
   shuffleArray(numbersSequence)
   return numbersSequence
}

function shuffleArray(array) {
   for (let i = array.length - 1; i > 0; i--) {
       let j = getRandomInt(0, i)
       let temp = array[i] // Store current value
       array[i] = array[j] // Swap values
       array[j] = temp // Assign stored value to new position
   }
}

function getRandomInt(min, max) {
   return Math.floor(Math.random() * (max - min + 1)) + min
}

function handleMainFloorClick(clickedLight, whileColorWas, game) {
   if (Array.isArray(whileColorWas)) whileColorWas = whileColorWas.join(',')

   if (whileColorWas !== '255,0,0') return
   
   game.loseTime()
   createShape(clickedLight, game)
   game.broadcastFailure()
}

function handleWallButtonClick(clickedLight, game) {
   if (clickedLight.id === game.lightIdsSequence[0]) {
      handleCorrectButtonClick(clickedLight, game)
   } else {
      handleIncorrectButtonClick(game)
   }
}

function handleCorrectButtonClick(clickedLight, game) {
   clickedLight.color = black
   clickedLight.onClick = 'ignore'

   //console.log('Correct button clicked')
   game.broadcastSuccess(game)

   game.lightIdsSequence.shift()

   if (game.lightIdsSequence.length === 0) {
      game.levelCompleted()
   }
}

function handleIncorrectButtonClick(game) {
   game.loseTime()
   game.broadcastFailure()
}

function createShape(clickedLight, game) {
   game.shapes.push(new Shape(
      clickedLight.posX + clickedLight.width / 2,
      clickedLight.posY + clickedLight.height / 2,
      'rectangle',
      clickedLight.width / 2,
      clickedLight.height / 2,
      [255, 100, 0],
      'ignore',
      [{ x: 0, y: 0 }],
      0,
      'mainFloor',
      2000
   ))
}



