export function getPhysicalElements(type) {
   const elements = {
      "lights": [
         [130,130,'rectangle','ledSwitch',960,480,25,25,5,5,'mainFloor', true],
      
         [255,70,'rectangle','ledSwitch',960,100,15,15,200,40, 'wallButtons',false],
         [255,640,'rectangle','ledSwitch',960,100,15,15,200,40,'wallButtons',false],
         [70,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false],
         [1120,240,'rectangle','ledSwitch',100,500,15,15,40,200,'wallButtons',false],
         
         [250,30,'rectangle','screen',960,100,25,25,190,40, 'wallScreens',false],
         [250,670,'rectangle','screen',960,100,25,25,190,40,'wallScreens',false],
         [30,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false],
         [1150,235,'rectangle','screen',100,500,25,25,40,190,'wallScreens',false],
      ]
   }

   return elements[type]
}

