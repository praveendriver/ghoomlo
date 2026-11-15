import json, glob, re
from collections import Counter

all_images = []
for f in sorted(glob.glob('/Users/malhar.gupta/projects/personal/travel agent/.workspace/japan-extract-*.json')):
    try:
        data = json.load(open(f))
        if isinstance(data, list):
            all_images.extend(data)
    except Exception as e:
        print(f'ERR {f}: {e}')

print(f'total images: {len(all_images)}')

all_places = []
for img in all_images:
    for p in (img.get('places') or []):
        p2 = dict(p)
        p2['source_file'] = img.get('file')
        p2['source_handle'] = img.get('source_url_hint')
        all_places.append(p2)
print(f'total raw place mentions: {len(all_places)}')

def norm(n):
    return re.sub(r'[^a-z0-9]+', '', (n or '').lower())

groups = {}
for p in all_places:
    k = norm(p.get('name'))
    if not k: continue
    groups.setdefault(k, []).append(p)
print(f'unique places (by name): {len(groups)}')

agg = []
for k, grp in groups.items():
    first = grp[0]
    cities = Counter(p.get('city') or 'unknown' for p in grp)
    kinds = Counter(p.get('kind') or 'unclear' for p in grp)
    agg.append({
        'name': first['name'],
        'kind': kinds.most_common(1)[0][0],
        'city': cities.most_common(1)[0][0],
        'mentions': len(grp),
        'timing_hints': sorted({p.get('timing_hint') for p in grp if p.get('timing_hint')}),
        'notes': sorted({p.get('notes') for p in grp if p.get('notes')})[:3],
        'source_files': sorted({p.get('source_file') for p in grp if p.get('source_file')})[:5],
        'handles': sorted({p.get('source_handle') for p in grp if p.get('source_handle')}),
    })
agg.sort(key=lambda x: (-x['mentions'], x['name']))

out = '/Users/malhar.gupta/projects/personal/travel agent/.workspace/japan-places-consolidated.json'
json.dump(agg, open(out, 'w'), indent=2, ensure_ascii=False)

cities = Counter(p['city'] for p in agg)
print('\nby city:')
for c, n in cities.most_common():
    print(f'  {c:<15} {n}')
print('\nby kind:')
kinds = Counter(p['kind'] for p in agg)
for kk, n in kinds.most_common():
    print(f'  {str(kk):<15} {n}')

print('\ntop 40 most-mentioned:')
for p in agg[:40]:
    n = p['name'][:45]
    c = p['city']
    k = p['kind']
    print(f"  {p['mentions']}x  {n:<46} ({c}, {k})")
