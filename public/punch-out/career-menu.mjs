import {MENU_ART as ART} from './menu-art.mjs';
import {ANOTHER_WORLD_ART} from './another-world-art.mjs';

/** Original menu state, DEF A2AC–A475/A4CC–A5C0. Authored timelines handle
 * screen construction; live input owns selection, digits, idle and dismissal. */
export class CareerMenu {
 constructor({memory,onAction,savedMenuCode=null,cold=true,allowAttract=true}){
  this.m=memory;this.allowAttract=allowAttract;this.onAction=onAction;this.savedMenuCode=savedMenuCode;this.data=ART;
  this.cache=new Map();this.frame=0;this.message='';this.blockedStart=false;
  if(cold)this.play('cold','title',6);else this.title(4);
 }
 play(name,terminal,timer=4,data=ART){
  if(this.data!==data)this.cache.clear();this.data=data;this.row=null;
  this.phase=name;this.sequence=this.data.sequences[name];
  if(!this.sequence)throw Error('Missing original menu sequence '+name);
  this.index=0;this.terminal=terminal;this.timer=timer;this.apply(this.sequence.frames[0]);
 }
 apply(id){
  const row=this.data.cues[id];if(this.data!==ART&&this.row===row)return;this.row=row;const m=this.m;
  if(this.row.palette){m.set(this.row.palette,0x480);m[0x4a0]=129;}
  m[0x1b]=this.row.hidden?128:129;
  for(const [address,value]of this.row.audio??[])m[address]=value;
 }
 title(timer=4,{release=false,keepMessage=false}={}){
  const m=this.m;if(this.data!==ART)this.cache.clear();this.data=ART;this.phase='title';this.index=0;this.sequence=ART.sequences.title;
  m[4]=m[0x1c]=1;m[0x1d]=255;m[0x4c0]=m[0x4c1]=m[0x4c2]=0;
  m[0x4c6]=timer;m[0x4c7]=64;m[0x4c8]=0;
  if(!keepMessage)this.message='';if(release)this.blockedStart=true;
  this.apply(this.sequence.frames.at(-1));
 }
 continue(){
  const m=this.m;this.phase='continue';this.sequence=ART.sequences.continue;this.index=0;
  m[0x4c0]=255;m[0x4c1]=m[0x4c2]=0;m.fill(39,0x120,0x12a);this.resetIdle();
  this.apply(this.sequence.frames.at(-1));this.message='';
 }
 resetIdle(){this.m[0x4c6]=16;}
 consume(address){if(!(this.m[address]&128))return false;this.m[address]&=127;return true;}
 changeDigit(direction){
  const m=this.m,index=m[0x4c1];
  m[0x120+index]=m[0x4c2]?(m[0x120+index]+direction+10)%10:0;
  m[0x4c2]=1;m[0xf0]=11;this.resetIdle();
 }
 advance(){
  const m=this.m;if(!m[0x4c2]){this.changeDigit(1);return;}
  if(++m[0x4c1]===10){
   const chord=!!((m[0xd5]|m[0xd7])&m[0xdb]&128);
   this.onAction({type:'password',password:Array.from(m.slice(0x120,0x12a)).join(''),specialChord:chord});return;
  }
  m[0x120+m[0x4c1]]=0;m[0xf0]=9;this.resetIdle();
 }
 dismiss(choice){this.choice=choice;if(choice.type==='another-world'){this.play('entry','chosen',4,{...ANOTHER_WORLD_ART.postfight,sequences:{entry:{frames:ANOTHER_WORLD_ART.entry.timeline.map(row=>row.cue)}}});this.phase='dismiss';return;}this.play(choice.type==='new'?'dismiss':'dismiss-continue','chosen');this.phase='dismiss';}
 interrupt(){
  this.m[0xd9]&=127;this.blockedStart=true;this.play('title-return','title',16);
 }
 tick(){
  this.frame++;const m=this.m;
  if(this.blockedStart){m[0xd9]&=127;if(!(m[0xd0]&16))this.blockedStart=false;}
  if(this.phase==='title'||this.phase==='continue'){
   if(this.consume(0xd3)){
    this.resetIdle();const directions=m[0xd2];
    if(!(directions&3)){if(directions===8)this.title(16);else this.continue();return;}
    if(this.phase==='continue'){this.changeDigit(directions===1?1:-1);return;}
   }
   if(this.phase==='continue'&&(this.consume(0xd5)||this.consume(0xd7))){this.advance();return;}
   if(this.consume(0xd9)){
    if(this.phase==='title')this.onAction({type:'new'});
    else if(m[0x4c2])this.advance();
    else {this.storedContinueEvent={type:'password',password:this.savedMenuCode,specialChord:false,storedContinue:true};this.onAction(this.storedContinueEvent);}
    return;
   }
   // A2FA decrements the original 64-frame inner timer; A4C6 only resets
   // its outer byte. Select has no ordinary title-navigation action.
   if(this.allowAttract&&--m[0x4c7]===0){m[0x4c7]=64;if(--m[0x4c6]===0){this.play('attract','demo');return;}}
   const loop=this.sequence.loop??this.sequence.frames;
   if(loop.length)this.apply(loop[this.index++%loop.length]);
   return;
  }
  if(this.phase==='attract'&&this.row.interruptible!==false&&this.consume(0xd9)){this.interrupt();return;}
  const frames=this.sequence.frames;
  this.apply(frames[Math.min(this.index++,frames.length-1)]);
  if(this.index<frames.length)return;
  if(this.terminal==='title'){this.title(this.timer,{release:this.blockedStart});}
  else if(this.terminal==='chosen')this.onAction({type:'chosen',choice:this.choice});
  else if(this.terminal==='demo')this.onAction({type:'demo'});
 }
 snapshot(){
  const scene=this.data.scenes[this.row.scene];
  if(!this.cache.has(this.row.scene))this.cache.set(this.row.scene,{width:scene.width??128,height:scene.height??80,cellWidth:scene.cellWidth??2,cellHeight:scene.cellHeight??3,rows:scene.rows.map(i=>this.data.rows[i]),inks:scene.inks.map(i=>this.data.rows[i])});
  const positions=[0,1,2,4,5,6,8,9,10,11];
  const labels=typeof scene.labels==='number'?this.data.labels[scene.labels]:scene.labels;
  const chars=labels.map(i=>typeof i==='number'?this.data.glyphs[i]:i).map(label=>{
   const index=positions.indexOf(label.address-0x22cf);
   if((this.phase==='continue'||this.phase==='dismiss'&&this.choice?.type!=='new')&&index>=0)return {...label,char:this.m[0x120+index]===39?'-':String(this.m[0x120+index])};
   return label;
  });
  return {frame:this.frame,sequenceFrame:this.index,kind:'menu',phase:this.phase,selection:this.phase==='continue'?'continue':'new',cursor:this.m[0x4c1],password:Array.from(this.m.slice(0x120,0x12a),d=>d===39?'-':String(d)).join(''),blockedStart:this.blockedStart,awaitingStart:this.phase==='title'||this.phase==='continue',completed:false,terminal:null,prompt:null,background:this.cache.get(this.row.scene),portrait:null,messageText:this.message,message:{chars},scroll:0,hidden:this.row.hidden,palette:Array.from(this.m.slice(0x480,0x4a0)),poseRecovered:true};
 }
}
