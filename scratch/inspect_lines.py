import sys

file_path = 'src/components/ForceAccount2Form.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(760, 780):
    if i < len(lines):
        print(f"{i+1:4}: {repr(lines[i])}")
