import json
import yaml
import os
import re

# Configuration
JACKETT_DIR = "/opt/Jackett/Definitions"
TRACKERS_FILE = "trackers.json"


def normalize_name(name):
    return re.sub(r"[^a-zA-Z0-9]", "", name).lower()


def extract_categories(yaml_path):
    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if not data or "caps" not in data or "categorymappings" not in data["caps"]:
            return None

        unique_cats = set()
        is_adult_content = False

        adult_keywords = {"xxx", "porn", "adult"}

        for mapping in data["caps"]["categorymappings"]:
            cat = mapping.get("cat", "")
            if cat:
                cat_lower = cat.lower()

                if any(keyword in cat_lower for keyword in adult_keywords):
                    is_adult_content = True

                base_cat = cat.split("/")[0].strip()
                if base_cat:
                    unique_cats.add(base_cat)

        if is_adult_content:
            return "Porn"

        if not unique_cats:
            return None

        return ", ".join(sorted(list(unique_cats)))

    except Exception as e:
        print(f"Error parsing {yaml_path}: {e}")
        return None


def main():
    if not os.path.exists(TRACKERS_FILE):
        print(f"Error: {TRACKERS_FILE} not found.")
        return

    with open(TRACKERS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not os.path.exists(JACKETT_DIR):
        print(f"Error: Jackett directory {JACKETT_DIR} not found.")
        return

    jackett_files = os.listdir(JACKETT_DIR)

    filename_map = {}
    for f in jackett_files:
        if f.endswith(".yml"):
            base = f[:-4]
            norm_base = normalize_name(base.replace("-api", ""))
            filename_map[norm_base] = f
            filename_map[normalize_name(base)] = f

    updated_count = 0
    not_found = []

    for tracker in data.get("trackers", []):
        name = tracker.get("Name", "")
        norm_name = normalize_name(name)

        match = filename_map.get(norm_name)

        if match:
            yaml_path = os.path.join(JACKETT_DIR, match)
            new_type = extract_categories(yaml_path)

            if new_type:
                if tracker.get("Type") != new_type:
                    tracker["Type"] = new_type
                    updated_count += 1
            else:
                not_found.append(f"{name} (no categories found in YAML)")
        else:
            not_found.append(f"{name} (no YAML match found in {JACKETT_DIR})")

    if updated_count > 0:
        with open(TRACKERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully updated {updated_count} trackers.")
    else:
        print("No updates found.")

    if not_found:
        print(f"\nSkipped {len(not_found)} trackers:")
        for item in not_found:
            print(f" - {item}")


if __name__ == "__main__":
    main()
