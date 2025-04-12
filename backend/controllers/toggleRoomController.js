let roomInstance = null

const toggleRoomController = {
    setRoomInstance: (instance) => {
        roomInstance = instance
    },

    toggleRoom: (req, res) => {
        const { status } = req.body

        console.log('Received toggle request:', status)

        if (typeof status === 'boolean') {
            roomInstance.enabled = status

            // Stop running games if room is disabled
            if (!roomInstance.enabled && roomInstance.currentGame) {
                roomInstance.currentGame.stop()
                roomInstance.currentGame = null
                roomInstance.currentGameSession = null
                roomInstance.isFree = true
            }
            
            res.json({ enabled: roomInstance.enabled })
        } else {
            res.status(400).json({ error: 'Invalid status value'})
        }
    }
}

export default toggleRoomController