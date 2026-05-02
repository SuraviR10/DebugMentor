import subprocess
import os
import tempfile

def compile_and_run(code: str) -> dict:
    """
    Compiles and runs C code using GCC.
    Returns a dictionary with status, output, and error.
    """
    # Create temporary files for the C code and the executable
    with tempfile.TemporaryDirectory() as temp_dir:
        c_file_path = os.path.join(temp_dir, 'program.c')
        exe_file_path = os.path.join(temp_dir, 'program.exe')

        with open(c_file_path, 'w') as f:
            f.write(code)

        # 1. Compilation Step
        try:
            compile_process = subprocess.run(
                ['gcc', c_file_path, '-o', exe_file_path],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if compile_process.returncode != 0:
                # Compilation failed
                return {
                    'status': 'error',
                    'type': 'compilation',
                    'stderr': compile_process.stderr
                }
        except subprocess.TimeoutExpired:
            return {
                'status': 'error',
                'type': 'timeout',
                'stderr': 'Compilation timed out.'
            }
        except Exception as e:
            return {
                'status': 'error',
                'type': 'system',
                'stderr': str(e)
            }

        # 2. Execution Step
        try:
            # Run the compiled executable
            run_process = subprocess.run(
                [exe_file_path],
                capture_output=True,
                text=True,
                timeout=5  # Prevent infinite loops
            )
            
            if run_process.returncode != 0:
                stderr_output = run_process.stderr
                if not stderr_output:
                    stderr_output = f"Runtime Error Code: {run_process.returncode} ({hex(run_process.returncode & 0xFFFFFFFF)})"
                
                return {
                    'status': 'error',
                    'type': 'runtime',
                    'stderr': stderr_output,
                    'stdout': run_process.stdout
                }
            
            return {
                'status': 'success',
                'stdout': run_process.stdout
            }
            
        except subprocess.TimeoutExpired:
            return {
                'status': 'error',
                'type': 'runtime_timeout',
                'stderr': 'Execution timed out. Do you have an infinite loop?'
            }
        except Exception as e:
            return {
                'status': 'error',
                'type': 'system',
                'stderr': str(e)
            }
