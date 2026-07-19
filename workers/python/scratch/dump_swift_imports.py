"""Diagnóstico AST de imports para Swift."""
import tree_sitter_language_pack as tslp

p = tslp.get_parser("swift")
code = b"""
import Foundation
import class UIKit.UIView
import struct Foundation.URL
"""
tree = p.parse(code)

def dump(node, indent=0):
    t = node.text.decode('utf-8', errors='replace')
    t = t.replace('\n', ' ')
    print("  " * indent + f"{node.type} [{t}]")
    for c in node.children:
        dump(c, indent + 1)

dump(tree.root_node)
