# Greyzone Game Room App

## Table of Contents
- [Mission](#mission)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Bugs and Issues](#bugs-and-issues)
- [Important Features](#important-features)

---
## Mission
This is an optimized and more scalable version of the Game Room App. We have streamlined the system by removing unnecessary components, leaving only the core features: monitor and room screens. Games are now modular, audios are fetched only on demand, and the ReportLightClickAction now utilizes WebSockets for more efficient communication.

---

## Technologies Used

The following technologies and frameworks are used in this application:

![HTML](https://img.shields.io/badge/HTML-5-orange?style=flat-square&logo=html5&logoColor=white)  
![CSS](https://img.shields.io/badge/CSS-3-blue?style=flat-square&logo=css3&logoColor=white)  
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=flat-square&logo=javascript&logoColor=white)  
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?style=flat-square&logo=bootstrap&logoColor=white)  
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react&logoColor=white)  
![Node.js](https://img.shields.io/badge/Node.js-16-green?style=flat-square&logo=node.js&logoColor=white)

---

## Installation

To get started with the Greyzone Game Room App, follow these steps:

1. **Install Dependencies**  
   ```bash 
   npm install
   ```

2. **Start the App**  
   ```bash 
   npm start
   ```

---
## Bugs and Issues
1. **TBA** (to be added)

---
## Important Features
Here are some of the key features of the **Greyzone Game Room App:**

1. **GameManager**
   - Responsible for loading the game files.

2. **Room WebSocket Listener**
   - The `Room` component contains the `setupWebSocketListener()` method, which listens for light click events from the frontend. This ensures seamless real-time interaction between the app and the user.

3. **Physical elements**
   - Physical element (Lights, Sensors, etc.) can now be defined inside its `roomTypeSpecifics` module. This file is loaded dynamically when the room is initialized.

4. **Game Rule Specific Logic**
   - Logics for specific rules of the game can be defined in there `gameRuleSpecifics` module. This file is loaded when a session is initializing.

5. **Game Modules**
   - Game modules must be placed inside the `games` directory. These modules are automatically detected by the system and can be loaded dynamically.

6. **Uncaught Exceptions**
   - Uncaught exceptions are now forwarded to the `Game Facility App`
