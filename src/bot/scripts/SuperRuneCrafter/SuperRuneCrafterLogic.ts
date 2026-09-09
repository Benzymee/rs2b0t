import type { WorldTile } from '../../adapter/ClientAdapter.js';
import { BANK_LOCATIONS, bankDistance } from '../../api/bank/BankLocations.js';
import Tile from '../../geometry/Tile.js';

/** Overlay title and script registry name. */
export const SCRIPT_NAME = 'SuperRuneCrafter';
export const OPTION_BEST = 'Best';

export type CraftTravel = 'walk' | 'zanaris' | 'entrana' | 'wildy';

export interface CraftRecipe {
    label: string;
    rune: string;
    talisman: string;
    level: number;
    ruins: Tile;
    bank: string;
    travel: CraftTravel;
}

export const DRAMEN_STAFF = 'Dramen staff';
export const COSMIC_TIARA = 'Cosmic tiara';
export const LOST_CITY_QUEST = 'Lost City';
export const ESSENCE = 'Rune essence';
export const PURE_ESSENCE = 'Pure essence';
export const ESSENCE_ID = 1436;

/** Fairy bank stand, first pin of the recorded cosmic path (BenzymesCosmics). */
export const ZANARIS_BANK = new Tile(3154, 9577, 0);
/** Last recorded pin, north of the cosmic mysterious ruins. */
export const COSMIC_RUINS_APPROACH = new Tile(3178, 9499, 0);
export const SHED_OUTSIDE = new Tile(3202, 3169, 0);
export const ZANARIS_SPAWN = new Tile(3220, 9592, 0);
export const ZANARIS_DOOR_ID = 2406;
export const ZANARIS_PLACEHOLDER_LADDER_ID = 2410;

export const TEMPLE_MIN_Z = 4600;
export const TEMPLE_MAX_Z = 5000;

export const PIN_LOOSE = 6;
export const PIN_CLICK_RANGE = 18;
export const PIN_AHEAD = 2;

export const TRADE_LOAD = 26;
export const MAX_BANK_FAILS = 6;
export const MAX_ENTER_FAILS = 3;

export const MODES = ['Solo', 'Runner', 'Mule Recipient'] as const;

/**
 * Highest-first so Best walks the list and takes the first altar the level and talismans allow.
 * Nature is NatureCrafter. Cosmic banks at the Zanaris fairy bankers (Lost City).
 */
export const CRAFT_RECIPES: CraftRecipe[] = [
    { label: 'Law runes', rune: 'Law rune', talisman: 'Law talisman', level: 54, ruins: new Tile(2858, 3378, 0), bank: 'Draynor', travel: 'entrana' },
    { label: 'Chaos runes', rune: 'Chaos rune', talisman: 'Chaos talisman', level: 35, ruins: new Tile(3060, 3585, 0), bank: 'Edgeville', travel: 'wildy' },
    { label: 'Cosmic runes', rune: 'Cosmic rune', talisman: 'Cosmic talisman', level: 27, ruins: COSMIC_RUINS_APPROACH, bank: 'Zanaris', travel: 'zanaris' },
    { label: 'Body runes', rune: 'Body rune', talisman: 'Body talisman', level: 20, ruins: new Tile(3050, 3442, 0), bank: 'Edgeville', travel: 'walk' },
    { label: 'Fire runes', rune: 'Fire rune', talisman: 'Fire talisman', level: 14, ruins: new Tile(3310, 3252, 0), bank: 'Duel Arena', travel: 'walk' },
    { label: 'Earth runes', rune: 'Earth rune', talisman: 'Earth talisman', level: 9, ruins: new Tile(3303, 3477, 0), bank: 'Varrock East', travel: 'walk' },
    { label: 'Water runes', rune: 'Water rune', talisman: 'Water talisman', level: 5, ruins: new Tile(3182, 3162, 0), bank: 'Draynor', travel: 'walk' },
    { label: 'Mind runes', rune: 'Mind rune', talisman: 'Mind talisman', level: 2, ruins: new Tile(2980, 3511, 0), bank: 'Edgeville', travel: 'walk' },
    { label: 'Air runes', rune: 'Air rune', talisman: 'Air talisman', level: 1, ruins: new Tile(2983, 3288, 0), bank: 'Falador East', travel: 'walk' }
];

export const RUNE_CHOICES = [OPTION_BEST, ...[...CRAFT_RECIPES].reverse().map(r => r.label)];
export const BY_LABEL = new Map(CRAFT_RECIPES.map(r => [r.label, r]));

