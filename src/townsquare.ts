import {
  abort,
  ceil,
  cliExecute,
  Effect,
  haveEffect,
  inebrietyLimit,
  myBuffedstat,
  myClass,
  myEffects,
  myInebriety,
  numericModifier,
  print,
  round,
  toFloat,
  visitUrl,
} from "kolmafia";
import { $class, $effect, $item, $location, $skill, $stat, have } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "./adventure";
import { adventureMacro, Macro } from "./combat";
import {
  everyTurnFunction,
  extractInt,
  getImage,
  getImageTownsquare,
  memoizeTurncount,
  mustStop,
  setChoice,
  stopAt,
  turboMode,
  wrapMain,
} from "./lib";
import { ensureEffect, expectedTurns, moodBaseline, shrug } from "./mood";

enum PartType {
  HOT,
  COLD,
  STENCH,
  SLEAZE,
  SPOOKY,
  PHYSICAL,
}

class MonsterPart {
  type: PartType;
  name: string;
  regex: RegExp;
  intrinsic: Effect;

  constructor(type: PartType, name: string, regex: RegExp, intrinsic: Effect) {
    this.type = type;
    this.name = name;
    this.regex = regex;
    this.intrinsic = intrinsic;
  }
}

const allParts = new Map<PartType, MonsterPart>([
  [
    PartType.HOT,
    new MonsterPart(
      PartType.HOT,
      "hot",
      /pairs? of charred hobo boots/,
      $effect`Spirit of Cayenne`
    ),
  ],
  [
    PartType.COLD,
    new MonsterPart(
      PartType.COLD,
      "cold",
      /pairs? of frozen hobo eyes/,
      $effect`Spirit of Peppermint`
    ),
  ],
  [
    PartType.STENCH,
    new MonsterPart(
      PartType.STENCH,
      "stench",
      /piles? of stinking hobo guts/,
      $effect`Spirit of Garlic`
    ),
  ],
  [
    PartType.SLEAZE,
    new MonsterPart(PartType.SLEAZE, "sleaze", /hobo crotch/, $effect`Spirit of Bacon Grease`),
  ],
  [
    PartType.SPOOKY,
    new MonsterPart(PartType.SPOOKY, "spooky", /creepy hobo skull/, $effect`Spirit of Wormwood`),
  ],
  [PartType.PHYSICAL, new MonsterPart(PartType.PHYSICAL, "physical", /hobo skin/, $effect`none`)],
]);

class PartPlan {
  type: MonsterPart;
  count = 0;

  constructor(type: MonsterPart) {
    this.type = type;
  }
}

const currentParts = memoizeTurncount(() => {
  const result = new Map<MonsterPart, number>();
  const text = visitUrl("clan_hobopolis.php?place=3&action=talkrichard&whichtalk=3");
  for (const part of allParts.values()) {
    const partRe = new RegExp(`<b>(a|[0-9]+)</b> ${part.regex.source}`, "g");
    result.set(part, extractInt(partRe, text));
  }
  return result;
});

const pldAccessible = memoizeTurncount(() => {
  return visitUrl("clan_hobopolis.php?place=8").match(/purplelightdistrict[0-9]+.gif/);
});

function getParts(part: MonsterPart, desiredParts: number, stopTurncount: number) {
  const current = currentParts().get(part) as number;
  if (current >= desiredParts || mustStop(stopTurncount)) return;

  print(`Getting ${part.name} in TownSquare`, "blue");

  // This is up here so we have the right effects on for damage prediction.
  const expected = expectedTurns(stopTurncount);
  moodBaseline(expected);
  // remove ML to make it easier to get parts
  for (const effectName of Object.keys(myEffects())) {
    const effect = Effect.get(effectName);
    if (numericModifier(effect, "Monster Level") > 0) shrug(effect as Effect);
  }

  while ((currentParts().get(part) as number) < desiredParts && !mustStop(stopTurncount)) {
    // get single turn of buffs
    moodBaseline(15);
    everyTurnFunction();
    if (myClass() !== $class`Grey Goo` && myBuffedstat($stat`Mysticality`) < 400)
      cliExecute(`gain 400 mys`);
    const manager = new AdventuringManager(
      $location`Hobopolis Town Square`,
      PrimaryGoal.NONE,
      ["familiar weight", "-0.05 ml 0 min"],
      usualDropItems
    );
    manager.preAdventure();

    if (
      [PartType.COLD, PartType.STENCH, PartType.SPOOKY, PartType.SLEAZE, PartType.HOT].includes(
        part.type
      )
    ) {
      const predictedDamage =
        (32 + 0.5 * myBuffedstat($stat`Mysticality`)) *
        (1 + numericModifier("spell damage percent") / 100);
      if (predictedDamage < 505 && myClass() !== $class`Grey Goo`) {
        abort(
          `Predicted spell damage ${round(
            predictedDamage
          )} is not enough to overkill hobos and not Grey You.`
        );
      }
      if (haveEffect(part.intrinsic) === 0 && have($skill`Flavour of Magic`)) {
        cliExecute(part.intrinsic.default);
      }
      Macro.stasis()
        .externalIf(
          myClass() === $class`Grey Goo`,
          Macro.if_(
            "monstername sausage goblin",
            Macro.trySkill($skill`Double Nanovision`).repeat()
          )
            .attack()
            .repeat()
        ) // rely on space tourist phaser
        .if_("monstername sausage goblin", Macro.trySkill($skill`Saucegeyser`).repeat())
        .trySkill($skill`Stuffed Mortar Shell`)
        .externalIf(!turboMode(), Macro.skill($skill`Cannelloni Cannon`).repeat())
        .item($item`seal tooth`)
        .setAutoAttack();
    } else if (part.type === PartType.PHYSICAL) {
      Macro.stasis()
        .trySkill($skill`Double Nanovision`)
        .trySkill($skill`Lunging Thrust-Smack`)
        .repeat()
        .setAutoAttack();
    }

    adventureMacro($location`Hobopolis Town Square`, Macro.abort());
  }
}

