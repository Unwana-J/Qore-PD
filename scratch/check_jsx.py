import sys

def check_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Very simple tag detection (not full JSX parser)
        # Looking for <div and </div
        # This is just a heuristic to find the mismatch area
        
        # Count <div
        div_opens = line.count('<div')
        # Count </div
        div_closes = line.count('</div')
        
        for _ in range(div_opens):
            stack.append(line_num)
        for _ in range(div_closes):
            if stack:
                stack.pop()
            else:
                print(f"Error: Extra </div> at line {line_num}")
    
    if stack:
        print(f"Error: {len(stack)} unclosed <div> tags. First one opened at line {stack[0]}")
        print(f"Top of stack: {stack[-5:] if len(stack) > 5 else stack}")

check_file('src/components/PhaseView.tsx')
