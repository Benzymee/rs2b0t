import { describe, expect, test } from 'bun:test';

import { DS_ID, DS_LOC } from '#/bot/api/ai/quests/defs/dragonslayer/areas.js';
import { MAZE_LEGS, MAZE_NPC, doorCrossed, inMaze, legFromPosition, mazeFloor, mazeLegIndex } from '#/bot/api/ai/quests/defs/dragonslayer/maze.js';
import { OZIACH_GOALS } from '#/bot/api/ai/quests/defs/dragonslayer/index.js';

describe("Melzar's Maze route", () => {
    test('every key a kill drops is spent by a later door', () => {
        const spent = new Set<number>();
        for (const leg of MAZE_LEGS) {
            if (leg.kind !== 'door' || leg.keyId === DS_ID.MAZE_KEY) {
                continue;
            }
            const dropped = MAZE_LEGS.findIndex(l => l.kind === 'kill' && l.keyId === leg.keyId);
            const door = MAZE_LEGS.indexOf(leg);
            expect(dropped).toBeGreaterThanOrEqual(0);
            expect(dropped).toBeLessThan(door);
            spent.add(leg.keyId);
        }
        expect(spent.size).toBe(6);
    });

    test('the key droppers are the quest ids, not the decoys sharing their names', () => {
        const ids = MAZE_LEGS.filter(l => l.kind === 'kill').map(l => l.npcId);
        expect(ids).toEqual([
            MAZE_NPC.GIANT_RAT, MAZE_NPC.GHOST, MAZE_NPC.SKELETON,
            MAZE_NPC.ZOMBIE, MAZE_NPC.MELZAR, MAZE_NPC.DEMON
        ]);
    });

    test('each door lands on the far side of its own tile', () => {
        for (const leg of MAZE_LEGS) {
            if (leg.kind !== 'door') {
                continue;
            }
            expect(leg.land.distanceTo(leg.door)).toBeLessThanOrEqual(1);
            expect(leg.land.distanceTo(leg.stand)).toBeLessThanOrEqual(1);
        }
    });

    test('the route ends in the basement at the chest', () => {
        const last = MAZE_LEGS[MAZE_LEGS.length - 1];
        expect(last.kind).toBe('chest');
        if (last.kind === 'chest') {
            expect(last.stand.z).toBeGreaterThan(9600);
        }
    });

    test('the front door is crossed while the maze key is still in the pack', () => {
        const front = MAZE_LEGS[0];
        expect(front.kind).toBe('door');
        if (front.kind !== 'door') {
            return;
        }
        expect(front.keyId).toBe(DS_ID.MAZE_KEY);
        // Its oploc handler never deletes the key, so holding it proves nothing.
        expect(doorCrossed(front, { x: 2940, z: 3248, level: 0 }, true)).toBe(true);
        expect(doorCrossed(front, { x: 2941, z: 3248, level: 0 }, true)).toBe(false);
        expect(doorCrossed(front, { x: 2960, z: 3248, level: 0 }, false)).toBe(false);
    });

    test('a coloured door is crossed exactly when its key is gone', () => {
        const red = MAZE_LEGS.find(l => l.kind === 'door' && l.keyId === DS_ID.RED_KEY);
        expect(red).toBeDefined();
        if (red?.kind !== 'door') {
            return;
        }
        expect(doorCrossed(red, { x: 2925, z: 3253, level: 0 }, true)).toBe(false);
        expect(doorCrossed(red, { x: 2925, z: 3253, level: 0 }, false)).toBe(true);
    });

    test('inMaze covers all four floors and nothing outside', () => {
        expect(inMaze({ x: 2935, z: 3250, level: 0 })).toBe(true);
        expect(inMaze({ x: 2930, z: 3250, level: 2 })).toBe(true);
        expect(inMaze({ x: 2932, z: 9645, level: 0 })).toBe(true);
        expect(inMaze({ x: 2960, z: 3250, level: 0 })).toBe(false);
        // The front door's own tile is the doorstep outside; counting it in
        // sends the bot that let itself out straight back through.
        expect(inMaze({ x: 2941, z: 3248, level: 0 })).toBe(false);
        expect(inMaze({ x: 2940, z: 3248, level: 0 })).toBe(true);
        expect(inMaze(null)).toBe(false);
    });

    test('a cold start resumes on the floor the bot is standing on', () => {
        expect(legFromPosition({ x: 3013, z: 3355, level: 0 })).toBe(0);
        expect(legFromPosition({ x: 2935, z: 3250, level: 0 })).toBe(1);
        expect(MAZE_LEGS[legFromPosition({ x: 2929, z: 3250, level: 1 })]).toMatchObject({ kind: 'kill', npcId: MAZE_NPC.GHOST });
        expect(MAZE_LEGS[legFromPosition({ x: 2925, z: 3251, level: 2 })]).toMatchObject({ kind: 'kill', npcId: MAZE_NPC.SKELETON });
        expect(MAZE_LEGS[legFromPosition({ x: 2932, z: 9641, level: 0 })]).toMatchObject({ kind: 'kill', npcId: MAZE_NPC.ZOMBIE });
        // Why: the Dwarven Mine anvil where the nails leg ends is z=9813, which a bare cellar test reads as the maze basement.
        expect(legFromPosition({ x: 3012, z: 9813, level: 0 })).toBe(0);
        // Duke Horacio's floor of Lumbridge castle, where the shield leg ends.
        expect(legFromPosition({ x: 3212, z: 3220, level: 1 })).toBe(0);
        // The rune essence mine, which is nowhere at all.
        expect(legFromPosition({ x: 2911, z: 4832, level: 0 })).toBe(0);
        // The dead end the second-floor descent drops into, not the entrance hall.
        expect(MAZE_LEGS[legFromPosition({ x: 2936, z: 3240, level: 0 })]).toMatchObject({ kind: 'climb', op: 'Climb-down' });
    });

    test('Oziach and Edgeville never resume on a cellar kill', () => {
        // Why: the live failure walked from (3068,3518) to (2929,9649) because MazeRun kept a leftover Melzar index after the briefing.
        const none = (): boolean => false;
        const oziach = { x: 3068, z: 3518, level: 0 };
        const melzarKill = MAZE_LEGS.findIndex(l => l.kind === 'kill' && l.npcId === MAZE_NPC.MELZAR);
        expect(melzarKill).toBeGreaterThan(0);
        expect(mazeLegIndex(oziach, none, melzarKill)).toBe(0);
        expect(mazeLegIndex(oziach, none, -1)).toBe(0);
        expect(MAZE_LEGS[0]).toMatchObject({ kind: 'door', keyId: DS_ID.MAZE_KEY });
    });

    test('a leftover magenta key outside the maze does not skip to the cellar door', () => {
        const holds = (id: number): boolean => id === DS_ID.MAGENTA_KEY;
        expect(mazeLegIndex({ x: 3068, z: 3518, level: 0 }, holds, -1)).toBe(0);
        expect(mazeLegIndex({ x: 2941, z: 3248, level: 0 }, holds, 14)).toBe(0);
    });

    test('inside the cellar a magenta key still resumes at its door', () => {
        const holds = (id: number): boolean => id === DS_ID.MAGENTA_KEY;
        const magenta = MAZE_LEGS.findIndex(l => l.kind === 'door' && l.keyId === DS_ID.MAGENTA_KEY);
        expect(mazeLegIndex({ x: 2929, z: 9649, level: 0 }, holds, -1)).toBe(magenta);
        expect(mazeFloor({ x: 2929, z: 9649, level: 0 })).toBe('cellar');
        expect(mazeFloor({ x: 3068, z: 3518, level: 0 })).toBe('out');
    });

    test('re-entering the ground floor drops a leftover cellar index', () => {
        const none = (): boolean => false;
        const hall = { x: 2935, z: 3250, level: 0 };
        const melzarKill = MAZE_LEGS.findIndex(l => l.kind === 'kill' && l.npcId === MAZE_NPC.MELZAR);
        expect(mazeLegIndex(hall, none, melzarKill)).toBe(1);
        expect(MAZE_LEGS[1]).toMatchObject({ kind: 'kill', npcId: MAZE_NPC.GIANT_RAT });
    });

    test('the drop pocket does not resume on the entrance-hall rat', () => {
        // Why: (2936,3241) is the sealed ground-floor landing, and a leftover rat index walks at a hall it cannot reach.
        const none = (): boolean => false;
        const drop = { x: 2936, z: 3241, level: 0 };
        expect(mazeFloor(drop)).toBe('drop');
        expect(mazeLegIndex(drop, none, 1)).toBe(11);
        expect(MAZE_LEGS[11]).toMatchObject({ kind: 'climb', op: 'Climb-down' });
    });
});

