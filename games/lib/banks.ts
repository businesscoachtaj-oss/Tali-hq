// A year (and more) of Four by Four and Trail (25 Nov 2026). Puzzles are built each day from these banks,
// seeded by the date and level, so everyone gets the same one and no two days repeat for a long time.
// Four by Four: tier 1 is plain, tier 2 needs a second look, tier 3 is wordplay. Family stops two
// categories that blur into each other turning up on the same day.
import { todayRng, shuffled, localDate } from './daily';
import type { Level } from './store';

const CATS = `1|animal|Australian animals|KOALA,WOMBAT,EMU,DINGO,QUOKKA,ECHIDNA,POSSUM
1|bird|Australian birds|GALAH,MAGPIE,KOOKABURRA,LORIKEET,CURRAWONG,BROLGA
1|sea|Sea creatures|OCTOPUS,SHARK,STINGRAY,SQUID,DOLPHIN,SEAHORSE
1|farm|On the farm|COW,SHEEP,GOAT,HORSE,PIG,ALPACA
1|insect|Insects|ANT,BEETLE,WASP,MOTH,CICADA,TERMITE
1|fruit|Fruit|MANGO,PEAR,PLUM,LYCHEE,PAPAYA,KIWI
1|veg|Vegetables|CARROT,LEEK,TURNIP,PARSNIP,CELERY,PUMPKIN
1|herb|Herbs|BASIL,MINT,THYME,SAGE,DILL,OREGANO
1|pasta|Pasta|PENNE,FUSILLI,ORZO,RIGATONI,FARFALLE,LASAGNE
1|bread|Breads|SOURDOUGH,BAGEL,NAAN,PITA,BRIOCHE,DAMPER
1|cheese|Cheeses|BRIE,FETA,CHEDDAR,GOUDA,HALLOUMI,PARMESAN
1|coffee|Coffee orders|LATTE,MOCHA,CORTADO,ESPRESSO,MACCHIATO,AFFOGATO
1|dessert|Desserts|PAVLOVA,TIRAMISU,TRIFLE,LAMINGTON,CRUMBLE,CHEESECAKE
1|colour|Shades of blue|NAVY,TEAL,COBALT,AZURE,CYAN,INDIGO
1|colourR|Shades of red|CRIMSON,SCARLET,RUBY,MAROON,CHERRY,BURGUNDY
1|planet|Planets|MARS,VENUS,MERCURY,NEPTUNE,SATURN,JUPITER
1|weather|Weather|HAIL,SLEET,DRIZZLE,FOG,THUNDER,MIST
1|tree|Australian trees|GUM,WATTLE,JACARANDA,BANKSIA,MALLEE,IRONBARK
1|flower|Flowers|ROSE,TULIP,DAISY,ORCHID,LILY,PEONY
1|city|Australian capitals|SYDNEY,PERTH,HOBART,DARWIN,ADELAIDE,BRISBANE
1|river|Rivers|MURRAY,NILE,THAMES,AMAZON,DANUBE,YANGTZE
1|country|Countries in Asia|JAPAN,NEPAL,LAOS,INDIA,VIETNAM,MONGOLIA
1|instrument|Instruments|HARP,OBOE,TUBA,CELLO,BANJO,VIOLIN
1|sport|Sports with a net|TENNIS,NETBALL,VOLLEYBALL,BADMINTON,SQUASH,PICKLEBALL
1|cricket|Cricket words|WICKET,OVER,BAILS,CREASE,STUMPS,INNINGS
1|footy|Footy words|BEHIND,GOAL,MARK,TACKLE,SCRUM,TRY
1|chess|Chess pieces|ROOK,BISHOP,PAWN,KNIGHT,KING,QUEEN
1|cards|In a deck of cards|ACE,JACK,JOKER,CLUB,SPADE,HEART
1|kitchen|Kitchen tools|WHISK,LADLE,GRATER,TONGS,SPATULA,COLANDER
1|tool|Tools in the shed|HAMMER,SPANNER,CHISEL,DRILL,SAW,PLIERS
1|car|Parts of a car|BOOT,BONNET,BUMPER,WHEEL,AXLE,CLUTCH
1|body|Bones|FEMUR,TIBIA,ULNA,SKULL,RIB,PELVIS
1|shape|Shapes|CIRCLE,SQUARE,OVAL,TRIANGLE,HEXAGON,RHOMBUS
1|dog|Dog breeds|KELPIE,BEAGLE,POODLE,BOXER,DACHSHUND,LABRADOR
1|clothes|Things you wear on your feet|THONGS,BOOTS,SANDALS,SNEAKERS,SLIPPERS,CLOGS
1|hat|Hats|BEANIE,BERET,FEDORA,AKUBRA,BOWLER,SOMBRERO
1|beach|At the beach|TOWEL,SAND,WAVE,SHELL,RIP,DUNE
1|camp|Camping gear|TENT,TORCH,ESKY,SWAG,BILLY,LANTERN
1|room|Rooms in a house|KITCHEN,LAUNDRY,STUDY,ATTIC,CELLAR,LOUNGE
1|egg|Ways to cook an egg|POACH,FRY,BOIL,SCRAMBLE,CODDLE,BAKE
1|greek|Greek gods|ZEUS,HERA,APOLLO,ATHENA,HERMES,ARES
1|thinker|Philosophers|PLATO,HUME,KANT,LOCKE,SENECA,CONFUCIUS
1|dance|Dances|WALTZ,TANGO,SALSA,FOXTROT,RUMBA,POLKA
1|stone|Gemstones|OPAL,RUBY,EMERALD,SAPPHIRE,TOPAZ,GARNET
1|metal|Metals|COPPER,TIN,ZINC,IRON,NICKEL,COBALT
1|sleep|Words for sleep|NAP,DOZE,KIP,SNOOZE,SLUMBER,SIESTA
1|hello|Ways to say hello|GDAY,HIYA,HOWDY,HEY,AHOY,HELLO
1|money|Money words|CASH,COINS,NOTES,CHANGE,SAVINGS,WAGES
1|transport|Ways to get around|TRAM,FERRY,BUS,TRAIN,SCOOTER,BIKE
1|game|Board games|LUDO,CLUEDO,MONOPOLY,SCRABBLE,DRAUGHTS,GO
2|keys|Things with keys|PIANO,MAP,LOCK,KEYBOARD,CODE,SONG
2|run|Things that run|NOSE,TAP,ENGINE,STOCKING,MASCARA,CANDIDATE
2|rings|Things with rings|ONION,TREE,CIRCUS,BELL,SATURN,PHONE
2|shell|Things with shells|TURTLE,SNAIL,TACO,WALNUT,OYSTER,EGG
2|wings|Things with wings|PLANE,BEE,ANGEL,HOSPITAL,STAGE,BUTTERFLY
2|crack|Things you can crack|JOKE,CODE,SMILE,KNUCKLES,WHIP,SAFE
2|tick|Things that tick|CLOCK,WATCH,BOX,METRONOME,TIMER,CLOCKWORK
2|pitch|Things with a pitch|SONG,TENT,CRICKET,SALES,ROOF,VOICE
2|bank|Things with banks|RIVER,BLOOD,MEMORY,FOG,CLOUD,SNOW
2|bark|Things that bark|DOG,TREE,SEAL,FOX,COUGH,SERGEANT
2|legs|Things with legs|TABLE,CHAIR,STOOL,JOURNEY,RACE,ARGUMENT
2|teeth|Things with teeth|COMB,SAW,ZIP,GEAR,COG,SHARK
2|eyes|Things with eyes|NEEDLE,POTATO,STORM,HURRICANE,PEACOCK,HOOK
2|faces|Things with faces|CLOCK,CLIFF,COIN,DICE,WATCH,MOUNTAIN
2|wallet|Things in a wallet|CASH,CARD,RECEIPT,LICENCE,PHOTO,COUPON
2|pockets|Things with pockets|JEANS,POOL,SNOOKER,KANGAROO,APRON,AIR
2|drink|Things you can drink to|HEALTH,SUCCESS,FRIENDS,LIFE,LOVE,VICTORY
2|space|Things in space|COMET,NEBULA,QUASAR,PULSAR,ASTEROID,METEOR
2|fold|Things you fold|NAPKIN,MAP,LAUNDRY,POKER,ORIGAMI,ARMS
2|hold|Things you can hold|BREATH,GRUDGE,HANDS,TUNE,FORT,HORSES
2|catch|Things you can catch|COLD,BUS,BALL,FISH,BREATH,WAVE
2|break|Things you can break|RECORD,NEWS,ICE,PROMISE,BREAD,SILENCE
2|keep|Things you keep|PROMISE,SECRET,SCORE,TIME,QUIET,DIARY
2|draw|Things you draw|CURTAINS,BATH,BREATH,CONCLUSION,LINE,RAFFLE
2|throw|Things you throw|PARTY,TANTRUM,PUNCH,DART,SHADE,DICE
3|fish|___FISH|JELLY,CAT,STAR,SWORD,GOLD,MONK
3|board|___BOARD|SURF,KEY,CHESS,BILL,CUP,DASH
3|ball|___BALL|FOOT,NET,SNOW,MEAT,EYE,BASKET
3|fire|FIRE___|PLACE,WORK,FLY,MAN,WOOD,ALARM
3|sun|SUN___|FLOWER,DIAL,RISE,BURN,GLASSES,SHINE
3|moon|MOON___|LIGHT,WALK,BEAM,SHINE,STONE,STRUCK
3|snow|SNOW___|FLAKE,MAN,BOARD,DRIFT,STORM,CONE
3|wise|WISE___|CRACK,GUY,OWL,MAN,ACRE,TOOTH
3|bow|___BOW|RAIN,ELBOW,CROSS,LONG,OXBOW,SHOW
3|bank|BANK___|NOTE,HOLIDAY,ROBBER,ACCOUNT,RUPT,BALANCE
3|house|___HOUSE|LIGHT,GREEN,TREE,WARE,DOG,FARM
3|book|___BOOK|NOTE,COOK,FACE,SCRAP,PASS,HAND
3|bee|Rhymes with bee|TEA,SEA,FREE,KEY,TREE,PEA
3|cat|Rhymes with cat|HAT,MAT,BAT,FLAT,SPAT,GNAT
3|bodyHide|Hidden body parts|ARMY,HEAR,LEGEND,SHIPMENT,CHINA,SHINY
3|animalHide|Hidden animals|CATALOG,PIGEON,DOGMA,SCOWL,BEARD,CRATE
3|numberHide|Hidden numbers|TONE,OFTEN,WEIGHT,CANINE,FREIGHT,STONE
3|palin|Read the same backwards|RACECAR,LEVEL,KAYAK,RADAR,CIVIC,REFER
3|homoph|Sound like letters|SEA,TEA,PEA,BEE,EYE,WHY
3|ace|Words that can follow PRIME|TIME,MINISTER,NUMBER,SUSPECT,MOVER,RIB
3|green|Words that follow GREEN|HOUSE,BELT,LIGHT,ROOM,GROCER,THUMB
3|black|Words that follow BLACK|BOARD,BIRD,SMITH,OUT,MAIL,JACK
3|water|Words that follow WATER|FALL,MELON,PROOF,COLOUR,FRONT,SLIDE
3|head|Words that follow HEAD|LIGHT,LINE,BAND,START,PHONES,MASTER
3|star|Words that follow STAR|FISH,DUST,LIGHT,BOARD,GAZER,STRUCK
3|apple|Kinds of apple|GRANNY,PINK,FUJI,GALA,BRAEBURN,JAZZ`;

