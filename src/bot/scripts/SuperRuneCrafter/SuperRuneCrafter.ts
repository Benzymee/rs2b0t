import { TaskBot, type Task } from '../../api/bot/Bot.js';
import { Execution } from '../../api/execution/Execution.js';
import { Game } from '../../api/game/Game.js';
import Tile from '../../geometry/Tile.js';
import type { WorldTile } from '../../adapter/ClientAdapter.js';
import { Bank } from '../../api/bank/Bank.js';
import { Banking } from '../../api/bank/Banking.js';
import { withdrawOp } from '../../api/bank/bankOps.js';
import { nearestBank } from '../../api/bank/BankLocations.js';
import { ChatDialog } from '../../api/ui/dialogue/ChatDialog.js';
import { Inventory, type InvItem } from '../../api/inventory/Inventory.js';
import { Equipment } from '../../api/equipment/Equipment.js';
import { Paint } from '../../paint/Paint.js';
import { fmtDuration } from '../../paint/paintLogic.js';
import { Skills } from '../../api/skills/Skills.js';
import { Trade } from '../../api/trade/Trade.js';
import { ContinueDialog } from '../../api/tasks/ContinueDialog.js';
import { Locs } from '../../api/locs/Locs.js';
import { Npcs } from '../../api/npcs/Npcs.js';
import { Players } from '../../api/players/Players.js';
import type { Loc } from '../../api/model/Loc.js';
import type { Npc } from '../../api/model/Npc.js';
import type { Player } from '../../api/model/Player.js';
import { Traversal } from '../../api/walking/Traversal.js';
import { DirectNavigator } from '../../event/webwalk/DirectNavigator.js';
import { ScriptRunner } from '../../runtime/ScriptRunner.js';
import { Quests } from '../../api/ui/questlog/Quests.js';
import { type SettingsSchema } from '../../runtime/Settings.js';
import {
    BANK_DIALOG_PREFER,
    COSMIC_TIARA,
    DIALOG_AVOID,
    DRAMEN_STAFF,
    ESSENCE,
    ESSENCE_ID,
    LOST_CITY_QUEST,
    MAX_BANK_FAILS,
    MAX_ENTER_FAILS,
    MODES,
    OPTION_BEST,
    PIN_AHEAD,
    RUNE_CHOICES,
    SCRIPT_NAME,
    SHED_OUTSIDE,
    TRADE_LOAD,
    ZANARIS_BANK,
    ZANARIS_DOOR_ID,
    ZANARIS_PLACEHOLDER_LADDER_ID,
    ZANARIS_SPAWN,
    advancePinIndex,
    bankTileNamed,
    cheb,
    destIsBankPin,
    destIsRuinsPin,
    fmtCount,
    fromZanarisShed,
    furthestPinInRange,
    inAltarInterior,
    inZanaris,
    isEssenceName,
    keepNames,
    lostCityComplete,
    nameLooksLikeEntranaGear,
    nextZanarisEntryAction,
    onCosmicCorridor,
    paintRuneLabel,
    pickDialogOption,
    pinListTo,
    rankedBanks,
    recipeByLabel,
    resolveBestRecipe,
    sameName,
    snapPinIndex,
    viasFor,
    type CraftRecipe
} from './SuperRuneCrafterLogic.js';

const RUINS = 'Mysterious ruins';
const ALTAR = { name: 'Altar', op: 'Craft-rune' };
const PORTAL = { name: 'Portal', op: 'Use' };
const TRADEREQ_CHAT = 4;
const TRADE_REQ_TEXT = /wishes to trade with you/i;
const EMPTY_TRADE_MS = 20_000;
const ADJACENT = 2;
const TEMPLE_RANGE = 30;
const ALTAR_PARK = 2;

export const SETTINGS: SettingsSchema = {
    rune: {
        type: 'string',
        default: OPTION_BEST,
        options: [...RUNE_CHOICES],
        label: 'Rune',
        help: 'Best uses the highest altar your Runecrafting level and talismans allow. '
            + 'Cosmic is ignored until Lost City is complete, then needs a wielded Dramen staff at the swamp shed. Nature is NatureCrafter.'
    },
    mode: {
        type: 'string',
        default: 'Solo',
        options: [...MODES],
        label: 'Mode',
        help: 'Solo banks its own essence. Runner ferries a 26-essence load into the altar. Mule Recipient camps at the altar.'
    },
    partner: {
        type: 'string',
        default: '',
        label: 'Trade essence to (IGN)',
        help: 'the Mule Recipient this runner delivers essence to',
        showIf: { key: 'mode', anyOf: ['Runner'] }
    }
};

function inTemple(): boolean {
    return inAltarInterior(Game.tile());
}

function heldNames(): string[] {
    return [
        ...Inventory.items().map(i => i.name ?? ''),
        ...Equipment.items().map(i => i.name ?? '')
    ].filter(Boolean);
}

function bankNames(): string[] {
    return Bank.items().map(i => i.name ?? '').filter(Boolean);
}

function lostCityDone(): boolean {
    return lostCityComplete(Quests.status(LOST_CITY_QUEST));
}

function lostCityBlocked(): boolean {
    return !lostCityDone();
}

function essCount(): number {
    return Inventory.items().filter(i => i.id === ESSENCE_ID || isEssenceName(i.name)).reduce((s, i) => s + i.count, 0);
}

function packJunk(keep: string[]): InvItem[] {
    const kept = new Set(keep.map(s => s.toLowerCase()));
    return Inventory.items().filter(i => !kept.has((i.name ?? '').toLowerCase()));
}

function playerNamed(name: string, range: number): Player | null {
    return Players.query().where(p => p.name !== null && sameName(p.name, name)).within(range).nearest();
}

function hasEntranaRestrictedGear(): boolean {
    return [...Inventory.items(), ...Equipment.items()].some(i => nameLooksLikeEntranaGear(i.name ?? ''));
}

