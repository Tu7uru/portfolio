---
title: LLM stress testing and judge calibration
label: JUDGE-CAL
period: PERSONAL PROJECT
tags: LLM Evaluation, LLM-as-Judge, QA
plain: LLM stress testing and judge calibration · what output to trust
order: 20
---
Systematic stress tests of self-hosted models and of the judges that score them.

- About 30% of model-generated interactive pages were found broken despite passing both a static validator and an LLM critic.
- The same model, classifying knowledge notes, showed a 23% error rate on its high-confidence answers.
- A headless-browser render gate flags broken generated pages without needing a model judge.
