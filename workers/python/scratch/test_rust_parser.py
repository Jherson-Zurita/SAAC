"""Test para el parser de Rust sin unicode problem."""
import sys
import os
import json
import shutil

sys.path.insert(0, "workers/python")

from parsers.rust import parse_rust

RUST_CODE = """
use std::fmt;
use std::collections::HashMap;
use std::io as my_io;
use crate::qux::*;

pub trait Drawable {
    fn draw(&self);
    fn area(&self) -> f64;
}

pub struct Circle {
    pub radius: f64,
    name: String,
}

impl Circle {
    pub fn new(radius: f64) -> Self {
        Circle { radius, name: String::new() }
    }

    fn internal_calc(&self) -> f64 {
        if self.radius > 0.0 && self.name.len() > 0 {
            return self.radius * 2.0;
        }
        0.0
    }
}

impl Drawable for Circle {
    fn draw(&self) {
        println!("circle");
    }

    fn area(&self) -> f64 {
        3.14 * self.radius * self.radius
    }
}

pub enum Shape {
    Circle(Circle),
    Rectangle { width: f64, height: f64 },
}

pub fn calculate(x: i32, y: &str) -> i32 {
    if x > 0 {
        return x;
    }
    -1
}
"""

TEMP = "workers/python/scratch/temp_rust"
os.makedirs(TEMP, exist_ok=True)
rust_file = os.path.join(TEMP, "TestFile.rs")
with open(rust_file, "w", encoding="utf-8") as f:
    f.write(RUST_CODE)

result = parse_rust(rust_file)
mod = result["module"]
classes = mod["classes"]
functions = mod["functions"]

# Assertions
errors = []

# Imports
expected_imports = {"std::fmt", "std::collections::HashMap", "std::io", "crate::qux"}
got_imports = set(mod["imports"])
if expected_imports != got_imports:
    errors.append(f"Expected imports {expected_imports}, got {got_imports}")

# Classes count: Drawable (trait), Circle (struct), Shape (enum)
if len(classes) != 3:
    errors.append(f"Expected 3 classes, got {len(classes)}: {[c['name'] for c in classes]}")

# Circle struct assertions
circle = next((c for c in classes if c["name"] == "Circle"), None)
if not circle:
    errors.append("Circle struct not found!")
else:
    if circle["visibility"] != "public":
        errors.append(f"Circle visibility: expected 'public', got '{circle['visibility']}'")
    if not circle["isStruct"]:
        errors.append("Circle should be a struct")
    if "Drawable" not in circle["implements"]:
        errors.append(f"Circle implements missing Drawable: {circle['implements']}")
    
    # Attributes
    attr_names = {a["name"] for a in circle["attributes"]}
    for expected in ("radius", "name"):
        if expected not in attr_names:
            errors.append(f"Circle missing attribute '{expected}': {attr_names}")
            
    rad_attr = next((a for a in circle["attributes"] if a["name"] == "radius"), None)
    if rad_attr:
        if rad_attr["visibility"] != "public":
            errors.append(f"radius visibility: expected 'public', got '{rad_attr['visibility']}'")
            
    name_attr = next((a for a in circle["attributes"] if a["name"] == "name"), None)
    if name_attr:
        if name_attr["visibility"] != "private":
            errors.append(f"name visibility: expected 'private', got '{name_attr['visibility']}'")

    # Methods (from both impl Circle and impl Drawable for Circle)
    method_names = {m["name"] for m in circle["methods"]}
    for expected in ("new", "internal_calc", "draw", "area"):
        if expected not in method_names:
            errors.append(f"Circle missing method '{expected}': {method_names}")
            
    new_method = next((m for m in circle["methods"] if m["name"] == "new"), None)
    if new_method:
        if not new_method["isConstructor"]:
            errors.append("new() should be constructor")
        if not new_method["isStatic"]:
            errors.append("new() should be static (no self parameter)")
            
    calc_method = next((m for m in circle["methods"] if m["name"] == "internal_calc"), None)
    if calc_method:
        if calc_method["isStatic"]:
            errors.append("internal_calc() should be instance method (has &self)")
        if calc_method["cyclomaticComplexity"] != 3:
            # 1 (base) + 1 (if) + 1 (&&)
            errors.append(f"internal_calc() CC: expected 3, got {calc_method['cyclomaticComplexity']}")

    # LCOM4: internal_calc y area acceden a radius. draw no accede a nada.
    # Excluyendo new (constructor):
    # - internal_calc accede a {radius, name}
    # - area accede a {radius}
    # - draw accede a {}
    # Grafo de cohesión:
    # - internal_calc y area se conectan por 'radius'.
    # - draw es un componente aislado.
    # Total componentes = 2. LCOM4 = 2.
    if circle["metrics"]["lcom4"] != 2:
        errors.append(f"Circle LCOM4: expected 2, got {circle['metrics']['lcom4']}")

# Drawable trait assertions
drawable = next((c for c in classes if c["name"] == "Drawable"), None)
if not drawable:
    errors.append("Drawable trait not found!")
else:
    if not drawable["isInterface"]:
        errors.append("Drawable should be an interface")
    if not drawable["isAbstract"]:
        errors.append("Drawable should be abstract")

# Global functions assertions
if len(functions) != 1:
    errors.append(f"Expected 1 global function (calculate), got {len(functions)}")
else:
    calc = functions[0]
    if calc["name"] != "calculate":
        errors.append(f"Expected 'calculate', got '{calc['name']}'")
    if calc["visibility"] != "public":
        errors.append(f"calculate visibility: expected 'public', got '{calc['visibility']}'")
    if calc["cyclomaticComplexity"] != 2:
        errors.append(f"calculate() CC: expected 2, got {calc['cyclomaticComplexity']}")

if errors:
    print(f"\n[FAIL] {len(errors)} FAILURES:")
    for e in errors:
        print(f"  - {e}")
else:
    print("\n[SUCCESS] ALL ASSERTIONS PASSED!")

shutil.rmtree(TEMP)
