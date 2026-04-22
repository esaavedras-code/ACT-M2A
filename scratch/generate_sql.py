
import json

# Balances calculated from previous SQL
balances = [
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"088","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"057","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"097","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"108","balance":19},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"056","balance":9},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"076","balance":444},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"116","balance":2},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"115","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"069","balance":3},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"117","balance":1.00},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"077","balance":1805.4},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"052","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"087","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"094","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"053","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"061","balance":6},
    {"project_id":"488f8f15-fa0b-4456-8e3d-dd19a8d8f222","item_num":"008","balance":6375.869916317993},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"055","balance":3},
    {"project_id":"488f8f15-fa0b-4456-8e3d-dd19a8d8f222","item_num":"006","balance":11},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"068","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"060","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"054","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"058","balance":3},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"075","balance":1},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"126","balance":16},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"063","balance":1}
]

# Last certs data
last_certs = {
    "2e0d8d80-3542-451c-bbef-63a791012e34": {
        "id": "db6d4c01-40d8-42bd-924c-746c5d748248",
        "items": [
            {"unit":"SqM","item_num":"018","quantity":"170.63","unit_price":77,"description":"Reconstruction of Existing Sidewalk","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"608-004","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"019","quantity":"10505","unit_price":1,"description":"Painting Concrete Curb","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"609-023","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Month","item_num":"025","quantity":"16","unit_price":2500,"description":"Field and Laboratory Office Model 2","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"611-011","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"043","quantity":"3.00","unit_price":6000,"description":"Alum. Light. Std. 40 Ft. Mount-Hght, 15' Bracket-Twin","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":3,"specification":"612-017","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"046","quantity":"193.88","unit_price":8,"description":"Conductor Cable 2 AWG Copper Stranded TW, 90øC","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"612-072","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"048","quantity":"1.00","unit_price":390,"description":"Polymer Concrete Pull Box Type E","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"612-382","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"049","quantity":"387.80","unit_price":9,"description":"Conductor No 2 AWG XHHW-2 600V Alum","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"612-935","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"050","quantity":"6","unit_price":360,"description":"Conductor No 1/0 AWG Aluminum XLPE 600V","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"612-957","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"076","quantity":"350","unit_price":4,"description":"Thermoplastic Pavement Marking Stripes, white","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"618-001","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"077","quantity":"205.70","unit_price":4,"description":"Thermoplastic Pavement Marking Stripes, yellow","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"618-002","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"078","quantity":"96","unit_price":190,"description":"Thermoplastic Pavement Markings, Symbols & Letters","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"618-003","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"082","quantity":"73.45","unit_price":7,"description":"Reflective Raised Pavt.Mark., One way, Clear","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"640-003","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"083","quantity":"22.25","unit_price":7,"description":"Reflective Raised Pavt.Mark., One way, Yellow","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"640-004","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"084","quantity":"29.00","unit_price":8,"description":"Reflective Raised Pavt Mark, Two way, Yellow and Red","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"640-011","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LS","item_num":"089","quantity":"90.00","unit_price":"400","description":"Traffic Counts, Adjustment and Fine Tuning","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"654-136","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"106","quantity":"388.72","unit_price":4,"description":"Electrical Conductor No. 6 RHH CU XLP 90 Deg","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"654-487","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ea","item_num":"113","quantity":"6","unit_price":2200,"description":"9 Port Ethernet Switch Devices","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"654-633","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LnM","item_num":"114","quantity":"97.56","unit_price":11,"description":"Coaxial and Power Cable","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"654-644","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"Ton","item_num":"132","quantity":"12.24","unit_price":130,"description":"WMA Marshall S(75) (12)","fund_source":"FHWA:100%","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"962-012","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LS","item_num":"142","quantity":"0.57947121","unit_price":14799.7,"description":"Special and/or Additional Work  - (PR-845 Asfalto)","fund_source":"FHWA:80.25","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"888-000","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"CuM","item_num":"144","quantity":"306","unit_price":30,"description":"Subbase Course","fund_source":"FHWA:80.25","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"301-001","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LS","item_num":"147","quantity":"2.82249665","unit_price":6183.32,"description":"Special and/or Additional Work -  (PR-844 Asfalto)","fund_source":"FHWA:80.25","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"888-000","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False},
            {"unit":"LS","item_num":"148","quantity":"100","unit_price":410,"description":"Special and/or Additional Work -  (Tubería en PR-176 INT Pio Baroja)","fund_source":"FHWA:80.25","mos_lot_num":"1","mos_provider":"","mos_quantity":0,"qty_from_mos":0,"specification":"888-000","mos_unit_price":0,"skip_retention":False,"mos_invoice_num":"","mos_invoice_total":0,"has_material_on_site":False}
        ]
    },
    "488f8f15-fa0b-4456-8e3d-dd19a8d8f222": {
        "id": "4fddb7f3-272c-4f4b-a232-4e5a44edacfd",
        "items": [
            {"unit":"Day","item_num":"004","quantity":"1","unit_price":19,"description":"Flashing Arrow Signs","fund_source":"FHWA:100%","mos_quantity":0,"qty_from_mos":0,"specification":"638-013","mos_unit_price":0,"skip_retention":False,"has_material_on_site":False},
            {"unit":"Ea","item_num":"010","quantity":"3","unit_price":675,"description":"Video Image Processor Programming","fund_source":"FHWA:100%","mos_quantity":0,"qty_from_mos":0,"specification":"654-811","mos_unit_price":0,"skip_retention":False,"has_material_on_site":False}
        ]
    }
}

# Contract items (subset needed for new items)
contract_items = [
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"088","specification":"654-010","description":"Traffic Signal Support, Single Mast Arm Type 45 ft","unit":"Ea","unit_price":12000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"057","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":400.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"097","specification":"654-255","description":"Traffic Signal Supp Single Mast Arm 30' Galv Steel","unit":"Ea","unit_price":10000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"108","specification":"654-531","description":"Pedestrian Signal Head Type P-12 LED 16 x 18","unit":"Ea","unit_price":940.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"056","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":400.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"076","specification":"618-001","description":"Thermoplastic Pavement Marking Stripes, white","unit":"LnM","unit_price":4.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"116","specification":"654-647","description":"Traf Signal Support S Mast Arm 25 ft Galv Steel","unit":"Ea","unit_price":8000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"115","specification":"654-646","description":"Traf Signal Support S Mast Arm 20 ft Galv Steel","unit":"Ea","unit_price":8000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"069","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":750.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"117","specification":"654-657","description":"Video Detection Camera","unit":"Ea","unit_price":2000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"077","specification":"618-002","description":"Thermoplastic Pavement Marking Stripes, yellow","unit":"LnM","unit_price":4.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"052","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":300.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"087","specification":"654-008","description":"Traffic Signal Support, Single Mast Arm Type 35 ft","unit":"Ea","unit_price":10000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"094","specification":"654-232","description":"Traffic Signal Sup, Single Mast Arm 50' Galv Steel","unit":"Ea","unit_price":13000.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"053","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":300.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"061","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":600.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"055","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":490.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"068","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":650.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"060","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":600.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"054","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":450.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"058","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":800.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"075","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":400.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"126","specification":"654-737","description":"Accesible Pedestrian Signal Push Button Station","unit":"Ea","unit_price":1100.0,"fund_source":"FHWA:100%"},
    {"project_id":"2e0d8d80-3542-451c-bbef-63a791012e34","item_num":"063","specification":"613-001","description":"Traffic Sign Assembly, Code No","unit":"Ea","unit_price":375.0,"fund_source":"FHWA:100%"},
    {"project_id":"488f8f15-fa0b-4456-8e3d-dd19a8d8f222","item_num":"008","specification":"654-644","description":"Coaxial and Power Cable","unit":"LnM","unit_price":11.5,"fund_source":"FHWA:100%"},
    {"project_id":"488f8f15-fa0b-4456-8e3d-dd19a8d8f222","item_num":"006","specification":"654-001","description":"Maint. & Removal of Exist. Traffic Signal System","unit":"LS","unit_price":250.0,"fund_source":"FHWA:100%"}
]

