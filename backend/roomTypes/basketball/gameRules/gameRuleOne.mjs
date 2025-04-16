export function getShapes(level) {
   const shapesAndPaths = {}
}

export function prepareGameLogic(game) {
   const colorsSequence = makeColorSequence(3, game.colors)

   console.log('Color sequence:', colorsSequence.map(c => c.name))

   game.lightColorSequence = new Array(colorsSequence.length).fill(null)

   showColorSequence(colorsSequence, game)
}

export function handlePhysicalElementAction(physicalElementId, whileColorWas, game) {
   if (game.room.lightGroups.wallButtons.includes(physicalElementId)) {
      handleWallButtonClick(physicalElementId, game)
  }
}

function showColorSequence(colorsSequence, game) {
   game.showColor = setInterval(() => {
      const currentColor = colorsSequence[game.currentColorIndex]
      // console.log('Showing color:', currentColor.name)
      
      const message = {
         type: 'colorNames',
         'cache-audio-file-and-play': currentColor.name
      }
      
      game.room.socket.broadcastMessage('monitor', message)
      game.room.socket.broadcastMessage('room-screen', message)

      game.room.lightGroups.wallButtons.forEach((light) => {
         light.color = colorsSequence[game.currentColorIndex].rgb
         // Force the light update to the frontend
         game.room.socket.broadcastMessage('monitor', {'type':'updateLight','lightId':light.id,'color':light.color})   
      })

      

      game.currentColorIndex++

      if (game.currentColorIndex >= colorsSequence.length) {
         setTimeout(() => {
            clearInterval(game.showColor)

            const shuffledColors = shuffleArray([...game.colors])
            game.room.lightGroups.wallButtons.forEach((light, i) => {
               light.color = shuffledColors[i].rgb
            })

            game.room.socket.broadcastMessage('monitor', { type: 'colorNamesEnd' })

            game.room.socket.broadcastMessage('room-screen', { type: 'colorNamesEnd' })
         }, 1000)
      }
   }, 1000)

   game.room.lightGroups.wallButtons.forEach((light, i) => {
      light.onClick = 'report'
      game.lightColorSequence[i] = colorsSequence[i % colorsSequence.length]
  }) 

  game.lightColorSequence.length = colorsSequence.length
 }

function makeColorSequence(size, colors) {
   return Array.from({ length: size }, () => colors[getRandomInt(0, colors.length - 1)])
 }

function shuffleArray(array) {
   for (let i = array.length - 1; i > 0; i--) {
      let j = getRandomInt(0, i)
      let temp = array[i] // Store current value
      array[i] = array[j] // Swap values
      array[j] = temp // Assign stored value to new position
   }
   return array
 }

function getRandomInt(min, max) {
     return Math.floor(Math.random() * (max - min + 1)) + min
 }

function handleWallButtonClick(clickedLight, game) {
   //console.log(clickedLight.color)
   //console.log(game.lightColorSequence[0].rgb)
   if (clickedLight.color === game.lightColorSequence[0].rgb) {
      handleCorrectButtonClick(clickedLight, game)
   } else {
      handleIncorrectButtonClick(clickedLight, game)
   }
 }

function handleCorrectButtonClick(clickedLight, game) {
   game.lightColorSequence.splice(0, 1)
   game.broadcastSuccess(clickedLight)
   
   if (game.lightColorSequence.length === 0) {
       game.levelCompleted()
   }
 }

function handleIncorrectButtonClick(clickedLight, game) {
      game.loseTime()
      game.broadcastFailure(clickedLight)
 }