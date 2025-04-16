import Game from '../classes/Game.js'

export default class DoubleGrid extends Game {
   constructor (players, rule, level, team, book_room_until, env, roomInstance, timeForLevel = 120, timeToPrepare) {
      super(players, rule, level, team, book_room_until, env, roomInstance, timeForLevel, timeToPrepare)
      this.running = false
      this.lightIdsSequence = []
      this.ruleLogic = null
      this.ruleAction = null
   }

   async start() {
      this.running = true
      super.start()
      console.log(`DoubleGrid is running!`)

      try {
         const ruleModuleName = this.rule
         const roomType = this.room.type // e.g., 'doubleGrid'

         const module = await import(`../roomTypes/${roomType}/gameRules/${ruleModuleName}.mjs`)

         this.ruleLogic = module.prepareGameLogic
         this.ruleAction = module.handlePhysicalElementAction

         if (this.ruleLogic) {
               this.ruleLogic(this)
         } else {
               console.warn(`No ruleLogic handler for rule ${this.rule}`)
         }
      } catch (error) {
         console.error(`Failed to load game rule module:`, error)
         throw new Error(`Failed to load game rule module:`, error)
      }
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
   if (this.running) {
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

   handleGameSpecificLightAction(clickedLight, whileColorWas) {
   if (this.isWaitingForChoiceButton) return

   if (this.ruleAction) {
      this.ruleAction(clickedLight, whileColorWas, this)
   } else {
      console.warn(`No ruleAction handler for rule ${this.rule}`)
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

   endGame() {
      const message = {
         type: 'levelCompleted',
         'cache-audio-file-and-play': 'levelCompleted'
      }

      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)

      this.endAndExit()
   }
}