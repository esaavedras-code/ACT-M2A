import json
with open('tmp/xlsx_data.json', encoding='utf-8') as f:
    data = json.load(f)

out = []
for i, row in enumerate(data):
    non_null = [x for x in row if x is not None]
    if len(non_null) > 0:
        out.append(f"Row {i+1}: {non_null[:8]}")

with open('tmp/row_mapping_utf8.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
