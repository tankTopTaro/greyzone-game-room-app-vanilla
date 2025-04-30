import GameSession from '../../classes/GameSession.js'

export default class Basketball extends GameSession {
   constructor (roomInstance, rule, level, players, team, book_room_until, is_collaborative, timeForLevel = 120, timeToPrepare, parent_gs_id = null, id) {
      super(roomInstance, rule, level, players, team, book_room_until, is_collaborative, timeForLevel, timeToPrepare, parent_gs_id, id)
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
      if (this.status === 'running') {
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
   
}

export function preparePhysicalElements(room) {
   room.addMatrix(130, 130, 'rectangle', 'ledSwitch', 960, 100, 80, 80, 90, 5, 'wallButtons', false)
}