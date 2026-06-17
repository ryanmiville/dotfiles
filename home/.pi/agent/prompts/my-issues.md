---
description: List my open JIRA issues via Atlassian Rovo MCP
argument-hint: "[extra-jql]"
---
Use the Atlassian Rovo MCP to find JIRA issues assigned to me that are still open.

In a single tool call, invoke `atlassian_rovo_searchJiraIssuesUsingJql` with:
- `cloudId`: `3a2b384e-326b-4f55-b635-9714ca748d7c` (horizon3ai)
- `jql`: `assignee = currentUser() AND statusCategory != Done${1:+ AND $1} ORDER BY updated DESC`
- `maxResults`: 50

(If the server isn't connected, connect to `atlassian-rovo` first, then make the single search call.)

Present the results as a concise markdown table with columns: Key, Summary, Type, Status, Priority. After the table, add one short line highlighting what's in progress vs blocked.
