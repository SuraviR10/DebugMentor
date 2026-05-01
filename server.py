import subprocess, tempfile, os, re, json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

GCC_PATH = r"C:\msys64\ucrt64\bin\gcc.exe"

ERROR_DB = {
    "missing_semicolon": {
        "label": "Missing Semicolon",
        "explain": "Every C statement must end with a semicolon (;). The compiler sees the next line and gets confused because it expected the current statement to end.",
        "concepts": ["Syntax", "Statements", "C Basics"],
        "confidence": 98,
        "hints": [
            "Look at the line number in the error — something is missing at the end.",
            "Every statement like int x = 5 must end with a semicolon: int x = 5;",
            "Add a semicolon (;) at the very end of the flagged line."
        ],
        "steps": [
            "Compile the code and read the error message.",
            "Go to the line number shown in the error.",
            "Check if the statement ends with a semicolon (;).",
            "Add the missing semicolon at the end of the line.",
            "Recompile and verify the error is gone."
        ],
        "suggestion": "Add semicolons at the end of every statement."
    },
    "undeclared_variable": {
        "label": "Undeclared Variable",
        "explain": "You are using a variable that was never declared. In C, you must declare a variable with its type before using it (e.g., int x;).",
        "concepts": ["Variables", "Declarations", "Scope"],
        "confidence": 95,
        "hints": [
            "The error message tells you the variable name — search for where you first use it.",
            "Check if you wrote the type (int, float, char) before the variable name.",
            "Add a declaration like 'int variableName;' before the first use."
        ],
        "steps": [
            "Find the variable name mentioned in the error.",
            "Search your code for where it is first used.",
            "Check if a declaration like 'int x;' exists before that line.",
            "Add the declaration with the correct type.",
            "Recompile and verify."
        ],
        "suggestion": "Declare all variables with their type before using them."
    },
    "missing_return": {
        "label": "Missing Return Statement",
        "explain": "A function that declares a return type (like 'int main()') must return a value. Without 'return 0;', the compiler warns that control reaches the end of a non-void function.",
        "concepts": ["Functions", "Return Values", "main()"],
        "confidence": 92,
        "hints": [
            "Look at your function — what type does it say it returns?",
            "If it says 'int', you must have 'return someNumber;' before the closing brace.",
            "Add 'return 0;' as the last line inside main()."
        ],
        "steps": [
            "Find the function mentioned in the warning.",
            "Check its return type (e.g., int).",
            "Add 'return 0;' before the closing brace of main().",
            "Recompile and verify."
        ],
        "suggestion": "Always add 'return 0;' at the end of main()."
    },
    "implicit_function": {
        "label": "Implicit Function Declaration",
        "explain": "You called a function before declaring or including it. C requires functions to be declared before they are called. You are likely missing a #include or a function prototype.",
        "concepts": ["Functions", "Headers", "#include", "Prototypes"],
        "confidence": 93,
        "hints": [
            "Check the function name in the error — is it from a library like printf or scanf?",
            "If it's printf/scanf, add '#include <stdio.h>' at the top.",
            "If it's your own function, declare it above main() or move its definition above main()."
        ],
        "steps": [
            "Identify the function name in the error message.",
            "If it's a standard function (printf, scanf, sqrt), add the correct #include.",
            "If it's your own function, add a prototype above main().",
            "Recompile and verify."
        ],
        "suggestion": "Include the correct header files and declare functions before calling them."
    },
    "type_mismatch": {
        "label": "Type Mismatch / Incompatible Types",
        "explain": "You are assigning or comparing values of incompatible types. For example, assigning a float to an int without casting, or comparing a pointer to an integer.",
        "concepts": ["Data Types", "Type Casting", "Assignments"],
        "confidence": 88,
        "hints": [
            "Look at the variable types on both sides of the = or comparison.",
            "If you need to convert, use a cast: (int)myFloat",
            "Make sure the variable type matches the value you are storing."
        ],
        "steps": [
            "Find the line with the type mismatch.",
            "Check the types on both sides of the assignment or comparison.",
            "Use explicit type casting if needed: (int)value.",
            "Or change the variable type to match.",
            "Recompile and verify."
        ],
        "suggestion": "Ensure variable types match the values being assigned or compared."
    },
    "division_by_zero": {
        "label": "Division by Zero",
        "explain": "Your program is dividing a number by zero, which is undefined in mathematics and causes a crash at runtime.",
        "concepts": ["Arithmetic", "Runtime Errors", "Conditions"],
        "confidence": 97,
        "hints": [
            "Find where you use the / operator.",
            "Check if the denominator could ever be zero.",
            "Add an if-check: if (b != 0) before dividing."
        ],
        "steps": [
            "Find the division operation in your code.",
            "Check what value the denominator holds at runtime.",
            "Add a guard: if (denominator != 0) { ... }",
            "Handle the zero case with an error message.",
            "Recompile and test."
        ],
        "suggestion": "Always check that the divisor is not zero before dividing."
    },
    "infinite_loop": {
        "label": "Possible Infinite Loop",
        "explain": "Your loop condition never becomes false, so the loop runs forever. This usually happens when the loop variable is never updated inside the loop body.",
        "concepts": ["Loops", "Conditions", "Loop Control"],
        "confidence": 85,
        "hints": [
            "Look at your loop condition — when does it become false?",
            "Check if the variable in the condition is being changed inside the loop.",
            "Make sure you have i++ or i-- or some update inside the loop."
        ],
        "steps": [
            "Find the loop in your code.",
            "Check the loop condition (e.g., i < 10).",
            "Verify the loop variable (i) is updated inside the loop body.",
            "Add i++ or the appropriate update if missing.",
            "Test with a small limit first."
        ],
        "suggestion": "Ensure the loop variable is updated so the condition eventually becomes false."
    },
    "array_out_of_bounds": {
        "label": "Array Out of Bounds",
        "explain": "You are accessing an array index that does not exist. If an array has 5 elements (index 0–4), accessing index 5 or higher causes undefined behavior or a crash.",
        "concepts": ["Arrays", "Indexing", "Memory", "Bounds Checking"],
        "confidence": 90,
        "hints": [
            "Check the size you declared for the array.",
            "Remember: an array of size N has valid indices 0 to N-1.",
            "Add a check: if (index >= 0 && index < size) before accessing."
        ],
        "steps": [
            "Find the array declaration and note its size.",
            "Find where you access the array with an index.",
            "Ensure the index is between 0 and size-1.",
            "Add bounds checking if the index is dynamic.",
            "Test and verify no crash occurs."
        ],
        "suggestion": "Always keep array indices within 0 to size-1."
    }
}

