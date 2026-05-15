import sys
import re

def check_file(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    balance = 0
    for i, line in enumerate(lines):
        line_num = i + 1
        opens = line.count('<div')
        closes = line.count('</div')
        balance += opens - closes
        if opens != 0 or closes != 0:
            print(f"Line {line_num:4}: {opens} opens, {closes} closes. Balance: {balance}")

check_file('src/components/PhaseView.tsx')
