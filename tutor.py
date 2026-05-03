import re

def analyze_error(stderr: str) -> dict:
    """
    Parses GCC stderr and returns a structured hint object.
    """
    # Define error patterns and their simplified explanations/hints
    error_rules = [
        {
            "pattern": r"expected ';' before",
            "concept": "Syntax",
            "simplification": "You forgot to add a semicolon (;)",
            "hints": [
                "There is a syntax error where a statement is incomplete.",
                "In C, statements must be ended with a specific punctuation mark.",
                "Look closely at the line mentioned. Add a semicolon (;) at the end of the statement just before it."
            ]
        },
        {
            "pattern": r"undeclared \(first use in this function\)",
            "concept": "Variables",
            "simplification": "You are using a variable that hasn't been declared.",
            "hints": [
                "The compiler doesn't recognize a name you used.",
                "Before you can use a variable in C, you must tell the compiler its type (like int, float, char).",
                "Declare the variable at the top of your function (e.g., 'int your_variable;')."
            ]
        },
        {
            "pattern": r"expected declaration or statement at end of input",
            "concept": "Syntax",
            "simplification": "You are missing a closing brace '}'.",
            "hints": [
                "The code ended unexpectedly. A block of code wasn't closed.",
                "Every opening brace '{' must have a matching closing brace '}'.",
                "Check the end of your file and your main function. Add a '}' where it's missing."
            ]
        },
        {
            "pattern": r"implicit declaration of function",
            "concept": "Functions",
            "simplification": "You called a function that hasn't been defined or imported.",
            "hints": [
                "You are trying to use a function, but the compiler doesn't know what it is.",
                "If it's a standard function like printf, you might be missing a header file.",
                "Make sure you have '#include <stdio.h>' at the top of your file."
            ]
        },
        {
            "pattern": r"lvalue required as left operand of assignment",
            "concept": "Syntax / Operators",
            "simplification": "You are trying to assign a value to something that isn't a variable.",
            "hints": [
                "There is a problem with an equals sign '='.",
                "In an assignment, the left side must be a variable that can hold data.",
                "Check if you accidentally used '=' (assignment) instead of '==' (comparison) in an 'if' statement."
            ]
        }
    ]

    # Handle specific runtime error codes (like Segfaults)
    if "Segmentation fault" in stderr or "0xC0000005" in stderr or "3221225477" in stderr:
        return {
            "matched": True,
            "concept": "Runtime / Memory",
            "simplification": "Your program crashed while running (Segmentation Fault).",
            "hints": [
                "This usually happens when you try to access memory that doesn't belong to you.",
                "Check for 'Array Out of Bounds' (accessing an index that is too large or negative).",
                "If you are using pointers, ensure they are initialized properly.",
                "If you used scanf, make sure you used the '&' symbol before the variable name!"
            ]
        }
        
    if "Floating point exception" in stderr or "Division by zero" in stderr or "0xC0000094" in stderr or "3221225620" in stderr:
         return {
            "matched": True,
            "concept": "Runtime / Math",
            "simplification": "Your program tried to divide a number by zero.",
            "hints": [
                "Division by zero is mathematically undefined and causes the program to crash.",
                "Check any division operations (/) or modulo operations (%) in your code.",
                "Ensure that the denominator variable is not zero before doing the math."
            ]
        }
    
    if "Execution timed out" in stderr:
         return {
            "matched": True,
            "concept": "Runtime / Loops",
            "simplification": "Your program took too long to run. You might have an infinite loop!",
            "hints": [
                "An infinite loop happens when the loop condition never becomes false.",
                "Check your 'for' or 'while' loops.",
                "Make sure your loop variable is being incremented or decremented correctly inside the loop."
            ]
        }

    # Handle generic exit codes with no message
    if "exited with error code" in stderr and "No error message" in stderr:
        return {
            "matched": True,
            "concept": "Runtime / Unknown",
            "simplification": "Your program exited with an error, but no details were provided.",
            "hints": [
                "Check if your program has any printf() or scanf() statements.",
                "Try running a simpler version of your code to isolate the problem.",
                "Look for potential issues: uninitialized variables, incorrect array access, or logic errors.",
                "Add debug print statements (printf) to see where your program fails."
            ]
        }

    for rule in error_rules:
        if re.search(rule["pattern"], stderr):
            # Try to extract the line number if possible (format: program.c:LINE:COL: error: ...)
            line_match = re.search(r"program\.c:(\d+):", stderr)
            line_num = line_match.group(1) if line_match else "unknown"
            
            return {
                "matched": True,
                "concept": rule["concept"],
                "simplification": f"Line {line_num}: {rule['simplification']}",
                "hints": rule["hints"]
            }

    # Fallback if no specific rule matched
    return {
        "matched": False,
        "concept": "Unknown",
        "simplification": "An unknown error occurred.",
        "hints": [
            "Read the compiler error carefully.",
            "Look at the line number mentioned in the error.",
            "Try breaking down the code into smaller parts."
        ]
    }
