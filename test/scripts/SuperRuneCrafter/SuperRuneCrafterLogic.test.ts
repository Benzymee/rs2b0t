import { describe, expect, test } from 'bun:test';
import Tile from '#/bot/geometry/Tile.js';
import {
    BANK_DIALOG_PREFER,
    BY_LABEL,
    COSMIC_ROUTE,
    COSMIC_RUINS_APPROACH,
    COSMIC_TIARA,
    CRAFT_RECIPES,
    ESSENCE,
    DIALOG_AVOID,
    DRAMEN_STAFF,
    OPTION_BEST,
    RUNE_CHOICES,
    SCRIPT_NAME,
    SHED_TO_BANK,
    ZANARIS_BANK,
    ZANARIS_SPAWN,
    advancePinIndex,
    bankTileNamed,
    cheb,
    destIsBankPin,
    destIsRuinsPin,
    fromZanarisShed,
    furthestPinInRange,
    inAltarInterior,
    inZanaris,
    keepNames,
    lostCityComplete,
    nameLooksLikeEntranaGear,
    namesHaveAltarEntry,
    namesHaveTalisman,
    nextZanarisEntryAction,
    onCosmicCorridor,
    paintRuneLabel,
    pickBestRecipe,
    pickDialogOption,
    pinListTo,
    recipeByLabel,
    recipeUnlocked,
    resolveBestRecipe,
    snapPinIndex,
    viasFor
} from '#/bot/scripts/SuperRuneCrafter/SuperRuneCrafterLogic.js';

