import json
with open('tmp/xlsx_data.json') as f:
    data = json.load(f)

for i, row in enumerate(data):
    non_null = [x for x in row if x is not None]
    if len(non_null) > 0:
        print(f"Row {i+1}: {non_null[:5]}")