type Cat = { tier: number; fam: string; name: string; words: string[] };
const BANK: Cat[] = CATS.split('\n').map(l => { const [t, fam, name, w] = l.split('|'); return { tier: Number(t), fam, name, words: w.split(',') }; });
const memberOf: Record<string, Set<number>> = {};
BANK.forEach((c, i) => c.words.forEach(w => (memberOf[w] ??= new Set()).add(i)));

// Words that also fit a category without being in its list: the wordplay ones worked out from the SCOWL
// dictionary (compound words, hidden words, rhymes), the rest by hand. Without this, PHONES could fit both
// "Hidden numbers" and "Words that follow HEAD" on the same board (found 25 Nov 2026).
const ALSO = `___FISH|ANGEL,DOG,FLAT,SHELL
___BOARD|BREAD,CARD,DART,OUT,OVER,SCORE,SEA,SNOW,STAR
___BALL|GUM,HAND,MOTH
FIRE___|ARMS,BALL,BOX,HOUSE,LIGHT,PROOF,STORM
SUN___|BAKE,BATH,BEAM,BELT,BONNET,FISH,HAT,LIGHT,ROOF,SHADE,SHINY
SNOW___|BALL,BIRD,FALL,LINE
BANK___|CARD,NOTES
___HOUSE|BATH,BIRD,CLUB,COOK,LONG,OUT,WHEEL,WORK
___BOOK|CASH,NET,OVER,SONG,WORK
Words that follow GREEN|FLY,MAIL,WOOD
Words that follow BLACK|BALL,FACE
Words that follow WATER|BIRD,BOARD,LILY,LINE,MARK,WHEEL
Words that follow HEAD|BOARD,GEAR,LOCK,LONG,MAN,PHONE,ROOM,STONE
Hidden numbers|CONE,PHONE,PHONES,TENNIS,TENT
Hidden body parts|ALARM,ARGUMENT,ARMS,BEARD,FARM,GEAR,HANDS,HEART,PARMESAN,PEAR,SHINE,SLIPPERS,SNAIL,TULIP,WHEEL,WHIP
Hidden animals|ATHENA,BATH,BEETLE,BOWLER,BUTTERFLY,CODDLE,CODE,FEMUR,FOXTROT,GLASSES,GRATER,KANT,KAYAK,KITCHEN,LANTERN,PASS,SCRABBLE,SCRAMBLE,SERGEANT,TANTRUM,TIRAMISU,TRAM,WHEEL,WOMBAT
Read the same backwards|EYE,NAAN
Rhymes with cat|CAT,GOAT,MEAT,WOMBAT
Rhymes with bee|BEE,HEY,JOURNEY,LYCHEE,MALLEE,SYDNEY
Australian animals|KANGAROO,SEAL,TURTLE
Insects|BEE,BUTTERFLY,FLY,GNAT
Fruit|CHERRY,MELON
Vegetables|ONION,POTATO,SQUASH
Desserts|AFFOGATO,JELLY
Weather|CLOUD,ICE,RAIN,SNOW,STORM
Flowers|BANKSIA,JACARANDA,WATTLE
Countries in Asia|CHINA
Cricket words|BALL,BAT,BOWLER
Footy words|BALL
Parts of a car|ENGINE
Things you wear on your feet|BOOT
Camping gear|DAMPER
Dances|JAZZ
Metals|GOLD,MERCURY
Money words|BILL,COIN,NOTE
Ways to get around|PLANE
Board games|CHESS
Instruments|BELL,KEYBOARD,PIANO,TRIANGLE
Shapes|CROSS,HEART,STAR
In a deck of cards|KING,QUEEN
Sea creatures|FISH,OYSTER,SEAL,TURTLE
On the farm|DOG
Things that run|RIVER
Things with rings|PHONES
Things you can crack|EGG,ICE,WALNUT
Things you fold|TOWEL
Things you can hold|HAND
Things you can catch|FERRY,PLANE,TRAIN,TRAM
Things you can break|CODE,EGG,HEART,WAVE
Things you draw|BLOOD,CARD,SWORD
Things you throw|BALL
Things in space|STAR
Things in a wallet|COIN,COINS,NOTE,NOTES`;
// Families that blur into each other, so they never share a board (dogs bark, trees have bark, and so on).
const CLASH = 'animal:bird,sea,dog bird:wings legs:animal,bird,farm,insect,dog,sea eyes:animal,bird,sea,farm,insect,dog teeth:animal,sea,farm,dog wings:insect bark:dog,tree shell:sea crack:shell space:planet wallet:money catch:transport pitch:cricket keys:instrument faces:cards fold:cards draw:cards chess:cards tree:flower bank:weather snow:weather stone:colour,colourR metal:planet fruit:colourR coffee:dessert bread:camp car:clothes hat:cricket';
const clash = new Set<string>();
CLASH.split(' ').forEach(e => { const [a, bs] = e.split(':'); bs.split(',').forEach(b => { clash.add(a + '|' + b); clash.add(b + '|' + a); }); });
ALSO.split('\n').forEach(l => { const [name, w] = l.split('|'); const i = BANK.findIndex(c => c.name === name); w.split(',').forEach(x => (memberOf[x] ??= new Set()).add(i)); });

