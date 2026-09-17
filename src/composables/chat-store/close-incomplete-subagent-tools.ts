import type { ToolRun } from '@/types/harness/tool-run'

const closeIncompleteSubagentTools = (tools: ToolRun[]): ToolRun[] =>
  tools.map((tool) =>
    tool.status === 'running'
      ? {
          ...tool,
          status: 'error' as const,
          result: { error: 'Tool did not complete' },
        }
      : tool,
  )

export default closeIncompleteSubagentTools
