import sys
import re

def check_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Regex to find <div or </div
        # This is slightly more robust than count()
        tokens = re.findall(r'<(div|/div)', line)
        
        for token in tokens:
            if token == 'div':
                stack.append(line_num)
            elif token == '/div':
                if stack:
                    stack.pop()
                else:
                    print(f"Error: Extra </div> at line {line_num}")
        
        # Print stack if it changes significantly or at milestones
        if line_num % 100 == 0:
            pass # print(f"Line {line_num}: Stack size {len(stack)}")

    if stack:
        print(f"Error: {len(stack)} unclosed <div> tags.")
        for s in stack:
            print(f"  Opened at line {s}: {lines[s-1].strip()}")

check_file('src/components/PhaseView.tsx')
