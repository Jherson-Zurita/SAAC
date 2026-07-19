"""Diagnóstico AST de tree-sitter para Swift, Go y Rust."""
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

# ── SWIFT ──
print("=" * 60)
print("SWIFT AST")
print("=" * 60)
try:
    p = tslp.get_parser("swift")
    code = b"""
import Foundation
import UIKit

protocol Drawable {
    func draw()
    var area: Double { get }
}

class Shape: NSObject, Drawable {
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

enum Direction {
    case north, south, east, west
}

extension Shape {
    func describe() -> String {
        return _name
    }
}
"""
    tree = p.parse(code)
    dump(tree.root_node)

    print("\n--- FIELD NAME CHECKS ---")
    # Find class
    for child in tree.root_node.children:
        if child.type == "class_declaration":
            print(f"\nclass_declaration:")
            check_fields(child, ["name", "body", "type_parameters", "superclass"])
        elif child.type == "protocol_declaration":
            print(f"\nprotocol_declaration:")
            check_fields(child, ["name", "body"])
        elif child.type == "struct_declaration":
            print(f"\nstruct_declaration:")
            check_fields(child, ["name", "body"])
        elif child.type == "function_declaration":
            print(f"\nfunction_declaration:")
            check_fields(child, ["name", "body", "parameters", "return_type", "returns"])
except Exception as e:
    print(f"ERROR: {e}")

# ── GO ──
print("\n" + "=" * 60)
print("GO AST")
print("=" * 60)
try:
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
    dump(tree.root_node)

    print("\n--- FIELD NAME CHECKS ---")
    for child in tree.root_node.children:
        if child.type == "type_declaration":
            print(f"\ntype_declaration:")
            check_fields(child, ["name", "type", "body"])
            for sub in child.children:
                if sub.type == "type_spec":
                    print(f"  type_spec:")
                    check_fields(sub, ["name", "type", "body"])
        elif child.type == "function_declaration":
            print(f"\nfunction_declaration:")
            check_fields(child, ["name", "body", "parameters", "result", "type_parameters", "receiver"])
        elif child.type == "method_declaration":
            print(f"\nmethod_declaration:")
            check_fields(child, ["name", "body", "parameters", "result", "receiver"])
except Exception as e:
    print(f"ERROR: {e}")

# ── RUST ──
print("\n" + "=" * 60)
print("RUST AST")
print("=" * 60)
try:
    p = tslp.get_parser("rust")
    code = b"""
use std::fmt;
use std::collections::HashMap;

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
    tree = p.parse(code)
    dump(tree.root_node)

    print("\n--- FIELD NAME CHECKS ---")
    for child in tree.root_node.children:
        if child.type == "struct_item":
            print(f"\nstruct_item:")
            check_fields(child, ["name", "body", "type_parameters"])
        elif child.type == "impl_item":
            print(f"\nimpl_item:")
            check_fields(child, ["type", "trait", "body", "type_parameters"])
        elif child.type == "trait_item":
            print(f"\ntrait_item:")
            check_fields(child, ["name", "body", "type_parameters"])
        elif child.type == "function_item":
            print(f"\nfunction_item:")
            check_fields(child, ["name", "body", "parameters", "return_type", "type_parameters"])
        elif child.type == "enum_item":
            print(f"\nenum_item:")
            check_fields(child, ["name", "body", "type_parameters"])
except Exception as e:
    print(f"ERROR: {e}")