/** How many ways the 16 words split into the board's groups (stops counting at 2). */
function solutions(groups: { i: number; words: string[] }[]) {
  const words = groups.flatMap(g => g.words);
  const fits = words.map(w => groups.map((g, gi) => (memberOf[w]?.has(g.i) ? gi : -1)).filter(gi => gi >= 0));
  const left = groups.map(() => 4); let n = 0;
  const go = (k: number) => {
    if (n > 1) return;
    if (k === words.length) { n++; return; }
    for (const gi of fits[k]) if (left[gi] > 0) { left[gi]--; go(k + 1); left[gi]++; }
  };
  go(0); return n;
}

export type FourSet = { name: string; words: string[] }[];
const FOUR_TIERS: Record<Level, number[]> = { easy: [1, 1, 1], medium: [1, 1, 2, 3], hard: [2, 2, 3, 3] };
/** Today's Four by Four for a level. Groups go from easiest to trickiest. */
export function makeFour(level: Level, date = localDate()): FourSet {
  const r = todayRng(level === 'easy' ? 61 : level === 'medium' ? 62 : 63, date);
  for (let tries = 0; tries < 400; tries++) {
    const picked: number[] = [];
    for (const tier of FOUR_TIERS[level]) {
      const options = shuffled(BANK.map((c, i) => i).filter(i => BANK[i].tier === tier && !picked.includes(i)), r);
      const ok = options.find(i => !picked.some(j => BANK[j].fam === BANK[i].fam || clash.has(BANK[j].fam + '|' + BANK[i].fam)));
      if (ok === undefined) break; picked.push(ok);
    }
    if (picked.length !== FOUR_TIERS[level].length) continue;
    const groups = picked.map(i => ({ i, words: shuffled(BANK[i].words, r).slice(0, 4) }));
    const all = groups.flatMap(g => g.words);
    if (new Set(all).size !== all.length) continue;
    // Easy: no word on the board may also fit another group. Medium and Hard may have a red herring,
    // but there is only ever one way to sort the board.
    if (level === 'easy' && groups.some(g => g.words.some(w => [...memberOf[w]].some(k => k !== g.i && picked.includes(k))))) continue;
    if (solutions(groups) !== 1) continue;
    return groups.map(g => ({ name: BANK[g.i].name, words: g.words }));
  }
  return BANK.slice(0, 4).map(c => ({ name: c.name, words: c.words.slice(0, 4) }));
}

