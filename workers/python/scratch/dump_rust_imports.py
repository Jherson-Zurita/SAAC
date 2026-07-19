"""Diagnóstico AST de imports para RUST."""
import tree_sitter_language_pack as tslp

p = tslp.get_parser("rust")
code = b"""
use std::collections::HashMap;
use std::fmt::{self, Debug};
use std::io as my_io;
use self::foo::bar;
use super::baz;
use crate::qux::*;
"""
tree = p.parse(code)

def dump(node, indent=0):
    t = node.text.decode('utf-8', errors='replace')
    t = t.replace('\n', ' ')
    print("  " * indent + f"{node.type} [{t}]")
    for c in node.children:
        dump(c, indent + 1)

dump(tree.root_node)
