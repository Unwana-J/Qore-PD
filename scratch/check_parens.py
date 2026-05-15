import sys

def check_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char == '(':
                stack.append(('(', line_num))
            elif char == ')':
                if stack and stack[-1][0] == '(':
                    stack.pop()
                else:
                    print(f"Error: Extra ) at line {line_num}")
            elif char == '{':
                stack.append(('{', line_num))
            elif char == '}':
                if stack and stack[-1][0] == '{':
                    stack.pop()
                else:
                    print(f"Error: Extra }} at line {line_num}")

    if stack:
        print(f"Error: {len(stack)} unclosed tokens.")
        for token, line in stack:
            print(f"  Unclosed {token} opened at line {line}")

check_file('src/components/PhaseView.tsx')
