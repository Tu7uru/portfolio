---
title: Long-session memory for coding agents
label: LONG-MEM
period: PERSONAL PROJECT
tags: Context Management, Search, LLM Agents
plain: Long-session memory for coding agents · recover values lost to compaction
order: 20
---
A search tool that lets an agent recover the exact values lost when its context is compacted in long sessions.

- Keeps 99% of the dropped values against 12% without the tool.
- Total input tokens stay within 6% of the plain agent.
- A one-line change that stops re-indexing earlier search results was adopted into daily use after it met an adoption rule set before the test.
- Earlier context compaction was tested and rejected: no detectable quality gain for 48% more tokens.
