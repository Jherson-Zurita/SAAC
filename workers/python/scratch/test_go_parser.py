"""Test para el parser de Go sin unicode problem."""
import sys
import os
import json
import shutil

sys.path.insert(0, "workers/python")

from parsers.go import parse_go

GO_CODE = """
package main

import (
    "fmt"
    "strings"
    . "math"
)

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Circle struct {
    Radius float64
    name   string
}

func NewCircle(radius float64) *Circle {
    return &Circle{Radius: radius}
}

func (c *Circle) Area() float64 {
    if c.Radius > 0 {
        return Pi * c.Radius * c.Radius
    }
    return 0
}

func (c *Circle) Perimeter() float64 {
    return 2 * Pi * c.Radius
}

func (c *Circle) UpdateName(n string) {
    c.name = n
}

func calculate(x int, y ...int) int {
    if x > 0 && len(y) > 0 {
        return x + y[0]
    }
    return x
}
"""

TEMP = "workers/python/scratch/temp_go"
os.makedirs(TEMP, exist_ok=True)
go_file = os.path.join(TEMP, "TestFile.go")
with open(go_file, "w", encoding="utf-8") as f:
    f.write(GO_CODE)

result = parse_go(go_file)
mod = result["module"]
classes = mod["classes"]
functions = mod["functions"]

# Assertions
errors = []

# Imports
expected_imports = {"fmt", "strings", "math"}
got_imports = set(mod["imports"])
if expected_imports != got_imports:
    errors.append(f"Expected imports {expected_imports}, got {got_imports}")

# Classes count: Shape (interface), Circle (struct)
if len(classes) != 2:
    errors.append(f"Expected 2 classes, got {len(classes)}: {[c['name'] for c in classes]}")

# Circle struct assertions
circle = next((c for c in classes if c["name"] == "Circle"), None)
if not circle:
    errors.append("Circle struct not found!")
else:
    if circle["visibility"] != "public":
        errors.append(f"Circle.visibility: expected 'public', got '{circle['visibility']}'")
    if not circle["isStruct"]:
        errors.append("Circle should be a struct")
    
    # Attributes
    attr_names = {a["name"] for a in circle["attributes"]}
    for expected in ("Radius", "name"):
        if expected not in attr_names:
            errors.append(f"Circle missing attribute '{expected}': {attr_names}")
    
    rad_attr = next((a for a in circle["attributes"] if a["name"] == "Radius"), None)
    if rad_attr:
        if rad_attr["visibility"] != "public":
            errors.append(f"Radius visibility: expected 'public', got '{rad_attr['visibility']}'")
            
    name_attr = next((a for a in circle["attributes"] if a["name"] == "name"), None)
    if name_attr:
        if name_attr["visibility"] != "private":
            errors.append(f"name visibility: expected 'private', got '{name_attr['visibility']}'")

    # Methods
    method_names = {m["name"] for m in circle["methods"]}
    for expected in ("Area", "Perimeter", "UpdateName"):
        if expected not in method_names:
            errors.append(f"Circle missing method '{expected}': {method_names}")
            
    area_method = next((m for m in circle["methods"] if m["name"] == "Area"), None)
    if area_method:
        if area_method["cyclomaticComplexity"] != 2:
            errors.append(f"Area() CC: expected 2 (has if), got {area_method['cyclomaticComplexity']}")

    # LCOM4: Area y Perimeter acceden a Radius. UpdateName accede a name.
    # Hay dos grupos disjuntos: {Area, Perimeter} y {UpdateName}.
    # Por tanto, LCOM4 debe ser 2.
    if circle["metrics"]["lcom4"] != 2:
        errors.append(f"Circle LCOM4: expected 2, got {circle['metrics']['lcom4']}")

# Shape interface assertions
shape = next((c for c in classes if c["name"] == "Shape"), None)
if not shape:
    errors.append("Shape interface not found!")
else:
    if not shape["isInterface"]:
        errors.append("Shape should be an interface")
    if not shape["isAbstract"]:
        errors.append("Shape should be abstract")
    for m in shape["methods"]:
        if not m["isAbstract"]:
            errors.append(f"Shape.{m['name']} should be abstract")

# Global functions assertions
if len(functions) != 2:
    errors.append(f"Expected 2 global functions (NewCircle, calculate), got {len(functions)}: {[f['name'] for f in functions]}")

calc_fn = next((f for f in functions if f["name"] == "calculate"), None)
if calc_fn:
    if calc_fn["visibility"] != "private":
        errors.append(f"calculate visibility: expected 'private', got '{calc_fn['visibility']}'")
    if calc_fn["cyclomaticComplexity"] != 3:
        # 1 (base) + 1 (if) + 1 (&&)
        errors.append(f"calculate() CC: expected 3, got {calc_fn['cyclomaticComplexity']}")
    
    # parameters
    params = calc_fn["parameters"]
    if len(params) != 2:
        errors.append(f"calculate() params: expected 2, got {len(params)}")
    else:
        p_x, p_y = params
        if p_x["name"] != "x" or p_x["isVariadic"]:
            errors.append("Param 1: expected name 'x', non-variadic")
        if p_y["name"] != "y" or not p_y["isVariadic"]:
            errors.append("Param 2: expected name 'y', variadic")

if errors:
    print(f"\n[FAIL] {len(errors)} FAILURES:")
    for e in errors:
        print(f"  - {e}")
else:
    print("\n[SUCCESS] ALL ASSERTIONS PASSED!")

shutil.rmtree(TEMP)
