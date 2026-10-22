// Native playback of the original PS2 action records. See ACTION_FORMAT.md.
// No CPU emulation: the resource addressing/countdown/jump rules are translated
// from the executable's 001757E0 / 00175700 (and compact 001754A0) readers.
export class Animation {
  constructor(data, group = 0, variant = 0) {
    this.data = data;
    this.serial = 0;
    this.select(group, variant);
  }
  select(group, variant = 0) {
    const selection = this.data.groups[group]?.variants[variant];
    if (!selection) throw Error(`Unsupported original action ${group}:${variant}`);
    this.group = group; this.variant = variant; this.selection = selection;
    this.transitions = [];
    this.load(selection.offset);
    this.skipEmpty();
    return this;
  }
  load(offset) {
    const record = this.data.records[offset];
    if (!record) throw Error(`Missing original action record 0x${offset.toString(16)}`);
    this.offset = offset; this.record = record;
    this.bytes = Uint8Array.from(record.bytes);
    this.remaining = this.bytes[2];
    this.serial++;
    this.transitions.push(offset);
  }
  advance() {
    const previous = this.record;
    const jumped = Boolean(previous.flags & 0x80);
    const next = jumped ? previous.jumpTarget : previous.nextOffset;
    if (!Number.isInteger(next)) throw Error(`Unresolved original action transition at ${this.offset}`);
    this.load(next);
    return jumped;
  }
  skipEmpty(jumped = false) {
    // Original code traverses zero-duration records without displaying them.
    // A malformed zero-time cycle must not hang the browser.
    const seen = new Set();
    while (this.remaining === 0) {
      if (seen.has(this.offset)) throw Error(`Zero-time action cycle at ${this.offset}`);
      seen.add(this.offset);
      jumped = this.advance();
    }
    return jumped;
  }
  step() {
    this.transitions = [];
    // Preserve the signed-byte storage's eight-bit wrap, including -1 timers.
    this.remaining = (this.remaining - 1) & 0xff;
    this.bytes[2] = this.remaining;
    if (this.remaining !== 0) return {entered:false, jumped:false};
    const jumped = this.advance();
    return {entered:true, jumped:this.skipEmpty(jumped)};
  }
  get cell() { return this.record.cell; }
  seek(group,variant,index) {
    if(!Number.isInteger(index)||index<0)throw Error('Invalid original frame index');
    const selection=this.data.groups[group]?.variants[variant];
    if(!selection)throw Error(`Unsupported original action ${group}:${variant}`);
    this.group=group;this.variant=variant;this.selection=selection;this.transitions=[];
    const first=this.data.records[selection.offset];
    this.load(selection.offset+index*first.size);
    this.skipEmpty();
    return this;
  }
  get collision() { return this.record.collision; }
  get cancelFlags() { return this.bytes[10] || 0; }
  consume(index) { const value = this.bytes[index] || 0; this.bytes[index] = 0; return value; }
}
