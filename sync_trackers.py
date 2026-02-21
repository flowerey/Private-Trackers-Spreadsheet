import json
import requests

MY_FILE = 'trackers.json'
UPSTREAM_URL = 'https://raw.githubusercontent.com/HDVinnie/Private-Trackers-Spreadsheet/master/trackers.json'
EXCLUDED_FIELDS = {'Observatory Grade'}

def main():
    with open(MY_FILE, 'r', encoding='utf-8') as f:
        my_data = json.load(f)

    response = requests.get(UPSTREAM_URL)
    upstream_data = response.json()

    my_trackers = {t['Name']: t for t in my_data['trackers']}
    updated_count = 0
    added_count = 0

    for up_t in upstream_data['trackers']:
        name = up_t['Name']
        up_date = up_t.get('Updated', '0000-00-00')

        if name in my_trackers:
            my_date = my_trackers[name].get('Updated', '0000-00-00')
            if up_date > my_date:
                for key, value in up_t.items():
                    if key not in EXCLUDED_FIELDS:
                        my_trackers[name][key] = value
                updated_count += 1
        else:
            new_entry = {k: v for k, v in up_t.items() if k not in EXCLUDED_FIELDS}
            my_trackers[name] = new_entry
            added_count += 1

    final_list = sorted(my_trackers.values(), key=lambda x: x['Name'])
    with open(MY_FILE, 'w', encoding='utf-8') as f:
        json.dump({"trackers": final_list}, f, indent=2, ensure_ascii=False)

    print(f"Sync complete. Updated: {updated_count}, Added: {added_count}")

if __name__ == "__main__":
    main()
