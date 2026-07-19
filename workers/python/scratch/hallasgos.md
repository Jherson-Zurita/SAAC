# Research Notes — AST Analysis for Swift, Go, and Rust

This document details the AST structures, node types, and field mappings discovered during research for Swift, Go, and Rust. These mappings will be used to implement the detailed parsers for each language in the Python worker.

---

## 1. Swift AST Structure & Mapping Rules

### 1.1 Imports
* **Node Type**: `import_declaration`
* **Syntax**: `import Foundation`, `import class UIKit.UIView`
* **Fields**:
  * An `import` keyword node.
  * An optional kind keyword node (`class`, `struct`, `protocol`, etc.).
  * An `identifier` node (which could be a `simple_identifier` or dot-separated identifiers).
* **Extraction Strategy**:
  * Get the text of the `identifier` node. This is the imported module or class path (e.g., `"Foundation"`, `"UIKit.UIView"`).
  * `isStatic`: `False`.
  * `isRelative`: `False`.
  * `isWildcard`: `False`.

### 1.2 Classes, Structs, Protocols, Extensions & Enums
* **Node Types**:
  * `class_declaration`
  * `struct_declaration`
  * `protocol_declaration`
  * `extension_declaration`
  * `enum_declaration`
* **Fields**:
  * `.name`: `type_identifier` or `simple_identifier`.
  * `.body`: `class_body` or `protocol_body`.
  * `.superclass`: Not populated as a field name; inheritance/protocol conformance is found in the `type_inheritance_clause` (sibling of the type name, e.g., `: NSObject, Drawable`).
* **Inheritance (Extends/Implements)**:
  * Traverse the children of the declaration node. Look for a `type_inheritance_clause` node.
  * Within it, extract all `user_type` / `type_identifier` names.
  * **Heuristics for Swift**:
    * If the type is an `interface` (represented by `protocol_declaration`), all conformances go to `implements`.
    * For classes, by convention, the first type in inheritance is usually the superclass (if it starts with a letter, or is known class), and subsequent types are protocols (implements). We can treat the first one as `extends` (if not starting with `I` followed by uppercase, or general heuristic) and the rest as `implements`.
* **Visibility / Modifiers**:
  * Modifiers such as `public`, `private`, `internal`, `fileprivate`, `open`, `static`, `class` are sibling tokens before the keyword (like `class`, `struct`).
  * Default visibility in Swift is `internal`.
* **Members**:
  * `init_declaration`: Constructors.
  * `function_declaration`: Methods.
  * `property_declaration`: Fields/Attributes.
    * Uses `value_binding_pattern` (like `let` or `var`), followed by a `pattern` (identifier) and an optional `type_annotation`.
    * If defined with `let`, `isReadonly` is `True`. If `var` with only `get` accessor block in its body, `isReadonly` is `True`.

---

## 2. Go AST Structure & Mapping Rules

### 2.1 Imports
* **Node Type**: `import_declaration`
* **Syntax**: `import "os"` or `import ( f "fmt"; "strings" )`
* **Structure**:
  * An `import` keyword.
  * One or more `import_spec` nodes, either directly or inside an `import_spec_list`.
  * Each `import_spec` contains:
    * `interpreted_string_literal` or `raw_string_literal` representing the package path.
    * An optional `package_identifier` or `dot` representing the import alias.
* **Extraction Strategy**:
  * Clean double quotes or backticks from the string literal to get the module name.
  * Set `alias` if `package_identifier` or `dot` is present.

### 2.2 Structures & Interfaces (OOP)
* **Node Type**: `type_declaration` containing a `type_spec`.
* **Structure**:
  * `type_spec` has field `.name` (`type_identifier`) and field `.type` which can be `struct_type` or `interface_type`.