function paintHud(ctx: CanvasRenderingContext2D, lines: string[]): void {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    const padX = 4;
    const padY = 3;
    const lineH = 14;
    const textW = Math.max(...lines.map(line => ctx.measureText(line).width));
    const w = Math.ceil(textW) + padX * 2;
    const h = padY * 2 + lines.length * lineH;
    const x = 4 + 512 - w - 4;
    const y = 4 + 334 - h - 4;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? '#800000' : '#ffffff';
        ctx.fillText(line, x + padX, y + padY + i * lineH);
    });
    ctx.restore();
}

function stopBot(bot: SuperRuneCrafter, reason: string): void {
    bot.log(reason);
    ScriptRunner.stop(reason);
}

function shedDoor(within: number, near: Tile | null = null): Loc | null {
    const byId = Locs.query().where(l => l.id === ZANARIS_DOOR_ID).action('Open').within(within).nearest();
    if (byId) {
        return byId;
    }
    return Locs.query()
        .name('Door')
        .action('Open')
        .where(l => l.id !== ZANARIS_PLACEHOLDER_LADDER_ID && (!near || l.tile().distanceTo(near) <= within))
        .within(within)
        .nearest();
}

function altarLoc(): Loc | null {
    return Locs.query().name(ALTAR.name).action(ALTAR.op).nearest();
}

function bankerOp(npc: Npc): string | null {
    const acts = npc.actions();
    return acts.find(a => /^bank$/i.test(a)) ?? acts.find(a => /bank/i.test(a)) ?? null;
}

function findFairyBanker(): Npc | null {
    const hasBank = (n: Npc): boolean => bankerOp(n) !== null;
    return Npcs.query().name('Banker').within(20).where(hasBank).nearest()
        ?? Npcs.query().within(20).where(n => /banker/i.test(n.name ?? '') && hasBank(n)).nearest()
        ?? null;
}

function runnerLoaded(bot: SuperRuneCrafter): boolean {
    return bot.hasAltarEntry() && essCount() === TRADE_LOAD && packJunk(bot.keepPack([ESSENCE])).length === 0;
}

function walkTile(t: WorldTile, here: WorldTile | null): Tile {
    const hereZ = here?.z ?? t.z;
    const sameBand = Math.abs(t.z - hereZ) < 2000;
    const level = sameBand && here ? here.level : t.level;
    return new Tile(t.x, t.z, level);
}

function isShutDoor(loc: Loc): boolean {
    const name = (loc.name ?? '').toLowerCase();
    if (!name.includes('door') && !name.includes('gate') && !name.includes('shed')) {
        return false;
    }
    return loc.actions().some(a => /^open/i.test(a));
}

async function handleBankDialog(): Promise<boolean> {
    if (ChatDialog.canContinue()) {
        await ChatDialog.continue();
        await Execution.delayTicks(1);
        return true;
    }
    if (!ChatDialog.isOpen() || ChatDialog.options().length === 0) {
        return false;
    }
    const opts = ChatDialog.options();
    const pick = pickDialogOption(opts, BANK_DIALOG_PREFER, DIALOG_AVOID);
    if (pick) {
        await ChatDialog.chooseOption(pick);
    } else {
        await ChatDialog.chooseOption();
    }
    await Execution.delayTicks(2);
    return true;
}

async function openFairyBank(bot: SuperRuneCrafter): Promise<boolean> {
    const log = (m: string): void => bot.log(`  ${m}`);
    if (Bank.isOpen()) {
        bot.resetBankFail();
        return true;
    }
    if (!inZanaris(Game.tile()) && !inTemple()) {
        if (!(await bot.enterZanaris())) {
            return false;
        }
    }
    let banker = findFairyBanker();
    if (!banker) {
        await bot.walkTo(ZANARIS_BANK, 4);
        banker = findFairyBanker();
    } else if (banker.distance() > 6) {
        bot.setStatus('walking to fairy banker');
        log(`walking to ${banker.name ?? 'Banker'}`);
        DirectNavigator.walk(walkTile(banker.tile(), Game.tile()));
        await Execution.delay(400);
        banker = findFairyBanker() ?? banker;
    }
    bot.setStatus('opening Zanaris bank');
    banker = findFairyBanker() ?? banker;
    const op = banker ? bankerOp(banker) : null;
    if (banker && op) {
        log(`Bank ${banker.name ?? 'Banker'} (right-click)`);
        await banker.interact(op);
        await Execution.delayUntil(() => Bank.isOpen() || ChatDialog.isOpen() || ChatDialog.canContinue(), 6000);
        if (ChatDialog.canContinue() || ChatDialog.isOpen()) {
            await handleBankDialog();
            await Execution.delayUntil(() => Bank.isOpen(), 4000);
        }
        if (Bank.isOpen()) {
            bot.resetBankFail();
            return true;
        }
    } else {
        log('no fairy banker with Bank nearby');
    }
    if (bot.countBankFail() >= MAX_BANK_FAILS) {
        stopBot(bot, `${SCRIPT_NAME}: could not Bank the Zanaris fairy bankers — stand nearer them`);
        return false;
    }
    bot.log('could not open the Zanaris bank — will retry');
    return false;
}

async function openBank(bot: SuperRuneCrafter): Promise<boolean> {
    const log = (m: string): void => bot.log(`  ${m}`);
    if (inZanaris(Game.tile()) || bot.recipe()?.travel === 'zanaris') {
        if (await openFairyBank(bot)) {
            return true;
        }
        if (inZanaris(Game.tile())) {
            return false;
        }
    }
    await bot.walkTo(bot.bankTile(), 3);
    if (await Banking.open({ stand: bot.bankTile(), log })) {
        bot.resetBankFail();
        return true;
    }
    if (bot.bankName() === 'Duel Arena') {
        if (await Bank.openNearestAccess({
            name: 'Open chest',
            op: 'Bank',
            openFirst: { name: 'Closed chest', op: 'Open' }
        }, log)) {
            bot.resetBankFail();
            return true;
        }
    }
    if (bot.countBankFail() >= MAX_BANK_FAILS) {
        stopBot(bot, `${SCRIPT_NAME}: couldn't reach the bank — start nearer it`);
        return false;
    }
    bot.log('could not open the bank — will retry');
    return false;
}

