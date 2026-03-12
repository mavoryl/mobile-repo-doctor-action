#!/usr/bin/env node

// action/summary.mjs — GitHub Step Summary generator + fail-on policy evaluator
// Pure Node.js, zero dependencies.

import { readFileSync, appendFileSync } from 'node:fs';

const [reportPath, failOn, cliExitStr] = process.argv.slice(2);

if (!reportPath || !failOn || cliExitStr === undefined) {
  console.error('Usage: summary.mjs <report.json> <fail-on> <cli-exit-code>');
  process.exit(2);
}

const cliExit = parseInt(cliExitStr, 10);

// If CLI exited with 2 (error), propagate immediately
if (cliExit === 2) {
  console.error('CLI scan failed with exit code 2');
  setOutput('exit_code', '2');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf-8'));
} catch (err) {
  console.error(`Failed to read report: ${err.message}`);
  setOutput('exit_code', '2');
  process.exit(2);
}

const { score, findings, topIssues, quickWins } = report;

// Count severities
const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
for (const f of findings) {
  counts[f.severity] = (counts[f.severity] || 0) + 1;
}

// Build Step Summary markdown
const lines = [];
lines.push(`## 🩺 Mobile Repo Doctor: ${score.overall}/100 (${score.grade})`);
lines.push('');
lines.push('| Axis | Score |');
lines.push('|------|-------|');
lines.push(`| Size | ${score.axes.size} |`);
lines.push(`| Speed | ${score.axes.speed} |`);
lines.push(`| Stability | ${score.axes.stability} |`);
lines.push(`| Hygiene | ${score.axes.hygiene} |`);
lines.push('');
lines.push('### Findings');
lines.push('');
lines.push('| Severity | Count |');
lines.push('|----------|-------|');
lines.push(`| Critical | ${counts.critical} |`);
lines.push(`| High | ${counts.high} |`);
lines.push(`| Medium | ${counts.medium} |`);
lines.push(`| Low | ${counts.low} |`);
lines.push(`| Info | ${counts.info} |`);

if (topIssues && topIssues.length > 0) {
  lines.push('');
  lines.push('### Top Issues');
  lines.push('');
  const shown = topIssues.slice(0, 5);
  for (const issue of shown) {
    lines.push(`- **[${capitalize(issue.severity)}]** ${issue.title}`);
  }
}

if (quickWins && quickWins.length > 0) {
  lines.push('');
  lines.push('### Quick Wins');
  lines.push('');
  const shown = quickWins.slice(0, 3);
  for (const qw of shown) {
    lines.push(`- ${qw.title} _(horizon: ${qw.horizon})_`);
  }
}

lines.push('');

// Write Step Summary
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  appendFileSync(summaryPath, lines.join('\n'), 'utf-8');
} else {
  // Local testing: print to stdout
  console.log(lines.join('\n'));
}

// Set outputs
setOutput('score', String(score.overall));
setOutput('grade', score.grade);
setOutput('findings_count', String(findings.length));
setOutput('critical_count', String(counts.critical));
setOutput('high_count', String(counts.high));

// Evaluate fail-on policy
let finalExit = 0;

if (failOn === 'none') {
  finalExit = 0;
} else if (failOn === 'critical') {
  finalExit = counts.critical > 0 ? 1 : 0;
} else if (failOn === 'high') {
  finalExit = (counts.critical > 0 || counts.high > 0) ? 1 : 0;
} else if (failOn.startsWith('score-below-')) {
  const threshold = parseInt(failOn.replace('score-below-', ''), 10);
  if (isNaN(threshold)) {
    console.error(`Invalid fail-on threshold: ${failOn}`);
    finalExit = 2;
  } else {
    finalExit = score.overall < threshold ? 1 : 0;
  }
} else {
  console.error(`Unknown fail-on policy: ${failOn}`);
  finalExit = 2;
}

setOutput('exit_code', String(finalExit));
process.exit(finalExit);

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `${name}=${value}\n`, 'utf-8');
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
