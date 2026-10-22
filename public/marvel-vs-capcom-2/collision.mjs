// Original HIT_ descriptors and HIT_FM rectangles, not distance-based reach.
// Readers: 001E7900 / 001E7A20 / 001E8310. Default scale: 001804F0.
export function descriptor(player, resources) {
  const row = resources.actions[player.name].hitDescriptors[player.animation.collision];
  if (!row) return [];
  return Array.from({length:8}, (_,i)=>row[i*2] | row[i*2+1]<<8);
}
export function rectangle(player, index, resources) {
  if (!index) return null;
  const box = resources.actions[player.name].boxes[index & 0x1fff];
  if (!box) throw Error(`Original box index out of range: ${player.name}:${index}`);
  const [x,rx,y,ry] = box, sx=resources.system.scaleX, sy=resources.system.scaleY;
  return {x:player.x-player.face*x*sx,y:player.y-y*sy,rx:rx*sx,ry:ry*sy};
}
export function contact(attacker, target, resources) {
  const a=descriptor(attacker,resources), b=descriptor(target,resources);
  for(const index of a.slice(0,2)){
    // Negative secondary selectors are throws, handled by their action path.
    if(!index || index&0x8000)continue;
    const hit=rectangle(attacker,index,resources);
    if(!hit || hit.rx===0 || hit.ry===0)continue;
    for(const hurtIndex of b.slice(2,6)){
      if(!hurtIndex)continue;
      const hurt=rectangle(target,hurtIndex,resources);
      if(hurt && Math.abs(hit.x-hurt.x)<=hit.rx+hurt.rx && Math.abs(hit.y-hurt.y)<=hit.ry+hurt.ry)
        return {attackBox:index&0x1fff,hurtBox:hurtIndex&0x1fff,regionFlags:hurtIndex&0xe000};
    }
  }
  return null;
}
// Normal-damage path of 0018B890, standard damage option and one-character ratio.
// Team/CPU handicaps, assists and character power-up modifiers are outside scope.
export function originalDamage(target, hit, comboIndex, system) {
  const f=Math.fround;
  let multiplier=32;
  if(!(hit[18]&8))multiplier=system.comboDamage[Math.min(19,comboIndex)];
  let value=Math.max(1,f(f(hit[0]*multiplier)/32));
  value=f(value*f(system.fighters[target.name].defense/32));
  const health=system.healthDamage.find(([threshold])=>target.health<=threshold);
  if(!health)throw Error('Health outside recovered damage thresholds');
  value=f(value*f(health[1]/32));
  // Original settings[1] and ratio[2] are both 32: neutral multiplier.
  return Math.max(1,Math.trunc(value));
}