def classify_error(stderr_line):
    l = stderr_line.lower()
    if "expected ';'" in l or "expected ';' before" in l:
        return "missing_semicolon"
    if "undeclared" in l or "use of undeclared" in l:
        return "undeclared_variable"
    if "implicit declaration" in l or "implicit function" in l:
        return "implicit_function"
    if "control reaches end" in l or "no return" in l:
        return "missing_return"
    if "incompatible type" in l or "cannot convert" in l or "assignment to" in l:
        return "type_mismatch"
    if "division by zero" in l:
        return "division_by_zero"
    if "array subscript" in l or "out of bounds" in l:
        return "array_out_of_bounds"
    return None

def parse_gcc_output(stderr, source_lines):
    errors = []
    seen = set()
    for line in stderr.splitlines():
        m = re.match(r'.+?:(\d+):(\d+):\s+(error|warning):\s+(.+)', line)
        if not m:
            continue
        lineno, col, severity, msg = int(m.group(1)), int(m.group(2)), m.group(3), m.group(4).strip()
        key = (lineno, msg[:40])
        if key in seen:
            continue
        seen.add(key)
        etype = classify_error(line)
        raw = source_lines[lineno - 1] if 0 < lineno <= len(source_lines) else ""
        errors.append({
            "line": lineno,
            "col": col,
            "severity": severity,
            "message": msg,
            "raw": raw,
            "type": etype
        })
    return errors

@app.route("/compile", methods=["POST"])
def compile_code():
    data = request.get_json()
    code = data.get("code", "")
    source_lines = code.splitlines()

    with tempfile.TemporaryDirectory() as tmpdir:
        src = os.path.join(tmpdir, "main.c")
        exe = os.path.join(tmpdir, "main.exe")
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)

        # Compile
        compile_result = subprocess.run(
            [GCC_PATH, src, "-o", exe, "-Wall", "-Wextra", "-fmax-errors=10"],
            capture_output=True, text=True, timeout=15
        )

        errors = parse_gcc_output(compile_result.stderr, source_lines)
        program_output = ""
        runtime_error = ""

        if compile_result.returncode == 0:
            # Run the compiled program
            try:
                run_result = subprocess.run(
                    [exe],
                    capture_output=True, text=True, timeout=5,
                    input=""
                )
                program_output = run_result.stdout
                if run_result.returncode != 0:
                    runtime_error = run_result.stderr or f"Program exited with code {run_result.returncode}"
            except subprocess.TimeoutExpired:
                runtime_error = "Runtime Error: Program timed out (possible infinite loop)."
                errors.append({
                    "line": 0, "col": 0, "severity": "error",
                    "message": "Program timed out — possible infinite loop.",
                    "raw": "", "type": "infinite_loop"
                })

        # Enrich errors with DB info
        enriched = []
        for e in errors:
            db = ERROR_DB.get(e["type"]) if e["type"] else None
            enriched.append({**e, "db": db})

        return jsonify({
            "success": compile_result.returncode == 0 and not runtime_error,
            "errors": enriched,
            "stderr": compile_result.stderr,
            "stdout": program_output,
            "runtime_error": runtime_error
        })

@app.route("/errordb", methods=["GET"])
def get_error_db():
    return jsonify(ERROR_DB)

if __name__ == "__main__":
    print("=" * 50)
    print("  CodeAid AI — Backend Server")
    print("  GCC:", GCC_PATH)
    print("  Running at: http://localhost:5000")
    print("=" * 50)
    app.run(debug=False, port=5000)
