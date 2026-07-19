"""Verificación AST de clases/miembros Swift."""
import tree_sitter_language_pack as tslp

p = tslp.get_parser("swift")
code = b"""
public class Shape: NSObject, Drawable {
    private var _name: String = ""
    var color: String = "red"
    static let defaultSize: Int = 10
    init(name: String) { self._name = name }
    func draw() { }
    static func create(type t: String, size: Int = 5, _ items: String...) -> Shape { return Shape(name: t) }
}
"""
tree = p.parse(code)

def dump(node, indent=0):
    t = node.text.decode("utf-8", errors="replace").replace("\n", " ")[:60]
    print("  " * indent + f"{node.type} [{t}]")
    for c in node.children:
        dump(c, indent + 1)

cls = tree.root_node.children[0]
print("=== class children types ===")
for c in cls.children:
    t = c.text.decode("utf-8", errors="replace").replace("\n", " ")[:50]
    print(f"  {c.type} [{t}]")

body = cls.child_by_field_name("body")
if body:
    print()
    print("=== body member types ===")
    for m in body.children:
        if m.type in ("{", "}"):
            continue
        t = m.text.decode("utf-8", errors="replace").replace("\n", " ")[:60]
        print(f"  {m.type} [{t}]")
        if m.type == "property_declaration":
            for c in m.children:
                ct = c.text.decode("utf-8", errors="replace").replace("\n", " ")[:40]
                print(f"    {c.type} [{ct}]")
        elif m.type == "function_declaration":
            print(f"    .name = {m.child_by_field_name('name')}")
            print(f"    .body = {m.child_by_field_name('body')}")
            print(f"    .return_type = {m.child_by_field_name('return_type')}")
            # Show parameters
            for c in m.children:
                if c.type == "parameter":
                    ct = c.text.decode("utf-8", errors="replace")[:40]
                    print(f"    parameter [{ct}]")
                    for sc in c.children:
                        sct = sc.text.decode("utf-8", errors="replace")[:30]
                        print(f"      {sc.type} [{sct}]")
        elif m.type == "init_declaration":
            for c in m.children:
                ct = c.text.decode("utf-8", errors="replace").replace("\n", " ")[:40]
                print(f"    {c.type} [{ct}]")
