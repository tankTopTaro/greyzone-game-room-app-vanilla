import path from 'path'
import axios from 'axios'
import fs from 'fs'
import os from 'os'
import { fileURLToPath } from 'url'

import Shape from './Shape.js'
import { hsvToRgb, areRectanglesIntersecting, handleUncaughtException } from '../utils/utils.js'

process.on('uncaughtException', handleUncaughtException)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAME_STATES_PATH = path.join(__dirname, '../assets/db/game_states.json')

const black = hsvToRgb([0,0,0])
const yellow = hsvToRgb([42,255,255])
const green = hsvToRgb([85,255,255])
const red = hsvToRgb([0,255,255])

export default class GameSession {
    constructor(roomInstance, rule, level, players = [], team, book_room_until, is_collaborative = true, timeForLevel = 120, timeToPrepare, parent_gs_id) {
      this.players = players
      this.rule = rule
      this.level = level
      this.team = team
      this.book_room_until = book_room_until
      this.room = roomInstance
      this.timeForLevel = timeForLevel
      this.is_collaborative = is_collaborative

      this.animationMetronome = undefined
      this.shapes = []
      this.status = undefined
      this.gameStartedAt = undefined
      this.lastLevelStartedAt = undefined
      this.lastLevelCreatedAt = Date.now()
      this.createdAt = Date.now()
      
      this.timeToPrepare = timeToPrepare ?? 15
      this.preparationInterval = undefined
      this.preparationIntervalStartedAt = undefined

      this.bookRoomInterval = undefined

      this.isWaitingForChoiceButton = false
      this.isChoiceButtonPressed = false
      this.roomMessage = ''
      this.currentLevelOffer = ''
      this.log = []
      this.isWon = false

      this.gameRuleSpecifics
      this.ruleLogic = null
      this.ruleAction = null

      this.penaltyTimestamps = []

      this.parent_gs_id = parent_gs_id || null
    }

    async init() {
        let result
        await this.prepareAndGreet()
            .then(() => {
                this.start()
                result = true
            })
            .catch((e) => {
                console.log('CATCH: prepareAndGreet() failed')
                this.logEvent('prepareAndGreet_failed', e.message || e)

                console.log(e)
                this.room.currentGameSession = undefined
                console.log('Game session cancelled.')
                console.log('Room remains free.')
                result = e
                // TODO: reportErrorToCentral(e)
            })

        return result
    }

    reset() {
        if (this.animationMetronome) {
            clearInterval(this.animationMetronome)
            this.animationMetronome = undefined
        }

        if (this.bookRoomInterval) {
            clearInterval(this.bookRoomInterval)
            this.bookRoomInterval = undefined
        }

        if (this.preparationInterval) {
            clearInterval(this.preparationInterval)
            this.preparationInterval = undefined
        }
        
        this.status = undefined
        this.shapes = []
        this.log = []
        this.isWon = false
        this.lastLevelCreatedAt = Date.now()
        this.room.lights.forEach(light => {
            light.color = black
            light.onClick = 'ignore'
        })
        this.room.sendLightsInstructionsIfIdle()
    }

    prepareAndGreet() {
        let prepared = this.prepare()
        let greeted = this.greet()

        return Promise.all([prepared, greeted])
            .then((results) => {
                console.log('Both promise are resolved!')
                console.log('Result of prepare():', results[0])
                console.log('Result of greet(): ', results[1])
            })
    }

    greet() {
        return new Promise((resolve) => {
            console.log('Greeting sound starts...')
            setTimeout(() => {
                console.log('Greeting sound ends...')
                resolve(true)
            }, 2000)
        })
    }
    
    async prepare() {
        return new Promise((resolve, reject) => {
            console.log('preparation starts...')
            this.countdown = this.timeForLevel
            this.prepTime = this.timeToPrepare

            this.saveGameStates()

            const message = {
               type: 'newLevelStarts',
               rule: this.rule,
               level: this.level,
               countdown: this.countdown,
               roomType: this.room.type,
               players: this.players,
               team: this.team,
               book_room_until: this.book_room_until
            }

            this.room.socket.broadcastMessage('monitor', message)
            this.room.socket.broadcastMessage('room-screen', message)

            this.preparationIntervalStartedAt = Date.now()

            this.trackBookRoomTime()

            this.preparationInterval = setInterval(async () => {
               this.updatePreparationInterval()
               this.updateGameStates()

               if (this.prepTime === 0) {
                  clearInterval(this.preparationInterval)

                  try {
                     clearInterval(this.animationMetronome);
                     this.gameRuleSpecifics = await this.loadGameRuleSpecifics()
                     this.prepareShapes();
                     console.log('preparation ends...');
                     this.status = 'prepared';
                     resolve(true); // Now resolve after preparation is complete
                  } catch (error) {
                     console.log('CATCH: prepareShapes() failed');
                     reject(error);
                  }
               }
            }, 1000)
        })
    }

