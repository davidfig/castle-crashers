// Enemy sprite sheets built by tools/art.mjs (art/chars/goblin.mjs ... weapons.mjs), bundled as data URLs.
import goblinPng from '../../art/out/goblin.png';
import orcPng from '../../art/out/orc.png';
import mobarcherPng from '../../art/out/mobarcher.png';
import shieldbearerPng from '../../art/out/shieldbearer.png';
import bomberPng from '../../art/out/bomber.png';
import bossPng from '../../art/out/boss.png';
import wolfPng from '../../art/out/wolf.png';
import slingerPng from '../../art/out/slinger.png';
import shamanPng from '../../art/out/shaman.png';
import drummerPng from '../../art/out/drummer.png';
import trollPng from '../../art/out/troll.png';
import skeletonPng from '../../art/out/skeleton.png';
import bonearcherPng from '../../art/out/bonearcher.png';
import ghoulPng from '../../art/out/ghoul.png';
import wraithPng from '../../art/out/wraith.png';
import skullPng from '../../art/out/skull.png';
import bonebrutePng from '../../art/out/bonebrute.png';
import necromancerPng from '../../art/out/necromancer.png';
import bansheePng from '../../art/out/banshee.png';
import plaguezombiePng from '../../art/out/plaguezombie.png';
import lichPng from '../../art/out/lich.png';
import dreadknightPng from '../../art/out/dreadknight.png';
import trapperPng from '../../art/out/trapper.png';
import snowspritePng from '../../art/out/snowsprite.png';
import harpoonerPng from '../../art/out/harpooner.png';
import frostwolfPng from '../../art/out/frostwolf.png';
import ramPng from '../../art/out/ram.png';
import icehuskPng from '../../art/out/icehusk.png';
import yetiPng from '../../art/out/yeti.png';
import frostshamanPng from '../../art/out/frostshaman.png';
import blizzardwitchPng from '../../art/out/blizzardwitch.png';
import whiteoutspiritPng from '../../art/out/whiteoutspirit.png';
import tundraguardPng from '../../art/out/tundraguard.png';
import rimekingPng from '../../art/out/rimeking.png';
import dreadregentPng from '../../art/out/dreadregent.png';

/** Order matches MobType (see data/mobs.ts). */
const SHEETS = [
  goblinPng, orcPng, mobarcherPng, shieldbearerPng, bomberPng, bossPng, wolfPng, slingerPng, shamanPng, drummerPng, trollPng, skeletonPng, bonearcherPng, ghoulPng, wraithPng, skullPng, bonebrutePng, necromancerPng, bansheePng, plaguezombiePng, lichPng, dreadknightPng,
  trapperPng, snowspritePng, harpoonerPng, frostwolfPng, ramPng, icehuskPng, yetiPng, frostshamanPng, blizzardwitchPng, whiteoutspiritPng, tundraguardPng, rimekingPng, dreadregentPng,
];

export function loadMobImages(): Promise<HTMLImageElement[]> {
  return Promise.all(SHEETS.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load an enemy sprite sheet.'));
    img.src = src;
  })));
}