async function cleanPack(bot: SuperRuneCrafter, keep: string[]): Promise<boolean> {
    const kept = new Set(keep.map(s => s.toLowerCase()));
    const deposit = (): Promise<void> => Bank.depositAllMatching(name => !kept.has(name.toLowerCase()), m => bot.log(`  ${m}`));
    await Bank.setNoteMode(false);
    await deposit();
    await Execution.delayTicks(1);
    if (packJunk(keep).length > 0) {
        await deposit();
        await Execution.delayUntil(() => packJunk(keep).length === 0, 2500);
    }
    const left = packJunk(keep);
    if (left.length > 0) {
        stopBot(bot, `${SCRIPT_NAME}: ${left.length} item(s) would not deposit (${left.map(i => `${i.name ?? 'unnamed'}#${i.id}`).join(', ')})`);
        return false;
    }
    return true;
}

async function ensureNamed(bot: SuperRuneCrafter, name: string, need: string): Promise<boolean> {
    if (Inventory.contains(name) || Equipment.contains(name)) {
        return true;
    }
    await Execution.delayUntil(() => Bank.loaded(), 3000);
    const item = Bank.items().find(i => i.name?.toLowerCase() === name.toLowerCase());
    if (!item) {
        stopBot(bot, `${SCRIPT_NAME}: no ${name} in the bank or pack (${need})`);
        return false;
    }
    const op = withdrawOp(item.ops, '1') ?? withdrawOp(item.ops, 'any') ?? 'Withdraw-1';
    await Bank.withdraw(name, op);
    if (!(await Execution.delayUntil(() => Inventory.contains(name) || Equipment.contains(name), 3000))) {
        stopBot(bot, `${SCRIPT_NAME}: the ${name} withdraw never landed`);
        return false;
    }
    bot.log(`withdrew a ${name}`);
    return true;
}

async function ensureAltarEntry(bot: SuperRuneCrafter): Promise<boolean> {
    if (bot.hasAltarEntry()) {
        return true;
    }
    if (bot.recipe()?.travel === 'zanaris') {
        await Execution.delayUntil(() => Bank.loaded(), 3000);
        const tiara = Bank.items().find(i => i.name?.toLowerCase() === COSMIC_TIARA.toLowerCase());
        if (tiara) {
            return ensureNamed(bot, COSMIC_TIARA, 'the cosmic ruins accept a tiara or a talisman');
        }
    }
    const talisman = bot.talismanName();
    if (!talisman) {
        return false;
    }
    return ensureNamed(bot, talisman, 'the altar can\'t be entered without one');
}

async function ensureDramen(bot: SuperRuneCrafter): Promise<boolean> {
    if (bot.recipe()?.travel !== 'zanaris') {
        return true;
    }
    return ensureNamed(bot, DRAMEN_STAFF, 'the swamp shed only teleports while it is wielded');
}

async function stripEntranaGear(bot: SuperRuneCrafter): Promise<boolean> {
    if (bot.recipe()?.travel !== 'entrana' || !hasEntranaRestrictedGear()) {
        return true;
    }
    bot.log('removing weapons and armour before Entrana');
    for (const item of Equipment.items()) {
        if (item.name && !(await Equipment.unequip(item.name))) {
            stopBot(bot, `${SCRIPT_NAME}: could not remove ${item.name} — Entrana monks refuse weapons and armour`);
            return false;
        }
    }
    return true;
}

export default class SuperRuneCrafter extends TaskBot {
    override loopDelay = 600;

    recipeState: CraftRecipe | null = null;
    choice = OPTION_BEST;
    mode = 'Solo';
    partner = '';
    lastRequester: string | null = null;
    trips = 0;
    crafted = 0;
    trades = 0;
    moved = 0;
    bankFails = 0;
    status = 'starting';
    startedAt = Date.now();
    xpAtStart = 0;
    private pinIndex = 0;
    private pinRouteKey = '';

    override async onStart(): Promise<void> {
        await Execution.delayUntil(() => Game.ingame() && Game.tile() !== null, 0);
        Traversal.preload();
        this.choice = this.settings.str('rune', OPTION_BEST);
        this.mode = this.settings.str('mode', 'Solo');
        this.partner = this.settings.str('partner', '').trim();
        this.startedAt = Date.now();
        this.xpAtStart = Skills.xp('runecraft');
        if (this.choice === OPTION_BEST) {
            this.recipeState = this.pickFromNames(heldNames());
        } else {
            const recipe = recipeByLabel(this.choice);
            if (!recipe) {
                throw new Error(`${SCRIPT_NAME}: unknown rune '${this.choice}'`);
            }
            this.recipeState = recipe;
        }
        if (this.recipeState && Skills.level('runecraft') < this.recipeState.level) {
            throw new Error(`${SCRIPT_NAME}: Runecrafting ${this.recipeState.level} required for ${this.recipeState.label}`);
        }
        if (this.recipeState?.travel === 'zanaris' && lostCityBlocked()) {
            throw new Error(`${SCRIPT_NAME}: Cosmic runes need Lost City complete, then a wielded Dramen staff at the Lumbridge swamp shed`);
        }
        if (this.mode === 'Runner') {
            if (!this.partner) {
                throw new Error(`${SCRIPT_NAME}: no trade partner configured`);
            }
            this.log(`${SCRIPT_NAME} runner starting — ${this.paintRune()} for '${this.partner}'`);
            this.add(new ContinueDialog(), new RunnerTrade(this), new RunnerDeliver(this), new Exit(this), new RunnerRestock(this), new Enter(this, () => essCount() > 0));
            return;
        }
        if (this.mode === 'Mule Recipient') {
            this.on('chat.message', e => {
                if (e.type === TRADEREQ_CHAT && e.username && TRADE_REQ_TEXT.test(e.text)) {
                    this.lastRequester = e.username;
                }
            });
            this.log(`${SCRIPT_NAME} mule recipient starting — ${this.paintRune()}`);
            this.add(new ContinueDialog(), new MuleTakeTrade(this), new Craft(this, false), new MuleDropJunk(this), new MuleAnswerRequest(this), new MuleWait(this), new MulePrepare(this), new Enter(this, () => true));
            return;
        }
        this.log(`${SCRIPT_NAME} starting — ${this.paintRune()}, bank ${this.bankName()}`);
        this.add(new ContinueDialog(), new Craft(this, true), new Exit(this), new BankTrip(this), new Enter(this, () => essCount() > 0));
    }

    override onPaint(ctx: CanvasRenderingContext2D): void {
        const mins = (Date.now() - this.startedAt) / 60_000;
        const hrs = mins / 60;
        const xp = Math.max(0, Skills.xp('runecraft') - this.xpAtStart);
        const xph = hrs > 0.008 ? xp / hrs : 0;
        const stats = this.mode === 'Runner'
            ? `delivered ${this.moved} - trades ${this.trades} - pack ${Inventory.used()}/28`
            : `${this.mode.toLowerCase()} ${this.crafted} - trips ${this.trips} - pack ${Inventory.used()}/28`;
        paintHud(ctx, [
            SCRIPT_NAME,
            `time ${fmtDuration(mins)} - ${this.status}`,
            `${this.paintRune()} - RC ${Skills.level('runecraft')}`,
            stats,
            `xp +${fmtCount(xp)}${xph > 0 ? ` (${fmtCount(xph)}/h)` : ''}`
        ]);
        const p = Paint.begin(ctx, { dock: 'chatbox', accent: '#800000' });
        p.title(SCRIPT_NAME);
        ScriptRunner.paintControls(p);
        p.end();
    }

    pickFromNames(names: string[]): CraftRecipe | null {
        return resolveBestRecipe(Skills.level('runecraft'), names, { lostCity: lostCityDone() });
    }

    resolveAtBank(): boolean {
        if (this.choice !== OPTION_BEST) {
            const recipe = recipeByLabel(this.choice) ?? this.recipeState;
            if (!recipe) {
                stopBot(this, `${SCRIPT_NAME}: unknown rune '${this.choice}'`);
                return false;
            }
            this.recipeState = recipe;
            return true;
        }
        const picked = this.pickFromNames([...heldNames(), ...bankNames()]);
        if (!picked) {
            stopBot(this, `${SCRIPT_NAME}: Best found no craftable altar — need a talisman your Runecrafting level can use (Cosmic also needs Lost City)`);
            return false;
        }
        if (this.recipeState?.label !== picked.label) {
            this.log(`Best → ${picked.label} (RC ${Skills.level('runecraft')}, ${picked.talisman})`);
        }
        this.recipeState = picked;
        return true;
    }

    atRecipeBank(): boolean {
        const here = Game.tile();
        const dest = this.bankTile();
        if (!here) {
            return false;
        }
        if (inZanaris(dest) !== inZanaris(here)) {
            return false;
        }
        return Math.max(Math.abs(here.x - dest.x), Math.abs(here.z - dest.z)) <= 14;
    }

    setStatus(s: string): void { this.status = s; }
    countCraft(n: number): void { this.crafted += n; }
    countTrip(): void { this.trips++; }
    tripsTotal(): number { return this.trips; }
    countTrade(essence: number): void { this.trades++; this.moved += essence; }
    countBankFail(): number { return ++this.bankFails; }
    resetBankFail(): void { this.bankFails = 0; }
    recipe(): CraftRecipe | null { return this.recipeState; }
    paintRune(): string { return paintRuneLabel(this.choice, this.recipeState); }
    talismanName(): string { return this.recipeState?.talisman ?? ''; }
    runeName(): string { return this.recipeState?.rune ?? ''; }
    ruinsTile(): Tile { return this.recipeState?.ruins ?? SHED_OUTSIDE; }
    bankName(): string {
        if (this.recipeState) {
            return this.recipeState.bank;
        }
        const here = Game.tile();
        if (here && inZanaris(here)) {
            return 'Zanaris';
        }
        return nearestBank(here ?? { x: 3093, z: 3243, level: 0 })?.name ?? 'Draynor';
    }
    bankTile(): Tile { return bankTileNamed(this.bankName()); }
    keepPack(extra: string[] = []): string[] {
        if (this.recipeState) {
            return keepNames(this.recipeState, extra);
        }
        return [DRAMEN_STAFF, COSMIC_TIARA, ...extra];
    }
    partnerName(): string { return this.partner; }
    pendingRequester(): string | null { return this.lastRequester; }
    takeRequester(): string | null {
        const name = this.lastRequester;
        this.lastRequester = null;
        return name;
    }
    muleKeep(): string[] { return this.keepPack(this.recipeState ? [this.recipeState.rune] : []); }
    hasAltarEntry(): boolean {
        const talisman = this.talismanName();
        if (talisman && (Inventory.contains(talisman) || Equipment.contains(talisman))) {
            return true;
        }
        return this.recipe()?.travel === 'zanaris'
            && (Inventory.contains(COSMIC_TIARA) || Equipment.contains(COSMIC_TIARA));
    }

    async walkTo(dest: Tile, radius = 2): Promise<void> {
        const here = Game.tile();
        if (here && new Tile(here.x, here.z, here.level).distanceTo(dest) <= radius) {
            return;
        }
        if (inAltarInterior(here)) {
            await Traversal.walkResilient(dest, { radius, attempts: 6, timeoutMs: 240_000, log: m => this.log(`  ${m}`) });
            return;
        }
        const wantZanaris = inZanaris(dest);
        const hereZanaris = inZanaris(here);
        if (wantZanaris && !hereZanaris) {
            if (!(await this.enterZanaris())) {
                return;
            }
        } else if (!wantZanaris && hereZanaris) {
            if (!(await this.leaveZanaris())) {
                return;
            }
        }
        const now = Game.tile();
        if (now && new Tile(now.x, now.z, now.level).distanceTo(dest) <= radius) {
            return;
        }
        if (inZanaris(now) && (destIsBankPin(dest) || destIsRuinsPin(dest) || onCosmicCorridor(now) || fromZanarisShed(now))) {
            await this.walkZanarisPins(dest, radius);
            return;
        }
        await Traversal.walkResilient(dest, { radius, attempts: 6, timeoutMs: 240_000, log: m => this.log(`  ${m}`) });
    }

    private async walkZanarisPins(dest: Tile, radius: number): Promise<boolean> {
        const here0 = Game.tile();
        if (!here0) {
            return false;
        }
        if (cheb(dest, here0) <= radius) {
            return true;
        }
        if (fromZanarisShed(here0) && destIsBankPin(dest)) {
            this.setStatus('walking to Zanaris bank');
            this.log(`from swamp shed at ${here0.x},${here0.z}, walking to fairy bank ${dest.x},${dest.z}`);
        }
        const vias = viasFor(here0, dest);
        const route = pinListTo(dest, vias);
        const key = `${dest.x},${dest.z}:${route.map(p => `${p.x},${p.z}`).join('|')}`;
        if (this.pinRouteKey !== key) {
            this.pinRouteKey = key;
            this.pinIndex = snapPinIndex(route, here0);
        } else if (this.pinIndex >= route.length) {
            this.pinIndex = snapPinIndex(route, here0);
        }
        if (!route.length) {
            return Traversal.walkResilient(walkTile(dest, here0), { radius, attempts: 4, timeoutMs: 120_000, log: m => this.log(`  ${m}`) });
        }
        this.setStatus(destIsRuinsPin(dest) ? 'walking to cosmic ruins' : destIsBankPin(dest) ? 'walking to Zanaris bank' : `walking ${dest.x},${dest.z}`);
        this.log(`pin path to ${dest.x},${dest.z} (${cheb(dest, here0)}t, ${route.length} pins)`);
        return this.walkPinsAhead(route, dest, radius);
    }

    private async walkPinsAhead(route: Tile[], dest: Tile, radius: number): Promise<boolean> {
        const started = Date.now();
        let lastClick: Tile | null = null;
        let lastHere: WorldTile | null = null;
        let lastMoved = Date.now();
        let shedNudge = 0;
        while (Date.now() - started < 180_000) {
            const here = Game.tile();
            if (!here) {
                return false;
            }
            if (cheb(dest, here) <= radius) {
                return true;
            }
            if (destIsBankPin(dest) && findFairyBanker() && (findFairyBanker()?.distance() ?? 99) <= 5) {
                return true;
            }
            if (ChatDialog.canContinue()) {
                await ChatDialog.continue();
                continue;
            }
            if (!lastHere || cheb(here, lastHere) > 0) {
                lastHere = here;
                lastMoved = Date.now();
                shedNudge = 0;
            }
            const idleMs = Date.now() - lastMoved;
            this.pinIndex = advancePinIndex(route, here, this.pinIndex);
            if (this.pinIndex >= route.length) {
                DirectNavigator.walk(walkTile(dest, here));
                await Execution.delay(300);
                continue;
            }
            if (idleMs > 4000) {
                await this.openNearbyDoor(4);
            }
            if (idleMs > 2500 && fromZanarisShed(here) && destIsBankPin(dest) && shedNudge < 3) {
                shedNudge++;
                const south = new Tile(here.x, here.z - 8, here.level);
                this.log(`shed walk blocked at ${here.x},${here.z}, stepping south to ${south.x},${south.z}`);
                DirectNavigator.walk(walkTile(south, here));
                lastClick = south;
                lastMoved = Date.now();
                await Execution.delay(600);
                continue;
            }
            const reach = furthestPinInRange(route, this.pinIndex, here, PIN_AHEAD);
            const click = walkTile(route[reach] ?? dest, here);
            const same = lastClick && lastClick.x === click.x && lastClick.z === click.z;
            if (!same || idleMs > 1800) {
                this.setStatus(`walking ${click.x},${click.z}`);
                if (!same) {
                    this.log(`walk ${click.x},${click.z} (pin ${reach + 1}/${route.length}, ${cheb(dest, here)}t to dest)`);
                }
                DirectNavigator.walk(click);
                lastClick = click;
            }
            if (idleMs > 4500 && this.pinIndex < route.length - 1 && !fromZanarisShed(here)) {
                this.log(`pin ${route[this.pinIndex].x},${route[this.pinIndex].z} stalled, skipping`);
                this.pinIndex++;
                lastClick = null;
                lastMoved = Date.now();
                continue;
            }
            await Execution.delay(300);
        }
        const end = Game.tile();
        return !!end && cheb(dest, end) <= radius;
    }

    private async openNearbyDoor(radius: number): Promise<boolean> {
        const door = Locs.query().where(l => isShutDoor(l) && l.distance() <= radius).nearest();
        if (!door) {
            return false;
        }
        const op = door.actions().find(a => /^open/i.test(a));
        if (!op) {
            return false;
        }
        this.log(`opening ${door.name}`);
        await door.interact(op);
        await Execution.delayTicks(2);
        return true;
    }

    /** Shed teleports only while Dramen is wielded. Never walk there with it sitting in the pack. */
    private async wieldDramenStaff(): Promise<boolean> {
        if (Equipment.contains(DRAMEN_STAFF)) {
            return true;
        }
        if (!Inventory.contains(DRAMEN_STAFF)) {
            return false;
        }
        this.setStatus('wielding Dramen staff');
        this.log('wielding Dramen staff for the Zanaris shed');
        await Equipment.equip(DRAMEN_STAFF);
        if (await Execution.delayUntil(() => Equipment.contains(DRAMEN_STAFF), 3000)) {
            return true;
        }
        stopBot(this, `${SCRIPT_NAME}: wield a Dramen staff before opening the Lumbridge swamp shed (Lost City)`);
        return false;
    }

    async enterZanaris(): Promise<boolean> {
        for (let step = 0; step < 8; step++) {
            const here = Game.tile();
            const action = nextZanarisEntryAction({
                inZanaris: inZanaris(here),
                inAltar: inAltarInterior(here),
                lostCityBlocked: lostCityBlocked(),
                wearingDramen: Equipment.contains(DRAMEN_STAFF),
                holdingDramen: Inventory.contains(DRAMEN_STAFF),
                atShed: !!here && new Tile(here.x, here.z, here.level).distanceTo(SHED_OUTSIDE) <= 2
            });
            if (action.kind === 'already-there') {
                return true;
            }
            if (action.kind === 'stop') {
                stopBot(this, `${SCRIPT_NAME}: ${action.reason}`);
                return false;
            }
            if (action.kind === 'withdraw-dramen') {
                const bank = (here ? rankedBanks(here) : []).find(b => b.name !== 'Zanaris');
                if (!bank) {
                    stopBot(this, `${SCRIPT_NAME}: wield a Dramen staff before opening the Lumbridge swamp shed (Lost City)`);
                    return false;
                }
                this.setStatus('banking Dramen staff');
                this.log(`Dramen staff not in pack — withdrawing at ${bank.name} before the swamp shed`);
                if (!(await Banking.open({ stand: bank.tile, log: m => this.log(`  ${m}`) }))) {
                    return false;
                }
                if (!(await ensureNamed(this, DRAMEN_STAFF, 'Lost City\'s swamp shed only teleports while it is wielded'))) {
                    return false;
                }
                await Bank.close();
                if (!(await this.wieldDramenStaff())) {
                    return false;
                }
                continue;
            }
            if (action.kind === 'equip-dramen') {
                if (!(await this.wieldDramenStaff())) {
                    return false;
                }
                continue;
            }
            if (action.kind === 'walk-shed') {
                const stand = Game.tile();
                this.setStatus('walking to Lost City shed');
                this.log(`not in Zanaris (at ${stand?.x},${stand?.z}), walking to the Lumbridge swamp shed`);
                if (!(await Traversal.walkResilient(SHED_OUTSIDE, { radius: 1, attempts: 4, timeoutMs: 300_000, log: m => this.log(`  ${m}`) }))) {
                    return false;
                }
                continue;
            }
            const door = shedDoor(6, SHED_OUTSIDE);
            if (!door) {
                this.log('no Lost City shed Door to Open');
                return false;
            }
            if (!Equipment.contains(DRAMEN_STAFF)) {
                if (!(await this.wieldDramenStaff())) {
                    return false;
                }
            }
            this.setStatus('entering Zanaris shed');
            this.log('Open the swamp shed Door (Dramen staff wielded)');
            if (!(await door.interact('Open'))) {
                return false;
            }
            if (await Execution.delayUntil(() => inZanaris(Game.tile()), 15_000)) {
                const land = Game.tile();
                this.log(`entered Zanaris from the swamp shed${land ? ` at ${land.x},${land.z}` : ''}`);
                return true;
            }
            return false;
        }
        return inZanaris(Game.tile()) || inAltarInterior(Game.tile());
    }

    async leaveZanaris(): Promise<boolean> {
        if (!inZanaris(Game.tile())) {
            return true;
        }
        if (!Equipment.contains(DRAMEN_STAFF) && Inventory.contains(DRAMEN_STAFF)) {
            if (!(await this.wieldDramenStaff())) {
                return false;
            }
        }
        this.setStatus('leaving Zanaris');
        this.log('leaving Zanaris through the shed Door');
        if (!(await Traversal.walkResilient(ZANARIS_SPAWN, { radius: 2, attempts: 4, timeoutMs: 120_000, log: m => this.log(`  ${m}`) }))) {
            return false;
        }
        const door = shedDoor(8, ZANARIS_SPAWN);
        if (!door) {
            this.log('no Zanaris shed Door to Open — standing at the spawn until one is in scene');
            return false;
        }
        if (!(await door.interact('Open'))) {
            return false;
        }
        return Execution.delayUntil(() => !inZanaris(Game.tile()) && !inAltarInterior(Game.tile()), 15_000);
    }
}

class Craft implements Task {
    constructor(private bot: SuperRuneCrafter, private thenExit: boolean) {}
    validate(): boolean { return inTemple() && essCount() > 0; }
    async execute(): Promise<void> {
        const altar = altarLoc();
        if (!altar) {
            await Execution.delayTicks(2);
            return;
        }
        this.bot.setStatus('crafting runes');
        const before = essCount();
        this.bot.log(`crafting ${before} essence at the altar`);
        if (!(await altar.interact(ALTAR.op))) {
            await Execution.delayTicks(2);
            return;
        }
        await Execution.delayUntil(() => essCount() === 0, 8000);
        const made = before - essCount();
        this.bot.countCraft(made);
        this.bot.log(`crafted ${made} ${this.bot.runeName()}s`);
        if (!this.thenExit) {
            return;
        }
        this.bot.setStatus('taking the portal out');
        this.bot.log('taking the portal back to the ruins');
        for (let i = 0; i < 15 && inTemple(); i++) {
            if (ChatDialog.canContinue()) {
                await ChatDialog.continue();
                continue;
            }
            const portal = Locs.query().name(PORTAL.name).action(PORTAL.op).nearest();
            if (portal) {
                await portal.interact(PORTAL.op);
            }
            await Execution.delayTicks(1);
        }
        if (!inTemple()) {
            this.bot.log('back at the mysterious ruins');
        }
    }
}

class Exit implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return inTemple() && essCount() === 0; }
    async execute(): Promise<void> {
        const portal = Locs.query().name(PORTAL.name).action(PORTAL.op).nearest();
        if (!portal) {
            await Execution.delayTicks(2);
            return;
        }
        this.bot.setStatus('taking the portal out');
        this.bot.log('taking the portal back to the ruins');
        if (!(await portal.interact(PORTAL.op))) {
            await Execution.delayTicks(2);
            return;
        }
        if (await Execution.delayUntil(() => !inTemple(), 15_000)) {
            this.bot.log('back at the mysterious ruins');
        }
    }
}

