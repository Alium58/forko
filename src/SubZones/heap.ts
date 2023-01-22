import {
  inebrietyLimit,
  lastChoice,
  lastMonster,
  myFamiliar,
  myInebriety,
  myTurncount,
  print,
  visitUrl,
} from "kolmafia";
import { $familiar, $location, $monster, $skill } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "../adventure";
import { adventureMacroAuto, adventureRunOrStasis, Macro } from "../combat";
import {
  clamp,
  everyTurnFunction,
  extractInt,
  getImageHeap,
  getPropertyInt,
  lastWasCombat,
  mustStop,
  printLines,
  setChoice,
  setPropertyInt,
  stopAt,
  wrapMain,
} from "../lib";
import { expectedTurns, moodMinusCombat } from "../mood";

class HeapState {
  defeated = 0;
  trashcanos = 0;
}
function getHeapState() {
  const result = new HeapState();
  const logText = visitUrl("clan_raidlogs.php");
  result.defeated = extractInt(/defeated +Stench hobo x ([0-9]+)/g, logText);
  result.trashcanos = extractInt(/started ([0-9]+) trashcano/g, logText);
  return result;
}

function estimateRemaining(heapState: HeapState) {
  return 500 - (heapState.defeated + heapState.trashcanos * 5);
}

const FREE_RUN_HEAP = true;
export function doHeap(stopTurncount: number) {
  if (getImageHeap() >= 10) {
    setPropertyInt("minehobo_heapNcsUntilCompost", 0);
    print("At Oscus. Heap complete!");
    return;
  }

  setChoice(203, 2); // Show Oscus in browser
  setChoice(214, 1); // Trashcano
  setChoice(218, 1); // I Refuse!
  setChoice(295, 1); // Take SR

  const tryFreeRun = FREE_RUN_HEAP && myInebriety() <= inebrietyLimit();

  let state = getHeapState();

  while (!mustStop(stopTurncount)) {
    printLines(
      `NCS until we compost: ${getPropertyInt("minehobo_heapNcsUntilCompost", 0)}`,
      `Image (approx): ${getImageHeap()}`
    );
    everyTurnFunction();

    setChoice(216, getPropertyInt("minehobo_heapNcsUntilCompost", 0) <= 0 ? 1 : 2);

    const estimatedTurns = estimateRemaining(state) / 1.9;
    moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
    const manager = new AdventuringManager(
      $location`The Heap`,
      PrimaryGoal.MINUS_COMBAT,
      [],
      usualDropItems
    );
    if (tryFreeRun) manager.setupFreeRuns();
    manager.preAdventure();
    const macro = Macro.externalIf(
      myFamiliar() === $familiar`Space Jellyfish`,
      Macro.while_(
        'hasskill CLEESH && hasskill Macrometeorite && hasskill Extract Jelly && !hpbelow 500 && !pastround 20 && monstername "stench hobo"',
        Macro.skill($skill`Extract Jelly`)
          .skill($skill`CLEESH`)
          .skill($skill`Macrometeorite`)
      ).toString()
    )
      .stasis()
      .kill();
    if (manager.willFreeRun) {
      adventureRunOrStasis($location`The Heap`, true);
    } else {
      adventureMacroAuto($location`The Heap`, macro);
    }

    if (lastWasCombat() && lastMonster() === $monster`stench hobo`) {
      state.defeated += 1;
    } else if (!lastWasCombat()) {
      if (lastChoice() === 216) {
        if (getPropertyInt("minehobo_heapNcsUntilCompost", 0) <= 0) {
          // We just composted.
          setPropertyInt("minehobo_heapNcsUntilCompost", 5);
        }
      } else if (lastChoice() === 203) {
        break;
      } else if ([214, 218].includes(lastChoice())) {
        // Some other choice adventure is filling the queue.
        setPropertyInt(
          "minehobo_heapNcsUntilCompost",
          getPropertyInt("minehobo_heapNcsUntilCompost", 0) - 1
        );
        if (lastChoice() === 214) state.trashcanos += 1;
      }
    }

    if (myTurncount() % 20 === 0) state = getHeapState();
  }

  if (getImageHeap.forceUpdate() === 10) {
    // Reset for next instance once we find Oscus.
    setPropertyInt("minehobo_heapNcsUntilCompost", 0);
    print("At Oscus. Heap complete!");
  }
}

export function main(args: string) {
  wrapMain(args, () => doHeap(stopAt(args)));
}
