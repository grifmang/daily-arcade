import {BANK_DATA} from './recovered-data.mjs';
import {FIGHT_SEEDS} from './fight-seeds.mjs';
import {OpponentVM} from './opponent-vm.mjs';
import {FightControl} from './fight-control.mjs';
import {PlayerState} from './player-state.mjs';
import {CombatResolution} from './combat-resolution.mjs';
import {normalizeInput,updateEntropy,acknowledgeDisplays} from './input-clockwork.mjs';
import {RoundFlow} from './round-flow.mjs';
import {CircuitFlow} from './circuit-flow.mjs';
import {PaletteState} from './palette.mjs';
import {OriginalAudio} from './audio.mjs';
import {initializeOriginalAudioMemory} from './audio-seeds.mjs';
import {RingPresentation} from './ring-presentation.mjs';
import {decodeCareerPassword} from './career-password.mjs';

export const FRAME_RATE=60.0988138974405;
export const FIGHTERS=FIGHT_SEEDS.map(({id,name,bank,offset})=>({id,name,bank,offset}));
export const BUTTONS={right:1,left:2,down:4,up:8,start:16,select:32,b:64,a:128};
const maps=Object.fromEntries(Object.entries(BANK_DATA).map(([key,segments])=>{
 const data=new Map();for(const [start,bytes] of segments)bytes.forEach((v,i)=>data.set(start+i,v));return [key,data];
}));
export class NativeFight {
 constructor({fighter=0,memory,onOpponentRender,onPlayerRender,opening=false}={}) {
  this.fighter=FIGHTERS.find(f=>f.id===fighter);if(!this.fighter)throw Error('Unknown original bout '+fighter);
  this.memory=new Uint8Array(memory||FIGHT_SEEDS.find(f=>f.id===fighter).memory);
  this.frame=0;this.events=[];this.failure=null;
  this.onOpponentRender=onOpponentRender;
  if(!memory&&!opening)initializeOriginalAudioMemory(this.memory,fighter);
  this.palette=new PaletteState({memory:this.memory});
  this.audio=new OriginalAudio({memory:this.memory,read:(address,bank)=>this.read(address,bank)});this.audioEvents=[];
  this.circuit=new CircuitFlow({memory:this.memory,read:(address,bank)=>this.read(address,bank)});
  this.flow=new RoundFlow({memory:this.memory,onTransition:event=>{this.events.push({...event,frame:this.frame});if(event.type==='circuit-result'){const pending=this.circuit.finish(event.result);this.flow.beginPostfight?.(pending);}}});
  const read=address=>this.read(address,this.memory[2]);
  this.control=new FightControl({memory:this.memory,read,onGetUpDisplay:()=>this.player.prepareDisplay()});
  this.opponent=new OpponentVM({memory:this.memory,read:address=>this.read(address,this.memory[0xaf]?6:this.memory[2]),render:()=>this.renderOpponent()});
  this.player=new PlayerState({memory:this.memory,read:address=>this.read(address,11),hooks:{render:onPlayerRender}});
  this.combat=new CombatResolution({memory:this.memory,read:address=>this.read(address,7),hooks:{
   knockedDown:()=>this.control.knockedDown(),startCombo:()=>this.control.startCombo(),advanceCombo:()=>this.control.advanceCombo()
  }});
  this.flow.configureSetup({read:(address,bank)=>this.read(address,bank),health:()=>this.combat.health()});
  if(opening){if(!memory){this.circuit.initializeBout();this.audio.reset();}this.flow.beginOpening();this.palette=new PaletteState({memory:this.memory});}
  this.ring=new RingPresentation(this.memory,fighter);this.ringStage=this.flow.stage;
 }
 read(address,bank=this.memory[2]) {
  address&=65535;
  if(address<2048)return this.memory[address];
  const key=address>=0xa000?'DEF':bank.toString(16).toUpperCase().padStart(3,'0');
  const value=maps[key]?.get(address);
  if(value===undefined)throw Error(`Unrecovered data ${key}:$${address.toString(16)} at native frame ${this.frame}`);
  return value;
 }
 advanceBout() {
  if(this.flow.stage!=='handoff'||this.circuit.pending?.type!=='next-bout')return false;
  const next=this.circuit.initializeBout();this.fighter=FIGHTERS.find(f=>f.id===next.fighter);
  this.flow.result=null;this.flow.beginOpening();this.ring.reset(this.fighter.id);this.ringStage=this.flow.stage;return true;
 }
 resumePassword(password) {
  const career=decodeCareerPassword(password);if(!career)return false;
  const m=this.memory;m.fill(0,0x180,0x800);m.set(career.records,0x170);m[1]=career.fighter;m.fill(0,0xd0,0xdc);
  this.failure=null;this.events=[];this.frame=0;this.circuit.pending=null;
  this.circuit.initializeBout();this.fighter=FIGHTERS.find(f=>f.id===career.fighter);
  for(const component of [this.player,this.opponent,this.control,this.combat]){if('frame'in component)component.frame=0;if(component.events)component.events.length=0;}
  this.audio.reset();this.audioEvents=[];this.flow.beginOpening();this.palette=new PaletteState({memory:m});this.ring.reset(career.fighter);this.ringStage=this.flow.stage;
  return career;
 }
 renderOpponent() {
  const m=this.memory;
  if(m[0xa0]){this.onOpponentRender?.({pose:m[0xa1],flags:m[0xa0],spriteMode:m[0xa2],rowHeight:m[0x80],x:m[0xb0],y:m[0xb1]});if((m[0xa0]&128)&&m[0xa1]<0xc0)m[0xa2]=0;m[0xa0]=0;m[0x17]=1;}
 }
 outline() {
  const m=this.memory;
  if(!m[0x9c])return;
  let selected;
  if(m[0x9c]&128){m[0x9c]&=127;selected=m[0x5ec];}
  else {m[0x9c]--;if(m[0x9c])return;selected=m[0x5ed];}
  for(let i=0;i<4;i++)m[0x493+i*4]=selected;
  m[0x4a0]=0x81;
 }
 step(input=0) {
  if(this.failure)throw Error(this.failure);
  const m=this.memory;
  if(Array.isArray(input))input=input.reduce((bits,key)=>bits|(BUTTONS[key]||0),0);
  this.frame++;
  const finish=()=>{if(this.flow.stage==='round-intro'&&this.ringStage!=='round-intro')this.ring.reset(this.fighter.id);this.ringStage=this.flow.stage;return this.snapshot();};
  try {
   if(this.flow.suppressNMI){this.audioEvents=[];this.flow.withoutNMITick();return finish();}
   this.palette.beforeFrame();
   this.ring.beforeFrame();
   if(m[0x1d]&128){const ack=[];if(m[0x410]&128){m[0x410]=0;ack.push('tile-buffer');}if(m[0x4a0]){m[0x4a0]=0;ack.push('palette');}this.palette.commit(ack);this.ring.commit(ack);}
   else {const ack=acknowledgeDisplays(m);this.palette.commit(ack);this.ring.commit(ack);}
   m[0x1e]++;if(m[0x1f])m[0x1f]--;
   updateEntropy(m);
   if(!this.flow.engineRunning){this.audioEvents=this.audio.tick();normalizeInput(m,input);this.flow.presentationTick?.();this.flow.fadeTick();this.flow.afterFrame();return finish();}
   this.combat.clock();this.combat.points();this.combat.health();this.combat.hearts();this.combat.stars();
   normalizeInput(m,input);
   this.audioEvents=this.audio.tick();
   this.control.clockEvents();this.control.selectPattern();this.control.react();this.control.patternTick();
   this.opponent.tick();this.renderOpponent();
   this.player.input();this.player.tick();this.player.prepareDisplay();
   this.combat.knockout();this.combat.hitResolution();this.control.recoveryTick();this.outline();this.control.completeStates();
   this.flow.fadeTick();this.flow.afterFrame();
   this.events.push(...this.opponent.events.splice(0).map(e=>({...e,frame:this.frame})),...this.player.events.splice(0).map(e=>({...e,frame:this.frame})),...this.combat.events.splice(0).map(e=>({...e,frame:this.frame})));
   if(this.events.length>256)this.events.splice(0,this.events.length-256);
  }catch(error){this.failure=error.message;throw error;}
  return finish();
 }
 snapshot() {
  const m=this.memory;
  return {frame:this.frame,fighter:this.fighter.id,name:this.fighter.name,
   round:m[6],clock:[m[0x302],m[0x304],m[0x305]],chronometer:(m[0x306]<<8)|m[0x307],
   hp:{mac:m[0x392],opponent:m[0x399]},hearts:m[0x323]*10+m[0x324],stars:m[0x342],
   knockdowns:{mac:m[0x3d0],opponent:m[0x3d1]},count:m[0xc2],knockdown:m[5],
   mac:this.player.snapshot(),opponent:this.opponent.snapshot(),control:this.control.snapshot(),
   seed:m[0x18],entropy:m[0x19],frameCounter:m[0x1e],phase:m[0],announcer:m[0x40],flow:this.flow.snapshot(),ring:this.ring.snapshot(),palette:this.palette.snapshot(),audio:this.audio.snapshot(),audioEvents:this.audioEvents,career:this.circuit.records(),result:this.circuit.pending,failure:this.failure};
 }
}
