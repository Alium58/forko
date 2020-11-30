import { visitUrl, print, lastChoice } from 'kolmafia';
import { $location } from 'libram/src';
import { adventureMacro, Macro } from './combat';
import {
  setChoice,
  mustStop,
  getPropertyInt,
  lastWasCombat,
  setPropertyInt,
  stopAt,
  extractInt,
  getImageAhbg,
  wrapMain,
  maximizeCached,
  preAdventure,
  usualDropItems,
} from './lib';
import { expectedTurns, moodBaseline, moodMinusCombat } from './mood';

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

  const logText = visitUrl('clan_raidlogs.php');
  result.watched = extractInt(/watched some zombie hobos dance \(([0-9]+) turn/g, logText);
  result.dances = extractInt(/busted (a|[0-9]+) move/g, logText);
  result.kills = extractInt(/defeated +Spooky hobo x ([0-9]+)/g, logText);
  result.flimflams = extractInt(/flimflammed some hobos \(([0-9]+) turn/g, logText);
  return result;
}

export function doAhbg(stopTurncount: number) {
  let state = getAhbgState();
  if (state.image < 10 && !mustStop(stopTurncount)) {
    setChoice(204, 2); // Run from Zombo.
    setChoice(208, 2); // Skip tomb + flowers
    setChoice(220, 2); // Skip flowers.
    setChoice(221, 1); // Study the dance moves.
    setChoice(222, 1); // Dance.
    setChoice(293, 2); // Skip SR.

    Macro.stasis().kill().setAutoAttack();
  }

  while (state.image < 10 && !mustStop(stopTurncount)) {
    let maximizeGoal = '-combat';
    if (state.watched + state.dances < 5 * state.flimflams && state.dances < 21) {
      if (state.image * 2 > state.watched + state.dances) {
        moodMinusCombat(expectedTurns(stopTurncount), 100);
      } else {
        moodMinusCombat(expectedTurns(stopTurncount), 25);
      }
      setChoice(222, 1);
    } else {
      moodBaseline(expectedTurns(stopTurncount));
      maximizeGoal = 'familiar weight';
      setChoice(222, 2);
    }
    setChoice(208, getPropertyInt('minehobo_ahbgNcsUntilFlowers', 0) <= 0 ? 1 : 2);

    maximizeCached([maximizeGoal], usualDropItems);
    preAdventure($location`The Ancient Hobo Burial Ground`);
    maximizeCached([maximizeGoal], usualDropItems);
    adventureMacro($location`The Ancient Hobo Burial Ground`, Macro.abort());

    if (!lastWasCombat()) {
      if (lastChoice() === 208) {
        if (getPropertyInt('minehobo_ahbgNcsUntilFlowers', 0) <= 0) {
          setPropertyInt('minehobo_ahbgNcsUntilFlowers', 5);
        }
      } else if (lastChoice() === 204) {
        // Zombo!
        break;
      } else if (lastChoice() !== 220) {
        setPropertyInt('minehobo_ahbgNcsUntilFlowers', getPropertyInt('minehobo_ahbgNcsUntilFlowers', 0) - 1);
      }
    }

    state = getAhbgState();
    print(`Image: ${state.image}`);
    print(`Flimflams: ${state.flimflams}`);
    print(`Chillier Night: ${state.watched + state.dances}`);
    print(`My dances: ${state.dances}`);
    print(`Until flowers: ${getPropertyInt('minehobo_ahbgNcsUntilFlowers')}`);
  }

  if (getImageAhbg(0)) {
    setPropertyInt('minehobo_ahbgNcsUntilFlowers', 0);
    print('At Zombo. AHBG complete!');
  }
}

export function main(args: string) {
  wrapMain(() => doAhbg(stopAt(args)));
}