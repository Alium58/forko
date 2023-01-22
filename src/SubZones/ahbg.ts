import { lastChoice, print, visitUrl } from "kolmafia";
import { $location } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "../adventure";
import { adventureMacroAuto, Macro } from "../combat";
import {
  everyTurnFunction,
  extractInt,
  getImageAhbg,
  getPropertyInt,
  lastWasCombat,
  mustStop,
  printLines,
  setChoice,
  setPropertyInt,
  stopAt,
  wrapMain,
} from "../lib";
import { expectedTurns, moodBaseline, moodMinusCombat } from "../mood";

class AHBGState {
  image = 0;
  watched = 0;
  dances = 0;
  kills = 0;
  flimflams = 0;
}

function getAhbgState() {
  const result = new AHBGState();
  result.image = getImageAhbg();

  const logText = visitUrl("clan_raidlogs.php");
  result.watched = extractInt(/watched some zombie hobos dance \(([0-9]+) turn/g, logText);
  result.dances = extractInt(/busted (a|[0-9]+) move/g, logText);
  result.kills = extractInt(/defeated +Spooky hobo x ([0-9]+)/g, logText);
  result.flimflams = extractInt(/flimflammed some hobos \(([0-9]+) turn/g, logText);
  return result;
}

export function doAhbg(stopTurncount: number) {
  const state = getAhbgState();
  if (state.image < 10 && !mustStop(stopTurncount)) {
    setChoice(204, 2); // Run from Zombo.
    setChoice(208, 2); // Skip tomb + flowers
    setChoice(220, 2); // Skip flowers.
    setChoice(221, 1); // Study the dance moves.
    setChoice(222, 1); // Dance.
    setChoice(293, 2); // Skip SR.
  }

  while (state.image < 10 && !mustStop(stopTurncount)) {
    everyTurnFunction();
    let primaryGoal = PrimaryGoal.MINUS_COMBAT;
    let auxiliaryGoals: string[] = [];
    if (state.watched + state.dances < 5 * state.flimflams && state.dances < 21) {
      if (state.image * 2 > state.watched + state.dances) {
        moodMinusCombat(expectedTurns(stopTurncount), 100);
      } else {
        moodMinusCombat(expectedTurns(stopTurncount), 25);
      }
      setChoice(222, 1);
      setChoice(208, getPropertyInt("minehobo_ahbgNcsUntilFlowers", 0) <= 0 ? 1 : 2);
    } else {
      moodBaseline(expectedTurns(stopTurncount));
      primaryGoal = PrimaryGoal.NONE;
      auxiliaryGoals = ["familiar weight"];
      setChoice(222, 2);
      setChoice(208, 2);
    }

    const manager = new AdventuringManager(
      $location`The Ancient Hobo Burial Ground`,
      primaryGoal,
      auxiliaryGoals,
      usualDropItems
    );
    manager.preAdventure();
    adventureMacroAuto($location`The Ancient Hobo Burial Ground`, Macro.stasis().kill());

    if (!lastWasCombat()) {
      if (lastChoice() === 208) {
        if (getPropertyInt("minehobo_ahbgNcsUntilFlowers", 0) <= 0) {
          setPropertyInt("minehobo_ahbgNcsUntilFlowers", 5);
        }
      } else if (lastChoice() === 204) {
        // Zombo!
        break;
      } else if (lastChoice() !== 220) {
        setPropertyInt(
          "minehobo_ahbgNcsUntilFlowers",
          getPropertyInt("minehobo_ahbgNcsUntilFlowers", 0) - 1
        );
      } else if (lastChoice() === 221) {
        state.watched += 1;
      } else if (lastChoice() === 222) {
        state.dances += 1;
      }
    }

    state.image = getImageAhbg();
    printLines(
      `Image: ${state.image}`,
      `Flimflams: ${state.flimflams}`,
      `Chillier Night: ${state.watched + state.dances}`,
      `My dances: ${state.dances}`,
      `Until flowers: ${getPropertyInt("minehobo_ahbgNcsUntilFlowers")}`
    );
  }

  if (getImageAhbg.forceUpdate() === 10) {
    setPropertyInt("minehobo_ahbgNcsUntilFlowers", 0);
    print("At Zombo. AHBG complete!");
  }
}

export function main(args: string) {
  wrapMain(args, () => doAhbg(stopAt(args)));
}
