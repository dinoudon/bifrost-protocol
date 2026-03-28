## 2025-05-22 - Optimizing Task Retrieval in SQLite
**Learning:** Retrieving all unassigned tasks and filtering them in JavaScript is a bottleneck (O(N) data transfer and processing) when the task list grows. SQLite 3.38+ supports JSON functions that allow offloading this filtering to the database layer. Additionally, missing indexes on status and priority columns lead to full table scans.
**Action:** Use `json_each` and `json_array_length` to filter JSON skill arrays in SQL. Implement composite indexes for common query patterns like `status` and `priority`.
