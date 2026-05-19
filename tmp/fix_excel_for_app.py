#!/usr/bin/env python3
"""Create an app-compatible copy of the user's job tracker workbook.

This keeps the original workbook untouched and patches the XLSX internals
to add the columns the web app expects.
"""

from __future__ import annotations

import copy
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET


SOURCE = Path("/Users/josh/Desktop/Job_Application_Tracker_FIXED.xlsx")
TARGET = Path("/Users/josh/Desktop/Job_Application_Tracker_FIXED_app_compatible.xlsx")

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS_XR = "http://schemas.microsoft.com/office/spreadsheetml/2014/revision"
NS_XR3 = "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"

ET.register_namespace("", NS_MAIN)
ET.register_namespace("mc", NS_MC)
ET.register_namespace("xr", NS_XR)
ET.register_namespace("xr3", NS_XR3)

CELL_REF_RE = re.compile(r"([A-Z]+)(\d+)")


def col_to_num(col: str) -> int:
    value = 0
    for ch in col:
        value = value * 26 + ord(ch) - 64
    return value


def num_to_col(value: int) -> str:
    chars: list[str] = []
    while value:
        value, rem = divmod(value - 1, 26)
        chars.append(chr(65 + rem))
    return "".join(reversed(chars))


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value_node = cell.find(f"{{{NS_MAIN}}}v")
    if value_node is None or value_node.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        return shared_strings[int(value_node.text)]
    return value_node.text


def append_shared_string(root: ET.Element, text: str) -> int:
    shared_strings = root.findall(f"{{{NS_MAIN}}}si")
    index = len(shared_strings)
    si = ET.SubElement(root, f"{{{NS_MAIN}}}si")
    t = ET.SubElement(si, f"{{{NS_MAIN}}}t")
    t.text = text
    root.set("count", str(int(root.get("count", "0")) + 1))
    root.set("uniqueCount", str(index + 1))
    return index


def normalize_response_status(raw: str) -> str:
    value = " ".join((raw or "").strip().split())
    if not value:
        return "Applied"

    lower = value.lower()
    if lower in {"offer received", "offer"}:
        return "Offer"
    if lower.startswith("interview"):
        return "Interview"
    if lower in {"pre-screen call", "prescreen call", "pre screen call"}:
        return "Pre-screen call"
    if lower == "rejected":
        return "Rejected"
    if lower in {"no response", "no response yet"}:
        return "No Response"
    if lower == "assessment":
        return "Assessment"
    if lower in {"auto-reply received", "auto reply received"}:
        return "Auto-reply received"
    if lower in {"human reply received", "human-reply received"}:
        return "Human reply received"
    return value.title()


def map_current_status(response_status: str) -> str:
    status = normalize_response_status(response_status)
    if status == "Pre-screen call":
        return "Pre-screen call"
    if status == "Offer":
        return "Offer"
    if status == "Rejected":
        return "Rejected"
    if status == "No Response":
        return "No Response"
    if status in {"Interview", "Assessment"}:
        return "Interview"
    return "Applied"


