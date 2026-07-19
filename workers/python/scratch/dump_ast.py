"""Diagnóstico completo del AST real de tree-sitter-csharp."""
import tree_sitter_language_pack as tslp

p = tslp.get_parser("csharp")
code = b"""
public class MyClass : Base, IDisposable {
    private int _id;
    public string Name { get; set; }
    public int Age { get; }
    public MyClass(int id, string name) { _id = id; }
    public void DoSomething(int value, params string[] list) {
        if (value > 0 && list.Length > 0) { }
    }
}
public record Point(int X, int Y);
"""
tree = p.parse(code)

def dump(node, indent=0):
    txt = node.text.decode("utf-8", errors="replace").replace("\n", " ")[:60]
    print("  " * indent + f"{node.type} [{txt}]")
    for c in node.children:
        dump(c, indent + 1)

# Full tree for inspection
print("=== FULL AST ===")
dump(tree.root_node)

# Field name checks
print("\n=== FIELD NAME CHECKS ===")
cls = tree.root_node.children[0]
for f in ["name", "body", "bases", "type", "parameters"]:
    n = cls.child_by_field_name(f)
    if n:
        print(f"class_declaration.{f} = {n.type}")
    else:
        print(f"class_declaration.{f} = None")

body = cls.child_by_field_name("body")
if not body:
    for c in cls.children:
        if c.type == "declaration_list":
            body = c
            break
    print(f"(body found via positional search: {body.type})")

print("\n=== MEMBERS ===")
for member in (body.children if body else []):
    if member.type in ("method_declaration", "constructor_declaration"):
        print(f"\n--- {member.type} ---")
        for f in ["name", "type", "parameters", "body", "returns"]:
            n = member.child_by_field_name(f)
            if n:
                t = n.text.decode("utf-8", errors="replace")[:40]
                print(f"  .{f} = {n.type} [{t}]")
            else:
                print(f"  .{f} = None")
    elif member.type == "field_declaration":
        print(f"\n--- field_declaration ---")
        for f in ["name", "type", "declaration"]:
            n = member.child_by_field_name(f)
            if n:
                t = n.text.decode("utf-8", errors="replace")[:40]
                print(f"  .{f} = {n.type} [{t}]")
            else:
                print(f"  .{f} = None")
    elif member.type == "property_declaration":
        print(f"\n--- property_declaration ---")
        for f in ["name", "type", "value", "accessors"]:
            n = member.child_by_field_name(f)
            if n:
                t = n.text.decode("utf-8", errors="replace")[:40]
                print(f"  .{f} = {n.type} [{t}]")
            else:
                print(f"  .{f} = None")

# Record
print("\n=== RECORD ===")
rec = tree.root_node.children[1]
print(f"record type: {rec.type}")
for f in ["name", "body", "parameters", "bases"]:
    n = rec.child_by_field_name(f)
    if n:
        t = n.text.decode("utf-8", errors="replace")[:40]
        print(f"  .{f} = {n.type} [{t}]")
    else:
        print(f"  .{f} = None")
