import {ANOTHER_WORLD_ART} from './another-world-art.mjs';
import {POSTFIGHT_ART} from './postfight-art.mjs';

const digitGlyph=tile=>tile>=1&&tile<=10?String(tile-1):tile===255?' ':null;
/** Original bank 7 $8FF0–90F0 password encoding. Inputs remain live career
 * digits; no captured career/password is used by the playable game. */
export function careerPassword(memory) {
 if(memory[0x13e])return null;
 const record=Array.from(memory.slice(0x170,0x176));
 const checksum=(record.reduce((a,b)=>a+b,0)^255)&255;
 const rank=(((((memory[9]&0x30)^0x30)-0x10)&255)>>>2)|record[3];
 const rotations=[1,2,0,255,2,0,1,255,0,1,2,255,255,255,255,255][rank];
 if(rotations===undefined||rotations===255)return null;
 const packed=new Uint8Array(5);
 const parts=(x,y,direction)=>{packed[y]|=record[x]&12;packed[y+direction]|=record[x]&3;};
 parts(0,0,1);parts(1,3,-1);parts(4,2,1);parts(5,1,-1);
 for(let x=0;x<3;x++)packed[x]|=(checksum<<(x*2))&48;
 packed[3]|=(checksum>>>2)&48;packed[4]=((rank<<4)&48)|(rank&12);
 const digits=new Uint8Array(10);
 for(let x=0;x<5;x++){digits[x*2]=(packed[x]<<2)&224;digits[x*2+1]=(packed[x]<<5)&255;}
 for(let r=0;r<rotations;r++)for(let x=9;x>=0;x--){const carry=digits[x]>>>7;digits[x]=(digits[x]<<1)&255;if(x)digits[x-1]|=carry<<4;else digits[9]=carry<<7;}
 for(let i=0;i<10;i++)digits[i]>>>=5;
 digits[9]|=rotations;
 const offsets=[6,3,5,7,9,0,1,4,2,8];
 return Array.from(digits,(v,i)=>(v+offsets[i])%10);
}

/** Game-specific authored presentation cues, recovered offline from original
 * main-thread routines. Runtime executes no cartridge code or video decoder. */