class BankTrip implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return !inTemple() && essCount() === 0; }
    async execute(): Promise<void> {
        this.bot.setStatus('banking');
        this.bot.log('heading to the bank');
        if (!(await openBank(this.bot))) {
            return;
        }
        if (!this.bot.resolveAtBank()) {
            return;
        }
        if (!this.bot.atRecipeBank()) {
            if (!(await ensureDramen(this.bot))) {
                return;
            }
            await Bank.close();
            this.bot.log(`moving to the ${this.bot.bankName()} bank for ${this.bot.paintRune()}`);
            return;
        }
        if (!(await stripEntranaGear(this.bot))) {
            return;
        }
        const madeRunes = this.bot.runeName() ? Inventory.count(this.bot.runeName()) : 0;
        if (!(await cleanPack(this.bot, this.bot.keepPack()))) {
            return;
        }
        this.bot.countTrip();
        if (madeRunes > 0) {
            this.bot.log(`deposited ${madeRunes} ${this.bot.runeName()}s`);
        }
        if (!(await ensureAltarEntry(this.bot))) {
            return;
        }
        if (!(await ensureDramen(this.bot))) {
            return;
        }
        if (Bank.count(ESSENCE) === 0 && !Bank.items().some(i => isEssenceName(i.name))) {
            stopBot(this.bot, `${SCRIPT_NAME}: out of Rune essence in the bank`);
            return;
        }
        const ess = Bank.items().find(i => isEssenceName(i.name));
        const essName = ess?.name ?? ESSENCE;
        const op = (ess && withdrawOp(ess.ops, 'all')) ?? 'Withdraw-All';
        await Bank.withdraw(essName, op);
        await Execution.delayUntil(() => essCount() > 0 || Bank.count(ESSENCE) === 0, 4000);
        this.bot.log(`withdrew ${essCount()} rune essence (trip ${this.bot.tripsTotal()})`);
    }
}

