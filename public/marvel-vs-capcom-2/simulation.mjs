// Authored 60 Hz preview rules. These are not decompiled retail combat routines.
export const RATE = 60;
export const FLOOR = 352;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const empty = () => new Set();
export class Match {
  constructor(fighter = 'ryu', mode = 'cpu') {
    this.mode = mode;
    this.names = [fighter, fighter === 'ryu' ? 'cyclops' : 'ryu'];
    this.wins = [0, 0]; this.round = 0; this.seed = 417;
    this.events = []; this.particles = []; this.paused = false;
    this.roundStart();
  }
  random() { this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5; return (this.seed >>> 0) / 4294967296; }
  roundStart() {
    this.round++; this.time = 99 * RATE; this.tickCount = 0;
    this.phase = 'intro'; this.delay = 150; this.projectiles = []; this.freeze = 0;
    this.players = this.names.map((name, i) => ({
      name, x: i ? 558 : 210, y: 0, vy: 0, face: i ? -1 : 1,
      health: 1000, meter: 0, state: 'idle', age: 0, attack: null,
      stun: 0, walk: false, crouch: false, block: false, combo: 0, flash: 0,
    }));
    this.aiInputs = empty(); this.aiTimer = 0;
    this.events.push({type:'round', round:this.round});
  }
  ai() {
    if (--this.aiTimer > 0) return this.aiInputs;
    this.aiTimer = 18 + Math.floor(this.random() * 16);
    const me = this.players[1], other = this.players[0];
    const distance = Math.abs(me.x - other.x), toward = me.x > other.x ? 'left' : 'right';
    const away = toward === 'left' ? 'right' : 'left';
    const keys = empty();
    if (other.attack && distance < 160 && this.random() < 0.55) keys.add(away);
    else if (distance > 105) keys.add(toward);
    if (distance < 130 && this.random() < 0.8) keys.add(this.random() < 0.6 ? 'light' : 'heavy');
    if (distance > 160 && this.random() < 0.28) keys.add('special');
    if (other.attack?.kind === 'special' && this.random() < 0.4) keys.add('jump');
    this.aiInputs = keys;
    return keys;
  }
  attack(player, kind) {
    if (player.attack || player.stun || player.health <= 0) return;
    const specs = {
      light:{windup:5, active:5, total:23, damage:48, reach:132, stun:15},
      heavy:{windup:11, active:7, total:37, damage:102, reach:162, stun:23},
      special:{windup:15, active:1, total:55, damage:78, reach:0, stun:20},
    };
    player.attack = {...specs[kind], kind, frame:0, hit:false, low:player.crouch};
    player.state = kind; player.age = 0;
    this.events.push({type:'swing',kind});
  }
  impact(attacker, target, attack, isProjectile = false) {
    if (target.health <= 0) return;
    const blocked = target.block && !target.attack && target.y === 0;
    const damage = blocked ? (isProjectile ? 7 : 0) : attack.damage;
    target.health = Math.max(0, target.health - damage);
    target.meter = clamp(target.meter + 6, 0, 100);
    attacker.meter = clamp(attacker.meter + (blocked ? 3 : 10), 0, 100);
    target.stun = blocked ? 10 : attack.stun;
    target.state = blocked ? 'block' : 'hurt'; target.age = 0;
    target.flash = blocked ? 0 : 5;
    target.x = clamp(target.x + attacker.face * (blocked ? 5 : 12), 88, 680);
    if (!blocked) { target.attack = null; this.freeze = attack.kind === 'heavy' ? 6 : 3; }
    const x = target.x - attacker.face * 22, y = FLOOR - target.y - 83;
    this.events.push({type:blocked?'block':'hit',x,y,kind:attack.kind});
    this.particles.push({x,y,t:14,max:14,blocked});
  }
  tick(given = [empty(), empty()]) {
    if (this.paused || this.phase === 'result') return;
    this.tickCount++;
    for (const spark of this.particles) spark.t--;
    this.particles = this.particles.filter(p => p.t > 0);
    if (this.phase === 'intro') {
      if (--this.delay <= 0) { this.phase = 'active'; this.events.push({type:'fight'}); }
      return;
    }
    if (this.phase === 'roundover') {
      this.players.forEach((p,i) => { p.age++; p.state = this.winner<0?'idle':(i===this.winner?'win':'ko'); });
      if (--this.delay <= 0) {
        if (Math.max(...this.wins) >= 2) { this.phase = 'result'; this.events.push({type:'result',winner:this.winner}); }
        else this.roundStart();
      }
      return;
    }
    if (this.freeze > 0) { this.freeze--; return; }
    this.time--;
    const inputs = [given[0] || empty(), this.mode === 'cpu' ? this.ai() : (given[1] || empty())];
    // Both fighters defend with this tick's input and can trade active attacks.
    this.players.forEach((p,i)=>{
      p.face=this.players[1-i].x>=p.x?1:-1;
      p.crouch=inputs[i].has('down')&&p.y===0;
      const horizontal=Number(inputs[i].has('right'))-Number(inputs[i].has('left'));
      p.block=horizontal===-p.face&&p.y===0&&!p.attack&&!p.stun;
    });
    const contacts=[];
    this.players.forEach((p, index) => {
      const keys = inputs[index], other = this.players[1-index];
      p.face = other.x >= p.x ? 1 : -1;
      p.age++; p.flash = Math.max(0,p.flash-1);
      p.walk = false;
      if (p.y > 0 || p.vy > 0) { p.y += p.vy; p.vy -= 0.58; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
      if (p.stun > 0) { p.stun--; if (!p.stun && !p.attack) {p.state = 'idle';p.age=0;} return; }
      if (p.attack) {
        const a = p.attack; a.frame++;
        if (a.kind === 'special' && a.frame === a.windup) {
          this.projectiles.push({owner:index,x:p.x+p.face*42,y:FLOOR-p.y-86,face:p.face,age:0,life:100,
            speed:p.name==='ryu'?6:9,damage:a.damage,stun:a.stun,kind:'special',name:p.name});
          this.events.push({type:'special',name:p.name});
        }
        if (a.kind !== 'special' && !a.hit && a.frame >= a.windup && a.frame < a.windup+a.active &&
            Math.abs(other.x-p.x)<a.reach && Math.abs(other.y-p.y)<(a.low?60:106) && (other.x-p.x)*p.face>=0) {
          a.hit = true; contacts.push([p,other,a]);
        }
        if (a.frame >= a.total) { p.attack=null; p.state='idle';p.age=0; }
        return;
      }
      const horizontal = Number(keys.has('right')) - Number(keys.has('left'));
      p.crouch = keys.has('down') && p.y === 0;
      p.block = horizontal === -p.face && p.y === 0;
      if (keys.has('jump') && p.y === 0) { p.vy=10.8;p.y=1;p.state='jump';p.age=0; }
      if (horizontal && !p.crouch) { p.x=clamp(p.x+horizontal*(p.block?1.8:2.8),88,680);p.walk=true; }
      p.state = p.y>0?'jump':p.crouch?'crouch':p.walk?'walk':'idle';
      if (keys.has('special')) this.attack(p,'special');
      else if (keys.has('heavy')) this.attack(p,'heavy');
      else if (keys.has('light')) this.attack(p,'light');
    });
    for(const contact of contacts)this.impact(...contact);
    const [a,b] = this.players;
    if (Math.abs(a.x-b.x)<104 && Math.abs(a.y-b.y)<90) {
      const correction=(104-Math.abs(a.x-b.x))/2,dir=a.x<b.x?-1:1;
      a.x=clamp(a.x+dir*correction,88,680);b.x=clamp(b.x-dir*correction,88,680);
    }
    for (const shot of this.projectiles) {
      shot.age++; shot.x += shot.face*shot.speed; shot.life--;
      const target=this.players[1-shot.owner];
      if (shot.life>0 && Math.abs(target.x-shot.x)<31 && Math.abs((FLOOR-target.y-73)-shot.y)<54) {
        this.impact(this.players[shot.owner],target,shot,true);shot.life=0;
      }
    }
    this.projectiles=this.projectiles.filter(s=>s.life>0&&s.x>-60&&s.x<828);
    if (a.health===0 || b.health===0 || this.time<=0) {
      this.winner=a.health===b.health?-1:(a.health>b.health?0:1);
      if (this.winner>=0) this.wins[this.winner]++;
      this.phase='roundover';this.delay=135;this.projectiles=[];
      this.events.push({type:'ko',winner:this.winner});
    }
  }
}
