import {SPECIAL_PASSWORD_ART as ART} from './special-password-art.mjs';

/** Original busy/credits menu work, authored offline from declaration/OAM
 * streams. Playback only schedules native art, palette and sound requests. */
export class SpecialPasswordPresentation {
 constructor({memory,kind,password}){
  this.m=memory;this.kind=kind;this.password=password;this.sequence=ART.sequences[kind];
  if(!this.sequence)throw Error('Unsupported special password '+kind);
  this.frame=0;this.segmentIndex=0;this.index=0;this.holdIndex=0;this.awaitingStart=false;this.completed=false;this.cache=new Map();
  memory[4]=memory[0x1c]=1;memory[0x1d]=255;memory[0x4c8]=0;memory[0x1f]=1;
  this.apply(this.sequence.segments[0].frames[0]);
 }
 apply(id){
  this.row=ART.cues[id];const m=this.m;
  if(this.row.palette){m.set(this.row.palette,0x480);m[0x4a0]=129;}
  m[0x1b]=this.row.hidden?128:129;
  for(const [address,value]of this.row.audio??[])m[address]=value;
 }
 tick(){
  if(this.completed)return;
  this.frame++;
  if(this.awaitingStart){
   const loop=this.sequence.segments[this.segmentIndex].loop;
   if(!(this.m[0xd9]&128)){if(loop.length)this.apply(loop[this.holdIndex++%loop.length]);return;}
   this.m[0xd9]&=127;this.awaitingStart=false;this.segmentIndex++;this.index=0;
  }
  const segment=this.sequence.segments[this.segmentIndex];
  this.apply(segment.frames[this.index++]);
  if(this.index>=segment.frames.length){
   if(segment.wait){this.awaitingStart=true;this.holdIndex=0;}
   else if(this.segmentIndex===this.sequence.segments.length-1)this.completed=true;
   else{this.segmentIndex++;this.index=0;}
  }
 }
 snapshot(){
  const scene=ART.scenes[this.row.scene];
  if(!this.cache.has(this.row.scene))this.cache.set(this.row.scene,{width:128,height:80,rows:scene.rows.map(i=>ART.rows[i]),inks:scene.inks.map(i=>ART.rows[i])});
  const positions=[0,1,2,4,5,6,8,9,10,11];
  const chars=scene.labels.map(i=>{const label=ART.glyphs[i],digit=positions.indexOf(label.address-0x22cf);return this.kind==='busy'&&digit>=0?{...label,char:this.password[digit]}:label;});
  return {frame:this.frame,kind:this.kind,phase:this.row.phase,awaitingStart:this.awaitingStart,completed:this.completed,terminal:'title',prompt:this.awaitingStart?'PUSH START':null,background:this.cache.get(this.row.scene),portrait:null,message:{chars},scroll:0,hidden:this.row.hidden,palette:Array.from(this.m.slice(0x480,0x4a0)),poseRecovered:true};
 }
}
