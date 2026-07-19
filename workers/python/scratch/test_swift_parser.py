"""Test para el parser de Swift sin unicode problem."""
import sys
import os
import json
import shutil

sys.path.insert(0, "workers/python")

from parsers.swift import parse_swift

SWIFT_CODE = """
import Foundation
import class UIKit.UIView

protocol Drawable {
    func draw()
    var area: Double { get }
}

public class Shape: NSObject, Drawable {
    private var _name: String = ""
    var color: String = "red"
    static let defaultSize: Int = 10

    init(name: String) {
        self._name = name
    }

    func draw() {
        if color == "red" {
            print("drawing red")
        }
    }

    var area: Double {
        return 0.0
    }

    static func create(type t: String, size: Int = 5, _ items: String...) -> Shape {
        if t == "circle" && size > 0 {
            return Shape(name: "circle")
        }
        return Shape(name: t)
    }
}

struct Point {
    let x: Int
    let y: Int

    func distance(to other: Point) -> Double {
        return 0.0
    }
}

extension Shape {
    func describe() -> String {
        return _name
    }
}
"""

TEMP = "workers/python/scratch/temp_swift"
os.makedirs(TEMP, exist_ok=True)
swift_file = os.path.join(TEMP, "TestFile.swift")
with open(swift_file, "w", encoding="utf-8") as f:
    f.write(SWIFT_CODE)

result = parse_swift(swift_file)
mod = result["module"]
classes = mod["classes"]

# Assertions
errors = []

# Imports
expected_imports = {"Foundation", "UIKit.UIView"}
got_imports = set(mod["imports"])
if expected_imports != got_imports:
    errors.append(f"Expected imports {expected_imports}, got {got_imports}")

# Classes count: Shape (class), Shape (extension), Drawable (protocol), Point (struct)
if len(classes) != 4:
    errors.append(f"Expected 4 types (Drawable, Shape, Point, Shape extension), got {len(classes)}: {[c['name'] for c in classes]}")

# Shape class assertions
shape = next((c for c in classes if c["name"] == "Shape" and not c.get("isExtension", False)), None)
if not shape:
    errors.append("Shape class not found!")
else:
    if shape["visibility"] != "public":
        errors.append(f"Shape.visibility: expected 'public', got '{shape['visibility']}'")
    if shape["isInterface"]:
        errors.append("Shape should not be an interface")
    if shape["extends"] != ["NSObject"]:
        errors.append(f"Shape.extends: expected ['NSObject'], got {shape['extends']}")
    if shape["implements"] != ["Drawable"]:
        errors.append(f"Shape.implements: expected ['Drawable'], got {shape['implements']}")
    
    # Attributes
    attr_names = {a["name"] for a in shape["attributes"]}
    for expected in ("_name", "color", "defaultSize"):
        if expected not in attr_names:
            errors.append(f"Shape missing attribute '{expected}': {attr_names}")
    
    name_attr = next((a for a in shape["attributes"] if a["name"] == "_name"), None)
    if name_attr:
        if name_attr["visibility"] != "private":
            errors.append(f"_name.visibility: expected 'private', got '{name_attr['visibility']}'")
        if name_attr["isReadonly"]:
            errors.append("_name.isReadonly: expected False (var)")
            
    size_attr = next((a for a in shape["attributes"] if a["name"] == "defaultSize"), None)
    if size_attr:
        if not size_attr["isStatic"]:
            errors.append("defaultSize: expected static")
        if not size_attr["isReadonly"]:
            errors.append("defaultSize: expected readonly (let)")
            
    # Methods
    method_names = {m["name"] for m in shape["methods"]}
    for expected in ("init", "draw", "create"):
        if expected not in method_names:
            errors.append(f"Shape missing method '{expected}': {method_names}")
            
    draw_method = next((m for m in shape["methods"] if m["name"] == "draw"), None)
    if draw_method:
        if draw_method["cyclomaticComplexity"] != 2:
            errors.append(f"draw() CC: expected 2 (has if), got {draw_method['cyclomaticComplexity']}")
            
    create_method = next((m for m in shape["methods"] if m["name"] == "create"), None)
    if create_method:
        if not create_method["isStatic"]:
            errors.append("create() should be static")
        if create_method["cyclomaticComplexity"] != 3:
            # 1 (base) + 1 (if) + 1 (&&)
            errors.append(f"create() CC: expected 3, got {create_method['cyclomaticComplexity']}")
        # check parameters
        params = create_method["parameters"]
        if len(params) != 3:
            errors.append(f"create() params: expected 3, got {len(params)}")
        else:
            p_t, p_s, p_i = params
            if p_t["name"] != "t":
                errors.append(f"Param 1 name: expected 't' (internal name), got '{p_t['name']}'")
            if p_s["name"] != "size" or not p_s["isOptional"]:
                errors.append(f"Param 2: size, expected optional (has default value)")
            if p_i["name"] != "items" or not p_i["isVariadic"]:
                errors.append(f"Param 3: items, expected variadic")

# Point struct assertions
point = next((c for c in classes if c["name"] == "Point"), None)
if not point:
    errors.append("Point struct not found!")
else:
    if not point["isStruct"]:
        errors.append("Point should be a struct")

# Shape extension assertions
shape_ext = next((c for c in classes if c["name"] == "Shape" and c.get("isExtension", False)), None)
if not shape_ext:
    errors.append("Shape extension not found!")
else:
    if not shape_ext["isExtension"]:
        errors.append("Shape extension isExtension should be True")
    desc = next((m for m in shape_ext["methods"] if m["name"] == "describe"), None)
    if not desc:
        errors.append("Shape extension missing 'describe' method")

if errors:
    print(f"\n[FAIL] {len(errors)} FAILURES:")
    for e in errors:
        print(f"  - {e}")
else:
    print("\n[SUCCESS] ALL ASSERTIONS PASSED!")

shutil.rmtree(TEMP)
