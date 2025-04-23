import express from 'express'
import cors from 'cors'
import path from 'path'
import axios from 'axios'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

import Socket from '../classes/Socket.js'
import GameManager from './GameManager.js'
import Light from './Light.js'
import { handleUncaughtException } from '../utils/utils.js'
import { getAllAvailableGameRules } from '../utils/getAllAvailableGameRules.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.on('uncaughtException', handleUncaughtException)

dotenv.config()

export default class Room {
    constructor(roomType) {
      this.socket = new Socket(8082)
      this.gameManager = new GameManager()
      this.currentGame = null // Track current game

      this.enabled = true // Enabling/Disabling the Room
      this._isFree = true  
      this.currentGameSession = undefined

      this.width
      this.height

      this.lights = []
      this.lightCounter = 0
      this.lightGroups = {}

      this.sendLightsInstructionsIsBusy = false
      this.sendLightsInstructionsRequestPending = false

      this.created_at = Date.now()
      this.type = roomType

      this.availableGameRules
      this.roomTypeSpecifics

      this.init()
    }

    async init() {
      this.roomTypeSpecifics = await this.loadRoomTypeSpecifics()
      this.availableGameRules = await getAllAvailableGameRules(this.type)

      // this.prepareLights()
      this.roomTypeSpecifics.preparePhysicalElements(this)
      this.measure()
      this.startServer()
      this.setupWebSocketListeners()
      
      try {
         await this.notifyFacility()
      } catch (error) {
         console.error('Continuing without notifying facility')
      }
    }

    setupWebSocketListeners() {
      this.socket.onClientMessage('monitor', (message) => {
         try {
            const data = JSON.parse(message)
            //console.log('Received message from monitor:', data)

            if (data.type === 'lightClickAction') {
               //console.log(`Light ID: ${data.lightId} | WhileColorWas: ${data.whileColorWas}`)
               this.currentGameSession.handleLightClickAction(parseInt(data.lightId, 10), data.whileColorWas)
            }
         } catch (error) {
            console.error('Error parsing WebSocket message:', error)
         }
      })
    }

    async loadRoomTypeSpecifics() {
      try {
         const modulePath = `../roomTypes/${this.type}/roomTypeSpecifics.mjs`;

         console.log('loading '+modulePath+'...')
         const roomTypeModule = await import(modulePath);
         return roomTypeModule;
      } catch (error) {
         console.error(`Failed to load roomTypeSpecifics for ${this.type}`, error);
         throw error;
      }
    }

    async prepareLights(){      
      const lightConfigs = this.roomTypeSpecifics.getPhysicalElements('lights')
      const lightPhysicalElements = lightConfigs

      lightPhysicalElements.forEach((lightConfig) => {
         const [matrixPosX, matrixPosY, elementsShape, elementsType, matrixWidth, matrixHeight, tileWidth, tileHeight, marginX, marginY, lightGroup, isAffectedByAnimation] = lightConfig;
      
         this.addMatrix(matrixPosX, matrixPosY, elementsShape, elementsType, matrixWidth, matrixHeight, tileWidth, tileHeight, marginX, marginY, lightGroup, isAffectedByAnimation);
      })      
    }  

    addMatrix(matrixPosX,matrixPosY,elementsShape,elementsType,matrixWidth,matrixHeight,tileWidth,tileHeight,marginX,marginY,lightGroup,isAffectedByAnimation){
        let numberOfTilesX = Math.floor(matrixWidth / (tileWidth+marginX))
        let numberOfTilesY = Math.floor(matrixHeight / (tileHeight+marginY))
        for (let i = 0; i < numberOfTilesX; i++) {
            for (let j = 0; j < numberOfTilesY; j++) {

                let light = new Light(this.lightCounter,matrixPosX+(i*(tileWidth+marginX)),matrixPosY+(j*(tileHeight+marginY)), elementsShape, elementsType, tileWidth, tileHeight,isAffectedByAnimation)
                
                if (!(lightGroup in this.lightGroups)){
                    this.lightGroups[lightGroup] = []
                }
                this.lightGroups[lightGroup].push(light)
                this.lights.push(light)
                this.lightCounter++
            }
        }
    }

    measure(){
        let minX,maxX,minY,maxY = undefined
        this.lights.forEach((light) => {
            if(minX === undefined || light.posX < minX){minX = light.posX}
            if(maxX === undefined || (light.posX+light.width) > maxX){maxX = (light.posX+light.width)}
            if(minY === undefined || light.posY < minY){minY = light.posY}
            if(maxY === undefined || (light.posY+light.height) > maxY){maxY = (light.posY+light.height)}
        })
        this.padding = {'left':minX,'top':minY}
        this.width = maxX + minX
        this.height = maxY + minY
    }

