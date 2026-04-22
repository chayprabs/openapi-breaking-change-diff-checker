# Product Brief

## Product

**OpenAPI Breaking-Change Diff and Contract Risk Report**

## Summary

- Users paste or upload two OpenAPI specs.
- The tool compares them semantically.
- It reports breaking, dangerous, safe, and docs-only changes.
- The core tool works without login.
- Prefer local browser processing.
- No AI API required.

## V1 Intent

The first Authos tool should give API teams a fast way to understand whether a new OpenAPI document is safe to release. Instead of showing only raw text differences, the tool should explain contract impact in categories that help with rollout decisions and review workflows.

## Product Goals

- Make API contract risk easier to review than raw YAML or JSON diffs.
- Keep the core workflow frictionless for unauthenticated users.
- Favor privacy-friendly local browser execution where practical.
- Produce an output structure that can later support exports, policies, or CI integration.

## Non-Goals for This Baseline

- Final visual design polish
- Production diff engine implementation
- Authentication or billing flows
- AI-assisted change analysis
