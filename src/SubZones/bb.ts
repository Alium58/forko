import { floor, print, visitUrl } from "kolmafia";
import { $location } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "../adventure";
import { adventureMacroAuto, Macro } from "../combat";
import {
  everyTurnFunction,
  extractInt,
  getImageBb,
  mustStop,
  printLines,
  setChoice,
  stopAt,
  wrapMain,
} from "../lib";
import { expectedTurns, moodMinusCombat, tryEnsureTriviaMaster } from "../mood";

const STACKHEIGHT = 34;
function tirevalancheKills(tires: number) {
  return floor(tires * tires * 0.1 + tires * 0.7);
}

class BBState {
  image = 0;
  estimatedProgress = 0;
  tirevalanches = 0;
  tiresCurrent = 0; // Current tires thrown gently.
  tiresTotal = 0; // Total tires thrown gently.
}

export function getBbState() {
  const state = new BBState();
  state.image = getImageBb();

  const logText = visitUrl("clan_raidlogs.php");
  state.estimatedProgress = extractInt(/defeated +Hot hobo x ([0-9]+)/g, logText);
  state.tirevalanches = extractInt(/started (a|[0-9]+) tirevalanche/g, logText);
  state.tiresTotal = extractInt(/threw ([0-9]+) tire/g, logText);
  state.tiresCurrent = state.tiresTotal - STACKHEIGHT * state.tirevalanches;
  state.estimatedProgress += tirevalancheKills(STACKHEIGHT) * state.tirevalanches;
  if (
    state.estimatedProgress < state.image * 50 ||
    state.estimatedProgress > (state.image + 1) * 50
  ) {
    print("WARNING: State misaligned.");
    state.estimatedProgress = state.image * 50;
  }
  return state;
}

export function doBb(stopTurncount: number) {
  if (getImageBb() >= 10) {
    print("Finished BB.");
    return;
  }

  setChoice(201, 0); // Show Ol' Scratch in browser
  setChoice(206, 2); // Put tire on gently
  setChoice(207, 2); // Skip door
  setChoice(213, 2); // Skip piping hot
  setChoice(291, 1); // Take SR

  let state = getBbState();
  while (state.image < 10 && !mustStop(stopTurncount)) {
    everyTurnFunction();
    let maxPricePerTurn = 100;
    let estimatedTurns = Math.max(2.1 * (100 - state.tiresTotal), 1);
    if (state.tiresCurrent >= 25 && state.estimatedProgress < 475) {
      maxPricePerTurn = 200;
      estimatedTurns = 10;
    }

    if (state.estimatedProgress > 475 && state.tiresCurrent < 10) {
      setChoice(206, 3); // Don't bother stacking.
    } else if (
      state.tiresCurrent >= STACKHEIGHT ||
      state.estimatedProgress + tirevalancheKills(state.tiresCurrent) > 505
    ) {
      setChoice(206, 1); // Start tirevalanche.
    } else {
      setChoice(206, 2); // Stack normally.
    }

    moodMinusCombat(expectedTurns(stopTurncount), estimatedTurns, maxPricePerTurn);
    tryEnsureTriviaMaster(estimatedTurns);
    const manager = new AdventuringManager(
      $location`Burnbarrel Blvd.`,
      PrimaryGoal.MINUS_COMBAT,
      [],
      usualDropItems
    );
    manager.preAdventure();
    adventureMacroAuto($location`Burnbarrel Blvd.`, Macro.stasis().kill());

    state = getBbState();
    printLines(
      `Image: ${state.image}`,
      `Tires: ${state.tiresCurrent} current, ${state.tiresTotal} total.`,
      `Estimated progress: ${state.estimatedProgress}`
    );
  }
  if (getImageBb() >= 10) {
    print("Finished BB.");
  }
}

export function main(args: string) {
  wrapMain(args, () => doBb(stopAt(args)));
}
