// Selected original float32 motion readers, using exported executable tables.
const f=Math.fround;
export function integrate(p){
  p.x=f(p.x+p.vx);p.vx=f(p.vx+p.ax);
  p.y=f(p.y+p.vy);p.vy=f(p.vy+p.ay);
}
export function jumpMotion(p,direction,system,superJump=false){
  // 00181D90: selector0 neutral,1 original forward(0x800),2 back(0x400).
  const index=direction===0?0:direction===p.face?1:2;
  const [vy,ay,vx,ax]=system.fighters[p.name][superJump?'superJump':'jump'][index];
  p.vy=f(f(system.scaleY*vy)/256);p.ay=f(f(system.scaleY*ay)/256);
  p.vx=f(-p.face*f(f(system.scaleX*vx)/256));p.ax=f(-p.face*f(f(system.scaleX*ax)/256));
  p.superJump=superJump?1:0;p.airCounter=0;p.jumpVariant=index;p.jumpDirection=index-1;p.airborne=true;p.airContactSlowed=false;p.airActionUsed=false;
  return index;
}
export function walkVelocity(p,horizontal,system){
  // 00181F10: normalized forward0x800 uses1024; back0x400 uses−768.
  const value=system.fighters[p.name].walk[horizontal===p.face?0:1];
  return f(p.face*f(f(system.scaleX*value)/256));
}
export function airMotion(p,system){
  // 001820A0: vertical integration, native horizontal velocity clamp, then X.
  p.y=f(p.y+p.vy);p.vy=f(p.vy+p.ay);
  const raw=system.fighters[p.name][p.superJump?'superAirSpeed':'airSpeed'];
  let low=f(f(system.scaleX*raw[0])/256),high=f(f(system.scaleX*raw[1])/256);
  if(p.face>0)[low,high]=[-high,-low];
  p.vx=f(Math.max(low,Math.min(high,p.vx)));p.x=f(p.x+p.vx);
}
export function superJumpSteer(p,system){
  // 001821D0; original1E7 selects neutral/forward/back row.
  if(!p.superJump)return;
  if((p.airCounter||0)<7){p.airCounter=(p.airCounter||0)+1;return;}
  const horizontal=Number(p.inputSet.has('right'))-Number(p.inputSet.has('left'));
  if(horizontal){const values=system.fighters[p.name].superSteer[(p.jumpDirection??-1)+1];if(values)p.vx=f(p.vx-p.face*f(f(system.scaleX*values[horizontal===p.face?0:1])/256));}
}
export function superJumpFall(p,system){
  if(p.superJump===1&&p.vy<=0){p.superJump=2;p.ay=f(f(system.scaleY*system.fighters[p.name].superFallGravity)/256);}
}
export function hitTier(row){
  const kind=row[3]&0x70;
  if(kind)return kind===0x30?2:kind===0x20?1:0;
  return row[9]>=12?2:row[9]>=5?1:0;
}
export function pushProfile(row,system){
  let index;
  if(row[3]&0x78)index=row[3]&8?4:((row[3]&0x70)>>4)-1;
  else index=row[9]>=12?2:row[9]>=5?1:0;
  const profile=system.pushProfiles[index];
  if(!profile)throw Error(`Unsupported original push profile ${index}`);
  return profile.values.slice();
}
export function applyPush(p,system){
  if(!p.pushQueue?.length)return;
  const amount=p.pushQueue[0];
  if(amount>0){p.pushQueue.shift();p.x=f(p.x+f(p.pushFace*f(system.scaleX*amount)));}
}
export function guardAllows(target,row){
  if(!target.block || target.attack || (target.state==='hurt') || (row[2]&8))return false;
  const kind=row[2]&15;
  if(kind===2)return !target.crouch;
  if(kind===4)return target.crouch;
  return kind===0;
}
export function blockTicks(row){
  if(row[20] || (row[2]&0xf0))return 18;
  const kind=row[3]&0x70;
  return kind===0x20?14:kind===0x10?11:18;
}
export function launchVector(direction,strength,system){
  if(strength<0 || strength>15)throw Error('Unresolved original launch strength');
  const angle=(40-direction)&31, value=system.launchStrength[strength];
  return {
    vx:f(system.scaleX*f(f(value*system.launchSine32[(angle+8)&31])/150)),
    vy:f(system.scaleY*f(f(value*system.launchSine32[angle])/125)),
  };
}
