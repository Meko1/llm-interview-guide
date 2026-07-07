# Test-Time Scaling Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing Test-Time Compute Scaling draft as a first-class VitePress topic and connect it to interview preparation pages.

**Architecture:** Keep `docs/inference/test-time-scaling.md` as the canonical engineering-side page for service-layer test-time compute. Link it from inference navigation, reasoning model content, CoT prompt content, high-frequency interview cards, real interview questions, and the inference cost playbook.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

- [x] Review the existing `docs/inference/test-time-scaling.md` draft and preserve its core structure.
- [x] Add the page to the top navigation and `/inference/` sidebar.
- [x] Cross-link the page from reasoning-model and CoT pages.
- [x] Add high-frequency and real-question interview entries.
- [x] Add a cost/SLA warning in the inference cost playbook.
- [x] Run Markdown/site checks and build.
- [ ] Commit, merge to `main`, push, monitor GitHub Actions, and verify the live Pages site.
