import { getClanName, print } from "kolmafia";
import { $location } from "libram";
import { AdventuringManager, PrimaryGoal } from "./adventure";
import { adventureRunOrStasis } from "./combat";
import { everyTurnFunction, setChoice, wrapMain } from "./lib";
import { moodAddItem, moodMinusCombat } from "./mood";
import { getSewersState, sewerAccess, throughSewers } from "./sewers";
import { setClan } from "./wl";

export function main(args: string | undefined) {
  if (args !== undefined) setClan(args);
  if (!throughSewers() && !sewerAccess())
    throw `You do not have dungeon access in clan ${getClanName()}.`;

  wrapMain(args, () => {
    setChoice(197, 2); // Turn valve - skip
    setChoice(198, 2); // Open grate - skip
    setChoice(199, 2); // Ladder - free BK

    let state = getSewersState();
    while (state.grates < 20 || state.valves < 20) {
      everyTurnFunction();
      if (state.valves < 20) setChoice(197, 3); // Open valves.
      if (state.grates < 20) setChoice(198, 3); // Open grates.

      moodMinusCombat(10, 10);
      const manager = new AdventuringManager(
        $location`A Maze of Sewer Tunnels`,
        PrimaryGoal.MINUS_COMBAT,
        [],
        []
      );
      manager.setupFreeRuns();
      manager.preAdventure();
      if (!manager.willFreeRun) moodAddItem();
      adventureRunOrStasis($location`A Maze of Sewer Tunnels`, manager.willFreeRun);

      state = getSewersState();
      print(`Opened ${state.grates} grates, turned ${state.valves} valves.`);
    }

    if (state.grates === 20 && state.valves === 20) {
      print("Successfully finished sewers.", "green");
    } else {
      throw "Something went wrong. Sewering failed.";
    }
  });
}
