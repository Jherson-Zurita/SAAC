import sys
import os
import shutil

# Agrega la ruta de workers/python al path de python para poder importar módulos
sys.path.append(os.path.abspath(os.path.dirname(__file__) + "/.."))

from language_registry import resolve as resolve_language
from parsers import parse_file

# Directorio temporal de pruebas
TEMP_DIR = os.path.abspath(os.path.dirname(__file__) + "/temp_test_files")
os.makedirs(TEMP_DIR, exist_ok=True)

# ---------------------------------------------------------
# C# Testing
# ---------------------------------------------------------
CSHARP_CODE = """
using System;
using System.IO;
using System.Collections.Generic;
using static System.Math;
using Env = System.Environment;

namespace TestNamespace
{
    [Serializable]
    [Obsolete("Use NewClass")]
    public class MyClass : IDisposable, IComparable
    {
        private int _id;
        public string Name { get; set; }
        public int Age { get; }

        public MyClass(int id, string name)
        {
            this._id = id;
            this.Name = name;
        }

        public void DoSomething(int value, params string[] list)
        {
            if (value > 0 && list.Length > 0)
            {
                foreach (var item in list)
                {
                    if (item == this.Name || value == 42)
                    {
                        Console.WriteLine(item);
                    }
                }
            }
        }

        public int GetId()
        {
            return _id;
        }

        public void Dispose()
        {
            // Empty
        }
    }
    
    public record Point(int X, int Y);
}
"""

# ---------------------------------------------------------
# Kotlin Testing
# ---------------------------------------------------------
KOTLIN_CODE = """
package com.example

import java.io.File
import java.util.List as JavaList
import java.util.*

@Entity
@Table(name = "users")
class User(val id: Int, var name: String) : Serializable, Comparable<User> {
    
    var email: String = ""
    
    companion object {
        const val DEFAULT_ROLE = "USER"
        fun createDefault(): User {
            return User(0, "Default")
        }
    }
    
    fun updateName(newName: String) {
        if (newName.isNotEmpty()) {
            this.name = newName
        } else {
            throw IllegalArgumentException("Empty name")
        }
    }
    
    fun getInfo(): String {
        return name + " (" + email + ")"
    }
    
    fun complexMethod(x: Int, vararg items: String): Boolean {
        var result = false
        if (x > 0 && items.isNotEmpty()) {
            for (item in items) {
                if (item == name || x == 100) {
                    result = true
                }
            }
        }
        return result
    }
}
"""

def test_csharp_parser():
    print("=== Testing C# Parser ===")
    cs_file = os.path.join(TEMP_DIR, "TestFile.cs")
    with open(cs_file, "w", encoding="utf-8") as f:
        f.write(CSHARP_CODE)
        
    spec = resolve_language(cs_file, "csharp")
    assert spec is not None, "C# Language spec should be resolved"
    
    result = parse_file(cs_file, spec)
    
    module = result["module"]
    print("C# Module ID:", module["id"])
    print("C# Module Name:", module["name"])
    print("C# Imports:", module["imports"])
    
    # Assert imports
    assert "System" in module["imports"]
    assert "System.IO" in module["imports"]
    assert "System.Collections.Generic" in module["imports"]
    assert "System.Math" in module["imports"]
    assert "System.Environment" in module["imports"]
    
    # Verify using details
    raw_imports = result["rawImports"]
    assert any(imp["module"] == "System.Environment" and imp["alias"] == "Env" for imp in raw_imports)
    assert any(imp["module"] == "System.Math" and imp["isStatic"] is True for imp in raw_imports)
    
    classes = module["classes"]
    print(f"C# Classes parsed ({len(classes)}):", [c["name"] for c in classes])
    
    # Assert classes
    assert len(classes) == 2, f"Should find MyClass and Point (record), found: {len(classes)}"
    
    my_class = next(c for c in classes if c["name"] == "MyClass")
    assert my_class["visibility"] == "public"
    assert "Serializable" in my_class["decorators"]
    assert "Obsolete" in my_class["decorators"]
    assert "IDisposable" in my_class["implements"]
    assert "IComparable" in my_class["implements"]
    
    attributes = my_class["attributes"]
    print("C# MyClass Attributes:", [(a["name"], a["type"], a["visibility"]) for a in attributes])
    assert any(a["name"] == "_id" and a["type"] == "int" and a["visibility"] == "private" for a in attributes)
    assert any(a["name"] == "Name" and a["type"] == "str" and a["visibility"] == "public" and a["isReadonly"] is False for a in attributes)
    assert any(a["name"] == "Age" and a["type"] == "int" and a["visibility"] == "public" and a["isReadonly"] is True for a in attributes)
    
    methods = my_class["methods"]
    print("C# MyClass Methods:", [m["name"] for m in methods])
    assert len(methods) == 4
    
    constructor = next(m for m in methods if m["isConstructor"])
    assert constructor["name"] == "MyClass"
    
    do_something = next(m for m in methods if m["name"] == "DoSomething")
    assert do_something["parameters"][0]["name"] == "value"
    assert do_something["parameters"][0]["type"] == "int"
    assert do_something["parameters"][1]["name"] == "list"
    assert do_something["parameters"][1]["type"] == "any"  # string[] normalized to generic or similar
    assert do_something["parameters"][1]["isVariadic"] is True
    
    # CC metrics
    print("C# DoSomething CC:", do_something["cyclomaticComplexity"])
    print("C# DoSomething Cognitive:", do_something["cognitiveComplexity"])
    # DoSomething complexity:
    # CC: 1 (base) + 1 (&&) + 1 (foreach) + 1 (||) = 4. Let's verify what complexity.py calculates.
    
    print("C# MyClass LCOM4:", my_class["metrics"]["lcom4"])
    
    # Point record
    point = next(c for c in classes if c["name"] == "Point")
    assert point["isRecord"] is True
    print("C# Point attributes:", point["attributes"])
    assert any(a["name"] == "X" and a["isReadonly"] is True for a in point["attributes"])
    assert any(a["name"] == "Y" and a["isReadonly"] is True for a in point["attributes"])
    
    print("C# tests passed successfully!")

