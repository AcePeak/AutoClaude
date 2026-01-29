# Test Registry

This file tracks all tests, validations, and verification checks for the project.

## Project Type
- Primary: [software|business|documentation|research|other]
- Testing approach: [automated|manual-checklist|validation-framework]

---

## Software Tests

### Unit Tests
| Test ID | Description | File | Added | Last Run | Status |
|---------|-------------|------|-------|----------|--------|
| UT-001 | Example test | tests/example.test.js | 2024-01-01 | - | PENDING |

### Integration Tests
| Test ID | Description | File | Added | Last Run | Status |
|---------|-------------|------|-------|----------|--------|
| IT-001 | Example integration | tests/integration/example.test.js | 2024-01-01 | - | PENDING |

### Regression Tests
| Test ID | Original Issue | Description | Added | Status |
|---------|---------------|-------------|-------|--------|
| RT-001 | Supervisor feedback #1 | Test for edge case X | 2024-01-01 | PASS |

---

## Business Validations

### User Persona Checks
| Check ID | Persona | Aspect | Validation Method | Last Checked | Result |
|----------|---------|--------|-------------------|--------------|--------|
| BP-001 | Primary user | Value proposition | Manual review | - | PENDING |

### Market Validation
| Check ID | Aspect | Method | Last Validated | Notes |
|----------|--------|--------|----------------|-------|
| MV-001 | Competitive position | Comparison matrix | - | PENDING |

### Messaging Validation
| Check ID | Message | Target Emotion | Clarity Score | Notes |
|----------|---------|----------------|---------------|-------|
| MSG-001 | Main headline | Trust/Confidence | - | PENDING |

---

## Documentation Checks

### Accuracy Checks
| Check ID | Section | Verified Against | Last Check | Status |
|----------|---------|------------------|------------|--------|
| DA-001 | API docs | Actual API | - | PENDING |

### Consistency Checks
| Check ID | Area | Related Docs | Last Check | Status |
|----------|------|--------------|------------|--------|
| DC-001 | Terminology | All docs | - | PENDING |

---

## General Verification

### Custom Checks
| Check ID | Description | Verification Method | Last Run | Status |
|----------|-------------|---------------------|----------|--------|
| GV-001 | Project-specific check | Manual verification | - | PENDING |

---

## Test Run History

| Date | Executor | Tests Run | Passed | Failed | Notes |
|------|----------|-----------|--------|--------|-------|
| 2024-01-01 | executor_xxx | 0 | 0 | 0 | Initial setup |

---

## Adding New Tests

When adding tests, follow this process:

1. Assign next available ID (UT-XXX, IT-XXX, RT-XXX, etc.)
2. Add entry to appropriate table above
3. Create actual test file (for software projects)
4. Run test and update status
5. Record in Test Run History

### Test ID Prefixes
- `UT-` : Unit Test
- `IT-` : Integration Test
- `RT-` : Regression Test
- `BP-` : Business/Persona validation
- `MV-` : Market Validation
- `MSG-` : Messaging Check
- `DA-` : Documentation Accuracy
- `DC-` : Documentation Consistency
- `GV-` : General Verification
