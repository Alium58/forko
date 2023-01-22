import { lastChoice, print, setAutoAttack, visitUrl } from "kolmafia";
import { $location } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "../adventure";
import { adventureMacroAuto, adventureRunOrStasis, Macro } from "../combat";
import { getState as getEeState } from "./ee";
import {
  everyTurnFunction,
  extractInt,
  getImagePld,
  lastWasCombat,
  mustStop,
  printLines,
  setChoice,
  stopAt,
  wrapMain,
} from "../lib";
import { expectedTurns, moodPlusCombat } from "../mood";

const FREE_RUN_PLD = true;

class PLDState {
  fights = 0;
  flimflams = 0;
  kills = 0;
}

function getPldState() {
  const result = new PLDState();
  const logText = visitUrl("clan_raidlogs.php");
  result.fights = extractInt(/started (a|[0-9]+) barfight/g, logText);
  result.flimflams = extractInt(/flimflammed some hobos \(([0-9]+) turn/g, logText);
  result.kills = extractInt(/defeated +Sleaze hobo x ([0-9]+)/g, logText);
  return result;
}

export function doPld(stopTurncount: number) {
  if (getImagePld() === 10) {
    print("At Chester.");
    return;
  }

  setChoice(205, 2); // Leave Chester.
  setChoice(219, 1); // We shouldn't encounter Furtivity.
  setChoice(223, 1); // Get into the club.
  setChoice(294, 1); // Take SR

  setAutoAttack(0);

  let state = getPldState();
  const diverts = getEeState().diverts;
  while (!mustStop(stopTurncount)) {
    everyTurnFunction();
    const maxFights = FREE_RUN_PLD ? 34 : 25;
    const tryFreeRun = state.fights < maxFights;
    setChoice(223, diverts + state.flimflams < 21 || getImagePld() >= 9 ? 3 : 1);
    setChoice(224, tryFreeRun ? 2 : 1);

    const turnsEstimate = Math.max(0, maxFights - state.fights) + Math.max(0, 18 - state.kills);
    const location = $location`The Purple Light District`;
    moodPlusCombat(expectedTurns(stopTurncount), turnsEstimate);
    const manager = new AdventuringManager(
      $location`The Purple Light District`,
      PrimaryGoal.PLUS_COMBAT,
      [],
      usualDropItems
    );
    if (tryFreeRun) manager.setupFreeRuns();
    manager.preAdventure();
    if (manager.willFreeRun) {
      adventureRunOrStasis(location, true);
    } else {
      adventureMacroAuto(location, Macro.stasis().kill());
    }

    state = getPldState();
    printLines(
      `Diverts: ${diverts}`,
      `Flimflams: ${state.flimflams}`,
      `Fights: ${state.fights}`,
      `Image (approx): ${getImagePld()}`
    );

    if (!lastWasCombat() && lastChoice() === 205) {
      break;
    }
  }

  if (getImagePld.forceUpdate() >= 10) {
    print("At Chester.");
  }
}

export function main(args: string) {
  wrapMain(args, () => doPld(stopAt(args)));
}
