import {NativeFight,FIGHTERS,FRAME_RATE,BUTTONS} from './engine.mjs';
import {FIGHTER_ART,createFighterArtState,advanceFighterArt,fighterArtParts,PLAYER_ART,createPlayerArtState,advancePlayerArt,playerArtParts} from './fighter-art.mjs';
import {SoundOutput} from './audio-output.mjs';
import {Controller} from './controller.mjs';
import {DEMO_FIGHTER_ART} from './demo-art.mjs';
const canvas=document.querySelector('#ring'),ctx=canvas.getContext('2d'),announcement=document.querySelector('#announcement'),status=document.querySelector('#state'),pause=document.querySelector('#pause'),select=document.querySelector('#fighter');
const input=new Set(),touchInput=new Set();let padInput=new Set();let activeArt=FIGHTER_ART[0],artState=createFighterArtState(activeArt),running=false,last=0,accumulator=0;
const sound=new SoundOutput();let startPulse=0;
let runEpoch=0,loadingSound=false,resultShown=null;
let playerArtState=createPlayerArtState();
const renderOpponent=params=>advanceFighterArt(activeArt,artState,params);
const renderPlayer=pose=>advancePlayerArt(playerArtState,pose);
let game=new NativeFight({onOpponentRender:renderOpponent,onPlayerRender:renderPlayer,menu:true});
const nextButton=document.querySelector('#next');
const careerEntry=document.querySelector('#career-entry'),careerInput=document.querySelector('#career-password'),careerMessage=document.querySelector('#career-message');let passwordCursor=0;
const specialStatus=document.querySelector('#special-status');
const menuStatus=document.querySelector('#menu-status');
let menuBoundary='';
for(const fighter of FIGHTERS){const option=document.createElement('option');option.value=fighter.id;option.textContent=String(fighter.id+1).padStart(2,'0')+' / '+fighter.name;select.append(option);}
function text(str,x,y,color='#dde8d8',size=3){ctx.fillStyle=color;ctx.font=`${size}px "Courier New",monospace`;ctx.textBaseline='top';ctx.fillText(str,x,y);}
function line(x,y,len,char,color){text(char.repeat(len),x,y,color);}
const detailCache=new WeakMap();
const surfaces=new Map(),surfaceBudget=24*1024*1024;let surfaceBytes=0;
function forgetSurface(surface){const entry=surfaces.get(surface);if(!entry)return;entry.variants.delete(entry.key);surfaceBytes-=entry.bytes;surfaces.delete(surface);}
const lightGlyph=char=>({'@':':','#':'+','%':';','*':'.'}[char]??char);
function drawDetail(matrix,colors,x,y){
 // Cache rasterized ASCII declarations, including their palette. Dynamic sprite
 // positions still update every frame; tiny text glyphs need only be drawn once.
 let variants=detailCache.get(matrix);if(!variants){variants=new Map();detailCache.set(matrix,variants);}
 const key=colors.join('/');let surface=variants.get(key);
 if(!surface){
  const cw=matrix.cellWidth,ch=matrix.cellHeight;
  surface=document.createElement('canvas');surface.width=matrix.width*cw*4;surface.height=matrix.height*ch*4;
  const pen=surface.getContext('2d');pen.scale(4,4);pen.font='bold 3px "Courier New",monospace';pen.textBaseline='top';
  const shapes=[' ',"'",'`','-',',','|','/','r', '.', '\\','!','t','_','L','J','o'];
  if(cw===2&&ch===2){
   for(let r=0;r<matrix.height;r++)for(let c=0;c<matrix.width;c++){const ink=matrix.inks[r][c],char=lightGlyph(matrix.rows[r][c]);if(ink!=='.'&&char!==' '){pen.fillStyle=colors[parseInt(ink,36)];pen.fillText(char,c*2,r*2-.2);}}
  }else for(let r=0;r<matrix.height;r+=2)for(let c=0;c<matrix.width;c+=2){
   let mask=0;const counts=new Map();
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const ink=matrix.inks[r+dy]?.[c+dx];if(ink&&ink!=='.'){mask|=1<<(dy*2+dx);counts.set(ink,(counts.get(ink)||0)+1);}}
   if(mask){const ink=[...counts].sort((a,b)=>b[1]-a[1])[0][0];pen.fillStyle=colors[parseInt(ink,36)];pen.fillText(shapes[mask],c,r-.2);}
  }
  if(variants.size>=8)forgetSurface(variants.values().next().value);
  const bytes=surface.width*surface.height*4;
  while(surfaceBytes+bytes>surfaceBudget&&surfaces.size)forgetSurface(surfaces.keys().next().value);
  variants.set(key,surface);surfaces.set(surface,{variants,key,bytes});surfaceBytes+=bytes;
 }
 else {const entry=surfaces.get(surface);surfaces.delete(surface);surfaces.set(surface,entry);}
 ctx.drawImage(surface,x+(matrix.x||0),y+(matrix.y||0),matrix.width*matrix.cellWidth,matrix.height*matrix.cellHeight);
}
function drawParts(parts,art,colors){for(const part of parts)drawMatrix(part.matrix,colors,part.x,part.y,art);}
function drawMatrix(matrix,colors,x=0,y=0,art={cellWidth:2,cellHeight:3}){
 if(matrix.char){ctx.save();ctx.translate(x,y);ctx.scale(1.6,1);text(matrix.char,0,0,colors[matrix.ink],8);ctx.restore();}
 else if(matrix.cellWidth===matrix.cellHeight&&(matrix.cellWidth===1||matrix.cellWidth===2))drawDetail(matrix,colors,x,y);
 else {const cw=matrix.cellWidth??art.cellWidth,ch=matrix.cellHeight??art.cellHeight;
  for(let r=0;r<matrix.height;r++)for(let c=0;c<matrix.width;c++){const ink=matrix.inks[r][c],char=lightGlyph(matrix.rows[r][c]);if(ink!=='.'&&char!==' '){ctx.fillStyle=colors[parseInt(ink,36)];ctx.font='bold 3px "Courier New",monospace';ctx.textBaseline='top';ctx.fillText(char,x+(matrix.x||0)+c*cw,y+(matrix.y||0)+r*ch);}}
 }
 for(const detail of matrix.details??[])drawMatrix(detail,colors,x,y);
}
function drawCorner(presentation,palette){const colors=[...palette.background,...palette.sprite],offset=-(presentation.scroll||0);
 if(presentation.hidden)return;
 for(const matrix of [presentation.background,presentation.portrait])if(matrix)drawMatrix(matrix,colors,0,offset);
 for(const item of presentation.message?.chars||[]){if(item.char===' ')continue;ctx.save();ctx.translate(item.x,item.y+offset);ctx.scale(item.scaleX??1.6,1);text(item.char,0,0,palette.background[item.ink??1],item.fontSize??8);ctx.restore();}
}
function draw(){ctx.setTransform(4,0,0,4,0,0);const m=game.memory,s=game.snapshot(),p=s.palette,b=p.background;ctx.fillStyle=b[0];ctx.fillRect(0,0,256,240);
 status.textContent=s.mode==='menu'?`${running?'LIVE':'PAUSED'} / ${s.flow.presentation.phase.toUpperCase()}`:s.mode==='attract-demo'?`${running?'LIVE':'PAUSED'} / ATTRACT DEMO`:s.flow.presentation?.kind?`${running?'LIVE':'PAUSED'} / ${s.flow.presentation.kind==='credits'?'CREDITS':'BUSY SIGNAL'} / ${s.flow.completed?'TITLE':s.flow.awaitingStart?'PRESS START':'PLAYING'}`:`${running?'LIVE':'PAUSED'} / ${s.mode==='training'?'TRAINING / ':''}ROUND ${s.round} / ${s.clock[0]}:${s.clock[1]}${s.clock[2]} / HEARTS ${s.hearts} / STARS ${s.stars}`;
 if(!p.visible.background&&!p.visible.sprite)return;
 if(s.flow.presentation&&s.flow.stage!=='fight'&&s.flow.stage!=='round-intro'&&s.flow.stage!=='round-light-wait'){drawCorner(s.flow.presentation,p);return;}
 if(p.visible.background){
  drawMatrix(s.ring.background,b);for(const part of s.ring.parts)drawMatrix(part.matrix,b,part.x,part.y);
  for(const item of s.ring.labels){ctx.save();ctx.translate(item.x,item.y);ctx.scale(1.6,1);text(item.char,0,0,b[item.ink],8);ctx.restore();}
 }
 const opponentParts=fighterArtParts(activeArt,artState,s.starSprite);
 if(p.visible.sprite)drawParts(opponentParts.filter(part=>!part.foreground),activeArt,p.sprite);
 if(p.visible.background)drawParts(playerArtParts(playerArtState,m[0x15]|((m[0x16]&1)<<8)),PLAYER_ART,p.background);
 if(p.visible.sprite)drawParts(opponentParts.filter(part=>part.foreground),activeArt,p.sprite);
}
function resultMessage(result){return result?.type==='ending'?'WORLD CHAMPION!':result?.won?'YOU WIN!':result?.type==='game-over'?'GAME OVER.':'BOUT OVER.';}
function setRunning(value,controllerStart=false){
 if(value&&(game.failure||(pause.disabled&&game.flow.stage==='handoff')))return;
 if(value)careerEntry.open=false;
 controller.neutralize();
 const epoch=++runEpoch;accumulator=0;last=0;
 if(!value){running=false;loadingSound=false;sound.pause();pause.textContent='Resume';if(!game.failure)announcement.textContent=game.flow.snapshot().terminal==='ending'?'':game.circuit.pending?resultMessage(game.circuit.pending):'Paused. Press P to continue.';return;}
 running=false;loadingSound=true;pause.textContent='Pause';announcement.textContent='';canvas.focus({preventScroll:true});
 const unlock=sound.unlock();
 if(controllerStart){running=true;loadingSound=false;sound.resume();document.querySelector('#sound').textContent=sound.context?.state==='running'?'Sound on':'Enable sound (click / key)';}
 unlock.then(available=>{
  if(epoch!==runEpoch){if(!running)sound.pause();return;}
  if(!available)document.querySelector('#sound').textContent='Sound unavailable';
  sound.resume();running=true;loadingSound=false;last=0;
 }).catch(()=>{if(epoch===runEpoch){document.querySelector('#sound').textContent='Sound unavailable';running=true;loadingSound=false;last=0;}});
}
function resetArt(){activeArt=game.fighter.id===19?DEMO_FIGHTER_ART:FIGHTER_ART.find(f=>f.id===game.fighter.id);artState=createFighterArtState(activeArt);playerArtState=createPlayerArtState();}
function clearControls(){input.clear();touchInput.clear();controller.neutralize();startPulse=0;}
function reset(){clearControls();resultShown=null;specialStatus.textContent='Training bout. Original NEW starts a separate career with Glass Joe.';sound.reset();game=new NativeFight({fighter:Number(select.value),onOpponentRender:renderOpponent,onPlayerRender:renderPlayer,opening:true,training:true,savedPassword:game.savedPassword,savedMenuCode:game.savedMenuCode});menuBoundary='';resetArt();nextButton.hidden=true;pause.disabled=false;setRunning(false);announcement.textContent='';pause.textContent='Start bout';draw();}
function showTitle(){++runEpoch;loadingSound=false;clearControls();sound.reset();resultShown=null;game.returnToTitle({host:true});nextButton.hidden=true;pause.disabled=false;menuBoundary=`menu/title/${game.fighter.id}`;setRunning(true,true);}
pause.addEventListener('click',()=>{if(!running&&!loadingSound&&game.frame===0&&!game.originalInputOwned)startPulse=4;setRunning(!(running||loadingSound));});document.querySelector('#restart').addEventListener('click',reset);select.addEventListener('change',reset);document.querySelector('#title').addEventListener('click',showTitle);
document.querySelector('#sound').addEventListener('click',event=>{const needsUnlock=sound.context?.state!=='running';sound.setMuted(needsUnlock?false:!sound.muted);event.currentTarget.textContent=sound.muted?'Sound off':'Sound on';event.currentTarget.setAttribute('aria-pressed',String(!sound.muted));if(!sound.muted)sound.unlock().then(()=>{if(!running)sound.pause();}).catch(()=>{});if(running)canvas.focus({preventScroll:true});});
function continueResult(controllerStart=false){if(game.advanceBout()){select.value=String(game.fighter.id);resetArt();controller.neutralize();nextButton.hidden=true;pause.disabled=false;setRunning(true,controllerStart);}else if(game.flow.stage==='handoff')showTitle();}
nextButton.addEventListener('click',()=>continueResult());
const controller=new Controller({onInput:held=>{padInput=held;},onLoss:()=>{if(running||loadingSound)setRunning(false);},onSetup:()=>setRunning(false),onModeInput:(held,edges)=>{
 if(careerEntry.open||!game.originalInputOwned)return false;
 if(edges.has('pause')&&!held.has('a')&&!held.has('b')){setRunning(!(running||loadingSound),true);return true;}
 if(!running||loadingSound){padInput=new Set();if(edges.has('start')&&!pause.disabled)setRunning(true,true);return true;}
 padInput=new Set(held);
 if(edges.size&&!sound.context){sound.unlock().then(()=>{if(!running)sound.pause();}).catch(()=>{});document.querySelector('#sound').textContent='Enable sound (click / key)';}
 return true;
},onAction:action=>{
 if(action==='password'&&(!running&&!loadingSound||game.flow.snapshot().terminal==='title'&&game.flow.stage==='handoff')){careerEntry.open=true;passwordCursor=0;setRunning(false);careerMessage.textContent='Digit 1 of 10';return true;}
 if(careerEntry.open){
  if(action==='special-password'){submitCareer(true,true);return true;}
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
function submitCareer(fromController=false,specialChord=false){
 const result=game.submitPassword(careerInput.value,{specialChord});
 if(!result.accepted){careerMessage.textContent=result.reason==='chord-required'?'This special password requires A or B + Select. Use the special submit button, or hold a punch button and press Select on your controller.':'That password is not valid. Check all ten digits.';return;}
 specialStatus.textContent=result.kind==='busy'?'Busy signal. The title returns after ten tones.':result.kind==='credits'?'Original credits. Press Start or Enter when the credits finish.':'';
 input.clear();touchInput.clear();controller.neutralize();sound.reset();resultShown=null;resetArt();select.value=String(game.fighter.id);nextButton.hidden=true;pause.disabled=false;careerEntry.open=false;startPulse=4;setRunning(true,fromController);
}
careerEntry.addEventListener('toggle',()=>{if(careerEntry.open){setRunning(false);careerMessage.textContent='Enter ten digits or use the controller.';}});
document.querySelector('#career-form').addEventListener('submit',event=>{event.preventDefault();submitCareer();});
document.querySelector('#career-special').addEventListener('click',()=>submitCareer(false,true));
document.querySelector('#career-cancel').addEventListener('click',()=>{careerEntry.open=false;controller.neutralize();canvas.focus({preventScroll:true});});
const keys={KeyZ:'b',KeyX:'a',KeyC:'select',ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'up',Enter:'start',Space:'start'};
window.addEventListener('keydown',e=>{if(!sound.context||sound.context.state==='suspended')sound.unlock().then(()=>{document.querySelector('#sound').textContent=sound.muted?'Sound off':'Sound on';if(!running)sound.pause();}).catch(()=>{});if(e.target.matches('select,button,input')||careerEntry.open)return;if(e.code==='KeyP'){e.preventDefault();if(!e.repeat&&!pause.disabled&&!game.failure)setRunning(!(running||loadingSound));return;}if(keys[e.code]){e.preventDefault();if(!e.repeat)input.add(keys[e.code]);}});
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
    if(activeArt.id!==game.fighter.id)resetArt();
    const boundary=game.originalInputOwned?`${flow.stage}/${flow.presentation?.phase??''}/${game.fighter.id}`:'';
    if(boundary!==menuBoundary){++runEpoch;clearControls();if(menuBoundary&&!boundary)resetArt();menuBoundary=boundary;resultShown=null;if(flow.stage==='menu')specialStatus.textContent='';}
    menuStatus.textContent=game.demoMode?'Original attract demo. Start returns to the title.':flow.stage==='menu'?flow.presentation.messageText||(flow.presentation.phase==='continue'?`CONTINUE · Digit ${Math.min(10,flow.presentation.cursor+1)} of 10 · Left/right changes a digit; A, B or Start advances. Up selects NEW. Select alone has no menu action.`:flow.presentation.phase==='title'?'NEW · Start begins a career. Down opens CONTINUE. Select alone has no menu action.':'Original '+flow.presentation.phase.replaceAll('-',' ')+' · Start returns to title during attract mode.') :'';
    if(flow.presentation?.kind==='credits'&&flow.awaitingStart)specialStatus.textContent='Credits complete. Press Start or Enter to return to the title.';
    if(flow.stage==='handoff'){
     const result=game.circuit.pending;
     const key=flow.terminal==='title'?'password-title':result;
     if(resultShown!==key){resultShown=key;announcement.textContent=['ending','title'].includes(flow.terminal)?'':resultMessage(result);if(flow.terminal==='title')specialStatus.textContent='Title. Choose New career or open password entry. Controller: Start begins a new career.';nextButton.hidden=false;nextButton.textContent=result?.type!=='next-bout'?'New career':result?.won?'Next opponent':result?.rematch?'Rematch':'Continue circuit';pause.disabled=true;}
    }else announcement.textContent='';
   }catch(error){setRunning(false);announcement.textContent='Reconstruction stopped: '+error.message;status.textContent='Unsupported original state';break;}
   accumulator-=1000/FRAME_RATE;
  }
 }
 last=now;draw();requestAnimationFrame(loop);
}
window.asciiPunchOut={get game(){return game},get running(){return running},get sound(){return sound}};
announcement.textContent='';running=true;pause.textContent='Pause';document.querySelector('#sound').textContent='Enable sound';draw();requestAnimationFrame(loop);
