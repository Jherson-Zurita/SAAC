"""Diagnóstico AST de tree-sitter para SWIFT solamente."""
import tree_sitter_language_pack as tslp

def dump(node, indent=0):
    txt = node.text.decode("utf-8", errors="replace").replace("\n", " ")[:60]
    print("  " * indent + f"{node.type} [{txt}]")
    for c in node.children:
        dump(c, indent + 1)

def check_fields(node, fields):
    for f in fields:
        n = node.child_by_field_name(f)
        if n:
            t = n.text.decode("utf-8", errors="replace")[:40]
            print(f"  .{f} = {n.type} [{t}]")
        else:
            print(f"  .{f} = None")

p = tslp.get_parser("swift")
code = b"""
import Foundation
import UIKit

protocol Drawable {
    func draw()
    var area: Double { get }
}

public class Shape: NSObject, Drawable {
    private var _name: String
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
        get { return 0.0 }
    }

    static func create(type: String, size: Int = 5, _ items: String...) -> Shape {
        if type == "circle" && size > 0 {
            return Shape(name: "circle")
        }
        return Shape(name: type)
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
tree = p.parse(code)

print("=== FULL SWIFT AST ===")
dump(tree.root_node)

print("\n=== FIELD NAME CHECKS ===")
for child in tree.root_node.children:
    tp = child.type
    if tp in ("class_declaration", "protocol_declaration", "struct_declaration",
              "extension_declaration", "function_declaration"):
        print(f"\n--- {tp} ---")
        check_fields(child, ["name", "body", "type_parameters", "superclass",
                             "parameters", "return_type", "returns"])
        # Check body children for methods
        body = child.child_by_field_name("body")
        if body:
            for member in body.children:
                if member.type in ("function_declaration", "init_declaration",
                                   "property_declaration", "subscript_declaration"):
                    print(f"  member: {member.type}")
                    check_fields(member, ["name", "body", "parameters",
                                         "return_type", "returns", "type"])
