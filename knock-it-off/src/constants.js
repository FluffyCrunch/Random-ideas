import * as CANNON from 'cannon-es';

// Physics collision groups: cannon-es only collides two bodies if each one's
// group is in the other's mask
export const G = { PROP: 1, CAT: 2, STATIC: 4 };

// Every body needs an explicit material: if either one is missing, cannon-es
// ignores your contact materials and falls back to the world default
export const MATS = { world: new CANNON.Material('world'), cat: new CANNON.Material('cat') };

// The living room, in metres. The floor is y = 0.
export const ROOM = { x0: -7, x1: 7, z0: -5, z1: 5, h: 3.6 };

export const RULES = { goal: 2500, time: 150, strikes: 3 };