/** Around the Zanaris shed, then south-west onto the cosmic corridor (BenzymesCosmics). */
export const SHED_TO_BANK: Tile[] = [
    new Tile(3220, 9592, 0),
    new Tile(3220, 9584, 0),
    new Tile(3220, 9576, 0),
    new Tile(3212, 9572, 0),
    new Tile(3202, 9568, 0),
    new Tile(3192, 9566, 0),
    new Tile(3182, 9564, 0),
    new Tile(3174, 9570, 0),
    new Tile(3163, 9572, 0),
    new Tile(3154, 9577, 0)
];

/** Recorded walkable tiles, Zanaris fairy bank → cosmic ruins. Reverse is the bank trip. */
export const COSMIC_ROUTE: Tile[] = [
    new Tile(3154, 9577, 0),
    new Tile(3163, 9572, 0),
    new Tile(3174, 9570, 0),
    new Tile(3182, 9564, 0),
    new Tile(3185, 9553, 0),
    new Tile(3187, 9543, 0),
    new Tile(3187, 9536, 0),
    new Tile(3184, 9531, 0),
    new Tile(3180, 9528, 0),
    new Tile(3172, 9527, 0),
    new Tile(3169, 9530, 0),
    new Tile(3164, 9527, 0),
    new Tile(3158, 9528, 0),
    new Tile(3154, 9530, 0),
    new Tile(3148, 9531, 0),
    new Tile(3145, 9529, 0),
    new Tile(3147, 9523, 0),
    new Tile(3153, 9519, 0),
    new Tile(3160, 9516, 0),
    new Tile(3170, 9513, 0),
    new Tile(3173, 9510, 0),
    new Tile(3175, 9505, 0),
    new Tile(3178, 9499, 0)
];

export const TO_RUINS = COSMIC_ROUTE;
export const TO_BANK = [...COSMIC_ROUTE].reverse();

export const FALLBACK_BANKS: Record<string, Tile> = {
    'Varrock East': new Tile(3253, 3420, 0),
    Draynor: new Tile(3093, 3243, 0),
    'Falador East': new Tile(3013, 3355, 0),
    Edgeville: new Tile(3094, 3493, 0),
    'Duel Arena': new Tile(3382, 3269, 0),
    Zanaris: ZANARIS_BANK
};

/** Entrana monks refuse weapons and armour; Law runes sail from Port Sarim. */
export const ENTRANA_GEAR =
    /\b(sword|dagger|scimitar|longsword|2h|two.handed|mace|warhammer|battleaxe|axe|pickaxe|spear|hasta|halberd|maul|claws|whip|bow|crossbow|javelin|dart|thrownaxe|knife|staff|wand|battlestaff|cannon|helmet|full helm|med helm|coif|platebody|chainbody|platelegs|plateskirt|kiteshield|square shield|sq shield|dragon square|god cape|fire cape|obsidian cape|defender)\b/i;

export function recipeByLabel(label: string): CraftRecipe | null {
    return BY_LABEL.get(label) ?? null;
}

export function pickBestRecipe(level: number, hasAccess: (recipe: CraftRecipe) => boolean): CraftRecipe | null {
    for (const recipe of CRAFT_RECIPES) {
        if (level >= recipe.level && hasAccess(recipe)) {
            return recipe;
        }
    }
    return null;
}

/** Best: highest altar the level, Lost City, and matching talisman/tiara allow. Law beats Cosmic when a Law talisman is held. */
export function resolveBestRecipe(
    level: number,
    names: readonly string[],
    opts: { lostCity: boolean }
): CraftRecipe | null {
    return pickBestRecipe(
        level,
        recipe => recipeUnlocked(recipe, { level, lostCity: opts.lostCity }) && namesHaveAltarEntry(names, recipe)
    );
}

export function namesHaveTalisman(names: readonly string[], recipe: CraftRecipe): boolean {
    const want = recipe.talisman.toLowerCase();
    for (const name of names) {
        if (name.toLowerCase() === want) {
            return true;
        }
    }
    return false;
}

/** Cosmic ruins also accept a Cosmic tiara (Enter) instead of using the talisman. */
export function namesHaveAltarEntry(names: readonly string[], recipe: CraftRecipe): boolean {
    if (namesHaveTalisman(names, recipe)) {
        return true;
    }
    if (recipe.travel === 'zanaris') {
        return names.some(n => n.toLowerCase() === COSMIC_TIARA.toLowerCase());
    }
    return false;
}

export function recipeUnlocked(recipe: CraftRecipe, opts: { level: number; lostCity: boolean }): boolean {
    if (opts.level < recipe.level) {
        return false;
    }
    // Why: Cosmic is Zanaris-only; an unfinished Lost City must not win Best even if a Cosmic talisman is in the pack.
    if (recipe.travel === 'zanaris' && !opts.lostCity) {
        return false;
    }
    return true;
}

