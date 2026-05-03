import subprocess
import os
import tempfile

GCC = r"C:\msys64\ucrt64\bin\gcc.exe"

def compile_and_run(code: str) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "program.c")
        exe = os.path.join(tmp, "program.exe")

        with open(src, "w", encoding="utf-8") as f:
            f.write(code)

        # Compile
        compile_proc = subprocess.run(
            [GCC, src, "-o", exe, "-Wall", "-fdiagnostics-color=never", "-fmax-errors=10"],
            capture_output=True, text=True, timeout=15
        )

        if compile_proc.returncode != 0:
            return {
                "status": "error",
                "type": "compilation",
                "stderr": compile_proc.stderr
            }

        # Run
        try:
            run_proc = subprocess.run(
                [exe], capture_output=True, text=True, timeout=5, input=""
            )
            if run_proc.returncode != 0:
                return {
                    "status": "error",
                    "type": "runtime",
                    "stderr": run_proc.stderr or f"Program exited with code {run_proc.returncode}",
                    "stdout": run_proc.stdout
                }
            return {
                "status": "success",
                "stdout": run_proc.stdout
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "type": "timeout",
                "stderr": "Execution timed out after 5 seconds. You might have an infinite loop!"
            }
