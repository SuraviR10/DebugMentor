from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from compiler import compile_and_run
from tutor import analyze_error
from database import log_compilation, get_dashboard_stats
import traceback
import os

app = Flask(__name__)
# Enable CORS for the vanilla HTML frontend to interact with the API
CORS(app)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(BASE_DIR, filename)

@app.route('/api/compile', methods=['POST'])
def compile_code():
    try:
        data = request.get_json()
        if not data or 'code' not in data:
            return jsonify({'error': 'No code provided'}), 400

        code = data['code']
        
        # 1. Compile and Run
        result = compile_and_run(code)
        
        if result['status'] == 'success':
            # Log success
            log_compilation('success', code=code)
            return jsonify({
                'status': 'success',
                'output': result['stdout']
            })
            
        else:
            # 2. If error, analyze the error
            stderr = result.get('stderr', '')
            analysis = analyze_error(stderr)
            
            # Log error
            log_compilation('error', 
                            error_type=analysis.get('concept', 'unknown'), 
                            concept=analysis.get('concept', 'unknown'),
                            code=code)
            
            return jsonify({
                'status': 'error',
                'type': result['type'], # compilation, runtime, timeout
                'raw_error': stderr,
                'analysis': analysis
            })

    except Exception as e:
        print(f"Server error: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    try:
        stats = get_dashboard_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': 'Could not fetch stats', 'details': str(e)}), 500

if __name__ == '__main__':
    # Run the Flask app
    print("Starting Intelligent Tutor API on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
