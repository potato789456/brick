'use strict';
/* Brick — the plan, equipment, back routine and quotes.
   Exercise keys are permanent ids: history is matched by key, so never rename a key (renaming the label is fine). */

// ---------- equipment ----------
// machine: the home cable/stack machine, 20–50 kg in 5 kg steps (5–15 kg settings are unusable)
// barbell 10 kg, ez 8 kg: any plates; dbpair: two equal dumbbells; dbsingle: one dumbbell; free: any number; bw: reps only
const EQUIP = {
  machine:  { label: 'Machine' },
  barbell:  { label: 'Barbell', bar: 10 },
  ez:       { label: 'EZ bar', bar: 8 },
  dbpair:   { label: 'Dumbbells · kg per dumbbell', bar: 2 },
  dbsingle: { label: 'One dumbbell', bar: 2 },
  free:     { label: 'Weight' },
  bw:       { label: 'Bodyweight' },
};
// Plates owned (total count). 5, 15 and 20 kg plates fit only on the barbell and EZ bar.
const PLATES = { 20: 2, 15: 2, 5: 2, 3: 4, 2.5: 8, 2: 8, 1: 8 };
const DB_PLATES = [3, 2.5, 2, 1];

const MG = {
  chest: 'Chest', shoulders: 'Shoulders', triceps: 'Triceps', back: 'Back', biceps: 'Biceps',
  reardelts: 'Rear delts', quads: 'Quads', glutes: 'Glutes', hamstrings: 'Hamstrings',
  calves: 'Calves', core: 'Core', forearms: 'Forearms',
};

