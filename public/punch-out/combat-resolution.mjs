/** Game-specific shared fight rules recovered from PRG bank 7. No CPU emulation. */
const byte = n => n & 255;
const negative = n => (n & 128) !== 0;

export class CombatResolution {
  constructor({ memory, read, hooks = {} }) {
    if (!(memory instanceof Uint8Array) || memory.length < 2048) throw new TypeError('CombatResolution requires shared fight RAM');
    if (typeof read !== 'function') throw new TypeError('CombatResolution requires bank-7 data reader');
    this.memory = memory;
    this.read = read;
    this.hooks = hooks;
    this.events = [];
  }
  hook(name) {
    if (typeof this.hooks[name] !== 'function') throw new Error(`Unresolved original combat helper: ${name}`);
    return this.hooks[name]();
  }
  random(threshold) {
    const m = this.memory;
    if (threshold === 15) return true;
    const old = m[0x18]; let carry = threshold >= 15 ? 1 : 0;
    for (let i = 0; i < 3; i++) { const next = m[0x18] & 1; m[0x18] = (m[0x18] >> 1) | (carry << 7); carry = next; }
    return threshold > (old & 15);
  }
  clearCombo() { const m = this.memory; m[0x4a] = m[0x4b] = m[0x4c] = 0; }
  state(base, mask = 3) { this.memory[0x90] = base + (mask & this.memory[0x74]); }
  stopClock() { this.memory[0x301] |= 1; }
  decrementStarCountdown() { const m = this.memory; m[0x347]--; if (!m[0x347]) m[0x347] = 1; }
  clearAttacks() {
    const m = this.memory;
    m.fill(0, 0x74, 0x78); m.fill(0, 0xb4, 0xba);
  }
  finishPunch() { this.memory[0x51] = this.memory[0x91] = 0x81; this.hook('knockedDown'); }
  macHitPose() {
    const m = this.memory;
    m[0x50] = negative(m[0x5a]) ? m[0x5a] : (0x90 | (m[0xb4] & 1)) + m[0x59];
    m[0x48e] = 0x25; m[0x4a0] = 0x81;
  }
  loseHearts(amount) {
    const m = this.memory;
    if (!(m[0x323] | m[0x324])) return;
    let low = m[0x324] - amount;
    const borrow = low < 0;
    if (borrow) low = byte(low) + 10;
    m[0x322] = low; m[0x321] = m[0x323] - (borrow ? 1 : 0);
    if (m[0x323] - (borrow ? 1 : 0) < 0 || !(m[0x321] | m[0x322])) {
      m[0xbc] = m[0x329] = 0; m[0x328] = 0x20; m[0x32a] = m[0x5a4];
      m[0x48e] = 0x14; m[0x320] = m[0x4a0] = 0x80;
      m[0x36] = (m[0x36] & 0x80) | 4;
    }
    // $8491's final comparison loop has no simulation side effects.
  }
  recoverStamina(amount) {
    const m = this.memory;
    const sum = byte(m[0x328] + amount); m[0x328] = sum;
    if (!sum || negative(sum)) {
      m[0x328] = 0; m[0xbc] = 1; m[0x48e] = 0x8f; m[0x4a0] = 0x80;
      m[0x36] = (m[0x36] & 0x80) | 8;
      const shifted = byte(m[0x329] << 1), carry = m[0x329] >> 7;
      const x = byte(shifted + 5 + carry);
      m[0x321] = m[0x328 + x]; m[0x322] = m[0x329 + x];
    } else if (sum >= m[0x32a]) m[0x328] = m[0x32a];
  }
  damage(amount, opponent) {
    const m = this.memory, x = opponent ? 8 : 1;
    const result = byte(m[0x391 + x] - amount);
    if (!result || negative(result)) {
      m[0x390 + x] = 0;
      return m[0x3d2] === 0;
    }
    m[0x390 + x] = result; return true;
  }
  boost(opponent) {
    const m = this.memory, x = opponent ? 9 : 2, cap = opponent ? m[0x5d7] : 15;
    if (cap >= m[0x390 + x]) m[0x38f + x] = m[0x390 + x] + 4;
  }
  macDown() {
    const m = this.memory;
    m[0x320] = m[0x340] = m[0xbb] = 0x80;
    this.stopClock(); m[5] = 2; m[0xbc] = 1; m[0x3c5] = 0;
    return 0;
  }
  opponentDown() {
    const m = this.memory;
    this.clearCombo(); this.stopClock(); m[0x3e3] = 1; m[0x3e0] = 0x80;
    m[5] = m[0x36] = 1; m[0xbb] = m[0x3cb] = 0;
    return 0;
  }
  clearAndFinish() { this.clearAttacks(); this.finishPunch(); }
  downOpponentAndFinish() { this.opponentDown(); this.finishPunch(); }
  hitResolution() {
    const m = this.memory;
    if (negative(m[0x98])) return this.resolveOpponentPunch();
    if (!negative(m[0x58])) return;
    m[0x344] = 0;
    if (m[0x58] !== 0x80 && !negative(m[0x74]) && m[0x4a]) {
      const defense = m[0xb6 + (m[0x74] & 3)];
      if (defense) {
        if (defense === 8) { this.clearCombo(); return this.blockMacPunch(0); }
        return this.evadeMacPunch();
      }
      m[0x581] = m[0x580]; m[0x4a] = 0x20; m[0x3e5] = 1; m[0x3e0] = 0x80;
      let comboContinuation = false;
      if (m[0x4b]) {
        m[0x4b]--;
        if (m[0x4b]) comboContinuation = true;
        else if (m[0x4c] & 1) { m[0x4b]++; comboContinuation = true; }
      }
      if (comboContinuation) {
        if (m[0x4c] & 1) {
          m[0x5c4]--;
          if (!m[0x5c4]) m[0x4c] = 0;
          else this.hook('advanceCombo');
        }
        m[0x58] = 3; this.state(0x91);
      } else {
        this.clearCombo(); m[0x58] = 3; this.state(0x8d); this.finishPunch();
      }
      this.decrementStarCountdown(); m[0x3d2] = m[0x3cb] === 9 ? 0 : 0x81;
      if (this.damage(m[0x5c5], true)) this.clearAttacks();
      else { this.state(0x8d); this.downOpponentAndFinish(); }
      return;
    }
    if (negative(m[0x74])) this.clearCombo();
    const defense = m[0xb6 + (m[0x74] & 3)];
    if (negative(defense)) return this.evadeMacPunch();
    const dealt = byte(m[0x75] - defense);
    if (!dealt || negative(dealt)) {
      if (defense === 8) return this.blockMacPunch(0);
      m[0x58] = 2; m[0xbb] = 0; return;
    }
    m[0xe0] = dealt;
    let received = byte(m[0xb5] - m[0x76 + (m[0xb4] & 1)]);
    if (negative(received)) received = 0;
    m[0xe1] = received;
    if (received) {
      m[0x58] = 0; this.state(0x8d); this.macHitPose(); this.loseHearts(1);
      m[0x341] = 0xff; m[0x3d2] = 0x82;
      if (this.damage(byte(m[0xe1] + m[0x5af]), false)) m[0x3d2] = m[0x3cb] === 9 ? 0 : 0x81;
      else m[0x3d2] = this.macDown();
      if (this.damage(m[0xe0], true)) this.clearAndFinish();
      else this.downOpponentAndFinish();
      return;
    }
    return this.resolveMacHit();
  }
  resolveOpponentPunch() {
    const m = this.memory;
    if (negative(m[0x58])) m[0x58] = 0;
    m[0x4fd] = 0;
    const defense = m[0x76 + (m[0xb4] & 1)];
    if (defense === 0xff || defense === 0x80) {
      let stamina, outcome;
      if (defense === 0xff) {
        m[0x3b0] = m[0x50]; m[0x3c5] = 0; stamina = m[0x5a0]; outcome = 4;
      } else { stamina = m[m[0x50] === 0x0e ? 0x5a2 : 0x5a1]; outcome = 2; }
      m[0x98] = m[0xbd] = outcome;
      if (!m[0xbc]) { this.recoverStamina(stamina); if (m[0xbc]) m[0x3c5] = 0; }
      m[0xb5] = m[0xb4] = 0; return;
    }
    const damage = byte(m[0xb5] - defense);
    if (!damage || negative(damage)) {
      if (defense !== 8) { m[0x98] = m[0xbd] = 2; return; }
      m[0x98] = m[0xbd] = 1; m[0x50] = 0x88;
      this.loseHearts(1); m[0x3d2] = 0x82;
      if (this.damage(m[0xbc] ? 2 : 4, false)) this.clearAndFinish();
      else { m[0x98] = m[0xbd] = 3; this.macHitPose(); this.macDown(); this.finishPunch(); }
      return;
    }
    m[0xe0] = damage;
    let dealt = byte(m[0x75] - m[0xb6 + (m[0x74] & 3)]);
    if (negative(dealt)) dealt = 0;
    m[0xe1] = dealt;
    if (!dealt) {
      m[0x98] = m[0xbd] = 3;
      if (!m[0xbc]) { this.recoverStamina(m[0x5a3]); m[0x329] = 1; }
      const next = byte(m[0x581] - m[0x582]); m[0x581] = Math.max(next, m[0x583]);
      this.loseHearts(3); m[0x341] = 0xff; this.macHitPose();
      if (!m[0x3c5]) {
        m[0x3d2] = 0x82; this.boost(true);
        if (this.damage(byte(m[0xe0] + m[0x5af]), false)) this.clearAndFinish();
        else { this.macDown(); this.finishPunch(); }
      } else { m[0x391] = 0; this.macDown(); this.finishPunch(); }
      return;
    }
    m[0x98] = m[0xbd] = 0; this.state(0x8d); this.macHitPose();
    this.loseHearts(3); m[0x341] = 0xff; m[0x3d2] = m[0x3cb] === 9 ? 0 : 0x81;
    // $819C loads E1 then overwrites A with zero: preserve the original zero damage.
    if (this.damage(0, true)) m[0x3d2] = 0x82;
    else m[0x3d2] = this.opponentDown();
    if (this.damage(byte(m[0xe0] + m[0x5af]), false)) this.clearAndFinish();
    else { this.macDown(); this.finishPunch(); }
  }
  evadeMacPunch() {
    const m = this.memory;
    m[0x58] = 2; this.loseHearts(1);
    const defense = m[0xb6 + (m[0x74] & 3)];
    if (defense !== 0x80) { this.finishPunch(); m[0xbb] = 1; }
    else m[0xbb] = 0;
    this.clearAttacks();
  }
  blockMacPunch(y) {
    const m = this.memory;
    m[0x58] = 1; m[0x343] = m[0x4fd] = y;
    this.state(0x85); this.loseHearts(1); this.clearAndFinish();
  }
  resolveMacHit() {
    const m = this.memory;
    m[0x58] = 3; m[0x3d2] = 0x81;
    if (negative(m[0x74])) m[0x3e4] = 5; else m[0x3e5] = 1;
    m[0x3e0] = 0x80;
    if (m[0xba]) { m[0x398] = 0; this.state(0x8d); this.downOpponentAndFinish(); return; }
    if (m[0x3cb] === 1 && negative(m[0x74])) {
      m[0x398] = 0; m[0x90] = 0x82; this.downOpponentAndFinish(); return;
    }
    if (m[0x3cb] === 9 && !negative(m[0x74])) m[0x3d2] = 0;
    this.boost(false);
    if (!this.damage(byte(m[0xe0] + (negative(m[0x74]) ? m[0x5d3] : 0)), true)) {
      if (negative(m[0x74])) m[0x90] = 0x82; else this.state(0x8d);
      this.downOpponentAndFinish(); return;
    }
    m[0x581] = m[0x580]; m[0x3b1]++;
    if (m[0x4a]) {
      if (!m[0x4b]) { this.hook('startCombo'); if (m[0x4b] === 1) m[0x4c] = 0x80; }
      m[0x4a] = 0x20; this.state(0x91); this.decrementStarCountdown(); this.clearAttacks(); return;
    }
    if (negative(m[0x74])) { m[0x90] = 0x82; this.decrementStarCountdown(); this.clearAndFinish(); return; }
    this.state(0x8d); m[0x347]--;
    let award = false;
    if (!m[0x347]) { m[0x347] = m[0x5b1]; award = m[0x347] !== 0; }
    if (!award && !negative(m[0x343]) && m[0x342]) award = this.random(m[0x5b4]);
    if (award) m[0x343] = 0x80;
    this.clearAndFinish();
  }
  clockDisplay() {
    const m = this.memory;
    // ADC #1 shares carry across the four display bytes in the cartridge.
    let carry = 0;
    for (let x = 4; x > 0; x--) {
      const value = m[0x301 + x] + 1 + carry;
      m[0x30a + x] = value; carry = value > 255 ? 1 : 0;
    }
    m[0x30a] = 0x80;
  }
  resetClock() {
    const m = this.memory; m.fill(0, 0x300, 0x308); m[0x303] = 0x2b; this.clockDisplay();
  }
  clock() {
    const m = this.memory, start = m[0x300], control = m[0x301];
    if (!start) return;
    if (negative(start)) { this.resetClock(); return; }
    if (negative(control)) {
      m[0x307]--; if (m[0x307]) return;
      m[0x307] = 8; m[0x306]--;
      let offset = m[0x30b] === 4 ? 4 : 0;
      if (!m[0x306]) { m[0x300] = 0; offset = 4; }
      for (let i = 0; i < 4; i++) m[0x30b + i] = this.read(0x87fe + offset + i);
      m[0x30a] = 0x80; return;
    }
    if (control === 1) return;
    if (control) {
      if (m[0x30a]) return;
      m[0x301] = 0x81; m[0x306] = 16; m[0x307] = 8; return;
    }
    const low = m[0x307] + m[0x309]; m[0x307] = low;
    m[0x306] = m[0x306] + m[0x308] + (low > 255 ? 1 : 0);
    if (m[0x306] < 100) return;
    m[0x306] -= 100; m[0x311]--; m[0x305]++;
    if (m[0x305] === 10) {
      m[0x305] = 0; m[0x304]++;
      if (m[0x304] === 6) {
        m[0x304] = 0; m[0x302]++;
        if (m[0x302] === 3) {
          m[0x301] = 2; m[0x90] = m[0x91] = m[0x51] = 0; m[0x50] = 0xc2;
        }
      }
    }
    this.clockDisplay();
  }
  health() {
    const m = this.memory;
    if (!m[0x390]) return;
    if (negative(m[0x390])) {
      m[0x390] &= 0x7f; m.fill(0, 0x391, 0x3a0); m[0x391] = m[0x398] = 0x60; return;
    }
    this.healthBar(0x391, 0x80, true); this.healthBar(0x398, 0x88, false);
  }
  healthBar(base, tile, reverse) {
    const m = this.memory;
    m[base + 1] = m[base];
    if (negative(m[base + 3])) return;
    const current = m[base + 1], old = m[base + 2];
    if (current === old) return;
    const decrease = old > current;
    m[base + 2] = old + (decrease ? -1 : 1);
    const next = m[base + 2]; let half = next >> 1;
    if (decrease) {
      if (next & 1) return;
      const fragment = half & 7; m[base + 5] = fragment ? tile + fragment : 0xfc;
      half >>= 3;
    } else {
      if (next & 1) { if (half) return; half = 1; }
      const fragment = half & 7; m[base + 5] = tile + fragment;
      half = (half >> 3) - (fragment === 0 ? 1 : 0);
    }
    m[base + 4] = reverse ? 0x66 - half : half + 0x68;
    m[base + 3] = 0x80;
  }
  hearts() {
    const m = this.memory, status = m[0x320];
    if (!status) return;
    let count = 2;
    if (negative(status)) { m[0x320] = 1; count = status === 0x80 ? 4 : 2; }
    else {
      if (!(m[0x321] | m[0x322])) return;
      m[0x323] = m[0x321]; m[0x324] = m[0x322];
    }
    for (let x = count; x > 0; x--) m[0x320 + x] = 0;
    m[0x326] = m[0x323] ? m[0x323] + 0x40 : 0xfc;
    m[0x327] = m[0x324] + 0x40; m[0x325] = 0x80;
  }
  stars() {
    const m = this.memory;
    if (!m[0x340]) return;
    let changed = false;
    if (negative(m[0x340])) {
      m[0x341] = m[0x342] = m[0x343] = 0; m[0x340] = 1; changed = true;
    } else if (m[0x341]) {
      const sum = byte(m[0x341] + m[0x342]); m[0x341] = 0;
      m[0x342] = negative(sum) ? 0 : Math.min(3, sum);
      if (!negative(sum) && sum >= 3 && !m[0x348]) m[0x348] = m[0x5b3];
      changed = true;
    }
    if (changed) { m[0x34a] = m[0x342] + 0x40; m[0x349] = 0x80; }
    if (!m[0x343]) return;
    if (negative(m[0x343])) {
      if (!m[0x344]) return;
      m[0x2ff] = m[0x344]; m[0x2fc] = m[0x345]; m[0x208] = m[0x345] + 8;
      m[0x2fe] = 2; m[0x343] = 20;
    } else {
      m[0x343]--;
      if (!m[0x343]) {
        if (m[0x3e0]) { m[0x343]++; return; }
        m[0x344] = 0; m[0x2fc] = 0xf8; m[0x208] = 0;
        m[0x341] = m[0x3e4] = m[0x3e0] = 1; m[0x17] = 0x81; return;
      }
    }
    m[0x2fd] = this.read(0x89fd + m[0x343]);
    if (m[0x343] === 16) m[0xf1] = 3;
    m[0x17] = 0x81;
  }
  points() {
    const m = this.memory;
    if (!m[0x3e7]) return;
    if (negative(m[0x3e7])) {
      const reset = m[0x3e7] === 0x80;
      m[0x3e7] = m[0x3e0] = 1; m.fill(0, 0x3e1, 0x3e7);
      if (reset) m.fill(0, 0x3e8, 0x3ee);
    } else if (!m[0x3e0]) return;
    let carry = 0;
    for (let x = 5; x >= 0; x--) {
      let value = m[0x3e8 + x] + m[0x3e1 + x] + carry;
      // CMP #10 supplies carry; SBC #10 uses that same carry.
      if (value >= 10) { value -= 10; carry = 1; } else carry = 0;
      m[0x3e8 + x] = value;
    }
    m.fill(0, 0x3e0, 0x3e7);
    let leading = true;
    for (let x = 0; x < 6; x++) {
      if (m[0x3e8 + x]) leading = false;
      m[0x3f1 + x] = leading && x < 5 ? 0xff : m[0x3e8 + x] + 1;
    }
    m[0x3f0] = 0x80;
  }
  /** $8A6F controls announcer text, not knockdown recovery ($B2EB). */
  knockout() {
    const m = this.memory;
    const done = () => { if (m[0x410]) m[0x410] |= 0x80; };
    if (negative(m[0x40])) {
      if (m[0x1e] & 15) { done(); return; }
      m[0x40] &= 0x7f; m[0x41] = 0x80; m[0x42] = 1; m[0x43] = 0;
      const index = byte(m[0x40] << 1);
      m[0x44] = this.read(0x8cd2 + index); m[0x45] = this.read(0x8cd2 + byte(index + 1));
    }
    if (!m[0x40]) { done(); return; }
    if (m[0x46]) {
      // $8A2A starts in bytes printed as .byte by the annotated disassembly.
      for (let x = 5; x >= 0; x--) m[0x410 + x] = this.read(0x8a12 + x);
      let y = byte(m[0x5bd + m[0x46]] + (m[0x5bd + m[0x46]] >> 1));
      for (let x = 3; x > 0; x--) { m[0x410 + x] = this.read(0x8a17 + y); y = byte(y - 1); }
      return;
    }
    const flash = m[0x40] === 2 || m[0x40] === 3;
    if (m[0x40] === 3 && !(m[0x1e] & 15)) m[0x40] = 4;
    if (flash) {
      m[0x48a] = (m[0x48a] & 15) | this.read(0x8b8b + (m[0x1e] & 15)); m[0x4a0] = 0x81;
    }
    if (negative(m[0x410])) return;
    m[0x42]--; if (m[0x42]) { done(); return; }
    m[0x42] = 1;
    const data = i => this.read(((m[0x44] | (m[0x45] << 8)) + byte(i)) & 0xffff);
    for (let budget = 0; budget < 1024; budget++) {
      const command = data(m[0x43]), param = command & 31;
      m[0x43]++;
      switch (command >> 5) {
        case 0:
          m[0x43] = this.random(param & 15) ? data(m[0x43]) : m[0x43] + 1;
          continue;
        case 2: case 3: {
          let category = param & 15;
          if (category >= 11) category -= 5;
          // CMP #$0B, optionally SBC #5, then three ASLs: final carry is zero.
          const seed = m[0x18]; let carry = 0;
          for (let i = 0; i < 3; i++) { const bit = m[0x18] & 1; m[0x18] = (m[0x18] >> 1) | (carry << 7); carry = bit; }
          const index = byte(((category << 3) | (seed & 7)) << 1);
          const target = (command >> 5) === 2 ? 0x400 : 0x402;
          m[target] = this.read(0x8b9b + index); m[target + 1] = this.read(0x8b9b + byte(index + 1));
          if (!m[target + 1]) throw new Error('Unrecovered announcer pick-pointer fallthrough at $8B17');
          done(); return;
        }
        case 4: {
          const delay = data(m[0x43]);
          m[0x42] = this.random(param & 15) ? delay & 15 : delay >> 4;
          m[0x43]++; done(); return;
        }
        case 6: case 7: {
          const pointer = (command >> 5) === 6 ? 0x400 : 0x402;
          m[0x412] = m[pointer]; m[0x411] = m[pointer + 1];
          const tableIndex = byte(param << 1);
          const table = this.read(0x8c4b + tableIndex) | (this.read(0x8c4b + byte(tableIndex + 1)) << 8);
          let y = 0, x = 3;
          // Preserve paired zero separators and the following terminating zero.
          for (let copyBudget = 0; copyBudget < 512; copyBudget++) {
            const value = this.read((table + y) & 0xffff);
            m[0x410 + x] = value; x = byte(x + 1); y = byte(y + 1);
            if (!value && !this.read((table + y) & 0xffff)) {
              m[0x410 + x] = 0; m[0x410]++; done(); return;
            }
          }
          throw new Error('Announcer text copy exceeded recovery budget');
        }
        default: throw new Error(`Null announcer command $${command.toString(16)} at script index ${byte(m[0x43] - 1)}`);
      }
    }
    throw new Error('Announcer exceeded same-frame command budget');
  }
}