    startServer() {
        // Prepare server
        this.server = express()
        const serverPort = 3002
        const serverHostname = process.env.HOSTNAME || '0.0.0.0'

        // Middleware to set no-cache headers for all routes
        this.server.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')
            res.setHeader('Surrogate-Control', 'no-store')
            next()
        })

        this.server.use(express.json())
        this.server.use(cors())
        this.server.use(express.static(path.join(__dirname, '../assets')))
        this.server.use(express.static(path.join(__dirname, '../public')))

        // API routes
        this.server.use((req, res, next) => {
            // Allow the /api/toggle-room to work
            if (!this.enabled && req.path.startsWith('/api/') && req.path !== '/api/toggle-room' && req.path !== '/api/health' && req.path !== '/api/room-status') {
                //console.log('Room enabled: ', this.enabled)
                return res.status(503).json({ error: 'Room is currently disabled' })
            }
            next()
        })

        this.server.use('/api/start-game-session', async (req, res) => {
            try {
               const { team, players, room, book_room_until, is_collaborative } = req.body
   
               if (!room || !players) {
                  return res.status(400).json({ error: 'Missing data'})
               }
      
               const [roomType, rule, level] = room.split(',')
      
               if (!roomType || !rule || !level || !players.length) {
                  return res.status(400).json({ error: 'Invalid room format or missing players' })
               }
      
               // Check if a game session is already running
               if (this.currentGameSession && this.currentGameSession.status === 'running') {
                  return res.status(403).json({ error: 'gameroom-busy' })
               }

               res.status(200).json({message: 'Session received'})
      
               // Start the session
               this.startGame(roomType, rule, level, players, team, book_room_until, is_collaborative)
                  .catch(err => {
                     throw new Error("Error starting game.", err)
                  })
            } catch (error) {
               console.error('Error in start-game-session:', err);
               return res.status(500).json({ error: 'Internal server error' });
            }
        })

        this.server.use('/api/toggle-room', (req, res) => {
            const { status } = req.body

            console.log('Received toggle request:', status)
   
            if (typeof status === 'boolean') {
               this.enabled = status
   
               // Stop running games if room is disabled
               if (!this.enabled && this.currentGame) {
                  this.currentGame.stop()
                  this.currentGame = null
                  this.currentGameSession = null
                  this.isFree = true
               }
               
               res.json({ enabled: this.enabled })
            } else {
               res.status(400).json({ error: 'Invalid status value'})
            }
        })
        this.server.use('/api/game-audio/:audioName', (req, res) => {
            const audio = {
               'levelFailed': 'audio/703542__yoshicakes77__dead.ogg',
               'levelCompleted': 'audio/703543__yoshicakes77__win.ogg',
               'playerScored': 'audio/703541__yoshicakes77__coin.ogg',
               'playerLoseLife': 'audio/253174__suntemple__retro-you-lose-sfx.wav',
               'gameOver': 'audio/76376__deleted_user_877451__game_over.wav',
               '321go': 'audio/474474__bnewton103__robotic-countdown.wav',
               'red': 'audio/196551__margo_heston__red-f.wav',
               'green': 'audio/196520__margo_heston__green-f.wav',
               'blue': 'audio/196535__margo_heston__blue-f.wav',
               'yellow': 'audio/196531__margo_heston__yellow-f.wav',
               'purple': 'audio/196547__margo_heston__purple-f.wav'
         }
         const audioName = req.params.audioName
      
         if (!audio[audioName]) return res.status(404).json({error: 'Audio not found'})
      
            res.json({ url: audio[audioName] })
       })

        this.server.get('/api/health', async(req, res) => { res.status(200).json({ status: 'ok' }) })  

        // Frontend routes
        this.server.get('/', (req, res) => {
            res.send('<html><body><h1>Hello</h1></body></html>')
        })
        this.server.get('/monitor', (req, res) => {
            const filePath = path.join(__dirname, '../public/monitor.html')
            res.sendFile(filePath)
        })
        this.server.get('/room-screen', (req, res) => {
            const filePath = path.join(__dirname, '../public/room.html')
            res.sendFile(filePath)
        })
        this.server.get('/get/roomData', (req, res) => {
            res.setHeader('Content-Type', 'application/json')
            res.json({
                room:{ width: this.width, height: this.height },
                lights: this.lights
            })
        })

        // Start server
        this.server.listen(serverPort, serverHostname, () => {
            console.log(`Server running at http://${serverHostname}:${serverPort}/`)
            console.log(`Monitor running at http://${serverHostname}:${serverPort}/monitor`)
            console.log(`Room Screen running at http://${serverHostname}:${serverPort}/room-screen \n`)
        })
    }

    sendLightsInstructionsIfIdle(){
      if(this.sendLightsInstructionsIsBusy){
         if(this.sendLightsInstructionsRequestIsPending){
            console.log('WARNING : Animation frame LOST ! (received sendLightsInstructionsIfIdle while sendLightsInstructionsRequestIsPending Already)')
            throw new Error('WARNING : Animation frame LOST ! (received sendLightsInstructionsIfIdle while sendLightsInstructionsRequestIsPending Already)')
         }
         this.sendLightsInstructionsRequestIsPending = true
         console.log('WARNING : Animation frame delayed (received sendLightsInstructionsIfIdle while sendLightsInstructionsIsBusy)')
         return false
      }
      this.sendLightsInstructionsIsBusy = true

      this.sendLightsInstructions()

      this.sendLightsInstructionsIsBusy = false
      if(this.sendLightsInstructionsRequestIsPending){
         this.sendLightsInstructionsRequestIsPending = false
         this.sendLightsInstructionsIfIdle()
         console.log('WARNING : doing another sendLightsInstructionsIfIdle in a row')
         throw new Error('WARNING : doing another sendLightsInstructionsIfIdle in a row')
      }
      return true
    }

    sendLightsInstructions(){
      this.lights.forEach((light) => {
         light.newInstructionString = JSON.stringify(light.color)

         if(light.lastHardwareInstructionString !== light.newInstructionString){
               this.sendHardwareInstruction(light)
         }

         if(light.lastSocketInstructionString !== light.newInstructionString){
               this.sendSocketInstructionForMonitor(light)
         }
      })
    }

    async sendHardwareInstruction(light){
        let newInstructionString = light.newInstructionString
        let response = await this.sendToHardware(light.hardwareAddress,light.color)
        if(response === true){
            light.lastHardwareInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToHardware FAILS ! for following light:')
            console.log(light)
            throw new Error(`WARNING : sendToHardware FAILS ! for following light: ${light}`)
        }
    }

    async sendSocketInstructionForMonitor(light){

        let newInstructionString = light.newInstructionString
        //console.log('TEST Changing light id:',light.id,' to: ', newInstructionString)
        let response = await this.sendToSocketForMonitor(light)
        if(response === true){
            light.lastSocketInstructionString = newInstructionString
        }else{
            console.log('WARNING : sendToSocketForMonitor FAILS ! for following light:')
            console.log(light)
        }
    }

    async sendToHardware(){
        // TODO
        return true
    }

    async sendToSocketForMonitor(light){
        let message = {'type':'updateLight','lightId':light.id,'color':light.color,'onClick':light.onClick}
        this.socket.broadcastMessage('monitor', message)
        return true
    }

    async startGame(roomType, rule, level, players, team, book_room_until, is_collaborative) {
        //console.log('startGame request: ', { roomType, rule, level, players, team, book_room_until })
        if(this.isFree) {
            this.isFree = false
            
            this.currentGameSession = await this.gameManager.loadGame(this, roomType, rule, level, players, team, book_room_until, is_collaborative)
         
            if (this.currentGameSession) {
               this.currentGame = this.currentGameSession
            } else {
               throw new Error('Failed to start game session')
            }
         }
    }

    get isFree() {
      return this._isFree
    }

    set isFree(value) {
      if (this._isFree !== value) {

         this._isFree = value

         this.notifyFacility()
      }
    }

    async notifyFacility() {
      const gra_id = process.env.HOSTNAME
      // console.log(`${gra_id} is notifying Facility...`)
      const apiURL = `http://${process.env.GFA_HOSTNAME}:${process.env.GFA_PORT}/api/game-room/${gra_id}/available`

      try {
         const response = await axios.post(apiURL, { 
            available: this.isFree, 
            enabled: this.enabled,
            room: this.type,
            rules: this.availableGameRules
         })
         if (response.status === 200) {
            // console.log('Facility notified:', response.data)
         }
      } catch (error) {
         console.error('Error notifying facility', error.code)
      }
    }

}
