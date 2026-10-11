# AVANZA Learn Quest Protocol v1

## Purpose
Turn learning processes into interactive missions without confusing motivation with verified mastery.

## Invariants
- XP, streaks, colors and levels are motivational only.
- Project/academic percentage changes only when a defined gate is independently justified as closed.
- A wrong answer never erases previously closed gates.
- A retry changes data/context before repeating the same skill.
- After three equivalent failures, the teaching strategy must materially change.
- The current academic tab waits for the learner's answer; other enabled AUTO project tabs may continue.
- No assistant should require the learner to type "sigue" after a result; PASS chains the next quest in the same response unless a pedagogical pause or genuine human gate exists.

## Visible protocol

### Present a quest
`🎮 QUEST | <course> | <mission_id> | ⭐<0-500> XP | ⚔️<1-5>/5 | <title>`

### Evaluate a quest
PASS:
`🏆 QUEST_RESULT | <mission_id> | PASS | +<xp> XP | 🔥<streak>`

RETRY:
`🔁 QUEST_RESULT | <mission_id> | RETRY | +0 XP | 🔥0`

## Recommended teaching loop
1. Brief mission framing.
2. One user-solvable challenge.
3. User answers.
4. Evaluate exact reasoning/calculation.
5. Explain only the smallest missing concept.
6. PASS -> reward + next quest in same response.
7. RETRY -> new data/context testing the same gate.
8. Periodically use retrieval missions from older topics.
9. Use BOSS missions for mixed/simulated assessments.

## HUD controls
- 🎯 mission: start/continue the next micro-mission.
- 💡 hint: one minimal Socratic hint; do not reveal the answer.
- 🔁 retry: same skill with different numbers/context.
- 👾 boss: cumulative simulation appropriate to current verified level.
- 🗺️ map: show completed/current/next missions and boss.

## Safety / rigor
The userscript does not answer exercises for the learner, bypass permissions, or create academic credit. It only coordinates interface state and sends explicit user-triggered learning actions.