def build_text_cell(ref: str, style_id: str, shared_index: int) -> ET.Element:
    cell = ET.Element(f"{{{NS_MAIN}}}c", {"r": ref, "s": style_id, "t": "s"})
    value = ET.SubElement(cell, f"{{{NS_MAIN}}}v")
    value.text = str(shared_index)
    return cell


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source workbook: {SOURCE}")

    with zipfile.ZipFile(SOURCE) as zin:
        workbook_files = {name: zin.read(name) for name in zin.namelist()}

    shared_root = ET.fromstring(workbook_files["xl/sharedStrings.xml"])
    shared_strings = [
        "".join(node.text or "" for node in si.iter(f"{{{NS_MAIN}}}t"))
        for si in shared_root.findall(f"{{{NS_MAIN}}}si")
    ]

    needed_strings = [
        "Current Status",
        "Follow-Up Date",
        "Applied",
        "No Response",
        "Interview",
        "Pre-screen call",
        "Offer",
        "Rejected",
    ]
    shared_lookup = {value: index for index, value in enumerate(shared_strings)}
    for text in needed_strings:
        if text not in shared_lookup:
            shared_lookup[text] = append_shared_string(shared_root, text)

    sheet_root = ET.fromstring(workbook_files["xl/worksheets/sheet1.xml"])
    sheet_data = sheet_root.find(f"{{{NS_MAIN}}}sheetData")
    if sheet_data is None:
        raise SystemExit("Applications sheet is missing sheetData")

    rows = sheet_data.findall(f"{{{NS_MAIN}}}row")
    header_row = rows[0]
    header_cells = {cell.attrib["r"]: cell for cell in header_row.findall(f"{{{NS_MAIN}}}c")}
    header_style = header_cells["J1"].attrib.get("s", "12")
    body_style = next(
        (cell.attrib.get("s", "2") for cell in rows[1].findall(f"{{{NS_MAIN}}}c") if cell.attrib["r"].startswith("J")),
        "2",
    )

    if "K1" not in header_cells:
        header_row.append(build_text_cell("K1", header_style, shared_lookup["Current Status"]))
    if "L1" not in header_cells:
        header_row.append(build_text_cell("L1", header_style, shared_lookup["Follow-Up Date"]))
    header_row.set("spans", "1:12")

    data_row_limit = 499
    for row in rows[1:]:
        row_number = int(row.attrib["r"])
        if row_number > data_row_limit:
            continue

        cells = {cell.attrib["r"]: cell for cell in row.findall(f"{{{NS_MAIN}}}c")}
        title = cell_value(cells.get(f"A{row_number}", ET.Element("missing")), shared_strings).strip() if f"A{row_number}" in cells else ""
        response_status = cell_value(cells.get(f"E{row_number}", ET.Element("missing")), shared_strings) if f"E{row_number}" in cells else ""
        current_status = map_current_status(response_status) if title else ""

        if f"K{row_number}" not in cells:
            if current_status:
                row.append(build_text_cell(f"K{row_number}", body_style, shared_lookup[current_status]))
            else:
                row.append(ET.Element(f"{{{NS_MAIN}}}c", {"r": f"K{row_number}", "s": body_style}))

        if f"L{row_number}" not in cells:
            row.append(ET.Element(f"{{{NS_MAIN}}}c", {"r": f"L{row_number}", "s": body_style}))

        row[:] = sorted(
            list(row),
            key=lambda cell: col_to_num(CELL_REF_RE.match(cell.attrib["r"]).group(1)),
        )
        row.set("spans", "1:12")

    dimension = sheet_root.find(f"{{{NS_MAIN}}}dimension")
    if dimension is not None:
        dimension.set("ref", "A1:L502")

    table_root = ET.fromstring(workbook_files["xl/tables/table1.xml"])
    table_root.set("ref", "A1:L499")
    auto_filter = table_root.find(f"{{{NS_MAIN}}}autoFilter")
    if auto_filter is not None:
        auto_filter.set("ref", "A1:L499")

    table_columns = table_root.find(f"{{{NS_MAIN}}}tableColumns")
    if table_columns is None:
        raise SystemExit("Applications table is missing tableColumns")

    existing_names = {col.attrib.get("name") for col in table_columns.findall(f"{{{NS_MAIN}}}tableColumn")}
    if "Current Status" not in existing_names:
        table_columns.append(
            ET.Element(
                f"{{{NS_MAIN}}}tableColumn",
                {"id": "14", f"{{{NS_XR3}}}uid": "{00000000-0010-0000-0000-00000E000000}", "name": "Current Status"},
            )
        )
    if "Follow-Up Date" not in existing_names:
        table_columns.append(
            ET.Element(
                f"{{{NS_MAIN}}}tableColumn",
                {"id": "15", f"{{{NS_XR3}}}uid": "{00000000-0010-0000-0000-00000F000000}", "name": "Follow-Up Date"},
            )
        )
    table_columns.set("count", str(len(table_columns.findall(f"{{{NS_MAIN}}}tableColumn"))))

    workbook_files["xl/sharedStrings.xml"] = ET.tostring(shared_root, encoding="utf-8", xml_declaration=True)
    workbook_files["xl/worksheets/sheet1.xml"] = ET.tostring(sheet_root, encoding="utf-8", xml_declaration=True)
    workbook_files["xl/tables/table1.xml"] = ET.tostring(table_root, encoding="utf-8", xml_declaration=True)

    with zipfile.ZipFile(TARGET, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for name, data in workbook_files.items():
            zout.writestr(name, data)

    print(f"Created {TARGET}")


if __name__ == "__main__":
    main()
