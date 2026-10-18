import {resolveBoutIdentity} from './bout-identity.mjs';
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
import {decodeCareerPassword,specialPassword} from './career-password.mjs';
import {CareerMenu} from './career-menu.mjs';
import {careerPassword} from './postfight-presentation.mjs';
import {DEMO_SEED} from './demo-seed.mjs';

export const FRAME_RATE=60.0988138974405;
export const FIGHTERS=FIGHT_SEEDS.map(({id,name,bank,offset})=>({id,name,bank,offset}));
export const BUTTONS={right:1,left:2,down:4,up:8,start:16,select:32,b:64,a:128};
const maps=Object.fromEntries(Object.entries(BANK_DATA).map(([key,segments])=>{
 const data=new Map();for(const [start,bytes] of segments)bytes.forEach((v,i)=>data.set(start+i,v));return [key,data];
}));
export class NativeFight {
 constructor({fighter=0,memory,onOpponentRender,onPlayerRender,opening=false,menu=false,training=false,savedPassword=null,savedMenuCode=null}={}) {
  this.fighter=FIGHTERS.find(f=>f.id===fighter);if(!this.fighter)throw Error('Unknown original bout '+fighter);
  this.memory=new Uint8Array(memory||FIGHT_SEEDS.find(f=>f.id===fighter).memory);
  if(memory){const identity=resolveBoutIdentity(this.memory[1],this.memory[0x13e]);this.fighter=FIGHTERS[identity.combatId];}else this.memory[0x13e]=0;
  this.committedStarSprite=this.memory.slice(0x2fc,0x300);this.spriteRowHeight=this.memory[0x10]&32?16:8;
  this.frame=0;this.events=[];this.failure=null;
  const stored=decodeCareerPassword(savedPassword);
  this.menuEnabled=!!menu;this.training=training;this.demoMode=false;this.savedPassword=stored?.kind==='career'?stored.password:null;
  this.savedMenuCode=null;this.rememberMenuCode(savedMenuCode??this.savedPassword);
  this.onOpponentRender=onOpponentRender;
  if(!memory&&!opening)initializeOriginalAudioMemory(this.memory,fighter);
  this.palette=new PaletteState({memory:this.memory});
  this.audio=new OriginalAudio({memory:this.memory,read:(address,bank)=>this.read(address,bank)});this.audioEvents=[];
  this.circuit=new CircuitFlow({memory:this.memory,read:(address,bank)=>this.read(address,bank)});
  this.flow=new RoundFlow({memory:this.memory,onTransition:event=>{this.events.push({...event,frame:this.frame});if(event.type==='circuit-result'){const pending=this.circuit.finish(event.result);this.flow.beginPostfight?.(pending);if(pending.jogging||pending.titleSequence){const digits=careerPassword(this.memory)?.join('');if(digits&&decodeCareerPassword(digits))this.rememberPassword(digits);}}}});
  const read=address=>this.read(address,this.memory[2]);
  this.control=new FightControl({memory:this.memory,read,onGetUpDisplay:()=>this.player.prepareDisplay()});
  this.opponent=new OpponentVM({memory:this.memory,read:address=>this.read(address,this.memory[0xaf]?6:this.memory[2]),render:()=>this.renderOpponent()});
  this.player=new PlayerState({memory:this.memory,read:address=>this.read(address,11),hooks:{render:onPlayerRender}});
  this.combat=new CombatResolution({memory:this.memory,read:address=>this.read(address,7),hooks:{
   knockedDown:()=>this.control.knockedDown(),startCombo:()=>this.control.startCombo(),advanceCombo:()=>this.control.advanceCombo()
  }});
  this.flow.configureSetup({read:(address,bank)=>this.read(address,bank),health:()=>this.combat.health()});
  if(opening){if(!memory){this.circuit.initializeBout();this.audio.reset();}this.flow.beginOpening();this.palette=new PaletteState({memory:this.memory});}
  this.ring=new RingPresentation(this.memory,this.fighter.id);this.ringStage=this.flow.stage;
  if(menu){this.memory.fill(0);if(this.savedMenuCode)this.rememberMenuCode(this.savedMenuCode);this.audio.reset();this.returnToTitle({cold:menu!=='title'});}
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
  const m=this.memory;m.fill(0,0x180,0x800);m.set(career.records,0x170);m[1]=career.fighter;m[0x13e]=0;m.fill(0,0xd0,0xdc);
  this.failure=null;this.events=[];this.frame=0;this.circuit.pending=null;this.demoMode=false;this.training=false;
  if(career.kind==='career')this.rememberPassword(career.password); // A443 copies normal entered passwords; Tyson's special does not.
  this.circuit.initializeBout();this.fighter=FIGHTERS.find(f=>f.id===career.fighter);
  for(const component of [this.player,this.opponent,this.control,this.combat]){if('frame'in component)component.frame=0;if(component.events)component.events.length=0;}
  this.audio.reset();this.audioEvents=[];this.flow.beginOpening();this.palette=new PaletteState({memory:m});this.ring.reset(career.fighter);this.ringStage=this.flow.stage;
  return career;
 }
 /** Public menu submission. The explicit chord flag represents original
  * (A OR B) + Select; it never changes ordinary career decoding. */
 submitPassword(password,{specialChord=false}={}) {
  if(this.menuEnabled)return this.menuPassword(password,specialChord);
  const career=this.resumePassword(password);
  if(career)return {accepted:true,kind:career.kind,career};
  const special=specialPassword(password);
  if(!special)return {accepted:false,reason:'invalid'};
  if(special.requiresChord&&!specialChord)return {accepted:false,reason:'chord-required',kind:special.kind};
  if(special.kind==='another-world'){this.returnToTitle();return this.menuPassword(password,specialChord);}
  this.failure=null;this.events=[];this.circuit.pending=null;this.memory.fill(0,0xd0,0xdc);
  this.audio.reset();this.audioEvents=[];this.flow.beginSpecialPassword(special);this.palette=new PaletteState({memory:this.memory});
  return {accepted:true,kind:special.kind};
 }
 get originalInputOwned(){return this.flow.stage==='menu'||this.demoMode;}
 rememberPassword(password){const normal=decodeCareerPassword(password);if(normal?.kind!=='career')return false;return this.rememberMenuCode(normal.password);}
 rememberMenuCode(password){
  const normal=decodeCareerPassword(password),special=specialPassword(password);
  const valid=normal?.kind==='career'?normal.password:special?.kind==='another-world'?special.password:null;
  if(!valid)return false;if(normal?.kind==='career')this.savedPassword=normal.password;this.savedMenuCode=valid;this.memory.set(Array.from(valid,Number),0x110);return true;
 }
 startAlternate(){
  const m=this.memory;m.fill(0,0x180,0x800);m.fill(0,0x40,0xb0);m.fill(0,0xd0,0xdc);m[1]=20;m[0x13e]=1;
  this.failure=null;this.events=[];this.circuit.pending=null;this.demoMode=false;this.training=false;
  const next=this.circuit.initializeBout();this.fighter=FIGHTERS[next.combatId];
  this.audio.reset();this.audioEvents=[];this.flow.beginOpening();this.palette=new PaletteState({memory:m});this.ring.reset(this.fighter.id);this.ringStage=this.flow.stage;
  for(const component of [this.player,this.opponent,this.control,this.combat]){if('frame'in component)component.frame=0;if(component.events)component.events.length=0;}
 }

