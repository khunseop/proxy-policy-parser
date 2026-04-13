# Project Roadmap

## Phase 1: Data Integration & Refinement (Current)
- [x] Create core parsers (Policy, Condition, Lists).
- [ ] Refactor into a unified "Flat Table" structure (Staircase + Path).
- [ ] Link Rules with actual List contents for deep visibility.
- [ ] Enhance documentation for developers and users.

## Phase 2: Web UI & Visualization
- [ ] Implement a Tree-View interface using FastAPI and a frontend (React/Angular).
- [ ] Search functionality: Instantly find rules by IP, URL, or Keyword.
- [ ] Object Explorer: Click a list name in a rule to jump to its content.

## Phase 3: Advanced Analysis (Policy Diff)
- [ ] Comparison engine: Compare "Yesterday vs. Today" versions of the policy.
- [ ] Detailed change report: Identify added/deleted rules and modified conditions/actions.
- [ ] Shadow Rule Detection: Identify rules that might be overridden by higher-level policies.
