import fs from 'fs'
import path from 'path'
import { WebSocketServer } from "ws"
import { EventEmitter } from "events"
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const GAME_STATES_PATH = path.join(__dirname, '../assets/db/game_states.json')

export default class Socket extends EventEmitter {
    constructor(port) {
        super()
        this.port = port
        this.socket = null
        this.clientByName = {}
        this.init()
    }

    init() {
      console.log('Socket initialized...')
        const host = process.env.HOSTNAME || '0.0.0.0'
        this.socket = new WebSocketServer({ port: this.port, host: host })

        this.socket.on('connection', (client, request) => {
            const forwarded = request.headers['x-forwarded-for']
            let clientIp = forwarded ? forwarded.split(',')[0].trim() : request.socket.remoteAddress

            // Normalize IPv6 localhost
            if (clientIp === '::1') clientIp = '127.0.0.1'

            client.clientIp = clientIp
            client.userAgent = request.headers['user-agent']
            
            // Expect the first message to contain the clientname
            client.once('message', (message) => {
                try {
                    const data = JSON.parse(message.toString())
                    console.log('Socket for '+data.clientname+' received message from client:', data.message);

                    if(data.clientname) {
                        const clientName = data.clientname

                        if (!this.clientByName[clientName]) {
                            this.clientByName[clientName] = new Set()
                        }

                        this.clientByName[clientName].add(client)
                        console.log('New client connected on the webSocket for '+clientName+'. clientIp: '+client.clientIp+' browser: '+client.userAgent);

                        // Send stored game states to the client
                        this.sendStoredGameStates(client)

                        // Handle messages from this client
                        client.on('message', (message) => {
                            this.emit(clientName, message.toString())
                        })

                        // Handle disconnections
                        client.on('close', () => {
                            this.handleClientDisconnect(clientName, client)
                        })
                    }
                } catch (error) {
                    console.error("Invalid message format:", error)
                }
            })
        })

        console.log('WebSocket Server running on port ' + this.port)
    }

    broadcastMessage(clientname, message) {
      // console.log(`Broadcasting ${JSON.stringify(message)} to ${clientname}`)
        if (this.clientByName[clientname]) {
            this.clientByName[clientname].forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message))
                }
            })
        }
    }

    handleClientDisconnect(clientname, client) {
        console.log(`Client from ${clientname} disconnected.`)
    
        if (this.clientByName[clientname]) {
            this.clientByName[clientname].delete(client)
            
            if (this.clientByName[clientname].size === 0) {
                delete this.clientByName[clientname] // Fully remove clientname entry
                console.log(`All clients from ${clientname} are disconnected.`)
            }
        }
    }

    onClientMessage(clientname, callback) {
        this.on(clientname, callback)
    }

    sendStoredGameStates(client) {
         if (fs.existsSync(GAME_STATES_PATH)) {
            try {
               const gameStates = JSON.parse(fs.readFileSync(GAME_STATES_PATH, 'utf8'))

               if (gameStates && Object.keys(gameStates).length > 0) {
                  client.send(JSON.stringify({
                     type: 'storedGameStates',
                     data: gameStates
                  }))
                  console.log('Sent stored game states to client')
               }
            } catch (error) {
               console.error('Error reading file:', error)
            }
         }
    }
}