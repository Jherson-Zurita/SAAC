"""Diagnóstico AST de tree-sitter para GO solamente."""
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

p = tslp.get_parser("go")
code = b"""
package main

import (
    "fmt"
    "strings"
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
        return 3.14 * c.Radius * c.Radius
    }
    return 0
}

func (c *Circle) Perimeter() float64 {
    return 2 * 3.14 * c.Radius
}

func calculate(x int, y ...int) int {
    if x > 0 && len(y) > 0 {
        return x + y[0]
    }
    return x
}
"""
tree = p.parse(code)

print("=== FULL GO AST ===")
dump(tree.root_node)

print("\n=== FIELD NAME CHECKS ===")
for child in tree.root_node.children:
    tp = child.type
    if tp in ("type_declaration", "function_declaration", "method_declaration", "import_declaration"):
        print(f"\n--- {tp} ---")
        check_fields(child, ["name", "type", "body", "parameters", "result", "receiver"])
        
        # Recurse inside type_declaration to inspect type_spec
        if tp == "type_declaration":
            for sub in child.children:
                if sub.type == "type_spec":
                    print(f"  member type_spec:")
                    check_fields(sub, ["name", "type", "body"])
                    t_node = sub.child_by_field_name("type")
                    if t_node and t_node.type == "struct_type":
                        print(f"    struct_type members:")
                        # Look at field_declaration_list
                        for field_decl_list in t_node.children:
                            if field_decl_list.type == "field_declaration_list":
                                for fd in field_decl_list.children:
                                    if fd.type == "field_declaration":
                                        print(f"      field_declaration: {fd.text.decode('utf-8', errors='replace')}")
                                        check_fields(fd, ["name", "type"])
                    elif t_node and t_node.type == "interface_type":
                        print(f"    interface_type members:")
                        for intf_body in t_node.children:
                            if intf_body.type == "method_spec_list":
                                for ms in intf_body.children:
                                    if ms.type == "method_spec":
                                        print(f"      method_spec: {ms.text.decode('utf-8', errors='replace')}")
                                        check_fields(ms, ["name", "parameters", "result"])
