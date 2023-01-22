import {
  getClanName,
  inebrietyLimit,
  myAdventures,
  myInebriety,
  print,
  setAutoAttack,
  visitUrl,
} from "kolmafia";
import { $item, $location } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "./adventure";
import { adventureRunOrStasis } from "./combat";
import {
  everyTurnFunction,
  extractInt,
  getChoice,
  memoizeTurncount,
  mustStop,
  setChoice,
  stopAt,
  wrapMain,
} from "./lib";
import { expectedTurns, moodAddItem, moodMinusCombat } from "./mood";

export const getSewersState = memoizeTurncount(() => {
  const logText = visitUrl("clan_raidlogs.php");
  const grates = extractInt(/opened (a|[0-9]+) sewer grate/g, logText);
  const valves = extractInt(
    /lowered the water level( [0-9]+ times?)? \(([0-9]+) turn/g,
    logText,
    2
  );
  return { grates, valves };
});

export function throughSewers() {
  return visitUrl("clan_hobopolis.php").includes("clan_hobopolis.php?place=2");
}

export function sewerAccess() {
  return visitUrl("clan_hobopolis.php").includes("adventure.php?snarfblat=166");
}

function doContinue(stopTurncount: number) {
  return sewerAccess() && !mustStop(stopTurncount) && myAdventures() >= 10;
}

export function doSewers(stopTurncount: number) {
  if (!throughSewers() && !sewerAccess())
    throw `You do not have dungeon access in clan ${getClanName()}.`;

  let state = getSewersState();
  if (doContinue(stopTurncount)) {
    const overdrunk = myInebriety() > inebrietyLimit();
    if (overdrunk) {
      print("WARNING: Going through sewers while overdrunk is not recommended.", "red");
    }

    // Gnaw through bars
    setChoice(211, 1);
    setChoice(212, 1);
    setChoice(197, 3); // Turn valve
    setChoice(198, 3); // Open grate
    setChoice(199, 2); // Ladder - skip.

    setAutoAttack(0);

    while (doContinue(stopTurncount)) {
      everyTurnFunction();
      if (state.valves >= 20) setChoice(197, 1); // Take tunnel and open grates.
      if (state.grates >= 20) setChoice(198, 1); // Take tunnel and open valves.
      if (state.grates + state.valves >= 32) setChoice(199, 1); // Take tunnel on useless ladder NC.

      const maxTurnsEstimate = 150 - (state.grates + state.valves) * 3.2;
      const anyTunnel = [197, 198, 199].some((adv: number) => getChoice(adv) === 1);
      const equips = anyTunnel ? [$item`hobo code binder`, ...usualDropItems] : usualDropItems;

      const location = $location`A Maze of Sewer Tunnels`;
      moodMinusCombat(expectedTurns(stopTurncount), maxTurnsEstimate);
      const manager = new AdventuringManager(
        $location`A Maze of Sewer Tunnels`,
        PrimaryGoal.MINUS_COMBAT,
        [],
        equips
      );
      manager.setupFreeRuns();
      manager.preAdventure();
      if (!manager.willFreeRun) moodAddItem();
      adventureRunOrStasis(location, manager.willFreeRun);

      state = getSewersState();
      print(`Opened ${state.grates} grates, turned ${state.valves} valves.`);
    }
  }

  if (throughSewers()) print("Cleared sewers!");
  else print("Stopping prematurely... not through sewers.");
}

export function main(args = "") {
  wrapMain(args, () => doSewers(stopAt(args)));
}
