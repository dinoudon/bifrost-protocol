## 2025-05-22 - Initial Bolt Optimization in Bifrost Protocol
**Learning:** SQLite 3.38+ supports powerful JSON filtering that can offload intensive JavaScript filtering back to the database.
**Action:** Use `json_each` and `json_array_length` for skill-based filtering in `availableTasks` to reduce row fetching and manual filtering overhead.
