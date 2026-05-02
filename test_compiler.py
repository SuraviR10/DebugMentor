from compiler import compile_and_run

code = """
#include <stdio.h>
int main() {
    printf("Hello from compiler test!\\n");
    return 0;
}
"""

print(compile_and_run(code))
