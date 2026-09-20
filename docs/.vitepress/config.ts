import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

const githubRepo = 'https://github.com/vixl-ai/vixl'

export default defineConfig({
  title: 'Vixl',
  description: 'Local-first LLMs UI',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://vixl.app',
  },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
  ],
  vite: {
    plugins: [
      llmstxt({
        domain: 'https://vixl.app',
      }),
    ],
  },
  themeConfig: {
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: `${githubRepo}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/getting-started/' },
      { text: 'GitHub', link: githubRepo },
      { text: 'Changelog', link: `${githubRepo}/releases` },
    ],
    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Overview', link: '/getting-started/' },
          { text: 'Philosophy', link: '/getting-started/philosophy' },
          { text: 'Installation', link: '/getting-started/installation' },
          {
            text: 'Set up providers and models',
            link: '/getting-started/set-up-providers-and-models',
          },
          { text: 'Add a project', link: '/getting-started/add-a-project' },
          { text: 'Your first chat', link: '/getting-started/your-first-chat' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'How Vixl works', link: '/concepts/' },
          { text: 'Chat modes', link: '/concepts/chat-modes' },
          {
            text: 'Permissions and approvals',
            link: '/concepts/permissions-and-approvals',
          },
          {
            text: 'Projects and home chats',
            link: '/concepts/projects-and-home-chats',
          },
          { text: 'Models and roles', link: '/concepts/models-and-roles' },
          { text: 'Context', link: '/concepts/context' },
          { text: 'Code graphs', link: '/concepts/code-graphs' },
          { text: 'The .vixl directory', link: '/concepts/the-vixl-directory' },
        ],
      },
      {
        text: 'Using Vixl',
        items: [
          { text: 'Manage chats', link: '/using/manage-chats' },
          {
            text: 'Queue and stop messages',
            link: '/using/queue-and-stop-messages',
          },
          {
            text: 'Review and restore changes',
            link: '/using/review-and-restore-changes',
          },
          {
            text: 'Compact and hand off long chats',
            link: '/using/compact-and-hand-off-long-chats',
          },
          { text: 'Export a transcript', link: '/using/export-a-transcript' },
          { text: 'Work with plans', link: '/using/work-with-plans' },
          {
            text: 'Orchestrate sub-agents',
            link: '/using/orchestrate-sub-agents',
          },
          { text: 'Best practices', link: '/using/best-practices' },
          { text: 'Use the workbench', link: '/using/use-the-workbench' },
          {
            text: 'Shortcuts and the command palette',
            link: '/using/shortcuts-and-the-command-palette',
          },
        ],
      },
      {
        text: 'Customize',
        items: [
          { text: 'Providers', link: '/customize/providers' },
          { text: 'Models', link: '/customize/models' },
          { text: 'MCP servers', link: '/customize/mcp-servers' },
          { text: 'Skills', link: '/customize/skills' },
          { text: 'Custom agents', link: '/customize/custom-agents' },
          {
            text: 'Rules and AGENTS.md',
            link: '/customize/rules-and-agents-md',
          },
          { text: 'Language servers', link: '/customize/language-servers' },
          { text: 'Appearance', link: '/customize/appearance' },
          {
            text: 'Permission settings',
            link: '/customize/permission-settings',
          },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'settings.json', link: '/reference/settings-json' },
          { text: 'mcp.json', link: '/reference/mcp-json' },
          {
            text: 'Custom agent frontmatter',
            link: '/reference/custom-agent-frontmatter',
          },
          { text: 'SKILL.md format', link: '/reference/skill-md-format' },
          {
            text: 'Keyboard shortcuts',
            link: '/reference/keyboard-shortcuts',
          },
          { text: 'Chat statuses', link: '/reference/chat-statuses' },
          { text: '.vixl layout', link: '/reference/vixl-layout' },
          {
            text: 'Managed components',
            link: '/reference/managed-components',
          },
        ],
      },
      {
        text: 'Resources',
        items: [
          { text: 'Troubleshooting', link: '/resources/troubleshooting' },
          { text: 'FAQ', link: '/resources/faq' },
          { text: 'Privacy', link: '/resources/privacy' },
          { text: 'Comparison', link: '/resources/comparison' },
          { text: 'Roadmap', link: '/resources/roadmap' },
          { text: 'Changelog', link: `${githubRepo}/releases` },
        ],
      },
    ],
  },
})
