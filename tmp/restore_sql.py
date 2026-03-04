
import json
import uuid

# Data from CHO #1 items (extracted from step 257)
cho_items_json = [
    {"unit":"Ea","item_num":"007","quantity":51,"unit_price":3300,"description":"Video Image Processor","fund_source":"FHWA:100%","specification":"654-590"},
    {"unit":"LnM","item_num":"008","quantity":6000,"unit_price":11.5,"description":"Coaxial and Power Cable","fund_source":"FHWA:100%","specification":"654-644"},
    {"unit":"Ea","item_num":"009","quantity":150,"unit_price":2400,"description":"Video Detection Camera","fund_source":"FHWA:100%","specification":"654-657"},
    {"unit":"Ea","item_num":"010","quantity":209,"unit_price":675,"description":"Video Image Processor Programming","fund_source":"FHWA:100%","specification":"654-811"},
    {"unit":"LnM","item_num":"012","quantity":100,"unit_price":7.5,"description":"Multi-Conductor Communication Cable, CCTV","fund_source":"FHWA:100%","specification":"830-215"},
    {"unit":"Ea","item_num":"013","quantity":9,"unit_price":4800,"description":"CCTV Camera with POE, Pressurized","fund_source":"FHWA:100%","specification":"830-216"},
    {"unit":"Ea","item_num":"014","quantity":7,"unit_price":1100,"description":"Managed Field Ethernet Switch, LHES","fund_source":"FHWA:100%","specification":"830-217"},
    {"unit":"Ea","item_num":"015","quantity":3,"unit_price":200,"description":"CCTV Lens Cleaning","fund_source":"FHWA:100%","specification":"833-001"},
    {"unit":"Ea","item_num":"016","quantity":80,"unit_price":225,"description":"Video Detection Camera Lens Cleaning","fund_source":"FHWA:100%","specification":"833-002"},
    {"unit":"Ea","item_num":"017","quantity":10,"unit_price":325,"description":"Video Detection Camera Alignment and Lens Cleaning","fund_source":"FHWA:100%","specification":"833-003"},
    {"unit":"Ea","item_num":"019","quantity":160,"unit_price":200,"description":"Cleaning Pull Box","fund_source":"FHWA:100%","specification":"956-140"}
]

project_id = '488f8f15-fa0b-4456-8e3d-dd19a8d8f222'

sql_fragments = []
for item in cho_items_json:
    # We clean external negative values for the "original" list
    qty = abs(float(item['quantity']))
    
    val_line = f"('{project_id}', '{item['item_num']}', '{item['specification']}', '{item['description'].replace(\"'\", \"''\")}', {qty}, '{item['unit']}', {item['unit_price']}, '{item['fund_source']}')"
    sql_fragments.append(val_line)

sql = "INSERT INTO contract_items (project_id, item_num, specification, description, quantity, unit, unit_price, fund_source) VALUES\n" + ",\n".join(sql_fragments) + ";"

print(sql)
