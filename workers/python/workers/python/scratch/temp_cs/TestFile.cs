
using System;
using System.Collections.Generic;
using static System.Math;

namespace MyApp.Models {
    [Serializable]
    public class MyClass : Base, IDisposable {
        private readonly int _id;
        public string Name { get; set; }
        public int Age { get; }

        public MyClass(int id, string name) {
            _id = id;
        }

        public void DoSomething(int value) {
            if (value > 0) {
                Console.WriteLine(value);
            }
        }

        public static int Calculate(ref int x, params string[] args) {
            if (x > 0 && args.Length > 0) {
                return x;
            }
            return -1;
        }

        private abstract void InternalMethod();
    }

    public record Point(int X, int Y);

    public interface IService {
        void Execute();
        int GetCount(string filter);
    }
}
