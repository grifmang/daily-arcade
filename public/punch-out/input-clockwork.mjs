/** Original controller normalization, entropy permutation and display acknowledgements.
 * Sources: PRG_BankDEF AFBD–B020/A5C3–A63E; PRG_Bank007 85E9–86A8. */
export function normalizeInput(memory, bits) {
  memory[0xd0] = bits;
  const groups = [bits & 15, bits & 128, bits & 64, bits & 16, bits & 32];
  for (let i = 0; i < groups.length; i++) {
    const status = 0xd2 + i * 2, history = status + 1, a = groups[i];
    if (a !== memory[status]) {
      memory[status] = a; memory[history] &= 127;
    } else if (!a) memory[history] &= 0x7e;
    else if (!(memory[history] & 1)) memory[history] |= 0x81;
  }
  if ((memory[0x50] & 127) === 7) {
    for (let offset = 8; offset; offset -= 2) memory[0xd3 + offset] &= 127;
  }
}

export function updateEntropy(memory) {
  // A641 calls A9DF, whose final carry-changing operation is A9FD ASL $21.
  // The intervening frame increment and bank switch preserve this carry.
  let carry = memory[0x21] >>> 7, a;
  const ror = value => { const result = (value >>> 1) | (carry << 7); carry = value & 1; return result; };
  const rol = value => { const result = ((value << 1) | carry) & 255; carry = value >>> 7; return result; };
  a = ror(memory[0x1e]); memory[0xe8] = a;
  a = ror(a); memory[0xe9] = a;
  a = ror(a); memory[0xea] = a;
  a = ror(a); memory[0xed] = a & 8;
  memory[0xed] |= memory[0xe8] & 1;
  memory[0xed] |= memory[0xe9] & 0x92;
  memory[0xed] |= memory[0xea] & 4;
  a = rol(memory[0x1e]); memory[0xe8] = a;
  a = rol(a); a = rol(a); a = rol(a);
  memory[0xed] |= a & 0x40;
  memory[0xed] |= memory[0xe8] & 0x20;
  a = ror(memory[0xd0]); memory[0xe8] = a;
  a = ror(a); memory[0xe9] = a;
  a = ror(a); memory[0xec] = a & 0x98;
  memory[0xec] |= memory[0xd0] & 1;
  memory[0xec] |= memory[0xe8] & 2;
  memory[0xec] |= memory[0xe9] & 4;
  a = rol(memory[0xd0]); memory[0xe8] = a;
  a = rol(a); memory[0xec] |= a & 0x20;
  a = (memory[0xe8] & 0x40) | memory[0xec];
  const sum = a + memory[0x19];
  memory[0x19] = sum; carry = sum > 255 ? 1 : 0;
  a = ror(memory[0x19]); memory[0xe8] = a;
  a = ror(a); memory[0xe9] = a;
  a = ror(a); memory[0xec] = a & 2;
  memory[0xec] |= memory[0xe8] & 0x20;
  memory[0xec] |= memory[0xe9] & 8;
  a = rol(memory[0x19]); memory[0xe8] = a;
  a = rol(a); memory[0xe9] = a;
  a = rol(a); memory[0xec] |= a & 0x40;
  memory[0xec] |= memory[0xe8] & 4;
  memory[0xec] |= memory[0xe9] & 0x10;
  memory[0x18] = ((memory[0x19] & 0x81) | memory[0xec]) + memory[0xed];
  return memory[0x18];
}

export function acknowledgeDisplays(memory) {
  const acknowledged = [];
  memory[0x1a] = 2;
  if (memory[0x17]) { memory[0x17] = 0; memory[0x1a]--; acknowledged.push('sprites'); }
  if (memory[0x60] && !(memory[0x60] & 128)) {
    // AA9F -> Bank B $8020. The actual pixels belong to the ASCII renderer.
    memory[0x60] = 0; memory[0x1a]--; acknowledged.push('player');
  }
  if (!memory[0x1a]) return acknowledged;
  if (memory[0x4a0]) { memory[0x4a0] = 0; memory[0x1a]--; acknowledged.push('palette'); }
  // There is no second budget branch after the palette call in A606.
  if (memory[0x410] & 128) { memory[0x410] = 0; acknowledged.push('tile-buffer'); }
  const flags = [[0x325, 0x349], [0x3f0], [0x30a], [0x394, 0x39b]][memory[0x1e] & 3];
  for (const address of flags) if (memory[address] & 128) { memory[address] = 0; acknowledged.push(address); }
  return acknowledged;
}
