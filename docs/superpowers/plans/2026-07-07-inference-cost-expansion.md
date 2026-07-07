# Inference Cost Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next publishable phase of the LLM interview guide: AI Infra inference deployment, benchmarking, quantization, and cost-governance interview playbooks.

**Architecture:** Add one interview hub page for inference/cost questions, connect it from existing foundation interview pages and navigation, then thicken key inference pages with interview-specific capacity planning, framework selection, benchmark report, and quantization launch-gate sections. Keep all changes as Markdown and VitePress navigation updates.

**Tech Stack:** VitePress 1.x, Markdown, existing `docs/.vitepress/config.mts` navigation.

---

- [x] Add `docs/interview/inference-cost-qna.md` as the central interview page for inference deployment and cost governance.
- [x] Link the hub from foundation requirement and Q&A pages.
- [x] Add the hub to VitePress nav and interview sidebar.
- [x] Add inference system design and capacity-planning content to `docs/inference/inference-optimization.md`.
- [x] Add framework-selection interview content to `docs/inference/serving-frameworks.md`.
- [x] Add benchmark report and goodput gate content to `docs/inference/inference-benchmark.md`.
- [x] Add quantization launch-gate content to `docs/inference/quantization.md`.
- [x] Expand real interview questions with inference deployment and cost-governance follow-ups.
- [x] Run Markdown/site checks and build.
- [ ] Commit, merge to `main`, push, monitor GitHub Actions, and verify the live Pages site.
