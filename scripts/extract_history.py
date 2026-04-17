"""
Extract and aggregate item history from the ACT Excel file.
Output: JSON file with aggregated spec data for the Negociación PriceComparison component.
"""
import openpyxl
import json
import collections
import re

INPUT_FILE = r'C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\Documentos\Items.History.02 hasta mzo 2024.xlsx'
OUTPUT_FILE = r'C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\public\items_history.json'

def safe_float(val):
    """Try to extract a numeric value from potentially dirty data."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    # Remove commas used as thousands separator
    s = s.replace(',', '')
    # Try direct conversion
    try:
        return float(s)
    except ValueError:
        # Try to extract first valid number
        m = re.match(r'^[\d]+\.?\d*', s)
        if m:
            try:
                return float(m.group())
            except:
                pass
        return None

def main():
    print("Loading workbook...")
    wb = openpyxl.load_workbook(INPUT_FILE, data_only=True, read_only=True)
    ws = wb.active
    
    # Columns: SPEC CODE(0), ITM NAME(1), PRO NUM(2), PRO NAME(3), START DATE(4),
    #          MUNICIPALITY(5), CONTRACTOR(6), QUANTITY(7), UNIT(8), UNIT PRICE(9), BY EWO(10)
    
    items = collections.defaultdict(lambda: {
        'prices': [], 'desc': '', 'unit': '', 'latest_date': '',
        'min_price': float('inf'), 'max_price': 0,
        'contractors': set(), 'municipalities': set()
    })
    
    skipped = 0
    processed = 0
    
    print("Processing rows...")
    for row in ws.iter_rows(min_row=2, values_only=True):
        spec = str(row[0]).strip() if row[0] else ''
        if not spec:
            continue
            
        price = safe_float(row[9])
        if price is None or price <= 0:
            skipped += 1
            continue
        
        desc = str(row[1]).strip() if row[1] else ''
        unit = str(row[8]).strip() if row[8] else ''
        date_val = str(row[4])[:10] if row[4] else ''
        contractor = str(row[6]).strip() if row[6] else ''
        municipality = str(row[5]).strip() if row[5] else ''
        
        entry = items[spec]
        entry['prices'].append(price)
        entry['desc'] = desc
        entry['unit'] = unit
        if date_val > entry['latest_date']:
            entry['latest_date'] = date_val
        if price < entry['min_price']:
            entry['min_price'] = price
        if price > entry['max_price']:
            entry['max_price'] = price
        if contractor:
            entry['contractors'].add(contractor)
        if municipality:
            entry['municipalities'].add(municipality)
        processed += 1
    
    wb.close()
    
    print(f"Processed {processed} records, skipped {skipped} invalid prices")
    print(f"Unique item specs: {len(items)}")
    
    # Build output JSON array
    output = []
    for spec, data in sorted(items.items()):
        n = len(data['prices'])
        avg = sum(data['prices']) / n
        output.append({
            'spec_num': spec,
            'description': data['desc'],
            'unit': data['unit'],
            'avg_price': round(avg, 2),
            'min_price': round(data['min_price'], 2),
            'max_price': round(data['max_price'], 2),
            'sample_count': n,
            'latest_date': data['latest_date'],
            'contractor_count': len(data['contractors']),
        })
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=None)
    
    print(f"Output written to {OUTPUT_FILE}")
    print(f"Total unique items: {len(output)}")
    # Show first 5
    for item in output[:5]:
        print(f"  {item['spec_num']} | {item['description'][:40]} | avg={item['avg_price']} | n={item['sample_count']}")

if __name__ == '__main__':
    main()