/** Only a green quest-list row counts; unknown / notStarted / inProgress all skip Cosmic. */
export function lostCityComplete(status: string): boolean {
    return status === 'complete';
}

export function inAltarInterior(tile: WorldTile | null): boolean {
    return tile !== null && tile.z >= TEMPLE_MIN_Z && tile.z < TEMPLE_MAX_Z;
}

/**
 * 2004 Zanaris is the Lumbridge swamp underground (surface z + 6400).
 * Also accepts the OSRS fairy-ring box in case a dump still uses those coords.
 */
export function inZanarisBox(tile: WorldTile | null): boolean {
    if (!tile) {
        return false;
    }
    const { x, z } = tile;
    if (x >= 2350 && x <= 2500 && z >= 4320 && z <= 4520) {
        return true;
    }
    return x >= 3140 && x <= 3260 && z >= 9440 && z <= 9680;
}

export function inZanaris(tile: WorldTile | null): boolean {
    if (!tile) {
        return false;
    }
    if (inAltarInterior(tile)) {
        return false;
    }
    return inZanarisBox(tile);
}

export function keepNames(recipe: CraftRecipe, extra: string[] = []): string[] {
    const keep = [recipe.talisman, ...extra];
    if (recipe.travel === 'zanaris') {
        keep.push(DRAMEN_STAFF, COSMIC_TIARA);
    }
    return keep;
}

export function paintRuneLabel(choice: string, recipe: CraftRecipe | null): string {
    if (choice === OPTION_BEST) {
        return recipe ? `${OPTION_BEST} → ${recipe.label}` : OPTION_BEST;
    }
    return recipe?.label ?? choice;
}

export function bankTileNamed(name: string): Tile {
    const known = BANK_LOCATIONS.find(b => b.name === name);
    if (known) {
        return new Tile(known.tile.x, known.tile.z, known.tile.level);
    }
    const fallback = FALLBACK_BANKS[name];
    if (!fallback) {
        throw new Error(`${SCRIPT_NAME}: unknown bank '${name}'`);
    }
    return fallback;
}

export function rankedBanks(from: WorldTile): { name: string; tile: Tile; d: number }[] {
    return BANK_LOCATIONS
        .map(b => ({ name: b.name, tile: new Tile(b.tile.x, b.tile.z, b.tile.level), d: bankDistance(from, b.tile) }))
        .sort((a, b) => a.d - b.d);
}

export function sameName(a: string, b: string): boolean {
    const clean = (s: string): string => s.toLowerCase().replace(/[\u00A0_]/g, ' ').trim();
    return clean(a) === clean(b);
}

export function nameLooksLikeEntranaGear(name: string): boolean {
    return ENTRANA_GEAR.test(name);
}

export function isEssenceName(name: string | null | undefined): boolean {
    const n = (name ?? '').toLowerCase();
    return n === ESSENCE.toLowerCase() || n === PURE_ESSENCE.toLowerCase();
}

export function fmtCount(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}

