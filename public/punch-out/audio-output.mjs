import {DMC_STEPS} from './audio-samples.mjs';

const CPU=1789773, FPS=60.0988138974405;
const LENGTH=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const NOISE=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068];
const DMC_RATE=[428,380,340,320,286,254,226,214,190,160,142,128,106,85,72,54];
const DUTY=[[0,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0],[0,1,1,1,1,0,0,0],[1,0,0,1,1,1,1,1]];
const channel=()=>({period:0,phase:0,length:0,volume:0,control:0,sweep:0,sweepDivider:0,sweepReload:false,envelope:0,envelopeDivider:0,envelopeStart:false});
const volume=p=>(p.control&16)?p.control&15:p.envelope;

/** Cartridge-independent APU-style audio hardware. Game code emits register writes;
 * this synthesizer only clocks oscillators, envelopes and extracted DMC samples. */
export class AudioSignal {
 constructor(sampleRate=48000){this.sampleRate=sampleRate;this.h90=Math.exp(-2*Math.PI*90/sampleRate);this.h440=Math.exp(-2*Math.PI*440/sampleRate);this.l14=1-Math.exp(-2*Math.PI*14000/sampleRate);this.reset();}
 reset(){
  this.registers=new Uint8Array(24);this.registers[0x15]=15;
  this.pulse=[channel(),channel()];this.triangle=channel();this.noise=channel();
  this.noise.shift=1;this.noise.clock=0;this.triangle.linear=0;this.triangle.reload=false;
  this.dmc={dac:0,steps:null,index:0,clock:0,enabled:false};this.frameClock=0;this.frameStep=0;
  this.high90=0;this.high440=0;this.low14k=0;this.lastInput=0;this.last90=0;
  this.sampleRemainder=0;this.peak=0;this.totalSamples=0;this.nonzeroSamples=0;
 }
 write(address,value){
  const r=address-0x4000;this.registers[r]=value;
  if(r<8){
   const p=this.pulse[r>>2],reg=r&3;
   if(reg===0)p.control=value;
   if(reg===1){p.sweep=value;p.sweepReload=true;}
   if(reg===2)p.period=(p.period&0x700)|value;
   if(reg===3){p.period=(p.period&255)|((value&7)<<8);p.phase=0;p.envelopeStart=true;if(this.registers[0x15]&(1<<(r>>2)))p.length=LENGTH[value>>3];}
  }else if(r===8)this.triangle.control=value;
  else if(r===10)this.triangle.period=(this.triangle.period&0x700)|value;
  else if(r===11){this.triangle.period=(this.triangle.period&255)|((value&7)<<8);this.triangle.reload=true;if(this.registers[0x15]&4)this.triangle.length=LENGTH[value>>3];}
  else if(r===12)this.noise.control=value;
  else if(r===14)this.noise.period=value;
  else if(r===15){if(this.registers[0x15]&8)this.noise.length=LENGTH[value>>3];this.noise.envelopeStart=true;}
  else if(r===17)this.dmc.dac=value&127;
  else if(r===21){
   for(let i=0;i<2;i++)if(!(value&(1<<i)))this.pulse[i].length=0;
   if(!(value&4))this.triangle.length=0;if(!(value&8))this.noise.length=0;
   if(!(value&16)){this.dmc.enabled=false;this.dmc.steps=null;}
   else if(!this.dmc.enabled){this.dmc.steps=DMC_STEPS[this.registers[18]]||null;this.dmc.index=0;this.dmc.clock=0;this.dmc.enabled=!!this.dmc.steps;}
  }else if(r===23){this.frameClock=0;this.frameStep=0;if(value&128){this.quarter();this.half();}}
 }
 quarter(){
  for(const p of [...this.pulse,this.noise]){
   if(p.envelopeStart){p.envelopeStart=false;p.envelope=15;p.envelopeDivider=p.control&15;}
   else if(p.envelopeDivider>0)p.envelopeDivider--;
   else {p.envelopeDivider=p.control&15;if(p.envelope>0)p.envelope--;else if(p.control&32)p.envelope=15;}
  }
  const t=this.triangle;
  if(t.reload)t.linear=t.control&127;else if(t.linear)t.linear--;
  if(!(t.control&128))t.reload=false;
 }
 half(){
  for(const p of [...this.pulse,this.noise])if(p.length&&!(p.control&32))p.length--;
  if(this.triangle.length&&!(this.triangle.control&128))this.triangle.length--;
  this.pulse.forEach((p,i)=>{
   const shift=p.sweep&7,target=p.period+((p.sweep&8)?-(p.period>>shift)-(i===0?1:0):(p.period>>shift));
   if(!p.sweepDivider&&(p.sweep&128)&&shift&&p.period>=8&&target>=0&&target<=2047)p.period=target;
   if(!p.sweepDivider||p.sweepReload){p.sweepDivider=(p.sweep>>4)&7;p.sweepReload=false;}else p.sweepDivider--;
  });
 }
 next(){
  const cycles=CPU/this.sampleRate;
  this.frameClock+=cycles;
  const sequence=(this.registers[23]&128)?[7457,14913,22371,29829,37281]:[7457,14913,22371,29829];
  if(this.frameClock>=sequence[this.frameStep]){
   if(this.frameStep!==3||(this.registers[23]&128)===0)this.quarter();
   if(this.frameStep===1||this.frameStep===sequence.length-1)this.half();
   if(++this.frameStep===sequence.length){this.frameClock-=sequence[sequence.length-1];this.frameStep=0;}
  }
  let square=0;
  for(let i=0;i<2;i++){
   const p=this.pulse[i];
   p.phase=(p.phase+cycles/(2*(p.period+1)))%8;
   const shift=p.sweep&7,target=p.period+((p.sweep&8)?-(p.period>>shift)-(i===0?1:0):(p.period>>shift));
   if(p.length&&p.period>=8&&(!shift||target<=2047))square+=DUTY[p.control>>6][p.phase|0]*volume(p);
  }
  const t=this.triangle;
  let tri=0;
  if(t.length&&t.linear&&t.period>1){t.phase=(t.phase+cycles/(t.period+1))%32;const step=t.phase|0;tri=step<16?15-step:step-16;}
  const n=this.noise;n.clock+=cycles;
  const period=NOISE[n.period&15];
  while(n.clock>=period){n.clock-=period;const bit=(n.shift^(n.shift>>((n.period&128)?6:1)))&1;n.shift=(n.shift>>1)|(bit<<14);}
  const noise=n.length&&!(n.shift&1)?volume(n):0;
  const d=this.dmc;
  if(d.enabled&&d.steps){
   d.clock+=cycles;
   while(d.enabled&&d.clock>=DMC_RATE[this.registers[16]&15]){
    d.clock-=DMC_RATE[this.registers[16]&15];const step=d.steps[d.index++];
    if(step>0&&d.dac<=125)d.dac+=2;else if(step<0&&d.dac>=2)d.dac-=2;
    if(d.index>=d.steps.length){if(this.registers[16]&64)d.index=0;else d.enabled=false;}
   }
  }
  const pulse=square?95.88/(8128/square+100):0;
  const weighted=tri/8227+noise/12241+d.dac/22638;
  const raw=pulse+(weighted?159.79/(1/weighted+100):0);
  // NES-style output coupling/filter chain: 90Hz and 440Hz highpass, 14kHz lowpass.
  this.high90=this.h90*(this.high90+raw-this.lastInput);this.lastInput=raw;
  this.high440=this.h440*(this.high440+this.high90-this.last90);this.last90=this.high90;
  this.low14k+=this.l14*(this.high440-this.low14k);
  const signal=this.low14k*1.4;this.peak=Math.max(this.peak,Math.abs(signal));this.totalSamples++;if(Math.abs(signal)>0.00001)this.nonzeroSamples++;
  return signal;
 }
 renderFrame(events=[]){
  for(const event of events)this.write(event.address,event.value);
  this.sampleRemainder+=this.sampleRate/FPS;const length=Math.floor(this.sampleRemainder);this.sampleRemainder-=length;
  const buffer=new Float32Array(length);for(let i=0;i<length;i++)buffer[i]=this.next();return buffer;
 }
 snapshot(){return {peak:this.peak,totalSamples:this.totalSamples,nonzeroSamples:this.nonzeroSamples,dmcActive:this.dmc.enabled};}
}

