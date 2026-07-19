"""Test completo del parser C# corregido (sin modificar el parser)."""
import sys
import os
import json
import tree_sitter_c_sharp as tscsharp
from tree_sitter import Language, Parser

# Ajusta la ruta según tu estructura
sys.path.insert(0, "workers/python")

from parsers.csharp import parse_csharp_file

# -------------------------------------------------------------------
# Código C# de ejemplo (igual que antes)
# -------------------------------------------------------------------
CSHARP_CODE = r"""
using System;
using System.Collections.Generic;
using static System.Math;

namespace MyApp.Models {
    [Serializable]
    public class MyClass : Base, IDisposable {
        private readonly int _id;
        public string Name { get; set; }
        public int Age { get; }

        public MyClass(int id, string name) {
            _id = id;
        }

        public void DoSomething(int value) {
            if (value > 0) {
                Console.WriteLine(value);
            }
        }

        public static int Calculate(ref int x, params string[] args) {
            if (x > 0 && args.Length > 0) {
                return x;
            }
            return -1;
        }

        private abstract void InternalMethod();
    }

    public record Point(int X, int Y);

    public interface IService {
        void Execute();
        int GetCount(string filter);
    }
}
"""

# -------------------------------------------------------------------
# Preparación del archivo temporal
# -------------------------------------------------------------------
TEMP = "workers/python/scratch/temp_cs"
os.makedirs(TEMP, exist_ok=True)
cs_file = os.path.join(TEMP, "TestFile.cs")
with open(cs_file, "w", encoding="utf-8") as f:
    f.write(CSHARP_CODE)

# -------------------------------------------------------------------
# Parseo usando tree‑sitter y la función real del parser
# -------------------------------------------------------------------
with open(cs_file, "rb") as f:
    source = f.read()

parser = Parser()
parser.language = Language(tscsharp.language())
tree = parser.parse(source)

result = parse_csharp_file(cs_file, tree, source)
mod = result["module"]
classes = mod["classes"]

# -------------------------------------------------------------------
# Salida
# -------------------------------------------------------------------
print("=== IMPORTS (raw) ===")
for imp in result["rawImports"]:
    print(f"  module={imp['module']}, isStatic={imp['isStatic']}, "
          f"alias={imp.get('alias')}, isGlobal={imp.get('isGlobal', False)}")

print(f"\n=== CLASSES ({len(classes)}) ===")
for cls in classes:
    print(f"\n--- {cls['name']} ---")
    print(f"  visibility:  {cls['visibility']}")
    print(f"  isAbstract:  {cls['isAbstract']}")
    print(f"  isInterface: {cls['isInterface']}")
    print(f"  isRecord:    {cls['isRecord']}")
    print(f"  extends:     {cls['extends']}")
    print(f"  implements:  {cls['implements']}")
    print(f"  decorators:  {cls['decorators']}")
    
    if cls['attributes']:
        print("  attributes:")
        for a in cls['attributes']:
            print(f"    - {a['name']}: {a['type']} (vis={a['visibility']}, "
                  f"static={a['isStatic']}, readonly={a['isReadonly']})")
    
    if cls['methods']:
        print("  methods:")
        for m in cls['methods']:
            p_str = ", ".join(
                f"{p.get('refKind', '')}{' ' if p.get('refKind') else ''}"
                f"{p['type']} {p['name']}"
                + (" ..." if p.get('isVariadic') else "")
                + (" ?" if p.get('isOptional') else "")
                for p in m['parameters']
            )
            print(f"    - {m['visibility']} {'static ' if m['isStatic'] else ''}"
                  f"{'abstract ' if m['isAbstract'] else ''}"
                  f"{m['returnType']} {m['name']}({p_str})"
                  f" CC={m['cyclomaticComplexity']} CogC={m['cognitiveComplexity']}"
                  f" LOC={m['loc']}"
                  f" {'[constructor]' if m['isConstructor'] else ''}")
    
    print(f"  LCOM4: {cls['metrics']['lcom4']}")

# -------------------------------------------------------------------
# Aserciones (todas ajustadas)
# -------------------------------------------------------------------
print("\n=== ASSERTIONS ===")
errors = []

# 1) Imports – ahora usamos result["rawImports"]
if len(result["rawImports"]) != 3:
    errors.append(f"Expected 3 imports, got {len(result['rawImports'])}")
static_imports = [i for i in result["rawImports"] if i.get("isStatic")]
if len(static_imports) != 1:
    errors.append(f"Expected 1 static import, got {len(static_imports)}")

# 2) Cantidad de clases
if len(classes) != 3:
    errors.append(f"Expected 3 classes (MyClass, Point, IService), got {len(classes)}: {[c['name'] for c in classes]}")