    async loadGameRuleSpecifics() {
      try {
         const modulePath = `../roomTypes/${this.room.type}/gameRules/${this.rule}.mjs`;
         console.log('loading '+modulePath+'...')
         const gameRuleModule = await import(modulePath);
         return gameRuleModule;
      } catch (error) {
         console.error(`Failed to load gameRuleSpecifics for ${this.rule}`, error);
         throw error;
      }
    }

    async prepareShapes(){    // handle the animations for the lights
      try {
         const levelConfig = this.gameRuleSpecifics.getShapes(this.level)
         levelConfig.shapes.forEach((shape, index) => {
            let pathDotsToUse = levelConfig.pathDots

            switch(this.level) {
                case 1:
                case 2:
                    pathDotsToUse = index === 1 && levelConfig.extraPathDots.length > 0 ? levelConfig.extraPathDots : levelConfig.pathDots
                    break
                case 3:
                    pathDotsToUse = index === 1 && levelConfig.safeDots.length > 0 ? levelConfig.safeDots : levelConfig.pathDots
                    break
                default:
                    break
            }

            this.shapes.push(new Shape(shape.x, shape.y, 'rectangle', shape.width, shape.height, shape.color, shape.action, pathDotsToUse, shape.speed, 'mainFloor'))
        })
      } catch (error) {
         console.error(`Error loading shapes config: ${error.message}`)
      }
    }

    handleLightClickAction(lightId, whileColorWas) {
      let clickedLight = this.GetLightById(lightId)

      function arraysEqual(arr1, arr2) {
         return arr1.length === arr2.length && arr1.every((val, index) => val === arr2[index]);
      }

      if (this.isWaitingForChoiceButton && !this.isChoiceButtonPressed) {
         if (arraysEqual(whileColorWas, [255, 252, 0]) || arraysEqual(whileColorWas, [0, 255, 0])) {
            this.roomMessage = 'continue'
         } else if (arraysEqual(whileColorWas, [255, 0, 0])) {
            this.roomMessage = 'exit'
         }

         this.isChoiceButtonPressed = true
         this.isWaitingForChoiceButton = false

         if (this.roomMessage === 'continue') {
            if (this.currentLevelOffer === 'same') {
               this.startSameLevel()
            } else if (this.currentLevelOffer === 'next') {
               this.startNextLevel()
            }
         } else if (this.roomMessage === 'exit') {
            this.endAndExit()
         }
         return
      } 

      this.handleGameSpecificLightAction(clickedLight, whileColorWas)
    }

    handleGameSpecificLightAction(clickedLight, whileColorWas) {
      if (this.isWaitingForChoiceButton) return

      if (this.ruleAction) {
         this.ruleAction(clickedLight, whileColorWas, this)
      } else {
         console.warn(`No ruleAction handler for rule ${this.rule}`)
      }
    }

    GetLightById(lightId) {
        let res
        this.room.lights.some((light) => {
            if(light.id === lightId){
                res = light
                return true
            }
        })
        return res
    }

    updateShapes() {
        let now = Date.now()
        this.shapes.forEach((shape) => {
            if(shape.active){
                if(shape.activeUntil !== undefined && shape.activeUntil < now) {
                    shape.active = false
                } else {
                    shape.update()
                }
            }
        })
    }

