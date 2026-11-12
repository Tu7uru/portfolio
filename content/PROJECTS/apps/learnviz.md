---
title: LearnViz
label: LEARNVIZ
period: PERSONAL PROJECT
tags: LLMs, Simulation, Validation
plain: LearnViz · text to validated interactive simulations
order: 10
---
Turns a concept described in text into an interactive visual simulation.

- The LLM writes only a data spec for each simulation, which a validator checks and a trusted engine renders.
- A 4-hour stress test found an engine integration bug; after the fixes, all 69 physics simulations ran without failure.
- A 3-round validate-and-repair loop raised valid generated specs from 2 of 7 to 6 of 7.