export function doTownsquare(stopTurncount: number, pass: number) {
  if (pldAccessible() && pass === 1) {
    print("Finished Town Square to PLD. Continuing...");
    return;
  } else if (getImageTownsquare() === 25) {
    print("Finished Town Square to Hodgman. Continuing...");
    return;
  } else if (mustStop(stopTurncount)) {
    print("Out of adventures.");
    return;
  }

  setChoice(230, 0); // Show binder adventure in browser.
  setChoice(200, 0); // Show Hodgman in browser.
  setChoice(272, 2); // Skip marketplace.
  setChoice(225, 3); // Skip tent.

  // print('Making available scarehobos.');
  visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");

  const image = getImage($location`Hobopolis Town Square`);
  const goalimage = pass === 1 ? 11 : 25;
  if (image < goalimage && myInebriety() <= inebrietyLimit()) {
    // Assume we're at the end of our current image and estimate. This will be conservative.
    const imagesRemaining = goalimage - image;
    let hobosRemaining = (imagesRemaining - 1) * 100;
    // Make a plan: how many total scarehobos do we need to make to kill that many?
    // Start with the part with the fewest (should be 0).
    const partCounts = [...currentParts().entries()];
    partCounts.sort((x, y) => x[1] - y[1]);
    const plan = partCounts.map(([part]: [MonsterPart, number]) => new PartPlan(part));
    for (const [idx, [, partCount]] of partCounts.entries()) {
      if (hobosRemaining > 0 && idx < partCounts.length - 1) {
        const [, nextPartCount] = partCounts[idx + 1];
        const killsToNext = nextPartCount - partCount;
        // Each part we add to our goal kills this many hobos - for the part with lowest, it's 9.
        // The part with the second lowest, it's 2 hobos plus 1 scarehobo or 10.
        const scarehoboFactor = idx + 9;
        const partsThisRound = Math.min(
          ceil(hobosRemaining / toFloat(scarehoboFactor) - 0.001),
          killsToNext
        );
        for (let idx2 = 0; idx2 <= idx; idx2++) {
          plan[idx2].count += partsThisRound;
        }
        hobosRemaining -= partsThisRound * scarehoboFactor;
      }
    }

    if (hobosRemaining > 0) {
      print(`Remaining after: ${hobosRemaining}`);
      for (const partPlan of plan) {
        partPlan.count += ceil((hobosRemaining * 3) / 7 / 6);
      }
    }

    // for (const partPlan of plan) {
    //    print(`PLAN: For part ${partPlan.type.name}, get ${partPlan.count} more parts.`);
    // }
    plan.sort((x, y) => x.type.type - y.type.type);
    for (const partPlan of plan) {
      print(`PLAN: For part ${partPlan.type.name}, get ${partPlan.count} more parts.`);
    }
    for (const partPlan of plan) {
      getParts(partPlan.type, partPlan.count, stopTurncount);
    }
    print("Making available scarehobos.");
    visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");
  }
  print("Close to goal; using 1-by-1 strategy.");

  while (getImageTownsquare() < goalimage && !mustStop(stopTurncount)) {
    everyTurnFunction();
    if (myInebriety() <= inebrietyLimit()) {
      for (const part of allParts.values()) {
        getParts(part, 1, stopTurncount);
      }
      print("Making available scarehobos.");
      visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");
    } else {
      const physical = allParts.get(PartType.PHYSICAL)!;
      getParts(physical, currentParts().get(physical)! + 1, stopTurncount);
    }
    currentParts.forceUpdate();
  }
  if (getImageTownsquare() < goalimage) {
    print("Done with town square.");
  } else if (mustStop(stopTurncount)) {
    print("Out of adventures.");
  }
}

export function main(args: string) {
  wrapMain(args, () => doTownsquare(stopAt(args), 2));
}