    applyShapesOnLights() {
        // scanning the shapes array reversly to focus on the last layer
        this.room.lights.forEach((light) => {
            if(!light.isAffectedByAnimation){return false}
            let lightHasColor = false

            for (let i = this.shapes.length - 1; i >= 0; i--) {
                const shape = this.shapes[i]
                if(!shape.active){continue}
                if(!(this.room.lightGroups[shape.affectsLightGroup].includes(light))){continue}
                // does that shape cross into that light ?
                let areIntersecting = false
                if(shape.shape === 'rectangle' && light.shape === 'rectangle'){
                    areIntersecting = areRectanglesIntersecting(shape, light)
                }else{
                    throw new Error('intersection not computable for these shapes (TODO).')
                }
                if(areIntersecting){
                    light.color = shape.color
                    light.onClick = shape.onClick
                    lightHasColor = true
                    break
                }
            }

            if(lightHasColor === false && light.isAffectedByAnimation === true){
                light.color = [0,0,0]
                light.onClick = 'ignore'
            }
        })
    }

    async levelCompleted() {
      console.log('Level Completed')
      clearInterval(this.animationMetronome)

      // Calculate the time taken to complete the level
      const timeTaken = Math.round((Date.now() - this.lastLevelStartedAt) / 1000)
      const levelKey = `${this.room.type} > ${this.rule} > L${this.level}`

      // Generate parent_gs_id
      const formatName = name => name.trim().replace(/\s+/g, '_')
      const baseName = formatName(this.team?.name || this.players[0]?.nick_name || 'anon')
      this.parent_gs_id = `${baseName}_${this.room.type}_${this.rule}_L${this.level}_win`

      // Update team and player games_history
      this.updateGamesHistory(this.team, levelKey, timeTaken, true)
      this.players.forEach(player => this.updateGamesHistory(player, levelKey, timeTaken, true))

      this.isWon = true

      // Send message to clients
      const message = {
         type: 'levelCompleted',
         message: 'Player Wins',
         'cache-audio-file-and-play': 'levelCompleted'
      }

      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)

      // Submit finished game session
      this.submitFinishedGameSession()
       
