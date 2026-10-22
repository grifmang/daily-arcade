export class Audio {
  enabled=true;
  unlock() {if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)();this.context.resume().catch(()=>{});}
  play(event) {
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context,t=ctx.currentTime;
    const sounds={swing:[170,60,.035,'triangle'],hit:[85,35,.12,'sawtooth'],block:[420,100,.06,'square'],special:[720,90,.23,'sawtooth'],fight:[550,1100,.16,'triangle'],ko:[220,65,.48,'triangle'],round:[330,660,.08,'sine']};
    const values=sounds[event.type];if(!values)return;
    const [start,end,duration,type]=values,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(start,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.07,t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duration+.02);
  }
}