// Trail themes: today's words are picked so their letters fill the grid exactly.
const THEMES = `Brain food|WALNUT,BLUEBERRY,SPINACH,EGGS,SALMON,OATS,AVOCADO,BEANS,LENTILS,BROCCOLI,ALMONDS,SARDINES,KALE,YOGHURT,TEA
Australian animals|KOALA,WOMBAT,PLATYPUS,QUOKKA,ECHIDNA,DINGO,POSSUM,GALAH,EMU,BILBY,NUMBAT,WALLABY,GLIDER,QUOLL,DUGONG
In the garden|TOMATO,LETTUCE,PUMPKIN,CARROT,BASIL,PARSLEY,ONION,BEANS,ZUCCHINI,RADISH,CHILLI,MINT,PEAS,GARLIC,CHIVES
Weather|THUNDER,DRIZZLE,SUNSHINE,RAINBOW,CYCLONE,FROST,HAIL,FOG,BREEZE,DROUGHT,LIGHTNING,MIST,SLEET,GALE,DEW
Thinkers|PLATO,SENECA,SOCRATES,KANT,HUME,LOCKE,ARENDT,CAMUS,LAOZI,DESCARTES,ARISTOTLE,EPICTETUS,SARTRE,MENCIUS,SPINOZA
At the beach|TOWEL,SUNSCREEN,BUCKET,SPADE,UMBRELLA,SHELL,SURFER,KITE,FLAGS,ESKY,SEAGULL,DUNES,RASHIE,BOARD,WAVE
Music|GUITAR,DRUMS,VIOLIN,PIANO,TRUMPET,CELLO,FLUTE,HARP,BANJO,OBOE,TUBA,UKULELE,CLARINET,TROMBONE,BASS
In the kitchen|KETTLE,TOASTER,SPATULA,WHISK,FRIDGE,OVEN,BLENDER,GRATER,LADLE,TONGS,SIEVE,PEELER,COLANDER,WOK,PAN
Ways to rest|NAP,STRETCH,WALK,BATH,MUSIC,GARDEN,BREATHE,SLEEP,JOURNAL,READ,SWIM,KNIT,PAINT,FISH,TEA
Space|VENUS,COMET,GALAXY,NEBULA,ORBIT,ROCKET,MOON,STAR,SUN,MARS,SATURN,ASTEROID,ECLIPSE,COSMOS,PLUTO
Camping|TENT,TORCH,ESKY,SWAG,BILLY,LANTERN,CAMPFIRE,MATCHES,COMPASS,MOZZIE,BUSHWALK,STARS,DAMPER,MARSHMALLOW,ROPE
Things that fly|EAGLE,PLANE,KITE,DRONE,BAT,BEE,ROCKET,GLIDER,BALLOON,MAGPIE,MOTH,BLIMP,JET,PARROT,FRISBEE
Breakfast|TOAST,EGGS,BACON,PORRIDGE,MUESLI,PANCAKES,CEREAL,FRUIT,YOGHURT,COFFEE,JUICE,CROISSANT,WAFFLES,VEGEMITE,TEA
Feelings|HAPPY,PROUD,CALM,EXCITED,NERVOUS,GRATEFUL,HOPEFUL,LONELY,CURIOUS,JOYFUL,BRAVE,CONTENT,ANXIOUS,CROSS,SAD
At school|PENCIL,RULER,DESK,TEACHER,RECESS,LUNCH,LIBRARY,HOMEWORK,ERASER,SCISSORS,GLUE,BELL,CLASS,MATHS,ART
Sports|CRICKET,NETBALL,TENNIS,SOCCER,RUGBY,SWIMMING,ROWING,GOLF,HOCKEY,CYCLING,SURFING,BOXING,ARCHERY,DIVING,JUDO
In the ocean|WHALE,DOLPHIN,CORAL,SHARK,TURTLE,OCTOPUS,SQUID,KELP,CRAB,STINGRAY,SEAHORSE,URCHIN,PLANKTON,SEAL,REEF
Things with wheels|CAR,BIKE,BUS,TRAIN,SKATEBOARD,PRAM,TROLLEY,TRACTOR,SCOOTER,WAGON,TRAM,TRUCK,UTE,CARAVAN,BARROW
Good habits|SLEEP,WALK,WATER,READ,STRETCH,BREATHE,LISTEN,THANKS,LEARN,COOK,TIDY,SMILE,FRIENDS,SUNLIGHT,REST
Birds|ROBIN,WREN,OWL,FINCH,PELICAN,KESTREL,HERON,SWAN,CRANE,LORIKEET,PARROT,EGRET,IBIS,EAGLE,PIGEON
Colours|RED,ORANGE,YELLOW,GREEN,BLUE,INDIGO,VIOLET,PINK,TEAL,MAROON,OCHRE,SILVER,GOLD,CREAM,BLACK
Fruit bowl|APPLE,BANANA,ORANGE,PEAR,MANGO,KIWI,GRAPES,PLUM,PEACH,LEMON,LIME,CHERRY,PAPAYA,LYCHEE,FIG
Inventions|WHEEL,PRINTER,TELEPHONE,LIGHTBULB,ENGINE,COMPASS,CAMERA,RADIO,CLOCK,PENICILLIN,INTERNET,PAPER,LENS,BATTERY,WIFI
In a forest|TREE,FERN,MOSS,BARK,LEAF,TRAIL,CREEK,OWL,MUSHROOM,ACORN,LOG,BRANCH,CANOPY,ROOT,VINE
Ways to move|RUN,JUMP,SKIP,HOP,CRAWL,DANCE,SWIM,CLIMB,ROLL,WALK,LEAP,TWIRL,SPRINT,STROLL,MARCH`;
const THEME_BANK = THEMES.split('\n').map(l => { const [theme, w] = l.split('|'); return { theme, words: w.split(',') }; });
export const TRAIL_SIZE: Record<Level, [number, number]> = { easy: [5, 6], medium: [6, 8], hard: [7, 8] };
/** Today's Trail for a level: a theme, and words from it whose letters add up to exactly the grid size. */
export function makeTrail(level: Level, date = localDate()) {
  const [cols, rows] = TRAIL_SIZE[level]; const N = cols * rows;
  const r = todayRng(level === 'easy' ? 71 : level === 'medium' ? 72 : 73, date);
  for (let t = 0; t < 300; t++) {
    const th = THEME_BANK[Math.floor(r() * THEME_BANK.length)];
    const pool = shuffled(th.words.filter(w => w.length <= Math.max(cols, rows) + 2), r);
    const pick: string[] = []; let sum = 0;
    for (const w of pool) { if (sum + w.length <= N && (N - sum - w.length === 0 || N - sum - w.length >= 3)) { pick.push(w); sum += w.length; } if (sum === N) break; }
    if (sum === N && pick.length >= 5) return { theme: th.theme, words: pick.sort((a, b) => b.length - a.length), cols, rows };
  }
  return { theme: THEME_BANK[0].theme, words: THEME_BANK[0].words.slice(0, 8), cols: 6, rows: 8 };
}
