from compiler import compile_and_run
from tutor import analyze_error
import json

code = """
#include <stdio.h>
int main() {
    printf("Hello from error test!")
    return 0;
}
"""

result = compile_and_run(code)

if result['status'] == 'error' and result['type'] == 'compilation':
    print("Compilation Error Detected. Stderr:")
    print(result['stderr'])
    print("\n--- Analyzer Output ---")
    analysis = analyze_error(result['stderr'])
    print(json.dumps(analysis, indent=2))
else:
    print("Expected a compilation error but got:", result)