# Process each project
for project_id, cert_data in last_certs.items():
    items = cert_data["items"]
    project_balances = [b for b in balances if b["project_id"] == project_id]
    
    for b in project_balances:
        item_num = b["item_num"]
        balance = b["balance"]
        
        # Find item in cert
        found = False
        for it in items:
            if it["item_num"] == item_num:
                it["qty_from_mos"] = (float(it.get("qty_from_mos", 0)) or 0.0) + balance
                found = True
                break
        
        if not found:
            # Get details from contract_items
            details = next((c for c in contract_items if c["project_id"] == project_id and c["item_num"] == item_num), None)
            if details:
                items.append({
                    "item_num": item_num,
                    "specification": details["specification"],
                    "description": details["description"],
                    "unit": details["unit"],
                    "quantity": 0,
                    "unit_price": details["unit_price"],
                    "fund_source": details["fund_source"],
                    "has_material_on_site": False,
                    "mos_quantity": 0,
                    "mos_unit_price": 0,
                    "mos_invoice_total": 0,
                    "mos_invoice_num": "",
                    "mos_provider": "",
                    "mos_lot_num": "1",
                    "qty_from_mos": balance,
                    "skip_retention": False,
                })
    
    # Generate SQL
    json_items = json.dumps(items)
    print(f"--- UPDATE {project_id} ---")
    print(f"UPDATE public.payment_certifications SET items = '{json_items}'::jsonb WHERE id = '{cert_data['id']}';")
    break # Only first one