describe('SuperRuneCrafterLogic', () => {
    test('paint title and script name are SuperRuneCrafter', () => {
        expect(SCRIPT_NAME).toBe('SuperRuneCrafter');
    });

    test('covers every 2004 altar except Nature', () => {
        expect(CRAFT_RECIPES.map(r => r.label)).toEqual([
            'Law runes',
            'Chaos runes',
            'Cosmic runes',
            'Body runes',
            'Fire runes',
            'Earth runes',
            'Water runes',
            'Mind runes',
            'Air runes'
        ]);
        expect(CRAFT_RECIPES.some(r => /nature/i.test(r.label))).toBe(false);
        expect(RUNE_CHOICES[0]).toBe(OPTION_BEST);
        expect(RUNE_CHOICES.at(-1)).toBe('Law runes');
    });

    test('Cosmic runes bank in Zanaris at the fairy-bank pin and ruins approach from BenzymesCosmics', () => {
        const cosmic = recipeByLabel('Cosmic runes');
        expect(cosmic).not.toBeNull();
        expect(cosmic?.travel).toBe('zanaris');
        expect(cosmic?.bank).toBe('Zanaris');
        expect(cosmic?.level).toBe(27);
        expect(cosmic?.talisman).toBe('Cosmic talisman');
        expect(cosmic?.ruins.x).toBe(COSMIC_RUINS_APPROACH.x);
        expect(cosmic?.ruins.z).toBe(COSMIC_RUINS_APPROACH.z);
        expect(bankTileNamed('Zanaris').x).toBe(ZANARIS_BANK.x);
        expect(bankTileNamed('Zanaris').z).toBe(ZANARIS_BANK.z);
        expect(COSMIC_ROUTE[0].x).toBe(ZANARIS_BANK.x);
        expect(COSMIC_ROUTE[0].z).toBe(ZANARIS_BANK.z);
        expect(COSMIC_ROUTE.at(-1)?.x).toBe(COSMIC_RUINS_APPROACH.x);
        expect(COSMIC_ROUTE.at(-1)?.z).toBe(COSMIC_RUINS_APPROACH.z);
        expect(SHED_TO_BANK[0].x).toBe(ZANARIS_SPAWN.x);
        expect(SHED_TO_BANK.at(-1)?.x).toBe(ZANARIS_BANK.x);
    });

    test('Fire runes bank at the Duel Arena chest', () => {
        expect(recipeByLabel('Fire runes')?.bank).toBe('Duel Arena');
        expect(bankTileNamed('Duel Arena').x).toBe(3382);
        expect(bankTileNamed('Duel Arena').z).toBe(3269);
    });

    test('every recipe bank name resolves to a tile', () => {
        for (const recipe of CRAFT_RECIPES) {
            expect(() => bankTileNamed(recipe.bank)).not.toThrow();
        }
        expect(() => bankTileNamed('No Such Bank')).toThrow(/unknown bank/);
    });

    test('BY_LABEL looks up by the settings label', () => {
        expect(BY_LABEL.get('Air runes')?.rune).toBe('Air rune');
        expect(recipeByLabel('nope')).toBeNull();
    });

    describe('pickBestRecipe', () => {
        test('takes the highest altar the level allows when every recipe is accessible', () => {
            const picked = pickBestRecipe(99, () => true);
            expect(picked?.label).toBe('Law runes');
        });

        test('skips altars above the Runecrafting level', () => {
            const picked = pickBestRecipe(20, () => true);
            expect(picked?.label).toBe('Body runes');
        });

        test('skips altars the pack has no talisman for', () => {
            const names = ['Air talisman', 'Water talisman'];
            const picked = pickBestRecipe(99, recipe => namesHaveTalisman(names, recipe));
            expect(picked?.label).toBe('Water runes');
        });

        test('ignores Cosmic when Lost City is not complete, even with a Cosmic talisman', () => {
            const names = ['Cosmic talisman', 'Chaos talisman', 'Air talisman'];
            const picked = pickBestRecipe(99, recipe =>
                recipeUnlocked(recipe, { level: 99, lostCity: false }) && namesHaveTalisman(names, recipe)
            );
            expect(picked?.label).toBe('Chaos runes');
        });

        test('Cosmic wins Best once Lost City is complete', () => {
            const names = ['Cosmic talisman', 'Body talisman'];
            const picked = pickBestRecipe(30, recipe =>
                recipeUnlocked(recipe, { level: 30, lostCity: true }) && namesHaveTalisman(names, recipe)
            );
            expect(picked?.label).toBe('Cosmic runes');
        });

        test('Best uses a held Law talisman instead of Cosmic when Lost City is complete', () => {
            const names = ['Law talisman', 'Cosmic talisman', 'Chaos talisman'];
            expect(resolveBestRecipe(99, names, { lostCity: true })?.label).toBe('Law runes');
            expect(resolveBestRecipe(54, ['Law talisman'], { lostCity: true })?.label).toBe('Law runes');
        });

        test('Best does not pick Cosmic just because Lost City is complete if Law is usable', () => {
            const picked = resolveBestRecipe(99, ['Law talisman', 'Cosmic talisman'], { lostCity: true });
            expect(picked?.label).not.toBe('Cosmic runes');
            expect(picked?.talisman).toBe('Law talisman');
        });

        test('returns null when nothing is both level-unlocked and accessible', () => {
            expect(pickBestRecipe(1, () => false)).toBeNull();
            expect(pickBestRecipe(0, () => true)).toBeNull();
        });
    });

    describe('recipeUnlocked', () => {
        const cosmic = recipeByLabel('Cosmic runes')!;
        const air = recipeByLabel('Air runes')!;

        test('Cosmic needs Lost City complete, not merely started or unknown', () => {
            expect(lostCityComplete('complete')).toBe(true);
            expect(lostCityComplete('notStarted')).toBe(false);
            expect(lostCityComplete('inProgress')).toBe(false);
            expect(lostCityComplete('unknown')).toBe(false);
            expect(recipeUnlocked(cosmic, { level: 27, lostCity: false })).toBe(false);
            expect(recipeUnlocked(cosmic, { level: 27, lostCity: true })).toBe(true);
            expect(recipeUnlocked(cosmic, { level: 26, lostCity: true })).toBe(false);
        });

        test('walk altars only gate on level', () => {
            expect(recipeUnlocked(air, { level: 1, lostCity: false })).toBe(true);
            expect(recipeUnlocked(air, { level: 0, lostCity: true })).toBe(false);
        });
    });

    describe('namesHaveAltarEntry', () => {
        const cosmic = recipeByLabel('Cosmic runes')!;
        const air = recipeByLabel('Air runes')!;

        test('a Cosmic tiara opens the Zanaris ruins without a talisman', () => {
            expect(namesHaveAltarEntry([COSMIC_TIARA], cosmic)).toBe(true);
            expect(namesHaveTalisman([COSMIC_TIARA], cosmic)).toBe(false);
            expect(namesHaveAltarEntry(['Cosmic talisman'], cosmic)).toBe(true);
        });

        test('a tiara does not substitute for a different altar', () => {
            expect(namesHaveAltarEntry([COSMIC_TIARA], air)).toBe(false);
            expect(namesHaveAltarEntry(['Air talisman'], air)).toBe(true);
        });
    });

    describe('keepNames', () => {
        test('Zanaris keeps Dramen staff and Cosmic tiara', () => {
            const cosmic = recipeByLabel('Cosmic runes')!;
            expect(keepNames(cosmic)).toEqual(['Cosmic talisman', DRAMEN_STAFF, COSMIC_TIARA]);
            expect(keepNames(cosmic, [ESSENCE])).toContain(ESSENCE);
        });

        test('walk altars keep only the talisman plus extras', () => {
            const air = recipeByLabel('Air runes')!;
            expect(keepNames(air, ['Rune essence'])).toEqual(['Air talisman', 'Rune essence']);
        });
    });

    describe('geometry', () => {
        test('altar interiors sit at z 4600-4999, not Zanaris', () => {
            expect(inAltarInterior(new Tile(2800, 4830, 0))).toBe(true);
            expect(inAltarInterior(new Tile(3154, 9577, 0))).toBe(false);
            expect(inAltarInterior(null)).toBe(false);
        });

        test('Zanaris is the swamp underground box, not the surface shed', () => {
            expect(inZanaris(new Tile(3154, 9577, 0))).toBe(true);
            expect(inZanaris(new Tile(3178, 9499, 0))).toBe(true);
            expect(inZanaris(new Tile(3202, 3169, 0))).toBe(false);
            expect(inZanaris(new Tile(2800, 4830, 0))).toBe(false);
        });

        test('fromZanarisShed is true at the shed spawn, false at the fairy bank', () => {
            expect(fromZanarisShed(ZANARIS_SPAWN)).toBe(true);
            expect(fromZanarisShed(new Tile(3220, 9584, 0))).toBe(true);
            expect(fromZanarisShed(ZANARIS_BANK)).toBe(false);
            expect(fromZanarisShed(COSMIC_RUINS_APPROACH)).toBe(false);
        });

        test('the cosmic corridor is the recorded bank↔ruins pins, not the shed', () => {
            expect(onCosmicCorridor(ZANARIS_BANK)).toBe(true);
            expect(onCosmicCorridor(COSMIC_RUINS_APPROACH)).toBe(true);
            expect(onCosmicCorridor(ZANARIS_SPAWN)).toBe(false);
        });
    });

    describe('cosmic pin path', () => {
        test('shed to bank uses SHED_TO_BANK', () => {
            const vias = viasFor(ZANARIS_SPAWN, ZANARIS_BANK);
            expect(vias).toEqual(SHED_TO_BANK);
        });

        test('bank to ruins uses COSMIC_ROUTE', () => {
            expect(viasFor(ZANARIS_BANK, COSMIC_RUINS_APPROACH)).toEqual(COSMIC_ROUTE);
            expect(destIsRuinsPin(COSMIC_RUINS_APPROACH)).toBe(true);
            expect(destIsBankPin(ZANARIS_BANK)).toBe(true);
        });

        test('ruins to bank uses the reversed cosmic route', () => {
            const vias = viasFor(COSMIC_RUINS_APPROACH, ZANARIS_BANK);
            expect(vias[0]).toEqual(COSMIC_RUINS_APPROACH);
            expect(vias.at(-1)).toEqual(ZANARIS_BANK);
        });

        test('pinListTo does not duplicate the ruins pin already on the route', () => {
            const pins = pinListTo(COSMIC_RUINS_APPROACH, COSMIC_ROUTE);
            expect(pins.at(-1)).toEqual(COSMIC_RUINS_APPROACH);
            expect(pins.filter(p => cheb(p, COSMIC_RUINS_APPROACH) === 0)).toHaveLength(1);
        });

        test('snapPinIndex advances to the next pin when already on one', () => {
            const here = COSMIC_ROUTE[3];
            const i = snapPinIndex(COSMIC_ROUTE, here);
            expect(i).toBe(4);
        });

        test('advancePinIndex skips ahead when a later pin is already in loose range', () => {
            const here = COSMIC_ROUTE[5];
            expect(advancePinIndex(COSMIC_ROUTE, here, 1)).toBe(6);
        });

        test('furthestPinInRange clicks ahead along the corridor without leaving click range', () => {
            const here = COSMIC_ROUTE[0];
            const reach = furthestPinInRange(COSMIC_ROUTE, 1, here, 2);
            expect(reach).toBeGreaterThanOrEqual(1);
            expect(cheb(COSMIC_ROUTE[reach], here)).toBeLessThanOrEqual(18);
            expect(reach - 1).toBeLessThanOrEqual(2);
        });

        test('standing on the last pin snaps to route.length so the walker aims at the dest', () => {
            const last = COSMIC_ROUTE[COSMIC_ROUTE.length - 1];
            expect(snapPinIndex(COSMIC_ROUTE, last)).toBe(COSMIC_ROUTE.length);
        });
    });

    describe('paintRuneLabel', () => {
        test('Best shows the resolved altar', () => {
            const air = recipeByLabel('Air runes')!;
            expect(paintRuneLabel(OPTION_BEST, air)).toBe('Best → Air runes');
            expect(paintRuneLabel(OPTION_BEST, null)).toBe(OPTION_BEST);
            expect(paintRuneLabel('Cosmic runes', recipeByLabel('Cosmic runes'))).toBe('Cosmic runes');
        });
    });

    describe('Entrana gear', () => {
        test('matches weapons and armour the monks refuse', () => {
            expect(nameLooksLikeEntranaGear('Bronze sword')).toBe(true);
            expect(nameLooksLikeEntranaGear('Rune platebody')).toBe(true);
            expect(nameLooksLikeEntranaGear('Dramen staff')).toBe(true);
            expect(nameLooksLikeEntranaGear('Cosmic talisman')).toBe(false);
            expect(nameLooksLikeEntranaGear('Rune essence')).toBe(false);
            expect(nameLooksLikeEntranaGear('Law rune')).toBe(false);
        });
    });

    describe('pickDialogOption', () => {
        test('prefers a bank yes over a decline', () => {
            expect(pickDialogOption(
                ["No, I'm fine", 'Yes please'],
                BANK_DIALOG_PREFER,
                DIALOG_AVOID
            )).toBe('Yes please');
        });

        test('falls through to Yes when no prefer string hits', () => {
            expect(pickDialogOption(['Maybe later', 'Yes'], ['bank'], DIALOG_AVOID)).toBe('Yes');
        });
    });

    describe('nextZanarisEntryAction', () => {
        const base = {
            inZanaris: false,
            inAltar: false,
            lostCityBlocked: false,
            wearingDramen: false,
            holdingDramen: false,
            atShed: false
        };

        test('Enter Zanaris by withdrawing Dramen, equipping it, then using the shed', () => {
            expect(nextZanarisEntryAction(base).kind).toBe('withdraw-dramen');
            expect(nextZanarisEntryAction({ ...base, holdingDramen: true }).kind).toBe('equip-dramen');
            expect(nextZanarisEntryAction({ ...base, holdingDramen: true, wearingDramen: true }).kind).toBe('walk-shed');
            expect(nextZanarisEntryAction({
                ...base,
                holdingDramen: true,
                wearingDramen: true,
                atShed: true
            }).kind).toBe('open-shed');
        });

        test('does not Open the shed while Dramen is only in the pack', () => {
            expect(nextZanarisEntryAction({ ...base, holdingDramen: true, atShed: true }).kind).toBe('equip-dramen');
        });

        test('already in Zanaris is done', () => {
            expect(nextZanarisEntryAction({ ...base, inZanaris: true }).kind).toBe('already-there');
        });
    });
});
