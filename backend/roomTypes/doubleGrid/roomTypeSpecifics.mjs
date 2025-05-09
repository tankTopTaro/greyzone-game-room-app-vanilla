import GameSession from '../../classes/GameSession.js'

/* export default class DoubleGrid extends GameSession {
   constructor (roomInstance, rule, level, players, team, book_room_until, is_collaborative, timeForLevel = 120, timeToPrepare, parent_gs_id = null, id) {
      super(roomInstance, rule, level, players, team, book_room_until, is_collaborative, timeForLevel, timeToPrepare, parent_gs_id, id)
      this.running = false
      this.lightIdsSequence = []
   }

   setupGame() {
      this.lastLevelStartedAt = Date.now()

      if (this.animationMetronome) {
         clearInterval(this.animationMetronome)
      }
      
      this.animationMetronome = setInterval(() =>{
         this.updateShapes()
         this.updateCountdown()
         this.applyShapesOnLights()
         this.room.sendLightsInstructionsIfIdle()
      } , 1000/25)   
   }

   stop() {
      if (this.status === 'running') {
         this.running = false
         this.reset()
         console.log('Game has been stopped')
         const message = {
            type: 'roomDisabled',
            message: 'Room has been disabled.'
         }
         
         this.room.socket.broadcastMessage('monitor', message)
         this.room.socket.broadcastMessage('room-screen', message)
      }
   }

   broadcastFailure() {
      const message = {
         type: 'playerFailed',
         'cache-audio-file-and-play': 'playerLoseLife'
      }
      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
   }
   
   broadcastSuccess() {
      const message = {
            type: 'playerSuccess',
            'cache-audio-file-and-play': 'playerScored'
      }
      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
   }
} */

export function doubleGrid(gameSession) {
   gameSession.running = false
   gameSession.lightIdsSequence = []

   gameSession.setupGame = function () {
      this.lastLevelStartedAt = Date.now()

      if (this.animationMetronome) {
         clearInterval(this.animationMetronome)
      }

      this.animationMetronome = setInterval(() => {
         this.updateShapes()
         this.updateCountdown()
         this.applyShapesOnLights()
         this.room.sendLightsInstructionsIfIdle()
      }, 1000/25)
   }

   gameSession.stop = function () {
      if (this.status === 'running') {
         this.running = false
         this.reset()
         console.log('Game has been stopped')
         const message = {
            type: 'roomDisabled',
            message: 'Room has been disabled.'
         }
         this.room.socket.broadcastMessage('monitor', message)
         this.room.socket.broadcastMessage('room-screen', message)
      }
   }

   gameSession.broadcastFailure = function () {
      const message = {
         type: 'playerFailed',
         'cache-audio-file-and-play': 'playerLoseLife'
      }
      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
   }

   gameSession.broadcastSuccess = function () {
      const message = {
         type: 'playerSuccess',
         'cache-audio-file-and-play': 'playerScored'
      }
      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
   }

   return gameSession
}

export function preparePhysicalElements(room) {
   room.addMatrix(130,130,'rectangle','ledSwitch',960,480,25,25,5,5,'mainFloor', true)
   room.addMatrix(255,70,'rectangle','ledSwitch',960,100,15,15,200,40, 'wallButtons',false)
   room.addMatrix(255,640,'rectangle','ledSwitch',960,100,15,15,200,40,'wallButtons',false)
   room.addMatrix(70,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false)
   room.addMatrix(1120,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false)
   
   room.addMatrix(250,30,'rectangle','screen',960,100,25,25,190,40, 'wallScreens',false)
   room.addMatrix(250,670,'rectangle','screen',960,100,25,25,190,40,'wallScreens',false)
   room.addMatrix(30,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false)
   room.addMatrix(1150,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false)
}