* **Struct Members**:
  * Inside `struct_type`, we have a `field_declaration_list` with `field_declaration` nodes.
  * Each `field_declaration` can have `.name` (`field_identifier`) and `.type` (`type_identifier` / `pointer_type` / etc.).
  * Visibility in Go is defined by capitalization: if the first letter is uppercase, it is `public`, else `private`.
* **Interface Members**:
  * Inside `interface_type`, we have a `method_spec_list` with `method_spec` nodes.
  * Each `method_spec` has `.name` (`field_identifier`) representing a method signature.

### 2.3 Functions & Methods
* **Node Types**:
  * `function_declaration`: Top-level function.
  * `method_declaration`: Struct method.
* **Receiver (for Methods)**:
  * `method_declaration` has field `.receiver` which is a `parameter_list` (e.g. `(c *Circle)`).
  * We extract the type of the receiver (e.g., `Circle`) to determine which struct this method belongs to.
* **Fields**:
  * `.name`: `identifier` or `field_identifier`.
  * `.parameters`: `parameter_list` containing `parameter_declaration` or `variadic_parameter_declaration`.
  * `.result`: The return type (`type_identifier`, `pointer_type`, or `parameter_list` if multiple return values).
  * `.body`: `block` containing statements.

---

## 3. Rust AST Structure & Mapping Rules

### 3.1 Imports
* **Node Type**: `use_declaration`
* **Syntax**: `use std::collections::HashMap;`, `use std::fmt::{self, Debug};`, `use std::io as my_io;`
* **Structure**:
  * Can contain a `scoped_identifier`, `scoped_use_list`, `use_as_clause`, `use_wildcard`, etc.
* **Extraction Strategy**:
  * Traverse the children of `use_declaration`.
  * If it has a `scoped_identifier`, that's the path.
  * If it has `use_wildcard`, `isWildcard = True`.
  * For complex scoped lists, we can reconstruct the paths (e.g., `std::fmt::Debug`, `std::fmt::self`).

### 3.2 Structs, Enums, Traits & Impls
* **Node Types**:
  * `struct_item`: Defines a struct.
  * `enum_item`: Defines an enum.
  * `trait_item`: Defines an interface/trait.
  * `impl_item`: Contains method implementations for a struct or a trait on a struct.
* **Fields**:
  * `struct_item` and `trait_item` have `.name` (`type_identifier`) and `.body` (`field_declaration_list` / `declaration_list`).
  * `impl_item` has:
    * `.type`: The struct being implemented (e.g. `Circle`).
    * `.trait`: The trait being implemented, if any (e.g. `Drawable`).
* **Mapping Strategy**:
  * Since Rust separates struct definitions (`struct_item`) from their methods (`impl_item`), our parser will first extract all `struct_item`, `trait_item`, and `enum_item` as classes/interfaces.
  * Then, we process all `impl_item` blocks and associate their methods with the corresponding struct (class) extracted earlier.
  * Visibility:
    * Rust visibility is private by default. If a `visibility_modifier` (e.g. `pub`, `pub(crate)`) is present, it is `public` (or internal).

### 3.3 Methods & Functions
* **Node Type**: `function_item`
* **Structure**:
  * `.name`: `identifier`.
  * `.parameters`: `parameters` list containing `parameter` or `self_parameter`.
  * `.return_type`: `primitive_type` / `type_identifier` / etc.
  * `.body`: `block`.
* **Self Parameter**:
  * If the first parameter is `self_parameter` (e.g. `&self`, `self`, `mut self`), it is an instance method. Otherwise, it is a static method.

---

## 4. Verification & Cohesion (LCOM4) Strategy

* **Cyclomatic & Cognitive Complexity**: Configured similarly to other C-family languages using keyword weights (e.g., `if`, `for`, `while`, `match`, `switch`, `&&`, `||`).
* **LCOM4**: Using `calculate_class_metrics` by identifying all fields accessed within each method.
* **Language Registry**: Already updated to map `"swift"`, `"go"`, and `"rust"` extension specifications to their respective names in tree-sitter.
