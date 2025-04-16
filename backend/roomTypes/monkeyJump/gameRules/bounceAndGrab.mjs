const levelConfigs = [

]

export function getShapes(level = 1) {
   return levelConfigs[level].shapes
}

export function prepareGameLogic(gameSession) {
   const config = levelConfigs[gameSession.level]
}