#!/usr/bin/env python3
"""
Health check script for tracker URLs.
Pings each tracker URL from trackers2.json and reports dead ones.
Run: python3 healthcheck.py
"""
import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

TIMEOUT = 10  # seconds
CONCURRENCY = 5  # parallel requests

def check_url(url, name):
    """Check if a URL is reachable. Returns (name, url, status, error)."""
    try:
        req = Request(url, method='HEAD', headers={
            'User-Agent': 'PrivateTrackersSpreadsheet/1.0 (healthcheck)'
        })
        resp = urlopen(req, timeout=TIMEOUT)
        return (name, url, resp.status, None)
    except HTTPError as e:
        return (name, url, e.code, str(e))
    except URLError as e:
        return (name, url, 0, str(e.reason))
    except Exception as e:
        return (name, url, 0, str(e))

def main():
    try:
        with open('trackers2.json') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("ERROR: trackers2.json not found")
        sys.exit(1)

    trackers = data.get('trackers', [])
    with_url = [t for t in trackers if t.get('url')]

    print(f"Checking {len(with_url)} tracker URLs (of {len(trackers)} total)...\n")

    dead = []
    alive = 0
    errors = 0

    for i, t in enumerate(with_url):
        name = t['name']
        url = t['url']
        try:
            result = check_url(url, name)
            status = result[2]
            if status and 200 <= status < 400:
                alive += 1
                status_char = '\033[92mOK\033[0m'
            else:
                dead.append(result)
                status_char = f'\033[91mFAIL ({status})\033[0m'
        except Exception as e:
            dead.append((name, url, 0, str(e)))
            status_char = f'\033[91mERROR\033[0m'
            errors += 1

        # Progress
        sys.stdout.write(f"\r[{i+1}/{len(with_url)}] {name}: {status_char}    ")
        sys.stdout.flush()
        time.sleep(0.2)  # Rate limit

    print(f"\n\n{'='*60}")
    print(f"Results: {alive} alive, {len(dead)} dead, {errors} errors")
    print(f"{'='*60}")

    if dead:
        print(f"\nDead/unreachable trackers:")
        for name, url, status, err in dead:
            print(f"  {name}: {url} (status={status}, error={err})")

    # Write report
    report = {
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'total': len(with_url),
        'alive': alive,
        'dead': len(dead),
        'dead_trackers': [{'name': n, 'url': u, 'status': s, 'error': e} for n, u, s, e in dead]
    }
    with open('healthcheck-report.json', 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to healthcheck-report.json")

if __name__ == '__main__':
    main()
