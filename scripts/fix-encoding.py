# -*- coding: utf-8 -*-
"""Fix mixed-encoding Turkish character corruption in SopranoChat source files.
Handles cases where a single line has both correct UTF-8 and double-encoded segments."""

import os
import re

# Specific corrupted byte sequences and their correct UTF-8 replacements
# These are hex patterns found in the actual file bytes
BYTE_REPLACEMENTS = [
    # Triple-encoded patterns (after first round fix left these)
    # "Boş" - Bo + Å\x9f -> the Å was double-encoded to \xc3\x85, and \x9f to \xc5\xb8  
    (b'\xc3\x85\xc5\xb8', b'\xc5\x9f'),  # ş (triple encoded)
    (b'\xc3\x84\xc5\xb8', b'\xc4\x9f'),  # ğ (triple encoded)
    (b'\xc3\x83\xe2\x80\x93', b'\xc3\x96'),  # Ö (triple encoded via — sequence)
    (b'\xc3\x83\xe2\x80\xa1', b'\xc3\x87'),  # Ç (triple encoded)
    (b'\xc3\x83\xc2\xbc', b'\xc3\xbc'),  # ü (triple encoded)
    (b'\xc3\x83\xc2\xb6', b'\xc3\xb6'),  # ö (triple encoded)
    (b'\xc3\x83\xc2\xa7', b'\xc3\xa7'),  # ç (triple encoded)
    (b'\xc3\x83\xc2\x9c', b'\xc3\x9c'),  # Ü (triple encoded)
    # Double-encoded symbol patterns remaining
    (b'\xc3\xa2\xe2\x80\xa0\xe2\x80\x99', b'\xe2\x86\x92'),  # → arrow
    (b'\xc3\xa2\xe2\x80\x94', b'\xe2\x80\x94'),  # — em dash
    (b'\xc3\xa2\xe2\x80\x93', b'\xe2\x80\x93'),  # – en dash  
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9c', b'\xe2\x80\x94'),  # — em dash variant
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x93', b'\xe2\x80\x93'),  # – en dash variant
    (b'\xc3\xa2\xe2\x82\xac\xe2\x84\xa2', b'\xe2\x80\x99'),  # ' right single quote
    (b'\xc3\xa2\xe2\x82\xac\xc2\xa2', b'\xe2\x80\xa2'),  # • bullet
    (b'\xc3\xa2\xe2\x80\xa2\xe2\x84\xa2', b'\xe2\x95\x90'),  # ═ box drawing (approx)
    (b'\xc3\xa2\xe2\x80\xa2', b'\xe2\x95'),  # box drawing prefix
    # Star
    (b'\xc3\xa2\xcb\x9c\xc2\x85', b'\xe2\x98\x85'),  # ★ 
    # Remaining double-encoded Turkish
    (b'\xc3\x84\xc2\xb1', b'\xc4\xb1'),  # ı (double encoded)
    (b'\xc3\x84\xc2\xb0', b'\xc4\xb0'),  # İ (double encoded)
    (b'\xc3\x85\xc5\x9f', b'\xc5\x9f'),  # ş (double encoded variant)
    (b'\xc3\x85\xc5\x9e', b'\xc5\x9e'),  # Ş (double encoded variant)
    (b'\xc3\x84\xe2\x80\x9f', b'\xc4\x9f'),  # ğ (double encoded variant)
    (b'\xc3\x84\xe2\x80\x9e', b'\xc4\x9e'),  # Ğ (double encoded variant)
    # Emoji patterns that got double-encoded
    (b'\xc4\x9f\xc5\x9f\xe2\x80\x9c\xc2\xb4', b'\xf0\x9f\x94\xb4'),  # 🔴
    (b'\xc4\x9f\xc5\x9f\xe2\x84\xa2\xc3\xaf\xc2\xb8\x8f', b'\xf0\x9f\x8f\x99\xef\xb8\x8f'),  # 🏙️
    (b'\xc4\x9f\xc5\x9f\xe2\x80\x98\xc2\x8b', b'\xf0\x9f\x91\x8b'),  # 👋
    (b'\xc4\x9f\xc5\x9f\xe2\x80\x9c', b'\xf0\x9f\x94'),  # � prefix
]

def fix_file(filepath):
    """Fix encoding corruption at byte level."""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
    except Exception as e:
        print(f"  ERROR reading {filepath}: {e}")
        return False

    original = raw
    result = raw

    # Apply byte-level replacements
    for bad, good in BYTE_REPLACEMENTS:
        result = result.replace(bad, good)

    if result != original:
        with open(filepath, 'wb') as f:
            f.write(result)
        # Verify it's still valid UTF-8
        try:
            result.decode('utf-8')
            print(f"  FIXED: {filepath}")
        except UnicodeDecodeError as e:
            print(f"  FIXED but UTF-8 validation warning at {e.start}: {filepath}")
        return True

    print(f"  SKIPPED (no changes): {filepath}")
    return False

def main():
    base = r'c:\SopranoChat'

    files_to_fix = [
        r'app\(tabs)\home.tsx',
        r'components\room\RoomOverlays.tsx',
        r'components\room\RoomManageSheet.tsx',
        r'components\room\ListenerGrid.tsx',
        r'services\roomAccess.ts',
        r'services\room.ts',
        r'services\call.ts',
        r'hooks\useRoomGamification.ts',
    ]

    fixed_count = 0
    for rel_path in files_to_fix:
        full_path = os.path.join(base, rel_path)
        if not os.path.exists(full_path):
            print(f"  NOT FOUND: {full_path}")
            continue
        if fix_file(full_path):
            fixed_count += 1

    print(f"\nDone! Fixed {fixed_count}/{len(files_to_fix)} files.")
    
    # Verify key lines
    print("\n--- Verification ---")
    verify_path = os.path.join(base, r'app\(tabs)\home.tsx')
    with open(verify_path, 'rb') as f:
        lines = f.read().split(b'\n')
    for i in [29, 32, 34, 65, 70, 146, 241, 529, 576, 646]:
        if i < len(lines):
            try:
                text = lines[i].decode('utf-8').strip()
                print(f"  L{i+1}: {text[:100]}")
            except:
                print(f"  L{i+1}: DECODE ERROR - {lines[i][:80]}")

if __name__ == '__main__':
    main()
