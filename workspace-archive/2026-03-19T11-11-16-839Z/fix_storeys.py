#!/usr/bin/env python3
"""
Post-process IFC file to:
1. Consolidate duplicate IfcBuildingStorey instances (Error #3)
2. Add storey height properties (Error #5)
"""

import re
import sys

def fix_ifc_storeys(input_file, output_file):
    with open(input_file, 'r') as f:
        lines = f.readlines()

    # Find all IFCBUILDINGSTOREY definitions and create canonical mapping
    storey_map = {}  # old_id -> canonical_id
    storey_canonical = {}  # storey_name -> canonical_id

    # Define canonical storeys with heights
    storey_heights = {
        'Foundation': 0.6,
        'EG': 2.8,
        'OG1': 2.8,
        'OG2': 2.8
    }

    storey_elevations = {
        'Foundation': -0.6,
        'EG': 0.0,
        'OG1': 2.8,
        'OG2': 5.6
    }

    # First pass: find and map all storey instances
    # Format: #26=IFCBUILDINGSTOREY('VwCPKnHnVWdEtvrDf3Av$y',#5,'EG',$,$,$,#29,$,.ELEMENT.,0.);
    for i, line in enumerate(lines):
        if 'IFCBUILDINGSTOREY(' in line:
            match = re.search(r"#(\d+)=IFCBUILDINGSTOREY\('[^']+',#\d+,'([^']+)'", line)
            if match:
                entity_id = match.group(1)
                storey_name = match.group(2)

                if storey_name in storey_heights:
                    if storey_name not in storey_canonical:
                        # First occurrence - this becomes canonical
                        storey_canonical[storey_name] = entity_id
                        print(f"  Canonical {storey_name}: #{entity_id}")
                    else:
                        # Duplicate - map to canonical
                        storey_map[entity_id] = storey_canonical[storey_name]
                        print(f"  Mapping duplicate #{entity_id} -> #{storey_canonical[storey_name]} ({storey_name})")

    print(f"\nFound {len(storey_canonical)} unique storeys")
    print(f"Mapping {len(storey_map)} duplicate storey references")

    # Second pass: replace all references to duplicate storeys and remove duplicate definitions
    output_lines = []
    removed_count = 0
    for line in lines:
        modified_line = line

        # Skip duplicate storey definitions entirely
        if 'IFCBUILDINGSTOREY(' in line:
            match = re.search(r"#(\d+)=IFCBUILDINGSTOREY", line)
            if match and match.group(1) in storey_map:
                # Skip this duplicate definition
                removed_count += 1
                continue

        # Replace references to duplicate storeys in all other lines
        for old_id, new_id in storey_map.items():
            # Match #ID followed by word boundary (comma, paren, etc)
            modified_line = re.sub(rf'#({old_id})([,\)])', f'#{new_id}\\2', modified_line)

        output_lines.append(modified_line)

    print(f"Removed {removed_count} duplicate storey definitions")

    # Third pass: add height property sets to canonical storeys
    # Find where to insert property sets (after storeys but before aggregates)
    insert_idx = None
    for i, line in enumerate(output_lines):
        if 'IFCRELAGGREGATES(' in line and insert_idx is None:
            insert_idx = i
            break

    if insert_idx is None:
        insert_idx = len(output_lines) - 10  # Fallback

    # Get next available entity ID
    max_id = 0
    for line in output_lines:
        ids = re.findall(r'#(\d+)=', line)
        for id_str in ids:
            max_id = max(max_id, int(id_str))

    next_id = max_id + 1

    # Create property sets for each canonical storey
    new_properties = []
    print(f"\nAdding property sets starting at #{next_id}:")
    for storey_name, canonical_id in storey_canonical.items():
        if storey_name in storey_heights:
            elevation = storey_elevations[storey_name]
            height = storey_heights[storey_name]

            # Create IfcPropertySingleValue for Height
            prop_height_id = next_id
            next_id += 1
            new_properties.append(
                f"#{prop_height_id}=IFCPROPERTYSINGLEVALUE('Height',$,IFCLENGTHMEASURE({height}),$);\n"
            )

            # Create IfcPropertySingleValue for Elevation
            prop_elev_id = next_id
            next_id += 1
            new_properties.append(
                f"#{prop_elev_id}=IFCPROPERTYSINGLEVALUE('Elevation',$,IFCLENGTHMEASURE({elevation}),$);\n"
            )

            # Create IfcPropertySet
            pset_id = next_id
            next_id += 1
            new_properties.append(
                f"#{pset_id}=IFCPROPERTYSET('{storey_name}_Dimensions',$,$,$,(#{prop_height_id},#{prop_elev_id}));\n"
            )

            # Create IfcRelDefinesByProperties
            rel_id = next_id
            next_id += 1
            owner_hist = '#5'
            new_properties.append(
                f"#{rel_id}=IFCRELDEFINESBYPROPERTIES('{storey_name}_HeightDef',{owner_hist},$,$,(#{canonical_id}),#{pset_id});\n"
            )

            print(f"  {storey_name}: Height={height}m, Elevation={elevation}m")

    # Insert new properties
    output_lines = output_lines[:insert_idx] + new_properties + output_lines[insert_idx:]

    # Write output
    with open(output_file, 'w') as f:
        f.writelines(output_lines)

    print(f"\n✓ Fixed IFC written to {output_file}")
    print(f"  - Consolidated to {len(storey_canonical)} unique storeys")
    print(f"  - Added height properties to all storeys")

if __name__ == '__main__':
    input_file = sys.argv[1] if len(sys.argv) > 1 else '/Users/louistrue/Development/agentic-bim-team/workspace/design_v3.ifc'
    output_file = sys.argv[2] if len(sys.argv) > 2 else '/Users/louistrue/Development/agentic-bim-team/workspace/design_v3_fixed.ifc'

    fix_ifc_storeys(input_file, output_file)