def test_kotlin_parser():
    print("=== Testing Kotlin Parser ===")
    kt_file = os.path.join(TEMP_DIR, "TestFile.kt")
    with open(kt_file, "w", encoding="utf-8") as f:
        f.write(KOTLIN_CODE)
        
    spec = resolve_language(kt_file, "kotlin")
    assert spec is not None, "Kotlin Language spec should be resolved"
    
    result = parse_file(kt_file, spec)
    
    module = result["module"]
    print("Kotlin Module ID:", module["id"])
    print("Kotlin Module Name:", module["name"])
    print("Kotlin Imports:", module["imports"])
    
    # Assert imports
    assert "java.io.File" in module["imports"]
    assert "java.util.List" in module["imports"]
    assert "java.util" in module["imports"]
    
    classes = module["classes"]
    print(f"Kotlin Classes parsed ({len(classes)}):", [c["name"] for c in classes])
    
    # Assert classes
    assert len(classes) == 3, f"Should find User, Companion and Companion object companion, found: {len(classes)}"
    
    user_class = next(c for c in classes if c["name"] == "User")
    assert user_class["visibility"] == "public"
    assert "Entity" in user_class["decorators"]
    assert "Table" in user_class["decorators"]
    assert "Serializable" in user_class["implements"]
    assert "Comparable" in user_class["implements"]
    
    attributes = user_class["attributes"]
    print("Kotlin User Attributes:", [(a["name"], a["type"], a["visibility"]) for a in attributes])
    assert any(a["name"] == "id" and a["type"] == "Int" and a["isReadOnly"] is True for a in attributes)
    assert any(a["name"] == "name" and a["type"] == "String" and a["isReadOnly"] is False for a in attributes)
    assert any(a["name"] == "email" and a["type"] == "Any" and a["isReadOnly"] is False for a in attributes)
    
    methods = user_class["methods"]
    print("Kotlin User Methods:", [m["name"] for m in methods])
    assert len(methods) == 5  # primary constructor, updateName, getInfo, complexMethod, and companion object functions? 
    # Let's count them:
    # 1. User (Constructor)
    # 2. updateName
    # 3. getInfo
    # 4. complexMethod
    # Wait, the other class is the Companion object.
    
    companion = next(c for c in classes if c["name"] == "Companion")
    assert companion["isObject"] is True
    print("Kotlin Companion Methods:", [m["name"] for m in companion["methods"]])
    assert any(m["name"] == "createDefault" for m in companion["methods"])
    
    print("Kotlin tests passed successfully!")

if __name__ == "__main__":
    try:
        test_csharp_parser()
        test_kotlin_parser()
        print("ALL TESTS PASSED!")
    finally:
        # Limpieza
        if os.path.exists(TEMP_DIR):
            shutil.rmtree(TEMP_DIR)
