# 3-Day Dogfood Log — Agent Memory Foundation (Phase 1)

**Start date:** 2026-06-27 (today)
**Goal:** Use the new Copilot memory for 3 days, capture pain points + missing features, then brainstorm Phase 2 (VO Workflow Agent) on Day 4 with real data instead of speculation.
**You are the only test user.** Treat your own friction as the highest-priority product signal.

---

## Where to find what shipped today

| Feature | Where |
|---|---|
| 🧠 Memory panel | Brain icon in the Copilot input bar (left of Reset / Send) |
| `remember` tool | AI calls automatically when you tell it durable facts |
| `forget` tool | AI calls automatically when you say "I'm not X anymore" or similar |
| Cross-session recall | The agent-proxy edge function injects your memory rows at the top of every system prompt |
| Manual delete | Each row in the memory panel has a trash-can button |

---

## Day 1 — Free play (2026-06-27)

**Mode:** No agenda. Use Copilot however feels natural for ~15-30 min.

**Suggested triggers:**
- Tell Copilot something about yourself or your work it doesn't already know
- Upload a real IFC, do a VO comparison
- Ask 2-3 questions you'd actually ask in real work (CIPAA, JKR, EOT, time bars…)
- Try mixing English / 中文 / BM in the same session, see how memory recall handles it

**Capture (write below):**

- The moment that felt **most magical** (e.g. "wait, it remembered that?"):
  > 
- The moment that felt **most stupid** (e.g. "why is it still asking me X?"):
  > 
- One thing you wanted to say but didn't because you knew it wouldn't matter:
  > 

---

## Day 2 — Simulated VO Claim workflow (2026-06-28)

**Mode:** Pretend you're preparing a real VO claim end-to-end.

**Walk through, COUNTING your back-and-forth turns:**
1. Upload base + revision IFC
2. Ask Copilot to compare them
3. Ask it to summarise commercial impact
4. Ask "Can I claim this under JKR 31.3?"
5. Ask it to draft the claim letter
6. Ask anything else you'd need (cost breakdown, time impact, EOT notice…)

**Capture:**

- **Turn count** (how many user messages to get from "two IFCs uploaded" → "ready-to-send claim letter"):
  > 
- The steps the AI **should have chained automatically** without asking:
  > 
- The steps where you really did want **manual control**, AI shouldn't autopilot:
  > 
- Did the AI use your memory (role, contract type, project pattern) in its draft? If yes — where? If no — where would it have helped?
  > 

---

## Day 3 — Cross-session continuity (2026-06-29)

**Mode:** Test whether the agent feels like an assistant that picks up where you left off.

**Try:**
- Start a workflow → close the page → wait 2+ hours → come back, ask "where did we leave off?"
- Open Brain panel — does the AI remember the project state it should?
- Add new facts mid-conversation ("the deadline got pushed to Friday"). Does it remember next day?
- Try to **break it**: tell contradictions, vague things, irrelevant chatter. Note what it incorrectly remembered vs ignored.

**Capture:**

- Did it remember project context across the gap? What was missing?
  > 
- What "obvious" context did it fail to carry?
  > 
- Did it remember **too much** noise (trivial things you wish it had ignored)?
  > 

---

## Day 4 — Phase 2 brainstorming inputs

Bring these to the next session (ping Claude with "ready for Phase 2 brainstorming"):

### Q1 — Your 3 most-annoying moments from these 3 days
1. 
2. 
3. 

### Q2 — The 1 thing you most want the agent to **proactively do** (no asking)
> 

### Q3 — The workflow you'd **pay for**
(Pick one — pick the one where 5 → 1 turn matters most to your work)

- [ ] VO claim end-to-end (IFC compare → contract clause → letter draft → 28-day timer)
- [ ] EOT application (delay event → JKR 43.1 clause match → notice draft → tracking)
- [ ] Weekly project report (auto-audit every Monday → KPI summary → email-able)
- [ ] BQ ↔ IFC reconciliation (highlight quantity discrepancies → priced impact)
- [ ] Other: 

### Q4 — Did anything **break** during the 3 days?
(Bug reports, weird AI behaviour, UI glitches — be specific so I can reproduce)

> 

---

## What I will NOT change during these 3 days

So we get clean signal:
- No code changes to memory infra
- No prompt edits
- No new tools
- Only emergency fixes if something actually broken (e.g. credits crash, login fail)

If you absolutely need a fix during the 3 days, ping me — but try to log it under Q4 first instead of fixing in-flight.

---

## Reminder: the experiment

We are betting that **memory + cross-session continuity** is the foundation that unlocks every Phase 2+ feature.

If after 3 days you feel "honestly memory didn't change much for me" — that's a **valuable** signal too. It would mean Phase 2 should be something other than workflow agent (maybe direct IFC automation, or LiDAR, or something else entirely).

Don't fake enthusiasm. Honest friction logs are worth more than polite ones.