export function cheb(a: WorldTile | null | undefined, b: WorldTile | null | undefined): number {
    if (!a || !b) {
        return 99;
    }
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

export function destIsRuinsPin(dest: WorldTile | null | undefined): boolean {
    return !!dest && cheb(dest, COSMIC_RUINS_APPROACH) <= 12;
}

export function destIsBankPin(dest: WorldTile | null | undefined): boolean {
    return !!dest && cheb(dest, ZANARIS_BANK) <= 14;
}

/** True when standing by the Zanaris shed rather than on the fairy-bank / ruins corridor. */
export function fromZanarisShed(here: WorldTile | null): boolean {
    if (!here || !inZanaris(here)) {
        return false;
    }
    if (cheb(here, ZANARIS_BANK) <= 12) {
        return false;
    }
    if (cheb(here, ZANARIS_SPAWN) <= 18) {
        return true;
    }
    if (here.x >= 3190 && here.z >= 9558 && here.z <= 9610) {
        return true;
    }
    return SHED_TO_BANK.some(p => cheb(here, p) <= 12);
}

export function onCosmicCorridor(here: WorldTile | null): boolean {
    if (!here || !inZanaris(here) || fromZanarisShed(here)) {
        return false;
    }
    return COSMIC_ROUTE.some(p => cheb(here, p) <= 14);
}

/** Pin list for a Zanaris walk: shed→bank, bank→ruins, or ruins→bank. */
export function viasFor(here: WorldTile | null, dest: WorldTile | null): Tile[] {
    if (!here || !dest) {
        return [];
    }
    if (inAltarInterior(here) || inAltarInterior(dest)) {
        return [];
    }
    if (fromZanarisShed(here) && destIsBankPin(dest)) {
        return SHED_TO_BANK;
    }
    if (destIsRuinsPin(dest)) {
        return TO_RUINS;
    }
    if (destIsBankPin(dest)) {
        return TO_BANK;
    }
    if (cheb(dest, COSMIC_RUINS_APPROACH) < cheb(dest, ZANARIS_BANK)) {
        return TO_RUINS;
    }
    return TO_BANK;
}

export function pinListTo(dest: WorldTile | null, vias: readonly Tile[]): Tile[] {
    const pins = [...vias];
    if (dest && destIsRuinsPin(dest)) {
        return pins;
    }
    if (dest && (!pins.length || cheb(pins[pins.length - 1], dest) > 1)) {
        pins.push(new Tile(dest.x, dest.z, dest.level));
    }
    return pins;
}

export function snapPinIndex(route: readonly WorldTile[], here: WorldTile | null): number {
    if (!here || !route.length) {
        return 0;
    }
    let on = -1;
    let near = -1;
    let nearD = 9999;
    for (let j = 0; j < route.length; j++) {
        const d = cheb(route[j], here);
        if (d <= PIN_LOOSE) {
            on = j;
        } else if (d < nearD) {
            nearD = d;
            near = j;
        }
    }
    if (on >= 0) {
        return Math.min(on + 1, route.length);
    }
    if (near >= 0 && nearD <= 18) {
        return near;
    }
    return 0;
}

export function advancePinIndex(route: readonly WorldTile[], here: WorldTile, pinIndex: number): number {
    let i = Math.max(0, pinIndex);
    for (let j = route.length - 1; j >= i; j--) {
        if (cheb(route[j], here) <= PIN_LOOSE) {
            return Math.min(j + 1, route.length);
        }
    }
    while (i < route.length && cheb(route[i], here) <= PIN_LOOSE) {
        i++;
    }
    while (i < route.length - 1 && cheb(route[i + 1], here) + PIN_LOOSE < cheb(route[i], here)) {
        i++;
    }
    return i;
}

export function furthestPinInRange(
    route: readonly WorldTile[],
    start: number,
    here: WorldTile,
    maxAhead: number = PIN_AHEAD
): number {
    let best = start;
    let n = 0;
    for (let i = start; i < route.length; i++) {
        if (cheb(route[i], here) <= PIN_CLICK_RANGE) {
            best = i;
            n++;
            if (n >= maxAhead) {
                break;
            }
        } else {
            break;
        }
    }
    return best;
}

export function pickDialogOption(options: string[], prefer: string[], avoid: string[]): string | null {
    const usable = options.filter(o => {
        const low = (o ?? '').toLowerCase();
        return !avoid.some(a => low.includes(a));
    });
    const pool = usable.length > 0 ? usable : options;
    for (const p of prefer) {
        const hit = pool.find(o => (o ?? '').toLowerCase().includes(p.toLowerCase()));
        if (hit) {
            return hit;
        }
    }
    const yes = pool.find(o => /^yes/i.test(o ?? ''));
    return yes ?? (pool.length > 0 ? pool[0] : null);
}

/**
 * Lost City shed only teleports while Dramen is wielded.
 * Order: withdraw the staff if missing, equip it, walk to the shed, then Open.
 */
export type ZanarisEntryAction =
    | { kind: 'already-there' }
    | { kind: 'stop'; reason: string }
    | { kind: 'withdraw-dramen' }
    | { kind: 'equip-dramen' }
    | { kind: 'walk-shed' }
    | { kind: 'open-shed' };

export function nextZanarisEntryAction(state: {
    inZanaris: boolean;
    inAltar: boolean;
    lostCityBlocked: boolean;
    wearingDramen: boolean;
    holdingDramen: boolean;
    atShed: boolean;
}): ZanarisEntryAction {
    if (state.inZanaris || state.inAltar) {
        return { kind: 'already-there' };
    }
    if (state.lostCityBlocked) {
        return { kind: 'stop', reason: 'Cosmic runes need Lost City complete to enter Zanaris through the swamp shed' };
    }
    if (!state.wearingDramen && !state.holdingDramen) {
        return { kind: 'withdraw-dramen' };
    }
    if (!state.wearingDramen) {
        return { kind: 'equip-dramen' };
    }
    if (!state.atShed) {
        return { kind: 'walk-shed' };
    }
    return { kind: 'open-shed' };
}

export const BANK_DIALOG_PREFER = ['yes please', 'yes', 'bank'];
export const DIALOG_AVOID = [
    'no, thank',
    'no thank',
    'no, not right now',
    'not right now',
    "i'm good",
    'nowhere',
    'nothing',
    'actually, i don'
];
