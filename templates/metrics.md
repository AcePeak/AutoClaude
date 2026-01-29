# Project Metrics

Track project evolution, iteration counts, and refactoring schedule.

---

## Iteration Tracking

| Metric | Value | Last Updated |
|--------|-------|--------------|
| Total task completions | 0 | - |
| Current iteration cycle | 0 | - |
| Tasks since last light refactor | 0 | - |
| Tasks since last heavy refactor | 0 | - |

---

## Refactoring Schedule

### Thresholds
- **Light refactor**: Every 5 completed tasks
- **Heavy refactor**: Every 15 completed tasks

### Refactoring History

| Date | Type | Executor | Changes Made | Notes |
|------|------|----------|--------------|-------|
| - | - | - | Initial project setup | - |

---

## Light Refactoring Checklist

When light refactor is due, address these items:

### For Software Projects
- [ ] Extract repeated code into reusable functions
- [ ] Improve unclear variable/function names
- [ ] Add missing inline documentation
- [ ] Organize imports and dependencies
- [ ] Fix code style inconsistencies
- [ ] Remove dead code
- [ ] Update outdated comments

### For Business Projects
- [ ] Consolidate related content sections
- [ ] Update cross-references
- [ ] Ensure consistent terminology
- [ ] Clean up outdated information
- [ ] Improve section organization

### For Documentation Projects
- [ ] Check all links are valid
- [ ] Update outdated examples
- [ ] Ensure consistent formatting
- [ ] Improve navigation/structure
- [ ] Add missing cross-references

---

## Heavy Refactoring Checklist

When heavy refactor is due, consider these architectural changes:

### For Software Projects
- [ ] Reassess overall architecture against requirements
- [ ] Split large files/modules (>300 lines)
- [ ] Apply appropriate design patterns
- [ ] Identify and fix performance bottlenecks
- [ ] Update dependencies to latest stable versions
- [ ] Restructure directory layout if needed
- [ ] Review and update API contracts
- [ ] Consolidate configuration management
- [ ] Improve error handling strategy
- [ ] Update testing strategy

### For Business Projects
- [ ] Reassess information architecture
- [ ] Restructure document hierarchy
- [ ] Create new categorization scheme if needed
- [ ] Archive obsolete content
- [ ] Create/update comprehensive index
- [ ] Realign with current business goals
- [ ] Update all personas and user journeys
- [ ] Refresh competitive analysis

### For Documentation Projects
- [ ] Restructure entire documentation tree
- [ ] Create new navigation system
- [ ] Update all screenshots/diagrams
- [ ] Rewrite outdated sections
- [ ] Add new sections for gaps
- [ ] Create quick-start guides
- [ ] Add troubleshooting sections

---

## First Principles Review

During heavy refactoring, answer these questions:

### Core Purpose
1. What is the fundamental goal of this project?
2. Who are the primary users/stakeholders?
3. What problem does it solve?

### Current State
1. Does the current structure serve the core purpose?
2. What are the main pain points?
3. What technical debt exists?

### Ideal State
1. What would the ideal structure look like?
2. What patterns/practices should we adopt?
3. What should be removed or deprecated?

### Action Plan
1. What are the highest-impact changes?
2. What can be done incrementally?
3. What requires a larger effort?

---

## Quality Metrics

### Code Quality (Software Projects)
| Metric | Current | Target | Last Updated |
|--------|---------|--------|--------------|
| Test coverage | - | 80% | - |
| Cyclomatic complexity (avg) | - | <10 | - |
| Documentation coverage | - | 90% | - |
| Lint errors | - | 0 | - |

### Content Quality (Business/Doc Projects)
| Metric | Current | Target | Last Updated |
|--------|---------|--------|--------------|
| Readability score | - | Grade 8 | - |
| Broken links | - | 0 | - |
| Outdated sections | - | 0 | - |
| Missing topics | - | 0 | - |

---

## Architecture Decision Records

Track major architectural decisions made during refactoring:

### ADR-001: [Title]
- **Date**: YYYY-MM-DD
- **Status**: [proposed|accepted|deprecated|superseded]
- **Context**: Why was this decision needed?
- **Decision**: What was decided?
- **Consequences**: What are the implications?

---

## Notes

- Update this file after each task completion
- Increment counters appropriately
- Trigger refactoring when thresholds are met
- Document all significant changes
