# Dify Production Interview Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused Dify / low-code workflow productionization interview page that helps candidates answer PoC validation, production governance, migration, and project storytelling questions.

**Architecture:** Keep `engineering/dify-workflow.md` as the concept and engineering overview. Add `interview/dify-production-qna.md` for interview follow-up chains, production gates, architecture layering, migration decisions, anti-patterns, and project talk tracks.

**Tech Stack:** VitePress 1.x, Markdown, existing docs navigation.

---

- [x] Review Dify, workflow, LangGraph production, and interview question coverage.
- [x] Add Dify production interview Q&A page.
- [x] Register the page in VitePress interview navigation.
- [x] Link related engineering, real-questions, and high-frequency pages.
- [x] Run Markdown/site checks and build.
- [ ] Commit, merge to `main`, push, monitor GitHub Actions, and verify the live Pages site.
