export type ControllerLayout='auto'|'left'|'right';
/** Rotate the page itself when OS rotation lock keeps the viewport portrait. */
export function controllerRotation(layout:ControllerLayout,width:number,height:number){
  if(layout==='auto'||width>=height)return 0;
  return layout==='left'?90:-90;
}
export function controllerAngle(screenAngle:number,pageRotation:number){return ((screenAngle+pageRotation)%360+360)%360;}
