#!/usr/bin/env python3
"""
Normalize trackers.json - fixes inconsistent values across all entries.
Run: python3 normalize.py
"""
import json
import re
import sys

# Observatory Grade: remove space before +/- sign
# "A +" -> "A+", "B -" -> "B-", etc.
def normalize_grade(grade):
    if grade == '-':
        return '-'
    # Remove spaces and normalize
    grade = grade.replace(' ', '')
    # Ensure consistent format: letter + optional sign
    if re.match(r'^[A-D][+-]?$', grade):
        return grade
    return grade

# Ratio Diff: "Yes" is invalid, should be "-"
def normalize_ratio_diff(val):
    if val == 'Yes':
        return '-'
    return val

# Join Diff: "Hard" -> "Tough"
def normalize_join_diff(val):
    if val == 'Hard':
        return 'Tough'
    return val

# Join: fix trailing comma, normalize values
def normalize_join(val):
    # Fix trailing comma
    val = val.rstrip(',').strip()
    # Normalize whitespace around commas
    val = re.sub(r'\s*,\s*', ', ', val)
    return val

# Type: normalize vocabulary
TYPE_REPLACEMENTS = {
    # Standardize casing
    'Tv': 'TV',
    # Standardize plural/singular (use singular for content types)
    'Movies': 'Movie',
    # Map Jackett Torznab names to trackers.json names
    'Audio': 'Music',
    'XXX': 'Porn',
    'Books': 'eBooks',
    'Console': 'Games',
    # Specific known mappings
    'Mac Software': 'Mac Software',  # keep as-is
}

def normalize_type(type_val):
    parts = [p.strip() for p in type_val.split(',')]
    normalized = []
    for part in parts:
        # Apply replacements
        if part in TYPE_REPLACEMENTS:
            part = TYPE_REPLACEMENTS[part]
        normalized.append(part)
    return ', '.join(normalized)

def main():
    with open('trackers.json', 'r') as f:
        data = json.load(f)

    changes = []

    for tracker in data['trackers']:
        name = tracker['Name']

        # Fix Observatory Grade
        old_grade = tracker['Observatory Grade']
        new_grade = normalize_grade(old_grade)
        if old_grade != new_grade:
            changes.append(f"  {name}: Observatory Grade '{old_grade}' -> '{new_grade}'")
            tracker['Observatory Grade'] = new_grade

        # Fix Ratio Diff
        old_rd = tracker['Ratio Diff']
        new_rd = normalize_ratio_diff(old_rd)
        if old_rd != new_rd:
            changes.append(f"  {name}: Ratio Diff '{old_rd}' -> '{new_rd}'")
            tracker['Ratio Diff'] = new_rd

        # Fix Join Diff
        old_jd = tracker['Join Diff']
        new_jd = normalize_join_diff(old_jd)
        if old_jd != new_jd:
            changes.append(f"  {name}: Join Diff '{old_jd}' -> '{new_jd}'")
            tracker['Join Diff'] = new_jd

        # Fix Join
        old_join = tracker['Join']
        new_join = normalize_join(old_join)
        if old_join != new_join:
            changes.append(f"  {name}: Join '{old_join}' -> '{new_join}'")
            tracker['Join'] = new_join

        # Fix Type
        old_type = tracker['Type']
        new_type = normalize_type(old_type)
        if old_type != new_type:
            changes.append(f"  {name}: Type '{old_type}' -> '{new_type}'")
            tracker['Type'] = new_type

    if changes:
        print(f"Fixed {len(changes)} issues:")
        for c in changes:
            print(c)
    else:
        print("No changes needed.")

    # Write back
    with open('trackers.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f"\nWrote trackers.json ({len(data['trackers'])} trackers)")

if __name__ == '__main__':
    main()
