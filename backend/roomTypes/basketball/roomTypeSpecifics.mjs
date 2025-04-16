export function getPhysicalElements(type) {
   const elements = {
      "lights": [
         [130, 130, 'rectangle', 'ledSwitch', 960, 100, 80, 80, 90, 5, 'wallButtons', false]
      ]
   }

   return elements[type]
}