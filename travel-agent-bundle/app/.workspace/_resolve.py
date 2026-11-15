"""Resolve top influencer-recommended places via the wired proxy APIs.

For each place: try Foursquare first (best for hours/category/kid-friendly),
then SerpAPI google_local (best for ratings + reviews + Google Maps URL),
fall back to TripAdvisor for sights, fall back to OSM/Wikidata.

Cache to japan-places-resolved.json so we don't burn API calls twice.
"""
import json, os, sys, time, urllib.request, urllib.parse, re

PROXY = 'http://localhost:8889/api'
WS = '/Users/malhar.gupta/projects/personal/travel agent/.workspace'
CACHE = os.path.join(WS, 'japan-places-resolved.json')
INPUT = os.path.join(WS, 'japan-places-consolidated.json')

# Load existing cache so we resume gracefully
resolved = {}
if os.path.exists(CACHE):
    try:
        for r in json.load(open(CACHE)):
            resolved[r['name']] = r
    except Exception:
        pass

places = json.load(open(INPUT))

# Filter: only what we'll actually resolve
SKIP_CITIES = {'Osaka', 'Hiroshima', 'Miyajima', 'Kobe', 'Nagoya', 'Ine (Kyoto Prefecture)'}
def keep(p):
    # Skip Osaka-area unless we already had this in scope (Kyoto is in scope; user's primary base is Tokyo)
    if p['city'].split(' ')[0] in SKIP_CITIES: return False
    # Skip generic stuff like "Japan", konbini brand entries
    if p['city'] == 'Japan' and p['kind'] in ('food','tip'): return False
    if p['name'].lower() in ('japan','tokyo','kyoto','hakone','nara'): return False
    return True

target = [p for p in places if keep(p)]
print(f'Filtered: {len(target)} of {len(places)} places to resolve')

def http_get_json(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'yatra-resolver/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except Exception as e:
        return 599, {'error': str(e)}

def resolve_one(p):
    name = p['name']
    city = p['city'].split(' ')[0]  # 'Mitaka (Tokyo)' -> 'Mitaka'
    if city in ('unknown', 'Japan'):
        city = 'Tokyo'
    near = f'{city}, Japan'

    out = {
        'name': name,
        'kind': p['kind'],
        'city_hint': p['city'],
        'mentions': p['mentions'],
        'timing_hints': p['timing_hints'],
        'notes': p['notes'],
        'source_files': p['source_files'],
        'handles': p['handles'],
    }

    # Try Foursquare
    fsq_url = f'{PROXY}/foursquare/places?' + urllib.parse.urlencode({'query': name, 'near': near, 'limit': 3})
    s, j = http_get_json(fsq_url)
    if s == 200 and isinstance(j, dict):
        results = j.get('results') or []
        if results:
            top = results[0]
            loc = top.get('location') or {}
            geo = ((top.get('latitude'), top.get('longitude')))
            out['fsq'] = {
                'fsq_id': top.get('fsq_place_id'),
                'name': top.get('name'),
                'category': (top.get('categories') or [{}])[0].get('name'),
                'address': loc.get('formatted_address') or loc.get('address'),
                'lat': top.get('latitude'),
                'lng': top.get('longitude'),
                'rating': top.get('rating'),
            }

    # Try SerpAPI google_local for ratings + Google Maps link
    local_url = f'{PROXY}/local?' + urllib.parse.urlencode({'q': name, 'location': near})
    s, j = http_get_json(local_url, timeout=30)
    if s == 200 and isinstance(j, dict):
        items = j.get('local_results') or []
        if items:
            top = items[0]
            out['google'] = {
                'title': top.get('title'),
                'rating': top.get('rating'),
                'reviews': top.get('reviews'),
                'address': top.get('address'),
                'phone': top.get('phone'),
                'hours': top.get('hours'),
                'gps': top.get('gps_coordinates'),
                'place_id': top.get('place_id'),
            }

    # If still no GPS, fallback to OSM Nominatim (no key, free)
    if not (out.get('fsq') or {}).get('lat') and not ((out.get('google') or {}).get('gps')):
        nom_url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
            'q': f'{name}, {city}, Japan', 'format': 'json', 'limit': 1,
        })
        s, j = http_get_json(nom_url)
        if s == 200 and isinstance(j, list) and j:
            top = j[0]
            out['osm'] = {
                'name': top.get('display_name'),
                'lat': float(top['lat']),
                'lng': float(top['lon']),
                'type': top.get('type'),
            }

    return out

# Resolve in serial; with 100+ Foursquare quota it's fine
done = 0
for p in target:
    if p['name'] in resolved:
        continue
    try:
        rec = resolve_one(p)
        resolved[p['name']] = rec
        done += 1
        if done % 5 == 0:
            json.dump(list(resolved.values()), open(CACHE, 'w'), indent=2, ensure_ascii=False)
            print(f'... {done}/{len(target)} resolved')
        time.sleep(0.4)  # politeness for OSM Nominatim
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f'ERR {p["name"]}: {e}')

# Final save
json.dump(list(resolved.values()), open(CACHE, 'w'), indent=2, ensure_ascii=False)
print(f'\nDONE: {len(resolved)} places cached at {CACHE}')

# Summary
hits = sum(1 for r in resolved.values() if (r.get('fsq') or r.get('google') or r.get('osm')))
print(f'with location data: {hits}/{len(resolved)}')
