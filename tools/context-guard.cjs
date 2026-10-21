#!/usr/bin/env node
'use strict';

/**
 * CONQUER context guard.
 * On each PR targeting main, code/assets/test changes require an updated
 * STATUS + BACKLOG + CHANGELOG in the SAME PR. No semantic content is invented.
 */
const { execFileSync } = require('node:child_process');

const REQUIRED = Object.freeze([
  'docs/context/STATUS.md',
  'docs/context/BACKLOG.md',
  'docs/context/CHANGELOG.md',
]);

function isOperational(path) {
  return (
    /^(src|qa|camp|assets|public|scripts|tools|server|supabase)\//.test(path) ||
    /^(index\.html|package(-lock)?\.json|vercel\.json)$/.test(path)
  ) && !path.endsWith('.md');
}

function validate(changedFiles) {
  const touched = new Set(changedFiles);
  const relevant = changedFiles.filter(isOperational);
  return {
    relevant,
    missing: relevant.length ? REQUIRED.filter(path => !touched.has(path)) : [],
  };
}

function gitChangedFiles(base, head) {
  // Both values come from immutable GitHub PR SHA fields in the workflow.
  if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(head)) {
    throw new Error('Expected 40-char commit SHA for base and head');
  }
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', base + '...' + head],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  return out.split(/\r?\n/).filter(Boolean);
}

function main() {
  const base = process.env.CONTEXT_BASE_SHA;
  const head = process.env.CONTEXT_HEAD_SHA;
  if (!base || !head) {
    console.error('Missing CONTEXT_BASE_SHA / CONTEXT_HEAD_SHA (PR SHAs).');
    process.exitCode = 2;
    return;
  }
  try {
    const files = gitChangedFiles(base, head);
    const { relevant, missing } = validate(files);
    if (!relevant.length) {
      console.log('Context guard: documentation-only/infrastructure PR; no gameplay state update required.');
      return;
    }
    console.log('Context guard: ' + relevant.length + ' operational files changed.');
    if (missing.length) {
      console.error('\nPR CONTEXT INCOMPLETE: the same PR must update:');
      for (const path of missing) console.error('  - ' + path);
      console.error('\nUpdate STATUS (what/where/test evidence), BACKLOG (done/open/dependencies) and CHANGELOG (dated entry).');
      console.error('ROADMAP and DECISIONS must also be updated when priorities/architecture change, otherwise explicitly mark them unchanged in the PR description.');
      process.exitCode = 1;
    } else {
      console.log('Required pyramid files are present in the PR diff.');
      console.log('Remember to update ROADMAP/DECISIONS when necessary and distinguish CODE / QA / MERGED.');
    }
  } catch (err) {
    console.error('Context guard could not validate this PR: ' + (err && err.message || err));
    process.exitCode = 2; // Fail closed if Git history is missing.
  }
}

if (require.main === module) main();
module.exports = { REQUIRED, isOperational, validate, gitChangedFiles };
