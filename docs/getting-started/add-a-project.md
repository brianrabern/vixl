---
title: Adding a project
---

# Adding a project

## Using the left sidebar

1. Click the **Add project** button in the Chats toolbar of the sidebar.
2. Choose the folder in the native dialog.

If that folder is already registered, it becomes the active project.

You can also right-click empty sidebar and choose **Open Project**.

## Open the project page

Left-click the project in the sidebar to expand its chats. Right-click it and choose **Open Project** to open the project page. The page shows the project name and these tabs:

- **Chats**
- **MCP**
- **Graph**
- **Plans**
- **Skills**
- **Agents**
- **Rules**

Those tabs are the project-scoped copies of the same surfaces in Settings (MCP, plans, skills, agents, rules), plus chats and the [code graph](/concepts/code-graphs). Escape on the project page returns home. An unknown slug redirects home.

## Remove a project from the sidebar

Right-click the project, then **Remove from sidebar**. That drops the row from `projects.json`. It does not delete the project folder, its `.vixl` directory, chats, or graph indexes.

Graph stores can be deleted later in Settings, Graphs.

Next: [your first chat](/getting-started/your-first-chat).