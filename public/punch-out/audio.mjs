import {AUDIO_DATA} from './audio-data.mjs';
import {createSoundRoutines} from './audio-routines.mjs';

/** Original bank-8 frame sequencer. Call once at NMI's pre-fighter sound point.
 * Requests F0..F3 are consumed in DMC/SQ1/SQ2/music order, then cleared.
 * The surrounding game owns request generation and frame/pause scheduling. */
export class OriginalAudio {
 constructor({memory=new Uint8Array(2048),read}={}) {
  this.memory=memory;this.readGame=read;this.frame=0;this.events=[];
  this.registers=new Uint8Array(24);this.registers[0x15]=15;
  this.run=createSoundRoutines(memory,address=>this.read(address),(address,value)=>this.write(address,value));
 }
 read(address) {
  if(address<2048)return this.memory[address];
  if(address>=0x4000&&address<=0x4017)return this.registers[address-0x4000];
  const key=address>=0xa000?'DEF':'008';
  const value=AUDIO_DATA[key][address];
  if(value!==undefined)return value;
  if(this.readGame)return this.readGame(address,8);
  throw Error(`Unrecovered original audio data $${address.toString(16)}`);
 }
 write(address,value) {
  value&=255;
  if(address<2048){this.memory[address]=value;return;}
  if(address<0x4000||address>0x4017)throw Error('Unexpected sound write '+address);
  this.registers[address-0x4000]=value;
  this.events.push({address,value});
 }
 tick() {
  this.events=[];this.requests=Array.from(this.memory.slice(0xf0,0xf4));
  this.run();this.frame++;
  return this.events;
 }
 reset({clearMemory=true}={}) {
  if(clearMemory){this.memory.fill(0,0xf0,0xfe);this.memory.fill(0,0x700,0x72d);}
  this.registers.fill(0);this.registers[0x15]=15;this.events=[];this.frame=0;
 }
 snapshot() {
  return {frame:this.frame,requests:this.requests||[0,0,0,0],active:Array.from(this.memory.slice(0xf4,0xf8)),
   registers:Array.from(this.registers),state:Array.from(this.memory.slice(0x700,0x72d)),eventCount:this.events.length};
 }
}
