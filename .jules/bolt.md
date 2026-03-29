## 2026-03-29 - Optimize availableTasks with SQLite JSON filtering
**Learning:** SQLite's json_each and json_array_length are significantly more efficient than filtering JSON columns in JavaScript after fetching. Using EXISTS with json_each allows for clean and fast intersection checks directly in the database.
**Action:** Always consider offloading JSON array filtering to SQLite using json_each and indexes when performance is a concern.