class Enter implements Task {
    private fails = 0;
    constructor(private bot: SuperRuneCrafter, private ready: () => boolean) {}
    validate(): boolean { return !inTemple() && this.ready() && this.bot.recipe() !== null; }
    async execute(): Promise<void> {
        this.bot.setStatus('heading to the ruins');
        this.bot.log('heading to the mysterious ruins');
        await this.bot.walkTo(this.bot.ruinsTile(), this.bot.recipe()?.travel === 'zanaris' ? 5 : 1);
        const ruins = Locs.query().name(RUINS).nearest();
        if (!ruins) {
            await Execution.delayTicks(2);
            return;
        }
        this.bot.setStatus('entering the altar');
        let started = false;
        if (this.bot.recipe()?.travel === 'zanaris' && Equipment.contains(COSMIC_TIARA)) {
            const enterOp = ruins.actions().find(a => /^enter/i.test(a)) ?? ruins.actions().find(a => /enter|use/i.test(a));
            if (enterOp) {
                this.bot.log(`${enterOp} the mysterious ruins (Cosmic tiara)`);
                started = !!(await ruins.interact(enterOp));
            }
        }
        if (!started) {
            const talisman = Inventory.first(this.bot.talismanName());
            if (!talisman) {
                if (!this.bot.hasAltarEntry()) {
                    stopBot(this.bot, `${SCRIPT_NAME}: no ${this.bot.talismanName()} in the pack — the altar can't be entered without one`);
                }
                return;
            }
            this.bot.log(`using the ${this.bot.talismanName()} on the mysterious ruins`);
            started = !!(await talisman.useOn(ruins));
        }
        if (!started) {
            await Execution.delayTicks(2);
            return;
        }
        if (await Execution.delayUntil(() => inTemple(), 10_000)) {
            this.bot.log('entered the altar');
            this.fails = 0;
            return;
        }
        if (++this.fails >= MAX_ENTER_FAILS) {
            stopBot(this.bot, `${SCRIPT_NAME}: the talisman didn't teleport into the altar`);
        }
    }
}

