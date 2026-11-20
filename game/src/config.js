// Palmera Bay configuration: city layout, story missions, tuning, upgrades.
// Every name, place and character here is original, invented for this game.
export const CITY = {
  half: 400,            // city extends -400..400 on x and z
  roadGap: 80,          // distance between avenues
  roadWidth: 14,
  beachZ: 330,          // south of this line is sand, then sea
  seaZ: 385,
};

export const PLAYER_START = { x: -40, z: 120, heading: Math.PI / 2 };

// Tio Ray's garage: park close and press G to buy upgrades with mission money.
export const GARAGE = { x: -160, z: -160, radius: 16 };

// Intersections with working traffic lights (both axes get their own head).
export const TRAFFIC_LIGHT_SPOTS = [
  { x: 0, z: 0 },
  { x: 160, z: 0 },
  { x: -160, z: 0 },
  { x: 0, z: 160 },
  { x: 0, z: -160 },
];

// Story: six chained jobs from Carmen Solis, the marina fixer. Job 6 is a
// street race Tio Ray runs at sunset — five checkpoints against the clock.
export const MISSIONS = [
  {
    id: 1, title: 'WHEELS FOR HIRE',
    intro: 'Carmen: "Milo, you need wheels before anything. Take any car or bike on the street — press E next to one — and bring it to my garage."',
    steps: [
      { text: 'Steal a car or bike — walk up to any parked or traffic vehicle and press E', kind: 'stealCar' },
      { text: 'Drive the vehicle to Carmen\'s garage (yellow marker)', kind: 'reach', x: -160, z: -160, radius: 12 },
    ],
    reward: 400,
  },
  {
    id: 2, title: 'SUNSET COURIER',
    intro: 'Carmen: "A package for the Beachside Cafe. The sun sets in 100 seconds and the buyer walks if you are late. Drive fast, drive clean."',
    steps: [
      { text: 'Pick up the package at the marina kiosk', kind: 'reach', x: 200, z: 320, radius: 10 },
      { text: 'Deliver the package to the Beachside Cafe before time runs out', kind: 'timedReach', x: -280, z: 280, radius: 10, time: 100 },
    ],
    reward: 600,
  },
  {
    id: 3, title: 'CASH PICKUP',
    intro: 'Carmen: "Three of my runners left cash stashed around town. Collect all three bags. The police are watching the streets tonight — stay sharp."',
    steps: [
      { text: 'Collect cash bag 1 of 3 (north plaza)', kind: 'pickup', x: 40, z: -280, radius: 8, wantedOnStart: 2 },
      { text: 'Collect cash bag 2 of 3 (east market)', kind: 'pickup', x: 280, z: 40, radius: 8 },
      { text: 'Collect cash bag 3 of 3 (west docks)', kind: 'pickup', x: -280, z: -40, radius: 8 },
    ],
    reward: 900,
  },
  {
    id: 4, title: 'HOT WHEELS',
    intro: 'Carmen: "You are too hot, Milo. Three stars and every cruiser in Palmera Bay knows your face. Lose them, then get to the safehouse."',
    steps: [
      { text: 'Lose the police — stay out of sight until your wanted level clears', kind: 'loseWanted', wantedOnStart: 3 },
      { text: 'Reach the safehouse on Coral Row', kind: 'reach', x: 120, z: -40, radius: 10 },
    ],
    reward: 1200,
  },
  {
    id: 5, title: 'THE MARINA SCORE',
    intro: 'Carmen: "Last job. Tio Ray\'s briefcase sits in the marina office, guarded and watched. Grab it, and bring it home. After this, the debt is gone."',
    steps: [
      { text: 'Reach the marina office', kind: 'reach', x: 240, z: 300, radius: 10, wantedOnStart: 2 },
      { text: 'Grab the briefcase and escape to the safehouse', kind: 'pickup', x: 240, z: 300, radius: 8 },
      { text: 'Escape to the safehouse — the whole force is after you', kind: 'reach', x: 120, z: -40, radius: 10, wantedOnStart: 4 },
    ],
    reward: 2500,
  },
  {
    id: 6, title: 'SUNSET GRAND PRIX',
    intro: 'Carmen: "The debt is paid, but Tio Ray runs a street race at sunset and the prize is real money. Five checkpoints across town, one clock. Win it, Milo — and take a bike if you want to feel fast."',
    steps: [
      { text: 'Get to the race start on the beach avenue', kind: 'reach', x: -240, z: 320, radius: 10 },
      {
        text: 'Race! Hit every checkpoint before the clock runs out',
        kind: 'race', time: 150,
        checkpoints: [
          { x: -240, z: 160, radius: 10 },
          { x: -80, z: 80, radius: 10 },
          { x: 80, z: -80, radius: 10 },
          { x: 240, z: -240, radius: 10 },
          { x: 240, z: 160, radius: 10 },
        ],
      },
      { text: 'Cross the finish line at the marina', kind: 'reach', x: 240, z: 300, radius: 10 },
    ],
    reward: 3000,
  },
];

// Garage upgrades, bought with mission money at Tio Ray's garage (press G).
// Costs are per level; engine also helps bikes, armor cuts all damage taken.
export const UPGRADES = [
  { id: 'engine', name: 'ENGINE TUNE', desc: '+6 top speed and sharper acceleration per level', costs: [500, 900, 1500], max: 3 },
  { id: 'armor', name: 'ARMOR PLATING', desc: '25% less damage from crashes and beatings per level', costs: [400, 800], max: 2 },
  { id: 'tires', name: 'RUN-FLAT TIRES', desc: 'Spike strips slow you down half as long per level', costs: [350, 700], max: 2 },
];

export const TUNING = {
  walkSpeed: 6,
  sprintSpeed: 10,
  carAccel: 16,
  carMaxSpeed: 40,
  carReverseSpeed: 14,
  carTurn: 1.9,
  carGrip: 0.92,
  bikeAccel: 24,
  bikeMaxSpeed: 54,
  bikeReverseSpeed: 10,
  bikeTurn: 2.7,
  engineSpeedBonus: 6,
  engineAccelBonus: 3,
  armorDamageCut: 0.25,
  tireSpikeCut: 0.5,
  trafficSpeed: 9,
  bikeTrafficSpeed: 12,
  pedSpeed: 1.6,
  copCarSpeed: 30,
  copFootSpeed: 6.5,
  maxHealth: 100,
  wantedDecaySeconds: 25,
  bustedHoldSeconds: 2.5,
  roadblockMinWanted: 3,
  roadblockIntervalSeconds: 22,
  roadblockLifetimeSeconds: 28,
  spikeSlowSeconds: 8,
  dayCycleSeconds: 240,
  saveKey: 'palmeraBaySaveV2',
};

export const CAR_COLORS = [0xd23b3b, 0x2e6fd8, 0xf2c230, 0x37b06a, 0x8a5fd0, 0xe8e8e8, 0x222831, 0xe87a2e, 0x3ec6c6, 0xc23b7a];
export const BIKE_COLORS = [0xd23b3b, 0x2e6fd8, 0xf2c230, 0x1c2733, 0xe8e8e8, 0x37b06a];
export const PED_SHIRTS = [0xe8e8e8, 0x4a90d9, 0xe87a2e, 0x7ec850, 0xd94f70, 0xf2c230, 0x9b59b6, 0x1abc9c];

// Deterministic pseudo-random helper so the city is the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