// ---------- exercises ----------
// min/max = rep range. alts = exercises you can swap to during a workout.
const EX = {
  bench:     { name: 'Barbell Bench Press',      mg: 'chest',     eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['dbpress'] },
  dbpress:   { name: 'DB Flat Press',            mg: 'chest',     eq: 'dbpair',   sets: 3, min: 8,  max: 12, alts: ['bench'] },
  dbflye:    { name: 'DB Flye',                  mg: 'chest',     eq: 'dbpair',   sets: 3, min: 10, max: 15, alts: ['pecdec'] },
  pecdec:    { name: 'Pec Dec Flye',             mg: 'chest',     eq: 'machine',  sets: 3, min: 10, max: 15, alts: ['dbflye'] },
  ohp:       { name: 'Overhead Press (Barbell)', mg: 'shoulders', eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['seatdbpress'] },
  seatdbpress:{ name: 'Seated DB Press',         mg: 'shoulders', eq: 'dbpair',   sets: 3, min: 8,  max: 12, alts: ['ohp'] },
  lateral:   { name: 'DB Lateral Raises',        mg: 'shoulders', eq: 'dbpair',   sets: 4, min: 12, max: 16, alts: [] },
  pushdown:  { name: 'Triceps Pushdown (Cable)', mg: 'triceps',   eq: 'machine',  sets: 3, min: 10, max: 15, alts: [] },
  tricepsoh: { name: 'Triceps Overhead (DB)',    mg: 'triceps',   eq: 'dbsingle', sets: 3, min: 10, max: 15, alts: ['tricepsez'] },
  tricepsez: { name: 'Triceps Overhead (EZ)',    mg: 'triceps',   eq: 'ez',       sets: 3, min: 10, max: 15, alts: ['tricepsoh'] },

  pulldown:  { name: 'Lat Pulldown',             mg: 'back',      eq: 'machine',  sets: 3, min: 8,  max: 12, alts: ['pulldownv'] },
  pulldownv: { name: 'Lat Pulldown (V-bar)',     mg: 'back',      eq: 'machine',  sets: 3, min: 8,  max: 12, alts: ['pulldown'], tip: 'The triangle handle, close grip.' },
  seatrow:   { name: 'Seated Row',               mg: 'back',      eq: 'machine',  sets: 3, min: 8,  max: 12, alts: ['csrow'] },
  pullover:  { name: 'Cable Pullover',           mg: 'back',      eq: 'machine',  sets: 3, min: 10, max: 15, alts: [] },
  reardelt:  { name: 'Rear Delt Machine',        mg: 'reardelts', eq: 'machine',  sets: 3, min: 12, max: 16, alts: [] },
  ezcurl:    { name: 'EZ Bar Curl',              mg: 'biceps',    eq: 'ez',       sets: 3, min: 10, max: 14, alts: ['dbcurl'] },
  dbcurl:    { name: 'DB Curl',                  mg: 'biceps',    eq: 'dbpair',   sets: 3, min: 10, max: 14, alts: ['ezcurl'] },
  wrist:     { name: 'Wrist Roller / Plate Pinch',mg: 'forearms',  eq: 'free',     sets: 3, min: 10, max: 20, alts: ['revcurl'] },

  legext:    { name: 'Leg Extension',            mg: 'quads',     eq: 'machine',  sets: 3, min: 10, max: 15, alts: [], tip: 'Only if the knee feels fine. Stop if it hurts.' },
  rdl:       { name: 'Romanian Deadlift',        mg: 'hamstrings',eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['hipthrust'], tip: 'Soft knees, push the hips back, bar close to the legs. Feel it in the glutes and hamstrings.' },
  sidelying: { name: 'Side-lying Leg Raise',     mg: 'glutes',    eq: 'bw',       sets: 3, min: 12, max: 20, alts: ['glutebridge'], tip: 'Lie on your side, top leg straight and slightly back, lift it slowly. Per leg.' },
  bss:       { name: 'Bulgarian Split Squat',    mg: 'quads',     eq: 'dbpair',   sets: 3, min: 8,  max: 12, alts: ['revlunge'], tip: 'Torso upright. Per leg.' },
  hipthrust: { name: 'Barbell Hip Thrust',       mg: 'glutes',    eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['glutebridge'], tip: 'Ribs down, squeeze at the top. No arching the lower back.' },
  glutebridge:{ name: 'Single-leg Glute Bridge', mg: 'glutes',    eq: 'bw',       sets: 3, min: 10, max: 20, alts: ['hipthrust'], tip: 'Per leg.' },
  revlunge:  { name: 'Reverse Lunge (DB)',       mg: 'quads',     eq: 'dbpair',   sets: 2, min: 10, max: 12, alts: ['bss'], tip: 'Per leg.' },
  hamcurl:   { name: 'Towel Hamstring Curl',     mg: 'hamstrings',eq: 'bw',       sets: 3, min: 8,  max: 15, alts: [], tip: 'Lie on your back, heels on a towel on a smooth floor, hips up, pull heels in. No stretching the hamstrings.' },
  calves:    { name: 'Calf Raises',              mg: 'calves',    eq: 'dbsingle', sets: 3, min: 15, max: 25, alts: [], tip: 'One leg at a time, holding one dumbbell. Per leg.' },
  squat:     { name: 'Squat',                    mg: 'quads',     eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['bss'], back: true },

  bentrow:   { name: 'Barbell Bent Over Row',    mg: 'back',      eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['csrow', 'pulldown', 'pulldownv'] },
  cgbench:   { name: 'Close-grip Bench Press',   mg: 'triceps',   eq: 'barbell',  sets: 3, min: 8,  max: 12, alts: ['pushdown'], tip: 'Hands about shoulder width, elbows close to the body.' },
  csrow:     { name: 'Chest-supported DB Row',   mg: 'back',      eq: 'dbpair',   sets: 3, min: 8,  max: 12, alts: ['bentrow'], tip: 'Chest on an incline bench. Easy on the lower back.' },
  revcurl:   { name: 'Reverse Curl (EZ Bar)',    mg: 'forearms',  eq: 'ez',       sets: 3, min: 10, max: 15, alts: ['wrist'] },
  obliques:  { name: 'Obliques (Pull-up Bar)',   mg: 'core',      eq: 'bw',       sets: 3, min: 10, max: 20, alts: ['deadbug'] },
  deadbug:   { name: 'Dead Bug',                 mg: 'core',      eq: 'bw',       sets: 3, min: 8,  max: 15, alts: ['obliques'], tip: 'Per side. Lower back stays glued to the floor.' },
};