class RunnerTrade implements Task {
    private before = 0;
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return Trade.active(); }
    async execute(): Promise<void> {
        if (Trade.onConfirmScreen()) {
            this.bot.setStatus('confirming the delivery');
            await Trade.accept();
            if (await Execution.delayUntil(() => !Trade.active(), 3000)) {
                const delivered = this.before - essCount();
                if (delivered > 0) {
                    this.bot.countTrade(delivered);
                    this.bot.log(`delivered ${delivered} essence to ${this.bot.partnerName()}`);
                }
                this.before = 0;
            }
            return;
        }
        if (Trade.myOffer().length === 0) {
            const held = essCount();
            if (held <= 0) {
                await Execution.delayTicks(1);
                return;
            }
            this.before = held;
            this.bot.setStatus('offering essence');
            if (held <= TRADE_LOAD) {
                await Trade.offerAll(ESSENCE, i => i.id === ESSENCE_ID);
            } else {
                await Trade.offer(ESSENCE, TRADE_LOAD, i => i.id === ESSENCE_ID);
            }
        } else {
            this.bot.setStatus('accepting the delivery');
            await Trade.accept();
        }
    }
}

class RunnerDeliver implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return inTemple() && essCount() > 0 && !Trade.active(); }
    async execute(): Promise<void> {
        const partner = this.bot.partnerName();
        const master = playerNamed(partner, TEMPLE_RANGE);
        if (!master) {
            this.bot.setStatus(`looking for ${partner} at the altar`);
            const altar = altarLoc();
            if (altar) {
                await DirectNavigator.walkTo(altar.tile(), ALTAR_PARK + 1, 10_000);
            }
            await Execution.delayTicks(2);
            return;
        }
        this.bot.setStatus(`delivering to ${partner}`);
        this.bot.log(`requesting a trade with ${master.name}`);
        await Trade.request(master.name ?? partner);
        await Execution.delayUntil(() => Trade.active(), 4000);
    }
}