      this.offerNextLevel()
    }

    async levelFailed() {
      console.log('Level Failed')
      clearInterval(this.animationMetronome)

      // Calculate the time taken to complete the level
      const timeTaken = Math.round((Date.now() - this.lastLevelStartedAt) / 1000)
      const levelKey = `${this.room.type} > ${this.rule} > L${this.level}`

      // Generate parent_gs_id
      const formatName = name => name.trim().replace(/\s+/g, '_')
      const baseName = formatName(this.team?.name || this.players[0]?.nick_name || 'anon')
      this.parent_gs_id = `${baseName}_${this.room.type}_${this.rule}_L${this.level}_lose`

      // Update team and player games_history
      this.updateGamesHistory(this.team, levelKey, timeTaken, false)
      this.players.forEach(player => this.updateGamesHistory(player, levelKey, timeTaken, false))
      
      const message = {
         type: 'levelFailed',
         message: 'Player Lose',
         'cache-audio-file-and-play': 'levelFailed'
      }

      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)

      // Submit the session even when the level fails
      this.submitFinishedGameSession()

      this.offerSameLevel()
    }  

    offerSameLevel() {
      this.isWaitingForChoiceButton = true
      this.currentLevelOffer = 'same'
      this.startChoiceButtons(yellow)

      const message = {
         type: 'offerSameLevel',
         message: 'Game Over! Press Yellow Button to play again, press Red Button to leave the room.'
      }

      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
    }

    offerNextLevel() {
      this.isWaitingForChoiceButton = true
      let isLastLevel = false

      if (this.room.type === 'doubleGrid' && this.level === 3) {
         isLastLevel = true
      }

      const buttonColor = isLastLevel ? yellow : green
      const message = isLastLevel 
      ? {
            type: 'offerNextLevel',
            message: 'This is the last level! Press Yellow button to play again, press Red Button to leave the room.'
        } 
      : {
            type: 'offerNextLevel',
            message: 'Game Over! Press Green Button to proceed to next level, press Red Button to leave the room.'
        }

      this.currentLevelOffer = isLastLevel ? 'same' :  'next'
      this.startChoiceButtons(buttonColor)

      this.room.socket.broadcastMessage('monitor', message)
      this.room.socket.broadcastMessage('room-screen', message)
    }

    async startSameLevel() {
      this.reset()
      this.room.isFree = false
      this.isChoiceButtonPressed = false

      this.gameLogEvent( this.team, 'start_same_level', `Team replay level ${this.level}`)
      this.players.forEach(player => this.gameLogEvent(player, 'start_same_level', `player replay level ${this.level}`))

      // Create a new session
      this.room.currentGameSession = await this.room.gameManager.loadGame(
         this.room,
         this.room.type,
         this.rule, 
         this.level, 
         this.players, 
         this.team,
         this.book_room_until,
         this.is_collaborative,
         5, // timeToPrepare, from 15 to 5
         this.parent_gs_id
      )

      if (!this.room.currentGameSession) {
         this.logEvent('same_level_failed', 'Failed to load same level.')
         return
      }
      
      // this.room.currentGameSession.start()
      this.gameLogEvent( this.team, 'start_same_level', `Team started replaying level ${this.level}`)
      this.players.forEach(player => this.gameLogEvent(player, 'start_same_level', `Player started replaying level ${this.level}`))
    }

    async startNextLevel() {   
      // Reset current game session properly
      this.reset()
      this.isChoiceButtonPressed = false
      this.room.isFree = false

      let isLastLevel = false
      if (this.room.type === 'doubleGrid' && this.level === 3) {
         isLastLevel = true
      }

      if (isLastLevel) {
         this.gameLogEvent( this.team, 'last_level_reached', `Team has reached the last level: Level ${this.level}`)
         this.players.forEach(player => this.gameLogEvent(player, 'start_next_level', `Player has reached the last level: Level ${this.level}`))
         return 
      }

      // Properly assign the new game session
      this.room.currentGameSession = await this.room.gameManager.loadGame(
         this.room,
         this.room.type,
         this.rule, 
         parseInt(this.level, 10) + 1, 
         this.players, 
         this.team,
         this.book_room_until,
         this.is_collaborative,
         5,  // timeToPrepare, from 15 to 5
         this.parent_gs_id
      )

      if (!this.room.currentGameSession) {
         this.logEvent('next_level_failed', 'Failed to load next level.')
         return
      }    
      
      // this.room.currentGameSession.start()
      this.gameLogEvent( this.team, 'start_next_level', `Team advanced to level ${this.level}`)
      this.players.forEach(player => this.gameLogEvent(player, 'start_next_level', `Player advanced to level ${this.level}`))
    }

    updatePreparationInterval() {
      //console.log('TimeToPrepare:', this.timeToPrepare)
      let timeLeft = Math.round((this.preparationIntervalStartedAt + (this.timeToPrepare * 1000) - Date.now()) / 1000)

      if (timeLeft != this.prepTime) {
         //console.log('TIMELEFT: ', timeLeft, 'PREPTIME: ', this.prepTime)
         if (timeLeft >= 0) {
            this.prepTime = timeLeft
            this.updateGameStates()
            if (this.prepTime === 15) {
               const message = {
                  type: 'updatePreparationInterval',
                  'cache-audio-file': '321go'
               }

               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)
            } else if (this.prepTime === 3) {
               const message = {
                  type: 'updatePreparationInterval', 
                  countdown: this.prepTime,
                  'play-audio-file': '321go'
               }

               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)
            } else {
               const message = {
                  type: 'updatePreparationInterval',
                  countdown: this.prepTime
               }

               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)
            }
         }
      }
    }

    updateCountdown() {
        if (this.status === undefined) return

         const penalties = this.penaltyTimestamps ? this.penaltyTimestamps.length : 0
         const baseTimeLeft = Math.round((this.lastLevelStartedAt + (this.timeForLevel * 1000) - Date.now()) / 1000)
         const timeLeft = baseTimeLeft - (penalties * 5)

        if (timeLeft !== this.countdown) {
            if (timeLeft >= 0) {               
               const message = {
                  type: 'updateCountdown',
                  countdown: this.countdown
               }
   
               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)

               this.countdown = timeLeft
               this.updateGameStates()
            } else {
               const message = { 
                  type: 'timeIsUp', 
                  message: 'Player ran out of time.'
               }

               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)

               this.levelFailed()
               this.gameLogEvent( this.team, 'time_is_up', 'Team ran out of time')
               this.players.forEach(player => this.gameLogEvent(player, 'time_is_up', 'Player ran out of time'))
            }
        }
    }

    loseTime() {
      this.penaltyTimestamps.push(Date.now())
      this.updateCountdown()
    }

    async start() {
      if (this.status === 'running') {
         console.warn('Game is already running. Ignoring start call.')
         return
      }
      
      // Load rule module before setup
      try {
         const ruleModuleName = this.rule

         const module = await import(`../roomTypes/${this.room.type}/gameRules/${ruleModuleName}.mjs`)

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

      // Continue startup
      this.setupGame()
      this.gameStartedAt = Date.now()
      this.status = 'running'
      console.log('Game Session started.')
    }
  
    setupGame() {
      console.log('Setting up game...')
    }

    startChoiceButtons(color) {
      if (this.isWaitingForChoiceButton) {

         this.room.lightGroups.wallButtons[0].color = color
         this.room.lightGroups.wallButtons[1].color = red 

         this.room.lightGroups.wallButtons.forEach((light, i) => {
            if (i === 0 || i === 1) {
               light.onClick = 'report' 
            } else {
               light.color = black
               light.onClick = 'ignore'
            }
         })

         this.isChoiceButtonPressed = false
      }
    }

    async endAndExit() {
      console.log('Game Ended...')
      this.room.socket.broadcastMessage('monitor', { type: 'endAndExit' })
      this.room.socket.broadcastMessage('room-screen', { type: 'endAndExit' })
      this.reset()
      this.score = 0
      this.room.isFree = true
      this.room.currentGameSession = undefined
      this.room.currentGame = undefined
      this.clearGameStates()
    }

    // Session
    trackBookRoomTime() {
      if (this.bookRoomInterval) clearInterval(this.bookRoomInterval)

      let warningSent = false

      this.bookRoomInterval = setInterval(() => {
         if(!this.book_room_until) return

         const now = Date.now()
         const bookRoomTime = new Date(this.book_room_until).getTime()
         const timeLeft = bookRoomTime - now

         this.checkExpiredFacilitySessions();

         const threeMinutes = 3 * 60 * 1000 // 3-minutes before timeout
         const oneSecond = 1000

         if (timeLeft <= 0) {
            clearInterval(this.bookRoomInterval)

            if (!this.checkUpcomingGameSession) {
               const message = {
                  type: 'bookRoomExpired',
                  message: 'Time is up! Please exit or extend your session.'
               }
   
               this.room.socket.broadcastMessage('monitor', message)
               this.room.socket.broadcastMessage('room-screen', message)
            } else {
               this.endAndExit()    // End the session and notify everyone
            }
         } else if (!warningSent && Math.abs(timeLeft - threeMinutes) <= oneSecond) {
            // Send warning once at the 3-minute mark
            const message = {
               type: 'bookRoomWarning',
               message: 'Time is almost up! You have 3 minutes left.',
            }

            this.room.socket.broadcastMessage('monitor', message)
            this.room.socket.broadcastMessage('room-screen', message)

            warningSent = true
         }
      }, 1000)  
    }

    async checkUpcomingGameSession() {
      const gra_id = os.hostname()
      try {
         const response = await axios.get(`http://${process.env.GFA_HOSTNAME}:${process.env.GFA_PORT}/api/game-room/${gra_id}/is-upcoming-game-session`)
         const data = response.data
   
         if (response.status === 200) {
            // Assuming data is an object with the is_upcoming flag
            if (typeof data.is_upcoming === 'boolean') {
               this.room.socket.broadcastMessage('monitor', {
                  type: 'isUpcomingGameSession',
                  is_upcoming: data.is_upcoming
               })
               return data.is_upcoming
            } else {
               console.error('Invalid data structure:', data)
               return false
            }
         } else {
            console.error('Unexpected response status:', response.status)
            return false
         }
      } catch (error) {
         console.error('Error checking for upcoming game session:', error)
         return false
      }
    }

    async checkExpiredFacilitySessions() {
      const now = Date.now()

      // Flag to check if any player has expired session
      let expiredPlayers = false;

      // Loop through each player to check if their facility session is expired
      this.players.forEach(player => {
         const sessionEndTime = new Date(player.facility_session.date_end).getTime()

         if (sessionEndTime <= now) {
            expiredPlayers = true

            // Notify player to leave the room
            this.room.socket.broadcastMessage('monitor', {
               type: 'facilitySessionExpired',
               message: `Player ${player.nick_name}'s session has expired. You must exit the room.`
            })

            this.room.socket.broadcastMessage('room-screen', {
               type: 'facilitySessionExpired',
               message: `Player ${player.nick_name}'s session has expired. Please exit the room.`
            })
         }
      })

      // If any player's session has expired, end the game for all players
      if (expiredPlayers) {
         this.endAndExit()
      }
    }

    async submitFinishedGameSession() {
      const gameSessionData = {
         players: this.players,
         team: this.team,
         roomType: this.room.type,
         gameRule: this.rule,
         gameLevel: this.level,
         durationStheory: this.timeForLevel,
         isWon: this.isWon,
         score: this.score,
         isCollaborative: this.is_collaborative,
         log: this.log,
         parentGsId: this.parent_gs_id
      };
   
      try {
         const response = await axios.post(`http://${process.env.GFA_HOSTNAME}:${process.env.GFA_PORT}/api/game-sessions`, gameSessionData);
   
         if (response.status === 200) {
            console.log('Game session uploaded successfully');
         }
      } catch (error) {
         console.error('Error uploading game session:', error.message);
      }
    }

    // Data

    saveGameStates() {
      this.clearGameStates()
      
      const gameStates = {
         players: this.players,
         team: this.team,
         roomType: this.room.type,
         rule: this.rule,
         level: this.level,
         book_room_until: this.book_room_until,
         countdown: this.countdown,
         lifes: this.lifes,
         prepTime: this.prepTime,
         score: this.score,
         parent_gs_id: this.parent_gs_id || null
      }

      try {
         const dir = path.dirname(GAME_STATES_PATH)
   
         // Ensure the directory exists
         if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
         }
   
         fs.writeFileSync(GAME_STATES_PATH, JSON.stringify(gameStates, null, 2), 'utf8')
      } catch (error) {
         console.error('Failed to save game states:', error)
      }
    }

    updateGameStates() {
      if (!fs.existsSync(GAME_STATES_PATH)) return

      const gameStates = JSON.parse(fs.readFileSync(GAME_STATES_PATH, 'utf8'))

      gameStates.prepTime = this.prepTime
      gameStates.countdown = this.countdown
      gameStates.lifes = this.lifes
      gameStates.level = this.level

      fs.writeFileSync(GAME_STATES_PATH, JSON.stringify(gameStates, null, 2), 'utf8')
    }

    clearGameStates() {
      if (fs.existsSync(GAME_STATES_PATH)) {
          fs.unlinkSync(GAME_STATES_PATH) // Deletes the game state file
          console.log('Game states cleared.')
      }
    }  

    updateGamesHistory(entity, levelKey, timeTaken, isCompleted) {
      if (!entity || !entity.games_history) {
         console.error("Invalid entity or games_history")
         return
      }

      if(!entity.games_history[levelKey]) {
         // Initialize history if it doesn't exist
         entity.games_history[levelKey] = {
            best_time: timeTaken,
            played: 1,
            played_today: 1
         }
      } else {
         const history = entity.games_history[levelKey]
         const oldBestTime = history.best_time

         if (isCompleted) {
            // Update best time if new time is better
            history.best_time = history.best_time === 0 ? timeTaken : Math.min(history.best_time, timeTaken)

            // Log event if new record is set
            if (history.best_time < oldBestTime) {
               const entityType = entity === this.team ? "team" : "player"

               this.gameLogEvent(
                  entity, 
                  `new_${entityType}_record`,
                  `New ${entityType} record on ${this.room.type} Level ${this.level}: ${history.best_time} seconds instead of ${oldBestTime}`
               )
            }
         }

         history.played += 1

         // Reset played_today if its a new day
         const lastPlayedDate = new Date(this.createdAt).toDateString()
         const today = new Date().toDateString() 
         history.played_today = lastPlayedDate === today ? history.played_today + 1 : 1
      }
    }

    gameLogEvent(entity, type, caption) {
      if (!entity) {
         console.error('Entity is null. Unable to log event')
         return
      }

      // if team is null, use player as fallback
      if (entity === this.team || entity === null) {
         entity = this.players[0]
      }

      if(!entity.events_to_debrief) {
         entity.events_to_debrief = []
      }

      entity.events_to_debrief.push({type, caption})
    }

    logEvent(event, details) {
      this.log.push({ event, details })
    }
}