describe('the Crandor secret wall', () => {
    test('is one loc, on the Crandor row, reached from a stand one tile south', () => {
        // m44_150.jm2 spawns it at (2836,9600) angle 3 (south) and nowhere else.
        // Why: a wall has no second loc on its far side, so both directions click this tile and the Karamja stand is not the door.
        expect(DS_LOC.CRANDOR_SECRET_DOOR).toMatchObject({ x: 2836, z: 9600, level: 0 });
        expect(DS_LOC.SECRET_WALL_KARAMJA_STAND.x).toBe(DS_LOC.CRANDOR_SECRET_DOOR.x);
        expect(DS_LOC.SECRET_WALL_KARAMJA_STAND.level).toBe(DS_LOC.CRANDOR_SECRET_DOOR.level);
        // door_open(loc_south, wall_straight) is (0,-1): the swing, and the
        // Karamja stand, are both one tile south of the wall.
        expect(DS_LOC.CRANDOR_SECRET_DOOR.z - DS_LOC.SECRET_WALL_KARAMJA_STAND.z).toBe(1);
    });

    test('the lair gate is taken from the lair column, which is the side that opens', () => {
        // Why: both leaves spawn at angle 0 (west) on x=2847, so check_axis_locactive reads that column as entering and the lock only guards the way in.
        expect(DS_LOC.ELVARG_GATE_INSIDE.x).toBe(DS_LOC.ELVARG_GATE.x);
        expect(DS_LOC.ELVARG_GATE_STAND.x).toBe(DS_LOC.ELVARG_GATE.x - 1);
    });
});

describe('Oziach', () => {
    test('every goal is judged on a phrase his reply actually contains', () => {
        // Why: an upstream reword leaves the goal silently incomplete and loops the conversation, so oziach.rs2's phrases are pinned here.
        const REPLIES: Record<string, string> = {
            'Where is the first piece of the map?':
                "Deep in a strange building known as Melzar's maze|located north west of Rimmington.",
            'Where is the second piece of the map?':
                'You will need to talk to the oracle on the ice mountain.',
            'Where is the third piece of the map?':
                'That was stolen by one of the goblins from the goblin village.',
            'Where can I get an antidragon shield?':
                'I believe the Duke of Lumbridge Castle may have one in his armoury.'
        };
        expect(OZIACH_GOALS).toHaveLength(4);
        for (const goal of OZIACH_GOALS) {
            const reply = REPLIES[goal.ask];
            expect(reply).toBeDefined();
            expect(reply.toLowerCase()).toContain(goal.heard);
        }
    });

    test('no goal phrase matches another goal reply', () => {
        for (const goal of OZIACH_GOALS) {
            const others = OZIACH_GOALS.filter(g => g !== goal);
            for (const other of others) {
                expect(other.heard).not.toContain(goal.heard);
            }
        }
    });
});
