"""Diagnóstico AST de imports para GO sin backslashes en f-strings."""
import tree_sitter_language_pack as tslp

p = tslp.get_parser("go")
code = b"""
package main
import "os"
import (
    f "fmt"
    "strings"
    . "math"
)
"""
tree = p.parse(code)

def dump(node, indent=0):
    t = node.text.decode('utf-8', errors='replace')
    t = t.replace('\n', ' ')
    print("  " * indent + f"{node.type} [{t}]")
    for c in node.children:
        dump(c, indent + 1)

dump(tree.root_node)
