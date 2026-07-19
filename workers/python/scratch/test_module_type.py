"""Test: verifica que detect_module_type() se integra correctamente con los parsers."""
import sys
import os
import shutil

sys.path.insert(0, "workers/python")

from parsers import parse_file
from language_registry import resolve as resolve_language

TEMP = "workers/python/scratch/temp_module_type"
os.makedirs(TEMP, exist_ok=True)

errors = []

# --- Test 1: Python controller (views.py con decoradores Django) ---
py_code = """
from django.views import View

class HomeView(View):
    def get(self, request):
        return HttpResponse("ok")
"""
fpath = os.path.join(TEMP, "views.py")
with open(fpath, "w") as f:
    f.write(py_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "controller":
    errors.append(f"views.py: expected 'controller', got '{mt}'")
else:
    print(f"  [OK] views.py -> {mt}")

# --- Test 2: Java service (UserService.java) ---
java_code = """
package com.example;
public class UserService {
    public void createUser() {}
}
"""
fpath = os.path.join(TEMP, "UserService.java")
with open(fpath, "w") as f:
    f.write(java_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "service":
    errors.append(f"UserService.java: expected 'service', got '{mt}'")
else:
    print(f"  [OK] UserService.java -> {mt}")

# --- Test 3: Go test file ---
go_code = """
package main_test
import "testing"
func TestSomething(t *testing.T) {}
"""
fpath = os.path.join(TEMP, "handler_test.go")
with open(fpath, "w") as f:
    f.write(go_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "test":
    errors.append(f"handler_test.go: expected 'test', got '{mt}'")
else:
    print(f"  [OK] handler_test.go -> {mt}")

# --- Test 4: Kotlin repository (UserRepository.kt) ---
kt_code = """
package com.example
class UserRepository {
    fun findById(id: Int): User? = null
}
"""
fpath = os.path.join(TEMP, "UserRepository.kt")
with open(fpath, "w") as f:
    f.write(kt_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "repository":
    errors.append(f"UserRepository.kt: expected 'repository', got '{mt}'")
else:
    print(f"  [OK] UserRepository.kt -> {mt}")

# --- Test 5: C# model (UserEntity.cs) ---
cs_code = """
using System;
namespace Models {
    public class UserEntity {
        public int Id { get; set; }
        public string Name { get; set; }
    }
}
"""
fpath = os.path.join(TEMP, "UserEntity.cs")
with open(fpath, "w") as f:
    f.write(cs_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "model":
    errors.append(f"UserEntity.cs: expected 'model', got '{mt}'")
else:
    print(f"  [OK] UserEntity.cs -> {mt}")

# --- Test 6: Rust unknown (lib.rs in unknown dir) ---
rs_code = """
pub fn main() {}
"""
fpath = os.path.join(TEMP, "lib.rs")
with open(fpath, "w") as f:
    f.write(rs_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
# lib.rs no matchea ninguna regla, debe ser "unknown"
if mt != "unknown":
    errors.append(f"lib.rs: expected 'unknown', got '{mt}'")
else:
    print(f"  [OK] lib.rs -> {mt}")

# --- Test 7: Swift controller (HomeController.swift) ---
swift_code = """
import UIKit
class HomeController {
    func handleRequest() {}
}
"""
fpath = os.path.join(TEMP, "HomeController.swift")
with open(fpath, "w") as f:
    f.write(swift_code)
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "controller":
    errors.append(f"HomeController.swift: expected 'controller', got '{mt}'")
else:
    print(f"  [OK] HomeController.swift -> {mt}")

# --- Test 8: Dir-based detection (services/payment.py) ---
svc_dir = os.path.join(TEMP, "services")
os.makedirs(svc_dir, exist_ok=True)
fpath = os.path.join(svc_dir, "payment.py")
with open(fpath, "w") as f:
    f.write("def process_payment(): pass\n")
spec = resolve_language(fpath, None)
result = parse_file(fpath, spec)
mt = result["module"]["moduleType"]
if mt != "service":
    errors.append(f"services/payment.py: expected 'service', got '{mt}'")
else:
    print(f"  [OK] services/payment.py -> {mt}")

# --- Summary ---
print()
if errors:
    print(f"[FAIL] {len(errors)} FAILURES:")
    for e in errors:
        print(f"  - {e}")
else:
    print("[SUCCESS] ALL MODULE TYPE ASSERTIONS PASSED!")

shutil.rmtree(TEMP)
