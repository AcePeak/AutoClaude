# AutoClaude User Interaction Rules

This project has AutoClaude continuous task system enabled.

## Identifying Continuous Tasks

When user mentions the following keywords or similar expressions in conversation, identify as "continuous task" request:

**Keywords:**
- "continuous task"
- "background task"
- "auto execute"
- "let supervisor handle"
- "add to queue"
- "nonstop task"
- "persistent task"
- "async task"

**Similar expressions:**
- "this task can be done slowly"
- "no rush, run it in background"
- "let the system handle it"
- "I'll do something else, run this automatically"

## Actions After Identification

When a continuous task request is identified, execute these steps:

### 1. Understand the Task
- Confirm user's specific requirements
- Ask user if anything is unclear

### 2. Create Task File
Create task file in `collaboration/queue/` directory:

**Filename format:**
```
task_<YYYYMMDD>_<HHMMSS>_<short_description>.md
```

**File content:**
```markdown
---
id: task_<YYYYMMDD>_<HHMMSS>_<short_description>
status: PENDING
priority: normal
created: <ISO 8601 time>
assigned_to: null
source: user_chat
depends_on: []
---
## Task Description
<Clearly describe task content based on user requirements>

## Background Info
<Context information provided by user>

## Acceptance Criteria
- [ ] <Specific, verifiable criterion 1>
- [ ] <Specific, verifiable criterion 2>
- [ ] <...>

## Execution Feedback
(Waiting for Executor to fill)

## Review Comments
(Waiting for Supervisor to fill)
```

### 3. Confirm and Notify User

After creating task, confirm to user:

```
Task added to queue:
- Task ID: <task_id>
- Description: <short description>
- Status: Pending

Supervisor will analyze this task on next check, Executor will execute automatically.
You can check task status in collaboration/queue/ directory.
```

## Priority Judgment

Judge task priority based on user expression:

| Expression | Priority |
|------------|----------|
| "urgent", "immediately", "ASAP" | high |
| Default / "normal", "regular" | normal |
| "no rush", "when available", "low priority" | low |

## Task Splitting

If user requirement is large, split into multiple tasks:

1. Create main task (describe overall goal)
2. Create subtasks (each independently completable)
3. Set dependencies (depends_on field)

Example:
```
task_001_setup_project (main task)
  +-- task_002_init_structure (depends_on: [])
  +-- task_003_add_dependencies (depends_on: [task_002])
  +-- task_004_write_tests (depends_on: [task_003])
```

## Non-Continuous Tasks

If user doesn't use the above keywords, handle normally:
- Complete task directly in current conversation
- Don't create task files
- Don't involve Supervisor/Executor flow

## Collaboration Directory Structure

```
collaboration/
+-- queue/           # Pending tasks
+-- executing/       # Executing tasks
+-- completed/       # Completed tasks
+-- .autoclaude/     # System config and logs
+-- project_plan.md  # Project plan
+-- SUPERVISOR_GUIDE.md
+-- EXECUTOR_GUIDE.md
```

## Checking Task Status

User may ask about task status, in this case:
1. Read `collaboration/queue/`, `executing/`, `completed/` directories
2. Summarize status of each task
3. Report to user

Example response:
```
Current task status:
- In queue: 3 tasks
- Executing: 1 task
- Completed: 5 tasks

Executing:
- task_xxx: Implementing user login feature

In queue:
- task_yyy: Add unit tests (high)
- task_zzz: Optimize database queries (normal)
- task_aaa: Update documentation (low)
```
