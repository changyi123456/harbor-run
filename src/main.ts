import './style.css';
const app=document.getElementById('app')!;
const params=new URLSearchParams(location.search);
if(params.has('controller')){
  const {mountController}=await import('./platform/controller');await mountController(app,params.get('controller')?.toUpperCase()??'');
}else{
  const {mountGame}=await import('./game/game');await mountGame(app);
}