// ---------- days ----------
// Rotation: push → pull → legs → push… Upper is a bonus day that does not move the rotation.
const DAYS = {
  push:  { name: 'Push',  focus: 'Chest · Shoulders · Triceps',  color: '#e0603f', ex: ['bench', 'dbflye', 'ohp', 'lateral', 'pushdown', 'tricepsoh'] },
  pull:  { name: 'Pull',  focus: 'Back · Rear delts · Biceps',   color: '#3f7fd0', ex: ['pulldown', 'seatrow', 'pullover', 'reardelt', 'ezcurl', 'dbcurl', 'wrist'] },
  legs:  { name: 'Legs',  focus: 'Quads · Glutes · Hamstrings',  color: '#3fa36b', ex: ['legext', 'bss', 'hipthrust', 'revlunge', 'hamcurl', 'calves'] },
  upper: { name: 'Upper', focus: 'Bonus day · whole upper body', color: '#d49a2a', ex: ['dbpress', 'bentrow', 'lateral', 'dbcurl', 'revcurl', 'obliques'] },
};
// Her days: 2 a week, glute focus, knee-friendly (no squats or lunges)
DAYS.ga = { name: 'Glutes & Push', focus: 'Glutes · Chest · Arms', color: '#e5679a', ex: ['hipthrust', 'sidelying', 'bench', 'cgbench', 'ezcurl'] };
DAYS.gb = { name: 'Glutes & Pull', focus: 'Glutes · Hamstrings · Back', color: '#8f6ad6', ex: ['rdl', 'bentrow', 'glutebridge', 'sidelying'] };

/* Programs per person. kind 'tough' = push/pull/legs + Hormozi-style lines; 'happy' = 2-day glute program + cheerful lines.
   rotation = the order "Next up" follows; bonus = extra days that do not move the rotation; goal = workouts per week. */
const PROGRAMS = {
  tough: { label: 'Push Pull Legs · tough love', days: ['push', 'pull', 'legs', 'upper'], rotation: ['push', 'pull', 'legs'], bonus: ['upper'], goal: 3 },
  happy: { label: 'Glutes, 2 a week · happy', days: ['ga', 'gb'], rotation: ['ga', 'gb'], bonus: [], goal: 2 },
};
const ROTATION = PROGRAMS.tough.rotation;

// ---------- evening back routine ----------
// Gentle, pain-guided. Nothing that stretches the hamstrings or pulls on the sciatic nerve.
const BACK = [
  { name: 'Cat-cow', art: 'catcow', secs: 60, how: 'On hands and knees. Slowly round your back up, then let it sag a little. Small, smooth, no forcing.' },
  { name: 'Hip flexor stretch — left', art: 'hipflexor', secs: 40, how: 'Half-kneel, left knee down. Tuck your pelvis under (squeeze the glute) and shift forward a little. Feel the front of the left hip.' },
  { name: 'Hip flexor stretch — right', art: 'hipflexor', flip: true, secs: 40, how: 'Same, right knee down. Tuck the pelvis first, then shift forward. Do not arch the lower back.' },
  { name: 'Figure-4 glute stretch — left', art: 'figure4', secs: 40, how: 'On your back, left ankle over right knee. Gently pull the right thigh toward you.' },
  { name: 'Figure-4 glute stretch — right', art: 'figure4', flip: true, secs: 40, how: 'Swap sides: right ankle over left knee.' },
  { name: 'Bird dog', art: 'birddog', secs: 60, how: 'On hands and knees. Reach opposite arm and leg out, hold 5 seconds, swap. Hips stay level, back stays flat.' },
  { name: 'Dead bug', art: 'deadbug', secs: 45, how: 'On your back, arms up, knees at 90°. Slowly lower opposite arm and leg. Lower back stays pressed into the floor.' },
  { name: 'Knee hug', art: 'kneehug', secs: 40, how: 'On your back, hug one knee gently to your chest for a few breaths, then the other. Relax.' },
];

