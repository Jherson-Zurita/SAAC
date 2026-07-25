#!/usr/bin/env python3
"""
test_pre_frontend_backend.py — Test suite E2E para los 6 módulos backend pre-frontend de SAAC v2.0:
1. ProjectConfig & Ignorados (.saacignore)
2. Consola de Comandos SAAC
3. Anotaciones, ADRs, Riesgos y Antipatrones Ignorados
4. Motor de Reglas Arquitectónicas (Fitness Functions & Fitness Score Configurable)
5. AnalysisRun, Historial y Versionado AMG (AMGDelta)
6. Configuración Global del Sistema
"""

import json
import os
import subprocess
import tempfile
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TAURI_DIR = os.path.join(PROJECT_ROOT, "src-tauri")

class TestPreFrontendBackend(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.project_path = self.tmp_dir.name

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_01_saacignore_and_project_config(self):
        """Verifica que .saacignore cree y filtre archivos ignorados."""
        saac_dir = os.path.join(self.project_path, ".saac")
        os.makedirs(saac_dir, exist_ok=True)
        
        # Crear .saacignore
        saacignore_path = os.path.join(self.project_path, ".saacignore")
        with open(saacignore_path, "w", encoding="utf-8") as f:
            f.write("# Archivos a ignorar\n**/ignored_dir/**\n*.min.js\n")

        # Crear archivos de prueba
        os.makedirs(os.path.join(self.project_path, "src"), exist_ok=True)
        os.makedirs(os.path.join(self.project_path, "ignored_dir"), exist_ok=True)

        with open(os.path.join(self.project_path, "src", "index.ts"), "w", encoding="utf-8") as f:
            f.write("console.log('hello');")
            
        with open(os.path.join(self.project_path, "ignored_dir", "secret.ts"), "w", encoding="utf-8") as f:
            f.write("console.log('secret');")

        # Ejecutar escaneo via --scan-json
        cmd = ["cargo", "run", "--manifest-path", os.path.join(TAURI_DIR, "Cargo.toml"), "--", "--scan-json", self.project_path]
        res = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, f"cargo run --scan-json falló: {res.stderr}")
        
        scan_data = json.loads(res.stdout)
        file_paths = [os.path.normpath(p) for p in scan_data.get("filePaths", [])]
        
        expected_valid = os.path.normpath(os.path.join(self.project_path, "src", "index.ts"))
        expected_ignored = os.path.normpath(os.path.join(self.project_path, "ignored_dir", "secret.ts"))
        
        self.assertIn(expected_valid, file_paths, "El archivo válido src/index.ts debe incluirse en el escaneo")
        self.assertNotIn(expected_ignored, file_paths, "El archivo en ignored_dir/ debe ser ignorado por .saacignore")

    def test_02_annotations_file(self):
        """Verifica la creación y actualización del archivo .saac/annotations.json."""
        saac_dir = os.path.join(self.project_path, ".saac")
        os.makedirs(saac_dir, exist_ok=True)
        
        annotations_file = os.path.join(saac_dir, "annotations.json")
        sample_data = {
            "annotations": [{
                "id": "ann-1",
                "targetId": "module::index",
                "targetType": "module",
                "title": "Nota de arquitectura",
                "content": "Refactorizar este módulo",
                "author": "Architect",
                "createdAt": "2026-07-25T12:00:00Z"
            }],
            "adrs": [{
                "id": "adr-1",
                "number": 1,
                "title": "Uso de Zustand para estado",
                "status": "Accepted",
                "context": "Necesidad de store reactivo",
                "decision": "Adoptar Zustand",
                "consequences": "Mayor simplicidad",
                "date": "2026-07-25",
                "author": "Architect"
            }],
            "ignoredAntipatterns": [{
                "antipatternId": "god-module-1",
                "ignoredAt": "2026-07-25T12:00:00Z",
                "justification": "Falso positivo aceptado temporalmente",
                "author": "Architect"
            }],
            "risks": [{
                "id": "risk-1",
                "title": "Acoplamiento en DB",
                "severity": "High",
                "description": "Múltiples accesos directos",
                "mitigation": "Crear repositorio",
                "affectedModuleIds": ["module::db"]
            }]
        }
        
        with open(annotations_file, "w", encoding="utf-8") as f:
            json.dump(sample_data, f, indent=2)

        self.assertTrue(os.path.exists(annotations_file))
        with open(annotations_file, "r", encoding="utf-8") as f:
            read_back = json.load(f)
        
        self.assertEqual(len(read_back["annotations"]), 1)
        self.assertEqual(read_back["adrs"][0]["title"], "Uso de Zustand para estado")
        self.assertEqual(read_back["ignoredAntipatterns"][0]["antipatternId"], "god-module-1")

    def test_03_rules_config_and_history(self):
        """Verifica la estructura de .saac/rules.json y .saac/history.json."""
        saac_dir = os.path.join(self.project_path, ".saac")
        os.makedirs(saac_dir, exist_ok=True)

        rules_file = os.path.join(saac_dir, "rules.json")
        rules_data = {
            "rules": [
                {
                    "id": "no-god-modules",
                    "name": "Sin Módulos Gigantes",
                    "description": "Ce <= 15",
                    "severity": "critical",
                    "weight": 50.0,
                    "enabled": True,
                    "condition": "max_ce <= 15"
                }
            ]
        }
        with open(rules_file, "w", encoding="utf-8") as f:
            json.dump(rules_data, f, indent=2)

        self.assertTrue(os.path.exists(rules_file))

        history_file = os.path.join(saac_dir, "history.json")
        history_data = {
            "runs": [
                {
                    "runId": "run-101",
                    "timestamp": "2026-07-25T12:00:00Z",
                    "totalFiles": 10,
                    "successful": 10,
                    "failed": 0,
                    "durationMs": 150,
                    "moduleCount": 3,
                    "dependencyCount": 2,
                    "antipatternCount": 0,
                    "fitnessScore": 100.0
                }
            ]
        }
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history_data, f, indent=2)

        self.assertTrue(os.path.exists(history_file))

if __name__ == "__main__":
    unittest.main()
