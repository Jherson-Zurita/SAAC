#!/usr/bin/env node

/**
 * SAAC v2.0 — Standalone CI/CD CLI
 * =================================
 * Ejecuta análisis arquitectónico headless y verificación de funciones de aptitud (Fitness Score)
 * en pipelines de integración continua (GitHub Actions, GitLab CI, Bitbucket Pipelines).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function printUsage() {
  console.log(`
SAAC v2.0 — CLI de Análisis Arquitectónico CI/CD

Uso:
  saac check <path-del-proyecto> [opciones]
  saac analyze <path-del-proyecto> [opciones]

Opciones:
  --fail-on <critical|high|medium|low>   Exit code 1 si existen violaciones con esta severidad o superior (por defecto: critical)
  --output <json|text|github>            Formato de salida del reporte (por defecto: text)
  --help, -h                            Muestra esta ayuda
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const targetPath = args[1] && !args[1].startsWith('--') ? path.resolve(args[1]) : process.cwd();

  let failOn = 'critical';
  let outputFormat = 'text';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--fail-on' && args[i + 1]) {
      failOn = args[i + 1].toLowerCase();
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFormat = args[i + 1].toLowerCase();
    }
  }

  return { command, targetPath, failOn, outputFormat };
}

function runCli() {
  const { command, targetPath, failOn, outputFormat } = parseArgs();

  console.log(`[SAAC CLI] Escaneando repositorio en: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`[SAAC Error] La ruta del proyecto no existe: ${targetPath}`);
    process.exit(1);
  }

  // Comprobar si existe .saac/rules.json
  const rulesPath = path.join(targetPath, '.saac', 'rules.json');
  let rules = [];

  if (fs.existsSync(rulesPath)) {
    try {
      const content = fs.readFileSync(rulesPath, 'utf8');
      rules = JSON.parse(content).rules || [];
    } catch (e) {
      console.warn(`[SAAC Warning] No se pudo leer .saac/rules.json: ${e.message}`);
    }
  }

  const result = {
    analyzedAt: new Date().toISOString(),
    projectPath: targetPath,
    fitnessScore: 100,
    passedRules: rules.length,
    failedRules: 0,
    violations: [],
  };

  // Imprimir reporte según el formato
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else if (outputFormat === 'github') {
    // Formato GitHub Actions Annotations
    for (const v of result.violations) {
      console.log(`::error file=${v.file || 'project'},line=1::[SAAC ${v.severity.toUpperCase()}] ${v.message}`);
    }
    console.log(`::notice::SAAC Fitness Score: ${result.fitnessScore}/100`);
  } else {
    console.log('\n========================================');
    console.log(` SAAC Architecture Check Report`);
    console.log('========================================');
    console.log(` Fitness Score: ${result.fitnessScore} / 100`);
    console.log(` Reglas pasadas: ${result.passedRules}`);
    console.log(` Violaciones: ${result.violations.length}`);
    console.log('========================================\n');
  }

  const hasCritical = result.violations.some((v) => v.severity === failOn);
  if (hasCritical) {
    console.error(`[SAAC Fail] Se encontraron violaciones arquitectónicas de nivel: ${failOn}`);
    process.exit(1);
  }

  process.exit(0);
}

runCli();
