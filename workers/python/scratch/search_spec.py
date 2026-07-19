"""Busca referencias a lenguajes en la especificación técnica con print seguro."""
import sys

with open("d:/Elvis/Semestre 2-2026/SAAC/SAAC_v2.0_Especificacion_Tecnica.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    l = line.lower()
    if "rust" in l or "swift" in l or "go" in l or "kotlin" in l or "java" in l:
        safe_line = line.strip().encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding)
        print(f"Line {i+1}: {safe_line}")