export class PostfightPresentation {
 constructor({memory}){this.m=memory;this.data=memory[0x13e]?ANOTHER_WORLD_ART.postfight:POSTFIGHT_ART;this.cache=new Map();}
 cue(row){return typeof row==='number'?this.data.cues[row]:row;}
 enter(pending){
  this.pending=pending;this.frame=0;this.sampledFrames=0;this.segmentIndex=0;this.index=0;this.completed=false;this.awaitingStart=false;this.holdIndex=0;this.exitLoop=null;
  const result=pending.result,gameover=pending.type==='game-over';
  this.key=`${pending.previousFighter}:${result}:${gameover?1:0}`;
  this.sequence=(!gameover&&pending.previousRematch?this.data.sequences[this.key+':retry']:null)??this.data.sequences[this.key]??this.data.sequences[`${pending.previousFighter}:${result}:0`];
  if(!this.sequence)throw Error('Missing original postfight presentation '+this.key);
  this.terminal=this.sequence.terminal;
  this.password=careerPassword(this.m);
  this.clock=Array.from(this.m.slice(0x30b,0x30f));this.round=this.m[6];
  this.fraction=[1,1,3,6,5,9,7,2,9,3,10,8,10,10].slice((this.m[0x306]>>>4)*2,(this.m[0x306]>>>4)*2+2);
  this.m[4]=this.m[0x1c]=1;this.m[0x1d]=255;this.m[0x1f]=1;this.apply(this.cue(this.sequence.segments[0].frames[0]));
  return this.snapshot();
 }
 apply(row){
  if(this.data!==POSTFIGHT_ART&&this.row===row)return;this.row=row;const m=this.m;
  if(row.palette){m.set(row.palette,0x480);m[0x4a0]=129;}
  m[0x1b]=row.hidden?128:129;
  for(const [address,value]of row.audio??[])m[address]=value;
 }
 tick(){
  if(this.completed)return;
  this.frame++;
  if(this.awaitingStart){
   const loop=this.sequence.segments[this.segmentIndex].loop;
   if(!(this.m[0xd9]&128)){if(loop?.length)this.apply(this.cue(loop[this.holdIndex++%loop.length]));return;}
   if(loop?.length)this.exitLoop={frames:loop,index:this.holdIndex};
   this.m[0xd9]&=127;this.awaitingStart=false;this.segmentIndex++;this.index=0;
  }
  const segment=this.sequence.segments[this.segmentIndex];
  if(!segment){this.completed=true;return;}
  let row=this.cue(segment.frames[this.index]);
  if(this.exitLoop&&row.phase==='password'&&!row.hidden){const pose=this.cue(this.exitLoop.frames[this.exitLoop.index++%this.exitLoop.frames.length]);row={...row,scene:pose.scene};}
  this.apply(row);this.sampledFrames++;
  if(++this.index>=segment.frames.length){
   if(segment.wait){this.awaitingStart=true;this.holdIndex=0;}
   else if(this.segmentIndex===this.sequence.segments.length-1)this.completed=true;
   else{this.segmentIndex++;this.index=0;}
  }
 }
 matrix(scene){
  if(!this.cache.has(this.row.scene))this.cache.set(this.row.scene,{width:128,height:80,rows:scene.rows.map(i=>this.data.rows[i]),inks:scene.inks.map(i=>this.data.rows[i])});
  return this.cache.get(this.row.scene);
 }
 labels(scene){
  const replacements=new Map();
  if(this.row.phase==='result'){
   this.clock.forEach((tile,i)=>replacements.set(0x218d+i,digitGlyph(tile)??({44:':'})[tile]));
   this.fraction.forEach((tile,i)=>replacements.set(0x2192+i,digitGlyph(tile)));
   replacements.set(0x2196,String(this.round));
  }
  if(this.password&&(this.row.phase==='password'||this.row.phase==='title')){
   const offsets=[0,1,2,4,5,6,8,9,10,11];
   for(const base of [0x20b2,0x282f])offsets.forEach((offset,i)=>replacements.set(base+offset,String(this.password[i])));
  }
  if(this.row.phase==='staff-credits'){
   const positions=[0,1,3,4,6,7];
   positions.forEach((offset,i)=>replacements.set(0x26b4+offset,i%2===0&&!this.m[0x170+i]?' ':String(this.m[0x170+i])));
  }
  const labels=(typeof scene.labels==='number'?this.data.labels[scene.labels]:scene.labels).map(label=>typeof label==='number'?this.data.glyphs[label]:label);
  if(this.m[0x13e]&&this.pending.previousFighter===28&&this.pending.won&&this.pending.result!==0xfa&&[...'TIME'].every((char,i)=>labels.some(label=>label.address===0x2391+i&&label.char===char))){
   this.clock.forEach((tile,i)=>replacements.set(0x2396+i,digitGlyph(tile)??({44:':'})[tile]??' '));
   this.fraction.forEach((tile,i)=>replacements.set(0x239b+i,digitGlyph(tile)??' '));replacements.set(0x239f,String(this.round));
  }
  const chars=labels.map(label=>({...label,char:replacements.get(label.address)??label.char}));
  // Original blank leading record digits still occupy a tile and can become
  // visible when the player's live career reaches ten wins/knockouts.
  if(this.row.phase==='staff-credits')for(const [a,char]of replacements){if(char===' '||chars.some(c=>c.address===a))continue;const next=chars.find(c=>c.address===a+1);if(next)chars.push({...next,x:next.x-8,address:a,char});}
  return chars;
 }
 snapshot(){
  if(!this.row)return null;
  const scene=this.data.scenes[this.row.scene];
  return{frame:this.frame,sampledFrames:this.sampledFrames,phase:this.completed&&this.terminal==='ending'?'credits':this.row.phase,awaitingStart:this.awaitingStart,completed:this.completed,terminal:this.terminal,prompt:this.awaitingStart?'PUSH START':null,background:this.matrix(scene),portrait:null,message:{chars:this.labels(scene)},scroll:0,hidden:this.row.hidden,palette:Array.from(this.m.slice(0x480,0x4a0)),poseRecovered:true,password:this.password?.join('')??null};
 }
}