// ---------- lines (original, Hormozi-flavoured) ----------
const QUOTES = {
  home: [
    'Nobody is coming. Stack the brick.',
    'Volume solves most problems. Get your reps in.',
    'Motivation is a bonus. Showing up is the job.',
    'The boring work is the work.',
    'You do not need a perfect week. You need the next session.',
    'Do the hard thing first. The rest of the day gets easier.',
    'Most people quit in the boring middle. That is where you win.',
    'One brick a day. Nobody remembers the bricks. Everybody sees the wall.',
    'Consistency beats intensity, every single time.',
    'You are not behind. You are one session away.',
    'Small reps, done for a long time, look like talent.',
    'Feelings are optional. Reps are not.',
    'Discipline is just doing it when you do not feel like it. Again.',
    'The gym does not care about your excuses. Neither does the wall.',
    'More reps than last time. That is the whole plan.',
  ],
  start: [
    'Beat last time by one rep. That is all.',
    'You already did the hardest part: you started.',
    'Do the boring sets well.',
    'Volume. Volume. Volume.',
    'Leave the phone. Lift the weight.',
  ],
  set: [
    'Brick down.', 'Stacked.', 'One more brick.', 'That is a rep in the bank.', 'Good. Again.',
    'Boring is working.', 'Volume wins.', 'Keep stacking.',
  ],
  done: [
    'Another brick in the wall. Same time next session.',
    'Most people did not train today. You did.',
    'Session done. The compounding is invisible until it is not.',
    'You kept a promise to yourself. That is the real rep.',
    'Proof beats hope. You just made more proof.',
  ],
  back: [
    'Not glamorous. Neither is a bad back.',
    'Six minutes. Then sleep.',
    'Recovery is part of the volume.',
  ],
  gap: [
    'The wall does not care how long you were gone. Add a brick.',
    'Missed some days. So what. Next session is the only one that counts.',
    'No guilt, no catching up. Just the next brick.',
  ],
};

// Cheerful lines for the 'happy' style: encouraging, warm, no tough love.
const QUOTES_HAPPY = {
  home: [
    'Hello you! Ready for a little brick today?',
    'Every workout is a gift to future you.',
    'Strong is a feeling. Let us go get some.',
    'Small steps, happy glutes.',
    'You showed up last time. That is already a lot.',
    'Your wall misses you. Just kidding, it is proud of you.',
    'Progress, not perfection.',
    'Move a little, smile a lot.',
    'Today is a good day to feel strong.',
    'Two workouts a week, every week. That is the magic.',
    'You are building something lovely, one brick at a time.',
    'Be gentle with the knee, be brave with the glutes.',
  ],
  start: ['Have fun! You have got this.', 'Breathe, smile, lift.', 'One set at a time.', 'Let us make the glutes happy.'],
  set: ['Yay!', 'Lovely!', 'Nice one!', 'Brick by brick.', 'So good!', 'Keep going, you are doing great.'],
  done: [
    'Another brick on your wall. So proud of you!',
    'Done! Now go enjoy the rest of your day.',
    'You did it. Future you says thank you.',
    'That was a good one. Treat yourself to something nice.',
    'Look at that wall grow!',
  ],
  back: ['A little stretch, a lot of comfort.', 'Gentle moves, sweet dreams.'],
  gap: [
    'Welcome back! The wall kept your spot warm.',
    'No pressure. Just one lovely little workout.',
    'Every comeback starts with one brick.',
  ],
};