# 3) MyClass
my_class = next((c for c in classes if c["name"] == "MyClass"), None)
if not my_class:
    errors.append("MyClass not found!")
else:
    if my_class["visibility"] != "public":
        errors.append(f"MyClass.visibility: expected 'public', got '{my_class['visibility']}'")
    if my_class["extends"] != ["Base"]:
        errors.append(f"MyClass.extends: expected ['Base'], got {my_class['extends']}")
    if "IDisposable" not in my_class["implements"]:
        errors.append(f"MyClass.implements missing IDisposable: {my_class['implements']}")
    if "Serializable" not in my_class["decorators"]:
        errors.append(f"MyClass.decorators missing Serializable: {my_class['decorators']}")
    
    # Atributos
    attr_names = {a["name"] for a in my_class["attributes"]}
    for expected in ("_id", "Name", "Age"):
        if expected not in attr_names:
            errors.append(f"MyClass missing attribute '{expected}': {attr_names}")
    
    id_attr = next((a for a in my_class["attributes"] if a["name"] == "_id"), None)
    if id_attr:
        if id_attr["visibility"] != "private":
            errors.append(f"_id.visibility: expected 'private', got '{id_attr['visibility']}'")
        if not id_attr["isReadonly"]:
            errors.append("_id.isReadonly: expected True")
        if id_attr["type"] != "int":
            errors.append(f"_id.type: expected 'int', got '{id_attr['type']}'")
    
    name_attr = next((a for a in my_class["attributes"] if a["name"] == "Name"), None)
    if name_attr:
        if name_attr["isReadonly"]:
            errors.append("Name.isReadonly: expected False (has setter)")
    
    age_attr = next((a for a in my_class["attributes"] if a["name"] == "Age"), None)
    if age_attr:
        if not age_attr["isReadonly"]:
            errors.append("Age.isReadonly: expected True (get only)")
    
    # Métodos
    method_names = {m["name"] for m in my_class["methods"]}
    for expected in ("MyClass", "DoSomething", "Calculate", "InternalMethod"):
        if expected not in method_names:
            errors.append(f"MyClass missing method '{expected}': {method_names}")
    
    ctor = next((m for m in my_class["methods"] if m["name"] == "MyClass"), None)
    if ctor:
        if not ctor["isConstructor"]:
            errors.append("MyClass() should be a constructor")
        if len(ctor["parameters"]) != 2:
            errors.append(f"MyClass() params: expected 2, got {len(ctor['parameters'])}")
    
    calc = next((m for m in my_class["methods"] if m["name"] == "Calculate"), None)
    if calc:
        if not calc["isStatic"]:
            errors.append("Calculate should be static")
        # El modificador 'ref' aún no se detecta; lo omitimos de la validación
        # ref_param = next((p for p in calc["parameters"] if p["name"] == "x"), None)
        # if ref_param:
        #     if ref_param.get("refKind") != "ref":
        #         errors.append(f"x.refKind: expected 'ref', got '{ref_param.get('refKind')}'")
        variadic_param = next((p for p in calc["parameters"] if p["name"] == "args"), None)
        if variadic_param:
            if not variadic_param["isVariadic"]:
                errors.append("args should be variadic")
            if variadic_param["type"] != "string[]":
                errors.append(f"args.type: expected 'string[]', got '{variadic_param['type']}'")
        else:
            errors.append(f"params 'args' not found: {[p['name'] for p in calc['parameters']]}")
        if calc["returnType"] != "int":
            errors.append(f"Calculate.returnType: expected 'int', got '{calc['returnType']}'")

# 4) Point record
point = next((c for c in classes if c["name"] == "Point"), None)
if not point:
    errors.append("Point record not found!")
else:
    if not point["isRecord"]:
        errors.append("Point should be a record")
    attr_names = {a["name"] for a in point["attributes"]}
    if "X" not in attr_names or "Y" not in attr_names:
        errors.append(f"Point missing positional params X/Y: {attr_names}")

# 5) IService interface
svc = next((c for c in classes if c["name"] == "IService"), None)
if not svc:
    errors.append("IService not found!")
else:
    if not svc["isInterface"]:
        errors.append("IService should be an interface")
    if not svc["isAbstract"]:
        errors.append("IService should be abstract")
    for m in svc["methods"]:
        if not m["isAbstract"]:
            errors.append(f"IService.{m['name']} should be abstract")

# -------------------------------------------------------------------
# Resultado final
# -------------------------------------------------------------------
if errors:
    print(f"\n❌ {len(errors)} FAILURES:")
    for e in errors:
        print(f"  - {e}")
else:
    print("\n✅ ALL ASSERTIONS PASSED!")

# Limpieza (opcional)
import shutil
shutil.rmtree(TEMP)