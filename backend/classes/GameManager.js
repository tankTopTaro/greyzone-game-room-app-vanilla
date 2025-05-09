import path from 'path'
import { fileURLToPath } from 'url'
import GameSession from './GameSession.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default class GameManager {
/*     async loadGame(roomInstance, id, roomType, rule, level, players, team, book_room_until, is_collaborative, timeToPrepare, parent_gs_id = null) {
        try {
            const GAMES_DIR = path.join(__dirname, `../roomTypes/${roomType}/roomTypeSpecifics.mjs`)

            console.log(`Loading game: ${GAMES_DIR}`)

            const { default: GameClass } = await import(`file://${GAMES_DIR}`)

            const gameInstance = new GameClass(roomInstance, rule, level, players, team, book_room_until, is_collaborative, undefined, timeToPrepare, parent_gs_id, id)

            const result = await gameInstance.init()

            if (result !== true) {
                console.log('Game failed to initialize properly')
                return null
            }

            return gameInstance
        } catch (error) {
            console.error(error)
            return null
        }
    } */
    
    async loadGame(roomInstance, id, roomType, rule, level, players, team, book_room_until, is_collaborative, timeToPrepare, parent_gs_id = null) {
        try {
            // Create base GameSession
            const gameSession = new GameSession(roomInstance, rule, level, players, team, book_room_until, is_collaborative, undefined, timeToPrepare, parent_gs_id, id)

            // Dynamically import roomTypeSpecific 
            const specificPath = path.join(__dirname, `../roomTypes/${roomType}/roomTypeSpecifics.mjs`)
            const module = await import(`file://${specificPath}`)

            if (typeof module[roomType] === 'function') {
                module[roomType](gameSession)
            } else {
                console.warn(`No function found for roomType: ${roomType}`)
            }

            // Run init()
            const result = await gameSession.init()
            if (result !== true) {
                console.log('Game failed to initialize properly')
                return null
            }

            return gameSession
        } catch (error) {
            console.error(`Error loading game for roomType ${roomType}: `, error)
        }
    }
}