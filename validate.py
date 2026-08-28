#!/usr/bin/env python3
"""
Validate trackers.json against schema.json.
Exit code 1 if validation fails.
"""
import json
import sys

try:
    import jsonschema
except ImportError:
    print("ERROR: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)

def main():
    try:
        with open('schema.json') as f:
            schema = json.load(f)
        with open('trackers.json') as f:
            data = json.load(f)
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON - {e}")
        sys.exit(1)

    validator = jsonschema.Draft7Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))

    if errors:
        print(f"VALIDATION FAILED: {len(errors)} error(s)\n")
        for err in errors:
            path = ' -> '.join(str(p) for p in err.absolute_path) if err.absolute_path else '(root)'
            print(f"  [{path}] {err.message}")
        sys.exit(1)
    else:
        print(f"VALIDATION PASSED: {len(data['trackers'])} trackers, all valid.")
        sys.exit(0)

if __name__ == '__main__':
    main()
