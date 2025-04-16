import Game from '../classes/Game.js'

export default class Basketball extends Game {
   constructor (players, rule, level, team, book_room_until, env, roomInstance, timeForLevel = 120, timeToPrepare) {
      super(players, rule, level, team, book_room_until, env, roomInstance, timeForLevel, timeToPrepare)
      this.running = false

      this.showColor = undefined
      this.lightColorSequence = []
      this.currentColorIndex = 0
      this.colors = [
         { rgb: [255, 0, 0], name: 'red' },
         { rgb: [0, 255, 0], name: 'green' },
         { rgb: [0, 0, 255], name: 'blue' },
         { rgb: [255, 255, 0], name: 'yellow' },
         { rgb: [255, 0, 255], name: 'purple' }
      ]

      this.ruleLogic = null
      this.ruleAction = null
   }

    async start() {
      this.running = true
      super.start()
      console.log(`Basketball is running!`)

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
      const handleMonitorMessage = (message) => {
         try {
            const data = JSON.parse(message)
   
            if (data.type === 'colorNamesEnd') {
               if (this.animationMetronome) {
                  clearInterval(this.animationMetronome)
               }
               this.lastLevelStartedAt = Date.now()
   
               this.animationMetronome = setInterval(() => {
                  this.updateCountdown()
                  this.updateShapes()
                  this.applyShapesOnLights()
                  this.room.sendLightsInstructionsIfIdle()
               }, 1000)
            }
         } catch (error) {
            console.error('Error parsing WebSocket message:', error)
         }
      }
   
      // Remove previous instance of Basketball's listener before adding a new one
      this.room.socket.off('monitor', handleMonitorMessage)
      this.room.socket.onClientMessage('monitor', handleMonitorMessage)
    }

    stop() {
      if (this.running) {
         this.running = false
         if (this.showColor) {
            clearInterval(this.showColor)
            this.showColor = undefined
         }
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

    broadcastFailure(clickedLight) {
        const message = {
            type: 'playerFailed',
            'cache-audio-file-and-play': 'playerLoseLife',
            color: clickedLight.color
        }
        this.room.socket.broadcastMessage('monitor', message)
        this.room.socket.broadcastMessage('room-screen', message)
    }

    broadcastSuccess(clickedLight) {
        const message = {
            type: 'playerSuccess',
            'cache-audio-file-and-play': 'playerScored',
            color: clickedLight.color
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