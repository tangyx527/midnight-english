#!/usr/bin/env node

// 直接调用内置的 @cloudbase/cloudbase-mcp 包的 CLI
const path = require('path')
const { spawn } = require('child_process')

// 获取内置包的路径并拼接 CLI 路径
const mcpPackagePath = require.resolve('@cloudbase/cloudbase-mcp')
const mcpCliPath = path.join(path.dirname(mcpPackagePath), 'cli.cjs')

// 执行内置的 MCP CLI
const child = spawn('node', [mcpCliPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
})

child.on('close', (code) => {
    process.exit(code)
})

child.on('error', (err) => {
    console.error('Error executing cloudbase-mcp:', err)
    process.exit(1)
}) 