// Original normal dispatch: 00184720, Ryu 001E97C0..001E9DE0,
// Cyclops 00210D60..00211370. Selection is pure; Match owns state changes.
const BUTTONS = {
  lp: {slot:0, strength:0, limb:'Punch'},
  hp: {slot:1, strength:2, limb:'Punch'},
  lk: {slot:2, strength:0, limb:'Kick'},
  hk: {slot:3, strength:2, limb:'Kick'},
};
const STRENGTHS = ['light', 'medium', 'heavy'];

/**
 * Select a native normal, or null when this input cannot begin/chain one.
 * resources.moves is moves.json; resources.actions contains fighter actions.
 * player.attack is the previous selection plus contacted (hit OR block).
 * inputSet uses left/right/down/jump; face is +1 right, -1 left.
 * An explicit strength selects 0/1/2 only for a fresh attack. A chain always
 * takes its strength from the previous normal's signed four-byte native row.
 * Stun, hitstop, attack completion and input edges are the caller's gates.
 */
export function chooseNormal(player, button, resources, {strength} = {}) {
  const input = BUTTONS[button];
  if (!input) return null;
  let selectedStrength = strength ?? input.strength;
  if (player.attack) {
    const current = player.attack;
    // 00184720 rejects whiffs and the animation's no-chain flag (0x20).
    const cancelFlags = player.animation?.cancelFlags ?? player.animation?.bytes?.[10] ?? 0;
    if (current.kind !== 'normal' || !current.contacted || (cancelFlags & 0x20)) return null;
    selectedStrength = current.chain?.[input.slot];
  }
  if (!Number.isInteger(selectedStrength) || selectedStrength < 0 || selectedStrength > 2) return null;

  const airborne = player.y > 0;
  const stance = airborne ? 'air' : player.crouch ? 'crouching' : 'standing';
  const family = resources.moves?.fighters?.[player.name]?.normals?.[`${stance}${input.limb}`];
  const base = family?.actions[selectedStrength];
  if (!base) return null;

  const held = player.inputSet;
  const down = held?.has('down');
  const up = held?.has('jump') || held?.has('up');
  const horizontal = Number(Boolean(held?.has('right'))) - Number(Boolean(held?.has('left')));
  const forward = horizontal === player.face;
  // actor+0x20E: 0x1000 down, 0x2000 up. These select the
  // aerial pose/attack ID independently of actor+0x210's chain bank.
  const alternate = airborne && base.alternate &&
    ((player.name === 'ryu' && up) || (player.name === 'cyclops' && down));
  const action = alternate ? {...base, ...base.alternate} : base;
  let group = action.groupOverride ?? action.group ?? family.group;
  let variant = action.variant;
  let attackId = action.attackId;
  // Ryu's standing forward+HP/HK branches: actor20E&0x800 (001E97C0 / 001E99F0).
  // func_001E3710 in the other branches is sound placement, not proximity
  // normal selection; no additional distance-based variant is inferred.
  if (player.name === 'ryu' && stance === 'standing' && selectedStrength === 2 && forward) {
    group = 20;
    variant = input.limb === 'Punch' ? 0 : 1;
    attackId = input.limb === 'Punch' ? 18 : 20;
  }

  const chainAddress = airborne && player.superJump
    ? base.chainAlternate?.chainAddress : base.chainAddress;
  const chain = resources.moves.chain_semantics?.tables[chainAddress]?.signedBytes;
  if (!Array.isArray(chain) || chain.length !== 4 ||
      !chain.every(value => Number.isInteger(value) && value >= -1 && value <= 2)) return null;
  if (!resources.actions?.[player.name]?.groups[group]?.variants[variant]) return null;

  return {
    group, variant, attackId, chain:[...chain],
    name:`${stance} ${STRENGTHS[selectedStrength]} ${input.limb.toLowerCase()}`,
    strength:selectedStrength, button, kind:'normal',
  };
}