 returnToTitle({cold=false,interrupt=false,timer=4,host=false}={}){
  this.menuEnabled=true;this.demoMode=false;this.training=false;this.circuit.pending=null;this.failure=null;
  // A host return can occur while Mac is blocking, unlike the source Start
  // interrupt (whose history is masked then). Retire combat/input workspace
  // before the menu normalizer sees it; preserve passwords, records and sound.
  this.memory.fill(0,0x40,0xf0);this.memory[0x13e]=0;
  if(host){this.audio.reset();this.audioEvents=[];}
  this.menu=new CareerMenu({memory:this.memory,cold,onAction:action=>{this.menuAction=action;},savedMenuCode:this.savedMenuCode});
  if(!cold){if(interrupt){this.menu.blockedStart=true;this.menu.play('title-return','title',16);}else this.menu.title(timer);}
  this.menuAction=null;this.flow.beginMenu(this.menu);return true;
 }
 menuPassword(password,specialChord=false,fromEditor=false,storedContinueEvent=null){
  const career=decodeCareerPassword(password),special=career?null:specialPassword(password);
  const rejected=reason=>{if(this.menu)this.menu.message=reason==='chord-required'?'This password requires A or B with Select.':'Invalid password.';return {accepted:false,reason,kind:special?.kind};};
  if(!career&&!special)return rejected('invalid');
  const storedOrigin=storedContinueEvent?.storedContinue===true&&storedContinueEvent===this.menu?.storedContinueEvent&&fromEditor&&this.flow.stage==='menu'&&this.menu?.phase==='continue'&&!this.memory[0x4c2]&&password===this.savedMenuCode;
  if(this.menu)this.menu.storedContinueEvent=null;
  if(special?.requiresChord&&!specialChord&&!storedOrigin)return rejected('chord-required');
  if(!this.menu||this.flow.stage!=='menu')this.returnToTitle();
  if(!fromEditor)this.memory.set(Array.from(career?.password??special.password,Number),0x120);
  if(special?.kind==='busy'){
   this.demoMode=false;this.circuit.pending=null;this.audio.reset();this.memory.fill(0,0xd0,0xdc);this.flow.beginSpecialPassword(special);
  }else if(special?.kind==='another-world'){this.rememberMenuCode(special.password);this.memory[1]=20;this.memory[0x13e]=1;this.memory[0xb]=4;this.menu.dismiss({type:'another-world'});if(fromEditor)this.menu.index=1;}
  else this.menu.dismiss(career?{type:'career',career}:{type:'credits',special});
  return {accepted:true,kind:career?.kind??special.kind,career:career??undefined};
 }
 handleMenuAction(){
  const action=this.menuAction;this.menuAction=null;if(!action)return;
  if(action.type==='new')this.menu.dismiss({type:'new'});
  else if(action.type==='password'){
   const result=this.menuPassword(action.password,action.specialChord,true,action);
   if(!result.accepted)this.menu.title(16,{keepMessage:true});
  }else if(action.type==='demo')this.startDemo();
  else if(action.type==='chosen'){
   const choice=action.choice;
   if(choice.type==='another-world')this.startAlternate();
   else if(choice.type==='career')this.resumePassword(choice.career.password);
   else if(choice.type==='credits'){this.audio.reset();this.memory.fill(0,0xd0,0xdc);this.flow.beginSpecialPassword(choice.special);}
   else this.startNewCareer();
  }
 }
 startNewCareer(){
  const m=this.memory;this.demoMode=false;this.training=false;
  // DEF A829: NEW clears records too; unlike Continue it starts at $0170.
  m.fill(0,0x170,0x800);m.fill(0,0x40,0xb0);m.fill(0,0xd0,0xdc);m[1]=0;m[0x13e]=0;
  this.circuit.pending=null;this.circuit.initializeBout();this.fighter=FIGHTERS[0];
  this.audio.reset();this.audioEvents=[];this.flow.beginOpening();this.palette=new PaletteState({memory:m});this.ring.reset(0);this.ringStage=this.flow.stage;
  for(const component of [this.player,this.opponent,this.control,this.combat]){if('frame'in component)component.frame=0;if(component.events)component.events.length=0;}
 }
 startDemo(){
  const m=this.memory,passwordWorkspace=m.slice(0x100,0x170),input=m.slice(0xd0,0xdc);
  // Original A549 clears $0170+, preserving the saved password workspace.
  m.set(DEMO_SEED.memory);m.set(passwordWorkspace,0x100);m.set(input,0xd0);
  // A574–A578 immediately enable both engine gates after this seed boundary.
  m[0x1c]=m[0x1d]=0;m[0x13e]=0;
  this.fighter={id:19,name:DEMO_SEED.name,bank:3,offset:0};this.demoMode=true;this.circuit.pending=null;
  this.flow.menu=this.flow.postfight=this.flow.specialPassword=null;this.flow.result=null;this.flow.stage='demo-intro';
  this.ring.reset(19);this.ringStage=this.flow.stage;this.palette=new PaletteState({memory:m});
  for(const component of [this.player,this.opponent,this.control,this.combat]){if('frame'in component)component.frame=0;if(component.events)component.events.length=0;}
 }
 demoAfterFrame(){
  const m=this.memory;
  if(m[0]&128){this.demoMode=false;this.menu.play('demo-exit','title',8);this.flow.beginMenu(this.menu);return;}
  if(this.flow.stage==='demo-intro'&&m[0]===1){m[0x1f]=2;this.flow.stage='demo-light-wait';}
  else if(this.flow.stage==='demo-light-wait'&&!m[0x1f]){m[0x1b]=129;m[0x22]=1;this.flow.stage='demo';}
 }
 renderOpponent() {
  const m=this.memory;
  if(m[0xa0]){this.onOpponentRender?.({pose:m[0xa1],flags:m[0xa0],spriteMode:m[0xa2],rowHeight:m[0x80],x:m[0xb0],y:m[0xb1]});if((m[0xa0]&128)&&m[0xa1]<0xc0)m[0xa2]=0;m[0xa0]=0;m[0x17]=1;}
 }
 commitStarSprite(acknowledged){
  // PPUCTRL is applied in NMI; OAM DMA occurs only on the sprites acknowledgement.
  this.spriteRowHeight=this.memory[0x10]&32?16:8;
  if(acknowledged.includes('sprites'))this.committedStarSprite.set(this.memory.subarray(0x2fc,0x300));
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
  if(this.demoMode)input&=BUTTONS.start; // Recorded demo commands own all combat input.
  this.frame++;
  const finish=()=>{if(this.menuEnabled&&this.flow.stage==='handoff'&&['title','game-over'].includes(this.flow.snapshot().terminal))this.returnToTitle();if(this.flow.stage==='round-intro'&&this.ringStage!=='round-intro')this.ring.reset(this.fighter.id);this.ringStage=this.flow.stage;return this.snapshot();};
  try {
   if(this.flow.suppressNMI){this.audioEvents=[];this.flow.withoutNMITick();return finish();}
   this.palette.beforeFrame();
   this.ring.beforeFrame();
   if(m[0x1d]&128){const ack=[];if(m[0x410]&128){m[0x410]=0;ack.push('tile-buffer');}if(m[0x4a0]){m[0x4a0]=0;ack.push('palette');}this.commitStarSprite(ack);this.palette.commit(ack);this.ring.commit(ack);}
   else {const ack=acknowledgeDisplays(m);this.commitStarSprite(ack);this.palette.commit(ack);this.ring.commit(ack);}
   m[0x1e]++;if(m[0x1f])m[0x1f]--;
   updateEntropy(m);
   if(!this.flow.engineRunning){this.audioEvents=this.audio.tick();normalizeInput(m,input);this.flow.presentationTick?.();this.handleMenuAction();this.flow.fadeTick();this.flow.afterFrame();return finish();}
   this.combat.clock();this.combat.points();this.combat.health();this.combat.hearts();this.combat.stars();
   normalizeInput(m,input);
   if(this.demoMode&&(m[0xd9]&128)){m[0xd9]&=127;this.returnToTitle({interrupt:true});this.audioEvents=this.audio.tick();return finish();}
   // DEF A682–A690: demo mode calls A750 before the sound sequencer.
   // The demo deliberately stops all channels instead of playing live cues.
   if(this.demoMode)m.fill(128,0xf0,0xf4);
   this.audioEvents=this.audio.tick();
   this.control.clockEvents();this.control.selectPattern();this.control.react();this.control.patternTick();
   this.opponent.tick();this.renderOpponent();
   this.player.input();this.player.tick();this.player.prepareDisplay();
   this.combat.knockout();this.combat.hitResolution();this.control.recoveryTick();this.outline();this.control.completeStates();
   this.flow.fadeTick();if(this.demoMode)this.demoAfterFrame();else this.flow.afterFrame();
   this.events.push(...this.opponent.events.splice(0).map(e=>({...e,frame:this.frame})),...this.player.events.splice(0).map(e=>({...e,frame:this.frame})),...this.combat.events.splice(0).map(e=>({...e,frame:this.frame})));
   if(this.events.length>256)this.events.splice(0,this.events.length-256);
  }catch(error){this.failure=error.message;throw error;}
  return finish();
 }
 snapshot() {
  const m=this.memory;
  return {frame:this.frame,fighter:this.fighter.id,careerId:this.circuit.pending?.previousFighter??m[1],routingCareerId:m[1],alternateFlag:m[0x13e],name:this.fighter.name,mode:this.demoMode?'attract-demo':this.flow.stage==='menu'?'menu':this.training?'training':m[0x13e]?'another-world':'career',
   round:m[6],clock:[m[0x302],m[0x304],m[0x305]],chronometer:(m[0x306]<<8)|m[0x307],
   hp:{mac:m[0x392],opponent:m[0x399]},hearts:m[0x323]*10+m[0x324],stars:m[0x342],starSprite:{oam:Array.from(this.committedStarSprite),rowHeight:this.spriteRowHeight},
   knockdowns:{mac:m[0x3d0],opponent:m[0x3d1]},count:m[0xc2],knockdown:m[5],
   mac:this.player.snapshot(),opponent:this.opponent.snapshot(),control:this.control.snapshot(),
   seed:m[0x18],entropy:m[0x19],frameCounter:m[0x1e],phase:m[0],announcer:m[0x40],flow:this.flow.snapshot(),ring:this.ring.snapshot(),palette:this.palette.snapshot(),audio:this.audio.snapshot(),audioEvents:this.audioEvents,career:this.circuit.records(),result:this.circuit.pending,failure:this.failure};
 }
}
