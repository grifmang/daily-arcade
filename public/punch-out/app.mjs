import {NativeFight,FIGHTERS,FRAME_RATE,BUTTONS} from './engine.mjs';
import {FIGHTER_ART,createFighterArtState,advanceFighterArt,fighterArtParts,PLAYER_ART,createPlayerArtState,advancePlayerArt,playerArtParts} from './fighter-art.mjs';
import {SoundOutput} from './audio-output.mjs';
import {Controller} from './controller.mjs';
const canvas=document.querySelector('#ring'),ctx=canvas.getContext('2d'),announcement=document.querySelector('#announcement'),status=document.querySelector('#state'),pause=document.querySelector('#pause'),select=document.querySelector('#fighter');
const input=new Set(),touchInput=new Set();let padInput=new Set();let activeArt=FIGHTER_ART[0],artState=createFighterArtState(activeArt),running=false,last=0,accumulator=0;
const sound=new SoundOutput();let startPulse=0;
let runEpoch=0,loadingSound=false,resultShown=null;
let playerArtState=createPlayerArtState();
const renderOpponent=params=>advanceFighterArt(activeArt,artState,params);
const renderPlayer=pose=>advancePlayerArt(playerArtState,pose);
let game=new NativeFight({onOpponentRender:renderOpponent,onPlayerRender:renderPlayer,opening:true});
const nextButton=document.querySelector('#next');
const careerEntry=document.querySelector('#career-entry'),careerInput=document.querySelector('#career-password'),careerMessage=document.querySelector('#career-message');let passwordCursor=0;
for(const fighter of FIGHTERS){const option=document.createElement('option');option.value=fighter.id;option.textContent=String(fighter.id+1).padStart(2,'0')+' / '+fighter.name;select.append(option);}
function text(str,x,y,color='#dde8d8',size=3){ctx.fillStyle=color;ctx.font=`${size}px "Courier New",monospace`;ctx.textBaseline='top';ctx.fillText(str,x,y);}
function line(x,y,len,char,color){text(char.repeat(len),x,y,color);}
function drawParts(parts,art,colors){for(const part of parts){const matrix=part.matrix;for(let r=0;r<matrix.height;r++){const row=matrix.rows[r],inks=matrix.inks[r];for(let c=0;c<matrix.width;c++){if(inks[c]!=='.'&&row[c]!==' ')text(row[c],part.x+matrix.x+c*art.cellWidth,part.y+matrix.y+r*art.cellHeight,colors[parseInt(inks[c],36)],3.3);}}}}
function drawMatrix(matrix,colors,x=0,y=0){for(let r=0;r<matrix.height;r++)for(let c=0;c<matrix.width;c++){const ink=matrix.inks[r][c],char=matrix.rows[r][c];if(ink!=='.'&&char!==' ')text(char,x+(matrix.x||0)+c*2,y+(matrix.y||0)+r*3,colors[parseInt(ink,36)],3.3);}}
function drawCorner(presentation,palette){const colors=[...palette.background,...palette.sprite],offset=-(presentation.scroll||0);
 if(presentation.hidden)return;
 for(const matrix of [presentation.background,presentation.portrait]){if(!matrix)continue;for(let r=0;r<matrix.height;r++)for(let c=0;c<matrix.width;c++){const ink=matrix.inks[r][c],char=matrix.rows[r][c];if(ink!=='.'&&char!==' ')text(char,c*2,r*3+offset,colors[parseInt(ink,36)],3.3);}}
 for(const item of presentation.message?.chars||[]){if(item.char===' ')continue;ctx.save();ctx.translate(item.x,item.y+offset);ctx.scale(1.6,1);text(item.char,0,0,palette.background[item.ink??1],8);ctx.restore();}
}
function draw(){ctx.setTransform(4,0,0,4,0,0);const m=game.memory,s=game.snapshot(),p=s.palette,b=p.background;ctx.fillStyle=b[0];ctx.fillRect(0,0,256,240);
 status.textContent=`${running?'LIVE':'PAUSED'} / ROUND ${s.round} / ${s.clock[0]}:${s.clock[1]}${s.clock[2]} / HEARTS ${s.hearts} / STARS ${s.stars}`;
 if(!p.visible.background&&!p.visible.sprite)return;
 if(s.flow.presentation&&s.flow.stage!=='fight'&&s.flow.stage!=='round-intro'&&s.flow.stage!=='round-light-wait'){drawCorner(s.flow.presentation,p);return;}
 if(p.visible.background){
  drawMatrix(s.ring.background,b);for(const part of s.ring.parts)drawMatrix(part.matrix,b,part.x,part.y);
  for(const item of s.ring.labels){ctx.save();ctx.translate(item.x,item.y);ctx.scale(1.6,1);text(item.char,0,0,b[item.ink],8);ctx.restore();}
 }
 const opponentParts=fighterArtParts(activeArt,artState);
 if(p.visible.sprite)drawParts(opponentParts.filter(part=>!part.foreground),activeArt,p.sprite);
 if(p.visible.background)drawParts(playerArtParts(playerArtState,m[0x15]),PLAYER_ART,p.background);
 if(p.visible.sprite)drawParts(opponentParts.filter(part=>part.foreground),activeArt,p.sprite);
}
function resultMessage(result){return result?.type==='ending'?'WORLD CHAMPION!':result?.won?'YOU WIN!':result?.type==='game-over'?'GAME OVER.':'BOUT OVER.';}
function setRunning(value,controllerStart=false){
 if(value&&(game.failure||(pause.disabled&&game.flow.stage==='handoff')))return;
 if(value)careerEntry.open=false;
 controller.neutralize();
 const epoch=++runEpoch;accumulator=0;last=0;
 if(!value){running=false;loadingSound=false;sound.pause();pause.textContent='Resume';if(!game.failure)announcement.textContent=game.flow.snapshot().terminal==='ending'?'':game.circuit.pending?resultMessage(game.circuit.pending):'Bout paused. Press P to continue.';return;}
 running=false;loadingSound=true;pause.textContent='Pause';announcement.textContent='';canvas.focus({preventScroll:true});
 const unlock=sound.unlock();
 if(controllerStart){running=true;loadingSound=false;sound.resume();document.querySelector('#sound').textContent=sound.context?.state==='running'?'Sound on':'Enable sound (click / key)';}
 unlock.then(available=>{
  if(epoch!==runEpoch){if(!running)sound.pause();return;}
  if(!available)document.querySelector('#sound').textContent='Sound unavailable';
  sound.resume();running=true;loadingSound=false;last=0;
 }).catch(()=>{if(epoch===runEpoch){document.querySelector('#sound').textContent='Sound unavailable';running=true;loadingSound=false;last=0;}});
}
function resetArt(){activeArt=FIGHTER_ART.find(f=>f.id===game.fighter.id);artState=createFighterArtState(activeArt);playerArtState=createPlayerArtState();}
function reset(){input.clear();touchInput.clear();controller.neutralize();startPulse=0;resultShown=null;sound.reset();game=new NativeFight({fighter:Number(select.value),onOpponentRender:renderOpponent,onPlayerRender:renderPlayer,opening:true});resetArt();nextButton.hidden=true;pause.disabled=false;setRunning(false);announcement.textContent='';pause.textContent='Start bout';draw();}
pause.addEventListener('click',()=>{if(!running&&!loadingSound&&game.frame===0)startPulse=4;setRunning(!(running||loadingSound));});document.querySelector('#restart').addEventListener('click',reset);select.addEventListener('change',reset);
document.querySelector('#sound').addEventListener('click',event=>{const needsUnlock=sound.context?.state!=='running';sound.setMuted(needsUnlock?false:!sound.muted);event.currentTarget.textContent=sound.muted?'Sound off':'Sound on';event.currentTarget.setAttribute('aria-pressed',String(!sound.muted));if(!sound.muted)sound.unlock().then(()=>{if(!running)sound.pause();}).catch(()=>{});if(running)canvas.focus({preventScroll:true});});
function continueResult(controllerStart=false){if(game.advanceBout()){select.value=String(game.fighter.id);resetArt();controller.neutralize();nextButton.hidden=true;pause.disabled=false;setRunning(true,controllerStart);}else if(game.flow.stage==='handoff'){select.value='0';reset();startPulse=4;setRunning(true,controllerStart);}}
nextButton.addEventListener('click',()=>continueResult());
const controller=new Controller({onInput:held=>{padInput=held;},onLoss:()=>{if(running||loadingSound)setRunning(false);},onSetup:()=>setRunning(false),onAction:action=>{
 if(action==='password'&&!running&&!loadingSound){careerEntry.open=true;passwordCursor=0;setRunning(false);careerMessage.textContent='Digit 1 of 10';return true;}
 if(careerEntry.open){
  if(action==='start'){submitCareer(true);return;}
  if(action==='select'){careerEntry.open=false;controller.neutralize();canvas.focus({preventScroll:true});return;}
  const digits=careerInput.value.replace(/\D/g,'').padEnd(10,'0').slice(0,10).split('');
  if(action==='left'||action==='right')passwordCursor=(passwordCursor+(action==='left'?9:1))%10;
  if(action==='up'||action==='down'){digits[passwordCursor]=String((Number(digits[passwordCursor])+(action==='up'?1:9))%10);careerInput.value=digits.join('');}
  careerInput.focus({preventScroll:true});careerInput.setSelectionRange(passwordCursor,passwordCursor+1);careerMessage.textContent=`Digit ${passwordCursor+1} of 10`;return;
 }
 if(action==='pause'){if(!pause.disabled){controller.neutralize();setRunning(!(running||loadingSound),true);}return;}
 if(action==='start'&&game.flow.stage==='handoff'){continueResult(true);return;}
 if(running||loadingSound)return;
 if(action==='start'&&!pause.disabled){controller.neutralize();if(game.frame===0)startPulse=4;setRunning(true,true);}
 else if(action==='select'){reset();}
 else if(action==='left'||action==='right'){select.selectedIndex=(select.selectedIndex+(action==='left'?-1:1)+select.options.length)%select.options.length;reset();}
}});
function submitCareer(fromController=false){
 if(!game.resumePassword(careerInput.value)){careerMessage.textContent='That password is not valid. Check all ten digits.';return;}
 input.clear();touchInput.clear();controller.neutralize();sound.reset();resultShown=null;resetArt();select.value=String(game.fighter.id);nextButton.hidden=true;pause.disabled=false;careerEntry.open=false;startPulse=4;setRunning(true,fromController);
}
careerEntry.addEventListener('toggle',()=>{if(careerEntry.open){setRunning(false);careerMessage.textContent='Enter ten digits or use the controller.';}});
document.querySelector('#career-form').addEventListener('submit',event=>{event.preventDefault();submitCareer();});
document.querySelector('#career-cancel').addEventListener('click',()=>{careerEntry.open=false;controller.neutralize();canvas.focus({preventScroll:true});});
const keys={KeyZ:'b',KeyX:'a',KeyC:'select',ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'up',Enter:'start',Space:'start'};
window.addEventListener('keydown',e=>{if(sound.context?.state==='suspended')sound.unlock().then(()=>{document.querySelector('#sound').textContent=sound.muted?'Sound off':'Sound on';if(!running)sound.pause();}).catch(()=>{});if(e.target.matches('select,button,input')||careerEntry.open)return;if(e.code==='KeyP'){e.preventDefault();if(!e.repeat&&!pause.disabled&&!game.failure)setRunning(!(running||loadingSound));return;}if(keys[e.code]){e.preventDefault();input.add(keys[e.code]);}});
window.addEventListener('keyup',e=>{if(keys[e.code]){e.preventDefault();input.delete(keys[e.code]);}});
window.addEventListener('blur',()=>{input.clear();touchInput.clear();controller.neutralize();if(running||loadingSound)setRunning(false);});
for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touchInput.add(button.dataset.key);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>touchInput.delete(button.dataset.key));}
function loop(now){
 controller.poll();
 if(running){
  if(last)accumulator+=Math.min(now-last,100);
  while(accumulator>=1000/FRAME_RATE){
   try{
    const buttons=[...new Set([...input,...touchInput,...padInput])];if(startPulse){buttons.push('start');startPulse--;}
    game.step(buttons);sound.playFrame(game.audioEvents);
    const flow=game.flow.snapshot();
    if(flow.stage==='handoff'){
     const result=game.circuit.pending;
     if(resultShown!==result){resultShown=result;announcement.textContent=flow.terminal==='ending'?'':resultMessage(result);nextButton.hidden=false;nextButton.textContent=result?.type!=='next-bout'?'New career':result?.won?'Next opponent':result?.rematch?'Rematch':'Continue circuit';pause.disabled=true;}
    }else announcement.textContent='';
   }catch(error){setRunning(false);announcement.textContent='Reconstruction stopped: '+error.message;status.textContent='Unsupported original state';break;}
   accumulator-=1000/FRAME_RATE;
  }
 }
 last=now;draw();requestAnimationFrame(loop);
}
window.asciiPunchOut={get game(){return game},get running(){return running},get sound(){return sound}};
announcement.textContent='';draw();requestAnimationFrame(loop);
