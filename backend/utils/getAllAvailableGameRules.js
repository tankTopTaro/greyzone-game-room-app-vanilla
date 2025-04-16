import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function getAllAvailableGameRules(roomType) {
   const gameRulesPath = path.join(__dirname, '../roomTypes', roomType, 'gameRules')

   try {
      const ruleFiles = await fs.readdir(gameRulesPath, { withFileTypes: true })

      const gameRules = ruleFiles
         .filter(file => file.isFile() && file.name.endsWith('.mjs'))
         .map(file => path.basename(file.name, '.mjs'))

      return gameRules
   } catch (err) {
      // gameRules folder might not exist or roomTypeName is invalid
      console.warn(`No gameRules found for room type "${roomType}"`)
      return []
   }
}
