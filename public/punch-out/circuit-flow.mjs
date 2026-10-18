/** Original career records and bout routing, DEF A952–A9C8 / AE28–AE52 / AAE5–AB55.
 * Victory cards, passwords and ending graphics are presentation handoffs. */
export class CircuitFlow {
  constructor({memory, read}) {
    if (!(memory instanceof Uint8Array) || memory.length < 2048 || typeof read !== 'function') throw new TypeError('CircuitFlow requires shared memory and read(address,bank)');
    this.memory = memory; this.read = read; this.pending = null;
  }
  byte(address, bank=this.memory[2]) { return this.read(address & 65535,bank); }
  incrementRecord(units) {
    const m = this.memory;
    const next = m[units] + 1;
    m[units] = next >= 10 ? 0 : next;
    const tens = m[units-1] + (next >= 10 ? 1 : 0);
    m[units-1] = tens >= 10 ? 0 : tens;
  }
  selectOpponent(won) {
    const m = this.memory, base = 0xa10d + ((m[1] << 2) & 255);
    if (won) {
      m[1] = this.byte(base); m[9] = this.byte(0xa18d+m[1]); m[10] = 0; return;
    }
    const flag = this.byte(base+2);
    if (m[10]) {
      if (flag & 128) return;
      m[1] = this.byte(base+1); m[9] = this.byte(0xa18d+m[1]); m[10] = 0;
    } else if (flag) m[10] = 1;
    else { m[1] = this.byte(base+1); m[9] = this.byte(0xa18d+m[1]); m[10] = 0; }
  }
  finish(result=this.memory[0]) {
    const m = this.memory;
    if (this.pending) return this.pending;
    if (!(result & 128) || result === 255) throw new Error('CircuitFlow.finish requires a final fight result, not an active/round-ended phase');
    const previousFighter=m[1],previousRematch=m[10]; m[8] = m[9];
    const won = [0xfe,0xfc,0xfa].includes(result), knockout = result === 0xfe || result === 0xfc;
    if (won) {
      if (knockout) this.incrementRecord(0x175);
      this.incrementRecord(0x171); this.selectOpponent(true);
      if (m[9] & 128) return this.pending = {type:'ending',won,knockout,previousFighter,fighter:m[1],result,records:this.records()};
      let card;
      if (!m[9] || (m[9] & 15) && !(m[8] & 15)) { m[0x3c0] = 0; card = 2; }
      else if (!(m[9] & 15)) card = 1;
      else card = 0;
      m[0x3d3] = card;
      return this.pending = {type:'next-bout',won,knockout,previousFighter,fighter:m[1],result,card,
        jogging:card === 2 && m[9] !== 0,titleSequence:m[9] === 0,records:this.records()};
    }
    m[0x3c0]++; this.incrementRecord(0x173); this.selectOpponent(false);
    if ((m[9] & 128) || m[0x173] >= this.byte(0xa9cd+(m[9] >>> 4))) {
      return this.pending = {type:'game-over',won,previousFighter,previousRematch,fighter:m[1],result,records:this.records()};
    }
    m[0x3d3] = 0;
    return this.pending = {type:'next-bout',won,previousFighter,previousRematch,fighter:m[1],result,card:0,rematch:previousFighter===m[1],records:this.records()};
  }
  /** AAE5's actual per-bout configuration. Call once when the result card advances. */
  initializeBout() {
    const m = this.memory;
    if (m[1] >= 14) throw new Error('Ending sentinel has no playable original bout');
    m[4] = m[0x1c] = m[0x1d] = 1; m[6] = 1;
    m[9] = this.byte(0xa18d+m[1]);
    const y = (m[1] << 1) & 255;
    m[2] = this.byte(0xa0d1+y); m[3] = this.byte(0xa0d2+y);
    // AB02 intentionally preserves $03C0, the streak used by loss routing.
    m.fill(0,0x3c1,0x3e1); m[0x3b1] = 0;
    const index = (14+m[3]) & 255;
    const pointer = this.byte(0x8000+index,m[2]) | (this.byte(0x8001+index,m[2]) << 8);
    for (let i=0;i<96;i++) m[0x5a0+i] = this.byte(pointer+i,m[2]);
    for (let x=0;x<4;x++) m[0x31+x] = m[0x5e8+x];
    m[0x347] = m[0x5b0]; m[0x348] = m[0x5b2]; m[0x310] = 3;
    m[0x4fd] = m[0x4fe] = 1; m[0x3e7] = 128; m[0x390] = 0x81;
    // AB4E: first-round knockdown counters/layout, before the bout screen.
    m[0x8f] = m[0x3ca] = 0; m.set([8,1,255],0x80);
    this.pending = null;
    return {fighter:m[1],bank:m[2],offset:m[3],rank:m[9],records:this.records()};
  }
  records() {
    const m = this.memory;
    return {wins:m[0x170]*10+m[0x171],losses:m[0x172]*10+m[0x173],knockouts:m[0x174]*10+m[0x175],lossStreak:m[0x3c0],rank:m[9],rematch:m[10]};
  }
}