class RunnerRestock implements Task {
    private emptyReads = 0;
    private stocked = false;
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean {
        if (essCount() === 0) {
            this.stocked = false;
        }
        return !inTemple() && !Trade.active() && !this.stocked && !runnerLoaded(this.bot);
    }
    async execute(): Promise<void> {
        this.bot.setStatus('restocking essence');
        if (!(await openBank(this.bot))) {
            return;
        }
        if (!this.bot.resolveAtBank()) {
            return;
        }
        if (!this.bot.atRecipeBank()) {
            if (!(await ensureDramen(this.bot))) {
                return;
            }
            await Bank.close();
            return;
        }
        if (!(await stripEntranaGear(this.bot))) {
            return;
        }
        if (!(await cleanPack(this.bot, this.bot.keepPack()))) {
            return;
        }
        if (!(await ensureAltarEntry(this.bot))) {
            return;
        }
        if (!(await ensureDramen(this.bot))) {
            return;
        }
        await Execution.delayUntil(() => Bank.loaded(), 3000);
        const ess = Bank.items().find(i => isEssenceName(i.name));
        const banked = ess ? Math.max(ess.count, Bank.count(ess.name ?? ESSENCE)) : Bank.count(ESSENCE);
        if (banked === 0) {
            if (++this.emptyReads >= 3) {
                stopBot(this.bot, `${SCRIPT_NAME}: out of Rune essence in the bank (three reads)`);
            }
            return;
        }
        this.emptyReads = 0;
        await Bank.withdrawX(ess?.name ?? ESSENCE, Math.min(TRADE_LOAD, banked, Inventory.free()));
        this.stocked = await Execution.delayUntil(() => essCount() > 0, 3000);
        this.bot.countTrip();
        this.bot.log(`withdrew ${essCount()} essence (bank run ${this.bot.tripsTotal()})`);
    }
}

