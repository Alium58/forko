import { floor, visitUrl, print, myTurncount } from 'kolmafia';
import { $location } from 'libram/src';
import { adventureMacro, Macro } from './combat';
import {
  getImage,
  setChoice,
  mustStop,
  stopAt,
  extractInt,
  maximizeCached,
  preAdventure,
  usualDropItems,
  wrapMain,
} from './lib';
import { moodNoncombat } from './mood';

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
  state.image = getImage($location`Burnbarrel Blvd.`);

  const logText = visitUrl('clan_raidlogs.php');
  state.estimatedProgress = extractInt(/defeated +Hot hobo x ([0-9]+)/, logText);
  state.tirevalanches = extractInt(/started (a|[0-9]+) tirevalanche/, logText);
  state.tiresTotal = extractInt(/threw ([0-9]+) tire/, logText);
  state.tiresCurrent = state.tiresTotal - STACKHEIGHT * state.tirevalanches;
  state.estimatedProgress += tirevalancheKills(STACKHEIGHT) * state.tirevalanches;
  if (state.estimatedProgress < state.image * 50 || state.estimatedProgress > (state.image + 1) * 50) {
    print('WARNING: State misaligned.');
    state.estimatedProgress = state.image * 50;
  }
  return state;
}

function doBb(stopTurncount: number) {
  if (getImage($location`Burnbarrel Blvd.`) >= 10) {
    print('Finished BB.');
    return;
  }

  setChoice(201, 0); // Show Ol' Scratch in browser
  setChoice(206, 2); // Put tire on gently
  setChoice(207, 2); // Skip door
  setChoice(213, 2); // Skip piping hot
  setChoice(291, 1); // Take SR

  Macro.stasis().kill().setAutoAttack();

  let state = getBbState();
  while (state.image < 10 && !mustStop(stopTurncount)) {
    let maxPricePerTurn = 100;
    if (state.tiresCurrent >= 25 && state.estimatedProgress < 475) {
      maxPricePerTurn = 200;
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

    moodNoncombat(stopTurncount - myTurncount(), Math.max(2.1 * (100 - state.tiresTotal), 1), maxPricePerTurn);
    maximizeCached(['-combat'], usualDropItems);
    preAdventure($location`Burnbarrel Blvd.`, false, false);
    maximizeCached(['-combat'], usualDropItems);
    adventureMacro($location`Burnbarrel Blvd.`, Macro.abort());

    state = getBbState();
    print(`Image: ${state.image}`);
    print(`Tires: ${state.tiresCurrent} current, ${state.tiresTotal} total.`);
    print(`Estimated progress: ${state.estimatedProgress}`);
  }
  if (getImage($location`Burnbarrel Blvd.`) >= 10) {
    print('Finished BB.');
  }
}

export function main(args: string) {
  wrapMain(() => doBb(stopAt(args)));
}
