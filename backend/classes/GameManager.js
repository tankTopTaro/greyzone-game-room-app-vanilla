import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default class GameManager {
    constructor(env) {
        this.env = env
    }

    async loadGame(roomInstance, roomType, rule, level, players, team, book_room_until, is_collaborative, timeToPrepare, parent_gs_id = null) {
        try {
            const GAMES_DIR = path.join(__dirname, `../roomTypes/${roomType}/roomTypeSpecifics.mjs`)

            console.log(`Loading game: ${GAMES_DIR}`)

            const { default: GameClass } = await import(`file://${GAMES_DIR}`)

            const gameInstance = new GameClass(roomInstance, rule, level, players, team, book_room_until, is_collaborative, undefined, timeToPrepare, parent_gs_id)

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
    }
}