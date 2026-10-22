import { Match } from './simulation.mjs';
import { Inputs } from './input.mjs';
import { Renderer, NAMES } from './render.mjs';
import { Audio } from './audio.mjs';
const $=id=>document.getElementById(id);
const canvas=$('game'),renderer=new Renderer(canvas),audio=new Audio();
let selected='ryu',match=null,last=0,accumulator=0,ready=false;
const input=new Inputs(canvas,()=>togglePause(),()=>{if(match&&match.phase!=='result')setPause(true);});
function setPause(value){
  if(!match||match.phase==='result')return;
  match.paused=value;input.clear();$('pause').textContent=value?'Resume':'Pause';
  $('status').textContent=value?'Paused · Enter or Start to resume':(match.phase==='active'?'Fight!':`Round ${match.round}`);
}
function togglePause(){setPause(!match?.paused);canvas.focus({preventScroll:true});audio.unlock();}
function start(){
  if(!ready)return;
  audio.unlock();match=new Match(selected,$('mode').value);input.clear();input.enabled=true;
  $('menu').hidden=true;$('results').hidden=true;$('pause').disabled=false;$('pause').textContent='Pause';
  $('p1-name').textContent=NAMES[match.names[0]];$('p2-name').textContent=NAMES[match.names[1]];
  $('p1-health').value=1000;$('p2-health').value=1000;
  $('status').textContent='Round 1 · Get ready';canvas.focus({preventScroll:true});last=performance.now();accumulator=0;
}
$('start').disabled=true;
$('start').addEventListener('click',start);$('rematch').addEventListener('click',start);
$('change-fighter').addEventListener('click',()=>{
  match=null;input.enabled=false;input.clear();$('results').hidden=true;$('menu').hidden=false;$('pause').disabled=true;
  $('status').textContent='Choose your fighter';document.querySelector(`[data-fighter="${selected}"]`).focus();
});
document.querySelectorAll('[data-fighter]').forEach(button=>button.addEventListener('click',()=>{
  selected=button.dataset.fighter;
  document.querySelectorAll('[data-fighter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  $('p1-name').textContent=NAMES[selected];$('p2-name').textContent=NAMES[selected==='ryu'?'cyclops':'ryu'];
}));
$('pause').addEventListener('click',togglePause);
$('sound').addEventListener('click',()=>{audio.unlock();audio.enabled=!audio.enabled;$('sound').setAttribute('aria-pressed',String(audio.enabled));$('sound').textContent=audio.enabled?'Sound on':'Sound off';});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('cabinet').requestFullscreen();}
  catch{$('status').textContent='Fullscreen unavailable in this browser.';}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';});
window.addEventListener('keydown',e=>{if(e.code==='Enter'&&!e.repeat&&!match&&ready&&!document.activeElement?.matches('button,a,input,select,textarea,summary')){e.preventDefault();start();}});
function updateHUD(){
  if(!match)return;
  $('p1-health').value=match.players[0].health;$('p2-health').value=match.players[1].health;
  // Keep native progress fallback values useful for assistive technology.
  $('p1-health').setAttribute('value',String(match.players[0].health));$('p2-health').setAttribute('value',String(match.players[1].health));
  $('timer').textContent=String(Math.max(0,Math.ceil(match.time/60))).padStart(2,'0');
  for(const event of match.events.splice(0)){
    audio.play(event);
    if(event.type==='fight')$('status').textContent='Fight!';
    if(event.type==='round')$('status').textContent=`Round ${event.round} · Get ready`;
    if(event.type==='ko')$('status').textContent=event.winner<0?'Draw round':`${NAMES[match.names[event.winner]]} takes the round`;
    if(event.type==='result'){
      input.clear();input.enabled=false;$('results').hidden=false;$('pause').disabled=true;
      $('result-title').textContent=event.winner<0?'Draw match':`${NAMES[match.names[event.winner]]} wins!`;
      $('result-detail').textContent=`${match.wins[0]} – ${match.wins[1]} · ${match.mode==='cpu'?'Versus computer':'Local versus'} · Play again or choose your fighter.`;
      $('status').textContent='Match complete';$('rematch').focus({preventScroll:true});
    }
  }
  if(match.paused)$('status').textContent='Paused · Enter or Start to resume';
}
function frame(now){
  const elapsed=Math.min(100,now-(last||now));last=now;accumulator+=elapsed;
  const keys=input.read();
  let stepped=false;
  while(accumulator>=1000/60){if(match)match.tick(keys);accumulator-=1000/60;stepped=true;}
  if(stepped)input.consume();
  updateHUD();renderer.draw(match,selected);
  $('controller-state').textContent=input.padCount?`${input.padCount} controller${input.padCount===1?'':'s'} connected`:'Keyboard ready';
  requestAnimationFrame(frame);
}
renderer.load().then(()=>{ready=true;$('start').disabled=false;$('start').dataset.ready='true';$('status').textContent='Choose your fighter';requestAnimationFrame(frame);}).catch(error=>{
  $('status').textContent=`Artwork could not load. Reload to retry. ${error.message}`;
  $('start').textContent='Reload to retry';$('start').disabled=false;$('start').addEventListener('click',()=>location.reload(),{once:true});
});
