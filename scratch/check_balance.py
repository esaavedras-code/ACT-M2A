import sys

def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    pairs = {'{': '}', '[': ']', '(': ')'}
    inverse = {v: k for k, v in pairs.items()}
    
    line_no = 1
    char_no = 1
    
    in_string = None
    escape = False
    
    for char in content:
        if escape:
            escape = False
            char_no += 1
            continue
        
        if char == '\\':
            escape = True
            char_no += 1
            continue
            
        if in_string:
            if char == in_string:
                in_string = None
            if char == '\n':
                line_no += 1
                char_no = 1
            else:
                char_no += 1
            continue
            
        if char in ["'", '"', '`']:
            in_string = char
            char_no += 1
            continue

        if char == '\n':
            line_no += 1
            char_no = 1
            continue
        
        if char in pairs:
            stack.append((char, line_no, char_no))
        elif char in inverse:
            if not stack:
                print(f"Extra closing '{char}' at line {line_no}, char {char_no}")
                return
            top, tl, tc = stack.pop()
            if top != inverse[char]:
                print(f"Mismatched '{char}' at line {line_no}, char {char_no} (expected closing for '{top}' from line {tl}, char {tc})")
                return
        char_no += 1
    
    if stack:
        for char, tl, tc in stack:
            print(f"Unclosed '{char}' from line {tl}, char {tc}")
    else:
        print("Balanced!")

if __name__ == "__main__":
    check_balance(sys.argv[1])