/** Gesture-unlocked browser transport. Sequencing is game-owned; pause cancels
 * queued audio and preserves oscillator state, reset also clears the hardware. */
export class SoundOutput {
 constructor(){this.context=null;this.signal=null;this.sources=new Set();this.muted=false;this.paused=false;this.nextTime=0;this.droppedFrames=0;}
 async unlock(){
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return false;
  if(!this.context){this.context=new Context();this.signal=new AudioSignal(this.context.sampleRate);this.gain=this.context.createGain();this.gain.gain.value=this.muted?0:0.65;this.gain.connect(this.context.destination);}
  await this.context.resume();this.paused=false;return this.context.state==='running';
 }
 playFrame(events){
  if(!this.signal||this.paused)return;
  const samples=this.signal.renderFrame(events);
  if(this.context.state!=='running')return;
  if(this.nextTime>this.context.currentTime+0.18){this.droppedFrames++;return;}
  const buffer=this.context.createBuffer(1,samples.length,this.context.sampleRate);buffer.copyToChannel(samples,0);
  const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);this.sources.add(source);source.onended=()=>this.sources.delete(source);
  this.nextTime=Math.max(this.context.currentTime+0.035,this.nextTime);source.start(this.nextTime);this.nextTime+=buffer.duration;
 }
 pause(){this.paused=true;for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.nextTime=0;}
 resume(){this.paused=false;this.context?.resume();}
 reset(){this.pause();this.signal?.reset();this.paused=false;}
 setMuted(muted){this.muted=!!muted;if(this.gain)this.gain.gain.setValueAtTime(this.muted?0:0.65,this.context.currentTime);}
 snapshot(){return {unlocked:!!this.context,state:this.context?.state||'locked',paused:this.paused,muted:this.muted,queued:this.sources.size,droppedFrames:this.droppedFrames,...this.signal?.snapshot()};}
}
