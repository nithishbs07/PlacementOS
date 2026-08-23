import os
import re
import glob

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if "http://localhost:8000" not in content:
        return

    # Add import if not exists
    if "API_BASE_URL" not in content:
        import_stmt = 'import { API_BASE_URL } from "@/lib/api";\n'
        # find the last import statement
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        lines.insert(last_import + 1, import_stmt)
        content = '\n'.join(lines)

    # Replace double quotes: "http://localhost:8000/api/..." -> `${API_BASE_URL}/api/...`
    # E.g. fetch("http://localhost:8000/api/rooms") -> fetch(`${API_BASE_URL}/api/rooms`)
    content = re.sub(r'"http://localhost:8000([^"]*)"', r'`${API_BASE_URL}\1`', content)
    
    # Replace single quotes (just in case)
    content = re.sub(r"'http://localhost:8000([^']*)'", r'`${API_BASE_URL}\1`', content)

    # Replace backticks: `http://localhost:8000/api/...` -> `${API_BASE_URL}/api/...`
    # E.g. fetch(`http://localhost:8000/api/panels/${id}`) -> fetch(`${API_BASE_URL}/api/panels/${id}`)
    content = re.sub(r'`http://localhost:8000([^`]*)`', r'`${API_BASE_URL}\1`', content)

    with open(filepath, 'w') as f:
        f.write(content)

tsx_files = glob.glob('frontend/src/app/**/*.tsx', recursive=True)
for file in tsx_files:
    patch_file(file)

print("Patching complete.")