class MuleTakeTrade implements Task {
    private openedAt = 0;
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean {
        if (!Trade.active()) {
            this.openedAt = 0;
            return false;
        }
        if (this.openedAt === 0) {
            this.openedAt = Date.now();
        }
        return true;
    }
    async execute(): Promise<void> {
        this.bot.takeRequester();
        if (Trade.onConfirmScreen()) {
            this.bot.setStatus('confirming the essence trade');
            const before = essCount();
            await Trade.accept();
            if (await Execution.delayUntil(() => !Trade.active(), 3000) && essCount() > before) {
                this.bot.countTrade(essCount() - before);
                this.bot.log(`received ${essCount() - before} essence`);
            }
            return;
        }
        if (Trade.myOffer().length > 0) {
            this.bot.log('safety: something is in MY trade offer — declining so nothing is given away');
            await Trade.decline();
            return;
        }
        const theirEssence = Trade.theirOffer().filter(o => isEssenceName(o.name)).reduce((s, o) => s + Math.max(1, o.count), 0);
        if (theirEssence <= 0) {
            if (Date.now() - this.openedAt > EMPTY_TRADE_MS) {
                this.bot.log('trade partner never offered essence — declining so waiting runners get served');
                await Trade.decline();
                return;
            }
            this.bot.setStatus('waiting for the essence offer');
            await Execution.delayTicks(1);
            return;
        }
        if (theirEssence > Inventory.free()) {
            this.bot.log(`can't fit ${theirEssence} essence (${Inventory.free()} slots free) — declining so the pack can be cleared first`);
            await Trade.decline();
            return;
        }
        this.bot.setStatus(`accepting ${theirEssence} essence`);
        await Trade.accept();
    }
}

class MuleAnswerRequest implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return inTemple() && !Trade.active() && this.bot.pendingRequester() !== null; }
    async execute(): Promise<void> {
        const name = this.bot.takeRequester();
        if (!name) {
            return;
        }
        const runner = await Execution.delayUntil(() => playerNamed(name, ADJACENT) !== null, 1800)
            ? playerNamed(name, ADJACENT)
            : null;
        if (!runner) {
            this.bot.log(`'${name}' asked to trade but never reached the altar — waiting for the next request`);
            return;
        }
        this.bot.setStatus(`answering ${runner.name}'s trade request`);
        this.bot.log(`answering ${runner.name}'s trade request`);
        await Trade.request(runner.name ?? name);
        await Execution.delayUntil(() => Trade.active(), 4000);
    }
}

class MuleDropJunk implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    private junk(): InvItem[] { return packJunk([...this.bot.muleKeep(), ESSENCE, 'Pure essence']); }
    validate(): boolean { return inTemple() && !Trade.active() && this.junk().length > 0; }
    async execute(): Promise<void> {
        this.bot.setStatus('dropping random-event junk');
        for (let guard = 0; guard < 28; guard++) {
            const item = this.junk()[0];
            if (!item) {
                break;
            }
            this.bot.log(`dropping ${item.name ?? `item#${item.id}`} — it blocks a full essence delivery`);
            const before = Inventory.used();
            if (!(await item.interact('Drop'))) {
                await Execution.delayTicks(1);
                return;
            }
            await Execution.delayUntil(() => Inventory.used() < before, 3000);
        }
        const left = this.junk();
        if (left.length > 0) {
            stopBot(this.bot, `${SCRIPT_NAME}: could not drop ${left.map(i => `${i.name ?? 'unnamed'}#${i.id}`).join(', ')}`);
        }
    }
}

class MulePrepare implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean {
        return !inTemple() && !Trade.active() && essCount() === 0
            && (packJunk(this.bot.muleKeep()).length > 0 || !this.bot.hasAltarEntry());
    }
    async execute(): Promise<void> {
        this.bot.setStatus('cleaning the pack at the bank');
        this.bot.log('bank trip — the pack needs just the talisman (+ the rune stack) to take trades');
        if (!(await openBank(this.bot))) {
            return;
        }
        if (!this.bot.resolveAtBank()) {
            return;
        }
        if (!this.bot.atRecipeBank()) {
            if (!(await ensureDramen(this.bot))) {
                return;
            }
            await Bank.close();
            return;
        }
        if (!(await stripEntranaGear(this.bot))) {
            return;
        }
        if (!(await cleanPack(this.bot, this.bot.muleKeep()))) {
            return;
        }
        if (!(await ensureAltarEntry(this.bot))) {
            return;
        }
        if (!(await ensureDramen(this.bot))) {
            return;
        }
        this.bot.log('pack is clean — heading back to the altar');
    }
}

class MuleWait implements Task {
    constructor(private bot: SuperRuneCrafter) {}
    validate(): boolean { return inTemple() && essCount() === 0; }
    async execute(): Promise<void> {
        const altar = altarLoc();
        if (altar && altar.distance() > ALTAR_PARK) {
            this.bot.setStatus('parking at the altar');
            this.bot.log('taking up station next to the altar');
            await DirectNavigator.walkTo(altar.tile(), ALTAR_PARK, 15_000);
            return;
        }
        this.bot.setStatus('waiting for a trade request');
        await Execution.delayTicks(2);
    }
}
