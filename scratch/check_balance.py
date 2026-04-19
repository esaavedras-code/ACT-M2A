import sys

def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    
    line = 1
    col = 1
    
    for i, char in enumerate(content):
        if char == '\n':
            line += 1
            col = 1
            continue
        
        if char in '({[':
            stack.append((char, line, col))
        elif char in ')}]':
            if not stack:
                print(f"Extra closing '{char}' at line {line}, col {col}")
            else:
                top, t_line, t_col = stack.pop()
                if top != pairs[char]:
                    print(f"Mismatch: '{char}' at line {line}, col {col} does not match '{top}' at line {t_line}, col {t_col}")
        col += 1

    if stack:
        for char, l, c in stack:
            print(f"Unclosed '{char}' from line {l}, col {c}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
